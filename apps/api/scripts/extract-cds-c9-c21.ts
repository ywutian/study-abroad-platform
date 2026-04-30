#!/usr/bin/env ts-node
/**
 * Extracts CDS Section C9 (freshman GPA distribution) + C21 (ED/EA admit rates)
 * from the same PDF in a single LLM call to amortize cost.
 *
 * Input:  same registry as extract-cds-c1.ts (schools[].selectedUrl)
 * Output: { schools: [{ schoolNameNorm, gpaDistribution, edAcceptanceRate,
 *           eaAcceptanceRate, sourceUrl, cycleYear }] }
 *
 * Then feed into load-cds-c9-c21.ts to write to School.gpaDistribution / .edAcceptanceRate / .eaAcceptanceRate.
 *
 * Usage:
 *   npx tsx apps/api/scripts/extract-cds-c9-c21.ts \
 *     --input scripts/cds-data/cds-pdf-registry-recovered-2026-04-28.json \
 *     --out   scripts/cds-data/cds-c9c21-2026-04-28.json \
 *     --model gpt-5.4-mini
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

type RegistryRow = {
  schoolName?: string;
  schoolNameNorm: string;
  selectedUrl?: string | null;
  sourceUrl?: string | null;
};

type GpaDistribution = Record<string, number>; // band → fraction (0..1)

type Extracted = {
  found?: boolean;
  gpaDistribution?: GpaDistribution | null;
  edApplied?: number | null;
  edAdmitted?: number | null;
  eaApplied?: number | null;
  eaAdmitted?: number | null;
  notes?: string;
  confidence?: number;
};

type OutputRow = {
  schoolNameNorm: string;
  cycleYear: number;
  sourceUrl: string;
  gpaDistribution: GpaDistribution | null;
  edAcceptanceRate: number | null;
  eaAcceptanceRate: number | null;
  edApplied: number | null;
  edAdmitted: number | null;
  eaApplied: number | null;
  eaAdmitted: number | null;
  notes?: string;
};

function loadDotEnv() {
  for (const file of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/api/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!m || process.env[m[1]] != null) continue;
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    input: get('input') ?? '',
    out: get('out') ?? '',
    cycleYear: Number(get('cycle-year') ?? 2024),
    limit: Number(get('limit') ?? 200),
    model: get('model') ?? process.env.OPENAI_MODEL ?? 'gpt-5.4-mini',
  };
}

function parseRows(input: string): RegistryRow[] {
  const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
  const rows = Array.isArray(raw) ? raw : raw.schools;
  if (!Array.isArray(rows)) throw new Error(`No schools[] array in ${input}`);
  return rows
    .map((r: RegistryRow) => ({
      ...r,
      selectedUrl: r.selectedUrl ?? r.sourceUrl ?? null,
    }))
    .filter((r: RegistryRow) => r.schoolNameNorm && r.selectedUrl);
}

async function download(url: string, dest: string) {
  // Derive a plausible Referer from the URL's origin (helps with hotlink-protected servers)
  let referer: string | undefined;
  try {
    const u = new URL(url);
    referer = `${u.protocol}//${u.host}/`;
  } catch (_e) {
    // ignore invalid URLs
  }
  const r = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      ...(referer ? { referer } : {}),
    },
  });
  if (!r.ok) throw new Error(`Download failed ${r.status}: ${url}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

function pdfToText(p: string) {
  return execFileSync('pdftotext', ['-layout', p, '-'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function relevantWindow(text: string): string {
  // Capture C9 (Profile of Admission/Freshman) and C21 (Early Decision) sections
  const lower = text.toLowerCase();
  const anchors = [
    'c9.',
    'c9 ',
    'high school grade-point',
    'high school gpa',
    'percent of all enrolled',
    'percent of all degree-seeking',
    'c21.',
    'c21 ',
    'early decision',
    'restrictive early action',
    'early action',
  ];
  const indexes = anchors
    .map((a) => lower.indexOf(a))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  if (indexes.length === 0) {
    // Fallback: first 30K chars
    return text.slice(0, 30000);
  }
  // Build a window that spans from first to last anchor + buffer
  const start = Math.max(0, indexes[0] - 1500);
  const end = Math.min(text.length, indexes[indexes.length - 1] + 6000);
  return text.slice(start, end);
}

function extractJson(text: string): Extracted {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start)
    throw new Error(`LLM did not return JSON: ${text.slice(0, 200)}`);
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callOpenAi(
  schoolName: string,
  sourceUrl: string,
  text: string,
  model: string,
): Promise<Extracted> {
  const { callLlm } = await import('./lib/llm-call');
  const userPrompt = `Extract Common Data Set Sections C9 (freshman class profile — high school GPA distribution) AND C21 (Early Decision/Early Action breakdown) from the PDF text for ${schoolName}.

Return ONLY this JSON shape (no prose, no markdown):
{
  "found": true,
  "gpaDistribution": {
    "3.75-4.00": <fraction 0..1>,
    "3.50-3.74": <fraction 0..1>,
    "3.25-3.49": <fraction 0..1>,
    "3.00-3.24": <fraction 0..1>,
    "<3.00": <fraction 0..1>
  } | null,
  "edApplied": <number> | null,
  "edAdmitted": <number> | null,
  "eaApplied": <number> | null,
  "eaAdmitted": <number> | null,
  "notes": "<string>",
  "confidence": <0..1>
}

Rules for C9:
- Look for table titled "Percent of all enrolled, degree-seeking, first-time, first-year (freshman) students who had high school grade-point averages within each of the following ranges"
- Convert percentages to fractions (50% → 0.50)
- Schools may use slightly different bands (e.g. "3.75 and higher", "3.50-3.74"); map to the canonical 5 bands above
- If C9 omits GPA breakdown (some schools say "school does not report"), set "gpaDistribution": null

Rules for C21:
- Look for table "Early Decision and Early Action plans" with applicants/admitted/enrolled by round
- "edApplied" = total Early Decision applicants (ED I + ED II combined if both reported)
- "edAdmitted" = total Early Decision admits
- "eaApplied" / "eaAdmitted" = same for Early Action / Restrictive Early Action / Single Choice EA
- If a category is absent, set null. Do not guess.
- Do not include RD or rolling counts here.

Source URL: ${sourceUrl}

PDF text:
${text}`;

  return await callLlm<Extracted>({
    model,
    systemPrompt:
      'You extract official college admissions tables into strict JSON. Return no prose.',
    userPrompt,
    maxOutputTokens: 1024,
  });
}

function buildOutputRow(
  row: RegistryRow,
  sourceUrl: string,
  cycleYear: number,
  e: Extracted,
): OutputRow {
  const edRate =
    e.edApplied != null && e.edAdmitted != null && e.edApplied > 0
      ? Math.round((e.edAdmitted / e.edApplied) * 10000) / 100
      : null;
  const eaRate =
    e.eaApplied != null && e.eaAdmitted != null && e.eaApplied > 0
      ? Math.round((e.eaAdmitted / e.eaApplied) * 10000) / 100
      : null;
  // Validate gpa distribution sums to ~1.0 (allow 5% slack)
  let gpaDist = e.gpaDistribution ?? null;
  if (gpaDist) {
    const sum = Object.values(gpaDist).reduce(
      (a, b) => a + (Number(b) || 0),
      0,
    );
    if (sum < 0.85 || sum > 1.15) gpaDist = null; // suspect, drop
  }
  return {
    schoolNameNorm: row.schoolNameNorm,
    cycleYear,
    sourceUrl,
    gpaDistribution: gpaDist,
    edAcceptanceRate: edRate,
    eaAcceptanceRate: eaRate,
    edApplied: e.edApplied ?? null,
    edAdmitted: e.edAdmitted ?? null,
    eaApplied: e.eaApplied ?? null,
    eaAdmitted: e.eaAdmitted ?? null,
    notes: e.notes,
  };
}

async function main() {
  loadDotEnv();
  const args = parseArgs();
  if (!args.input || !args.out) {
    throw new Error('--input and --out are required');
  }
  const rows = parseRows(args.input).slice(0, args.limit);
  const output: OutputRow[] = [];
  const failures: Array<{
    schoolNameNorm: string;
    sourceUrl: string;
    error: string;
  }> = [];

  for (const row of rows) {
    const sourceUrl = row.selectedUrl as string;
    const tmp = path.join(
      os.tmpdir(),
      `cds-c9c21-${row.schoolNameNorm.replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}.pdf`,
    );
    try {
      await download(sourceUrl, tmp);
      const fullText = pdfToText(tmp);
      const window = relevantWindow(fullText);
      const extracted = await callOpenAi(
        row.schoolName ?? row.schoolNameNorm,
        sourceUrl,
        window,
        args.model,
      );
      const r = buildOutputRow(row, sourceUrl, args.cycleYear, extracted);
      output.push(r);
      const gpaOk = r.gpaDistribution ? '✓' : '·';
      const edOk = r.edAcceptanceRate != null ? '✓' : '·';
      const eaOk = r.eaAcceptanceRate != null ? '✓' : '·';
      console.log(
        `${row.schoolName ?? row.schoolNameNorm}: gpa=${gpaOk} ed=${edOk}(${r.edAcceptanceRate ?? 'null'}%) ea=${eaOk}(${r.eaAcceptanceRate ?? 'null'}%)`,
      );
    } catch (error) {
      failures.push({
        schoolNameNorm: row.schoolNameNorm,
        sourceUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`${row.schoolName ?? row.schoolNameNorm}: failed`);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  const out = {
    _meta: {
      extractedAt: new Date().toISOString(),
      source: 'CDS C9 (GPA distribution) + C21 (ED/EA) via LLM',
      model: args.model,
      input: args.input,
      success: output.length,
      failures: failures.length,
    },
    schools: output,
    failures,
  };
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { out: args.out, success: output.length, failures: failures.length },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
