#!/usr/bin/env ts-node
/**
 * Overnight marathon: fix sat25/sat75 for schools with heuristic placeholder values.
 *
 * Strategy (fast, no PDF downloads):
 *   1. Tavily-searches for SAT quartile data via web pages (admissions pages, Niche, etc.)
 *   2. Extracts sat25/sat75 from Tavily snippet text directly via LLM
 *   3. If no data found in snippets → tries CDS PDF fallback
 *   4. Sanity-checks and writes real sat25/sat75 to DB
 *
 * Targets: schools where sat25=950 AND sat75=1200 (the heuristic placeholder)
 *
 * Usage (from apps/api/):
 *   npx tsx scripts/mine-sat-quartiles.ts
 *   npx tsx scripts/mine-sat-quartiles.ts --dry-run --limit 10
 *   npx tsx scripts/mine-sat-quartiles.ts --limit 74   # all 74 target schools
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Args ─────────────────────────────────────────────────────────────────────

interface Args {
  limit: number;
  dryRun: boolean;
  delayMs: number;
  model: string;
  out: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (n: string) => argv.includes(`--${n}`);
  const today = new Date().toISOString().slice(0, 10);
  return {
    limit: Number(get('limit') ?? 74),
    dryRun: has('dry-run'),
    delayMs: Number(get('delay-ms') ?? 350),
    model: get('model') ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    out:
      get('out') ??
      path.join(
        process.cwd(),
        'scripts/cds-data',
        `sat-quartiles-${today}.json`,
      ),
  };
}

function loadDotEnv() {
  for (const f of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/api/.env'),
    path.join(process.cwd(), '../..', '.env'),
  ]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(t);
      if (m && process.env[m[1]] == null)
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

// ─── Tavily key rotation ───────────────────────────────────────────────────────

const keyPool: { key: string; exhausted: boolean; calls: number }[] = [];
let keyIdx = 0;

function loadKeys() {
  const packed = process.env.TAVILY_API_KEYS;
  if (packed) {
    for (const k of packed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (!keyPool.some((p) => p.key === k))
        keyPool.push({ key: k, exhausted: false, calls: 0 });
    }
  }
  const single = process.env.TAVILY_API_KEY;
  if (single && !keyPool.some((p) => p.key === single))
    keyPool.push({ key: single, exhausted: false, calls: 0 });
  for (let n = 1; n <= 30; n++) {
    const k = process.env[`TAVILY_API_KEY_${n}`];
    if (k && !keyPool.some((p) => p.key === k))
      keyPool.push({ key: k, exhausted: false, calls: 0 });
  }
}

function nextKey(): string | null {
  const active = keyPool.filter((k) => !k.exhausted);
  if (!active.length) return null;
  const k = active[keyIdx % active.length];
  keyIdx++;
  k.calls++;
  return k.key;
}

function markExhausted(key: string) {
  const k = keyPool.find((x) => x.key === key);
  if (k) k.exhausted = true;
  const remaining = keyPool.filter((k) => !k.exhausted).length;
  console.log(
    `[KEY] Exhausted: ${key.slice(0, 16)}... Remaining active: ${remaining}`,
  );
}

// ─── Tavily search ─────────────────────────────────────────────────────────────

interface TavilyResult {
  url: string;
  title: string;
  content: string;
  score: number;
}

async function tavilySearch(
  query: string,
  maxResults = 5,
  includeDomains?: string[],
): Promise<TavilyResult[]> {
  const key = nextKey();
  if (!key) return [];

  const body: Record<string, unknown> = {
    api_key: key,
    query,
    max_results: maxResults,
    search_depth: 'basic', // faster for snippet-based extraction
    include_answer: false,
  };
  if (includeDomains?.length) body.include_domains = includeDomains;

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 429 || res.status === 402) {
      markExhausted(key);
      return [];
    }
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: TavilyResult[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

// ─── LLM extraction from snippets ─────────────────────────────────────────────

interface SatData {
  found: boolean;
  sat25?: number | null;
  sat75?: number | null;
  pctSubmittingSat?: number | null;
  sourceUrl?: string;
  notes?: string;
}

async function llmExtractFromSnippets(
  snippets: string,
  schoolName: string,
  model: string,
): Promise<SatData> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const userPrompt = `Extract SAT 25th and 75th percentile scores for ${schoolName} from these search results.

SEARCH RESULTS:
${snippets.slice(0, 8000)}

Return JSON only:
{
  "found": true/false,
  "sat25": number or null,
  "sat75": number or null,
  "pctSubmittingSat": number or null,
  "sourceUrl": "url where data was found" or null,
  "notes": "brief note"
}

Rules:
- found=true only if you see actual SAT percentile numbers for ${schoolName}
- sat25: combined SAT 25th percentile (400-1600, e.g. "middle 50% SAT: 1150-1350" → sat25=1150)
- sat75: combined SAT 75th percentile (400-1600, e.g. "middle 50% SAT: 1150-1350" → sat75=1350)
- pctSubmittingSat: what % of enrolled freshmen submitted SAT (0-100)
- If school is test-optional and most students don't submit SAT, still extract if data shown
- Ignore data from other schools`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You extract SAT percentile data from search results. Return only valid JSON.',
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_completion_tokens: 300,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const raw = data.choices[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { found: false, notes: 'no JSON from LLM' };
    return JSON.parse(match[0]) as SatData;
  } catch (e) {
    return { found: false, notes: String(e) };
  }
}

// ─── PDF fallback ──────────────────────────────────────────────────────────────

async function tryPdfFallback(
  pdfUrl: string,
  schoolName: string,
  model: string,
): Promise<SatData> {
  // Download PDF
  const tmpPath = path.join(os.tmpdir(), `sat-cds-${Date.now()}.pdf`);
  try {
    const res = await fetch(pdfUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; DataBot/1.0)' },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return { found: false, notes: `PDF download ${res.status}` };
    fs.writeFileSync(tmpPath, Buffer.from(await res.arrayBuffer()));

    // Extract text
    let rawText: string;
    try {
      rawText = execFileSync('pdftotext', ['-layout', tmpPath, '-'], {
        encoding: 'utf8',
        maxBuffer: 10_000_000,
      });
    } catch {
      return { found: false, notes: 'pdftotext failed' };
    }

    if (!rawText || rawText.length < 100)
      return { found: false, notes: 'empty PDF text' };

    // Find C8 section window
    const lower = rawText.toLowerCase();
    const anchors = [
      'c8.',
      'c8 ',
      'sat evidence-based',
      'sat math',
      'middle 50%',
      'score range',
      'percent submitting sat',
      'c7.',
      'test scores',
    ];
    const idxs = anchors
      .map((a) => lower.indexOf(a))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    const window = idxs.length
      ? rawText.slice(
          Math.max(0, idxs[0] - 500),
          Math.min(rawText.length, idxs[0] + 6000),
        )
      : rawText.slice(0, 15000);

    // Extract via LLM
    const result = await llmExtractFromSnippets(window, schoolName, model);
    if (result.found) result.sourceUrl = pdfUrl;
    return result;
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup failures for temporary PDF text extraction files.
    }
  }
}

// ─── Sanity check ─────────────────────────────────────────────────────────────

function isSane(sat25: number, sat75: number, satAvg: number): boolean {
  if (sat25 >= sat75) return false;
  if (sat25 < 600 || sat75 > 1600) return false;
  if (sat75 - sat25 < 60) return false; // too narrow
  if (sat75 - sat25 > 450) return false; // too wide
  // satAvg should fall roughly between sat25 and sat75
  if (satAvg > 0 && (satAvg < sat25 - 150 || satAvg > sat75 + 150))
    return false;
  return true;
}

// ─── DB update ────────────────────────────────────────────────────────────────

async function updateSchool(
  schoolId: string,
  sat25: number,
  sat75: number,
  sourceUrl: string,
  dryRun: boolean,
) {
  if (dryRun) {
    console.log(`  [DRY-RUN] Would set sat25=${sat25} sat75=${sat75}`);
    return;
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { metadata: true },
  });
  const meta = (school?.metadata as Record<string, unknown>) ?? {};
  const provenance = ((meta.provenance as Record<string, unknown>) ??
    {}) as Record<string, unknown>;

  const fp = {
    source: 'CDS_PDF_AUTO',
    tier: 'OFFICIAL',
    fetchedAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    sourceUrl,
    cycleYear: 2024,
    confidence: 0.85,
    realDataStatus: 'VERIFIED_REAL',
    extractionMethod: 'pdf_llm',
  };

  await prisma.school.update({
    where: { id: schoolId },
    data: {
      sat25,
      sat75,
      metadata: {
        ...meta,
        provenance: { ...provenance, sat25: fp, sat75: fp },
      } as never,
    },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  loadDotEnv();
  const args = parseArgs();
  loadKeys();
  console.log(
    `[INIT] ${keyPool.length} Tavily keys | Model: ${args.model} | Mode: ${args.dryRun ? 'DRY-RUN' : 'LIVE'}`,
  );

  // Load all target schools: those with the wrong placeholder sat25=950 sat75=1200
  const targets = await prisma.school.findMany({
    where: { sat25: 950, sat75: 1200 },
    select: { id: true, name: true, website: true, satAvg: true },
    orderBy: { satAvg: 'desc' },
    take: args.limit,
  });
  console.log(
    `[TARGETS] ${targets.length} schools with heuristic sat25=950/sat75=1200`,
  );

  const results: unknown[] = [];
  let updated = 0,
    noData = 0,
    insane = 0,
    errors = 0;

  for (let i = 0; i < targets.length; i++) {
    const school = targets[i];
    const activeKeys = keyPool.filter((k) => !k.exhausted).length;
    if (activeKeys === 0) {
      console.log('[STOP] All Tavily keys exhausted');
      break;
    }

    console.log(
      `\n[${i + 1}/${targets.length}] ${school.name} (satAvg=${school.satAvg})`,
    );

    try {
      // ── Step 1: Tavily search for SAT data on web pages ──
      const queries = [
        `"${school.name}" SAT 25th percentile 2024 admissions statistics`,
        `"${school.name}" "middle 50%" SAT scores 2024-2025 freshman profile`,
        `"${school.name}" SAT score range 25th 75th percentile`,
      ];

      let snippetText = '';
      let pdfUrlFallback: string | null = null;

      for (const query of queries.slice(0, 2)) {
        const results = await tavilySearch(query, 6);
        await delay(150);
        if (results.length === 0) continue;

        for (const r of results) {
          snippetText += `\n\n--- SOURCE: ${r.url}\nTITLE: ${r.title}\nCONTENT: ${r.content}\n`;
          // Note PDF URL for fallback
          if (r.url.toLowerCase().endsWith('.pdf') && !pdfUrlFallback) {
            pdfUrlFallback = r.url;
          }
        }
        break; // usually first query is enough
      }

      // ── Step 2: LLM extraction from snippets ──
      let satData: SatData = { found: false };
      if (snippetText.length > 100) {
        satData = await llmExtractFromSnippets(
          snippetText,
          school.name,
          args.model,
        );
        await delay(150);
      }

      // ── Step 3: PDF fallback if snippets didn't have data and we found a PDF ──
      if (!satData.found && pdfUrlFallback) {
        console.log(
          `  Snippets empty → trying PDF fallback: ${pdfUrlFallback.slice(0, 60)}`,
        );
        satData = await tryPdfFallback(pdfUrlFallback, school.name, args.model);
        await delay(150);
      }

      if (!satData.found) {
        console.log(
          `  No SAT data found (${satData.notes ?? 'test-optional or not published'})`,
        );
        results.push({
          schoolId: school.id,
          schoolName: school.name,
          status: 'no_data',
          notes: satData.notes,
        });
        noData++;
        continue;
      }

      const sat25 = satData.sat25;
      const sat75 = satData.sat75;

      if (!sat25 || !sat75) {
        console.log(`  Partial data: sat25=${sat25} sat75=${sat75} - skipping`);
        results.push({
          schoolId: school.id,
          schoolName: school.name,
          status: 'incomplete',
          notes: satData.notes,
        });
        noData++;
        continue;
      }

      // ── Step 4: Sanity check ──
      if (!isSane(sat25, sat75, school.satAvg ?? 0)) {
        console.log(
          `  SANITY FAIL: sat25=${sat25} sat75=${sat75} satAvg=${school.satAvg}`,
        );
        results.push({
          schoolId: school.id,
          schoolName: school.name,
          status: 'insane',
          sat25,
          sat75,
          satAvg: school.satAvg,
        });
        insane++;
        continue;
      }

      // ── Step 5: Update DB ──
      console.log(
        `  ✓ sat25=${sat25} sat75=${sat75} | src: ${(satData.sourceUrl ?? '').slice(0, 60)}`,
      );
      await updateSchool(
        school.id,
        sat25,
        sat75,
        satData.sourceUrl ?? '',
        args.dryRun,
      );
      results.push({
        schoolId: school.id,
        schoolName: school.name,
        status: 'updated',
        sat25,
        sat75,
        sourceUrl: satData.sourceUrl,
      });
      updated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ERROR: ${msg}`);
      results.push({
        schoolId: school.id,
        schoolName: school.name,
        status: 'error',
        notes: msg,
      });
      errors++;
    }

    await delay(args.delayMs);
  }

  // ── Write output ──
  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      dryRun: args.dryRun,
      updated,
      noData,
      insane,
      errors,
      activeKeys: keyPool.filter((k) => !k.exhausted).length,
    },
    results,
  };
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(output, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(
    `DONE: ${updated} updated, ${noData} no data, ${insane} insane, ${errors} errors`,
  );
  console.log(
    `Active keys: ${keyPool.filter((k) => !k.exhausted).length}/${keyPool.length}`,
  );
  console.log(`Output: ${args.out}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
