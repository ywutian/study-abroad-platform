#!/usr/bin/env ts-node
/**
 * Focused re-extract: LLM gets a tighter prompt asking ONLY for residency table.
 * Many earlier extracts returned overall=X intl=null because the LLM was busy
 * extracting C9/C11/C21 too and missed the residency rows. This pass focuses
 * the LLM on a single output: the C1 residency breakdown.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

function loadDotEnv() {
  for (const f of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/api/.env'),
  ]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(t);
      if (!m || process.env[m[1]] != null) continue;
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}
loadDotEnv();
const prisma = new PrismaClient();

interface Counts {
  total?: number | null;
  inState?: number | null;
  outOfState?: number | null;
  international?: number | null;
}
interface Extracted {
  applicants?: Counts;
  admitted?: Counts;
  intlAdmitRate?: number;
  oosAdmitRate?: number;
  notes?: string;
}

async function downloadPdf(url: string, dest: string) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (study-abroad-platform; +https://github.com/ywutian/study-abroad-platform)',
    },
  });
  if (!r.ok) throw new Error(`Download ${r.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

function pdfToText(p: string) {
  return execFileSync('pdftotext', ['-layout', p, '-'], {
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
}

async function callLlm(schoolName: string, sourceUrl: string, text: string) {
  const { callLlm } = await import('./lib/llm-call');
  const userPrompt = `From the Common Data Set PDF text below, extract ONLY the C1 residency breakdown for ${schoolName}.

You are looking for a small section with rows like:
  In-State        12,345    1,234     567
  Out-of-State    20,000    2,000     800
  Foreign         5,000      500      150

Return JSON in this exact shape:
{
  "applicants": {"total": number|null, "inState": number|null, "outOfState": number|null, "international": number|null},
  "admitted": {"total": number|null, "inState": number|null, "outOfState": number|null, "international": number|null},
  "intlAdmitRate": number|null,
  "oosAdmitRate": number|null,
  "notes": "brief explanation"
}

CRITICAL:
- Look for keywords: "in-state", "out-of-state", "foreign", "international", "non-resident", "alien", "resident"
- The C1 section appears within the first ~10 pages
- If you find applicants and admits per residency, ALSO compute the rates: intlAdmitRate = intl_admitted / intl_applicants × 100
- If the document does not break down by residency at all, return all null.
- Source URL: ${sourceUrl}

PDF text (first 30,000 chars):
${text.slice(0, 30000)}`;

  return await callLlm<Extracted>({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    systemPrompt:
      'You extract residency-level admissions tables into strict JSON. Return only the JSON object.',
    userPrompt,
    maxOutputTokens: 600,
  });
}

async function main() {
  // Find schools where intl is heuristic AND we have a known URL
  const us = ['US', 'United States', 'United States of America'];
  const schools = await prisma.school.findMany({
    where: { country: { in: us } },
    select: {
      nameNorm: true,
      name: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      metadata: true,
    },
  });
  // Build set of schools that need data
  const needsData = new Set<string>();
  for (const s of schools) {
    const meta = (s.metadata as any) ?? {};
    const intlProv = meta.provenance?.intlAcceptanceRate;
    const oosProv = meta.provenance?.oosAcceptanceRate;
    if (intlProv?.permanent || oosProv?.permanent) continue;
    const intlIsHeur =
      !s.intlAcceptanceRate ||
      intlProv?.tier === 'INFERRED' ||
      (typeof intlProv?.source === 'string' &&
        intlProv.source.toUpperCase().includes('HEURISTIC'));
    if (intlIsHeur) needsData.add(s.nameNorm);
  }
  console.log(`Schools still on heuristic intl: ${needsData.size}`);

  // Load best URL per school from collected bundle
  let bundle: any = null;
  const bundlePaths = [
    'scripts/cds-data/cds-known-urls-bundle-2026-04-28.json',
    'apps/api/scripts/cds-data/cds-known-urls-bundle-2026-04-28.json',
  ];
  for (const p of bundlePaths) {
    try {
      bundle = JSON.parse(fs.readFileSync(p, 'utf8'));
      break;
    } catch {
      /* try next */
    }
  }
  if (!bundle) {
    console.log('No known URL bundle found; cannot proceed');
    process.exit(1);
  }
  const targets = (bundle.schools || []).filter(
    (s: any) => needsData.has(s.schoolNameNorm) && s.selectedUrl,
  );
  console.log(`Targets with known URL: ${targets.length}`);

  const limit = Number(
    process.argv[process.argv.indexOf('--limit') + 1] ?? targets.length,
  );
  const work = targets.slice(0, limit);

  const results = [];
  let success = 0;
  let intlYielded = 0;
  for (const t of work) {
    const tmp = path.join(
      os.tmpdir(),
      `cds-resi-${t.schoolNameNorm.replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}.pdf`,
    );
    try {
      await downloadPdf(t.selectedUrl, tmp);
      const text = pdfToText(tmp);
      const ex = await callLlm(t.schoolName, t.selectedUrl, text);
      // Compute rates from counts if needed
      let intlRate = ex.intlAdmitRate ?? null;
      let oosRate = ex.oosAdmitRate ?? null;
      if (
        intlRate == null &&
        ex.applicants?.international &&
        ex.admitted?.international
      ) {
        intlRate =
          (ex.admitted.international / ex.applicants.international) * 100;
      }
      if (
        oosRate == null &&
        ex.applicants?.outOfState &&
        ex.admitted?.outOfState
      ) {
        oosRate = (ex.admitted.outOfState / ex.applicants.outOfState) * 100;
      }
      let acceptanceRate: number | null = null;
      if (ex.applicants?.total && ex.admitted?.total) {
        acceptanceRate = (ex.admitted.total / ex.applicants.total) * 100;
      }
      const valid =
        (intlRate != null && intlRate > 0 && intlRate <= 100) ||
        (oosRate != null && oosRate > 0 && oosRate <= 100);
      if (valid) {
        intlYielded++;
        results.push({
          schoolNameNorm: t.schoolNameNorm,
          schoolName: t.schoolName,
          cycleYear: 2024,
          sourceUrl: t.selectedUrl,
          rates: {
            acceptanceRate:
              acceptanceRate != null
                ? Math.round(acceptanceRate * 100) / 100
                : null,
            intlAcceptanceRate:
              intlRate != null ? Math.round(intlRate * 100) / 100 : null,
            oosAcceptanceRate:
              oosRate != null ? Math.round(oosRate * 100) / 100 : null,
          },
          notes: ex.notes,
        });
        console.log(
          `✓ ${t.schoolName}: intl=${intlRate?.toFixed(2)}% oos=${oosRate?.toFixed(2)}%`,
        );
      } else {
        console.log(`· ${t.schoolName}: no residency in PDF`);
      }
      success++;
    } catch (e) {
      console.log(`✗ ${t.schoolName}: ${(e as Error).message.slice(0, 80)}`);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  const out = {
    _meta: {
      extractedAt: new Date().toISOString(),
      source:
        'extract-cds-residency-only.ts: focused LLM prompt on C1 residency only',
      success,
      intlYielded,
      attempted: work.length,
    },
    schools: results,
  };
  const outPath = path.join(
    process.cwd(),
    'scripts/cds-data/cds-residency-focused-2026-04-28.json',
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(
    `\nDone. Attempted ${work.length}, success ${success}, intl yielded ${intlYielded}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
