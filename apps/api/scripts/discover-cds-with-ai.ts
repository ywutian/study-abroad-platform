#!/usr/bin/env ts-node
/**
 * AI-driven CDS URL discovery using OpenAI Responses API + web_search tool.
 *
 * For each school in the input registry, ask GPT-5.4 (with native web search)
 * to find the official Common Data Set URL. Returns whether it's PDF or HTML,
 * and a direct PDF link if discoverable from an HTML landing page.
 *
 * Why this beats Tavily search:
 *  - GPT-5.4 has training knowledge of institutional research office naming
 *    conventions; it can navigate from a CDS landing page to the actual PDF.
 *  - It opens pages, not just snippets — verifies the URL contains real CDS data.
 *  - Self-correcting: if first query fails, it tries reformulations.
 *
 * Cost: ~$0.04 per school (web search + reasoning).
 *
 * Usage:
 *   npx tsx apps/api/scripts/discover-cds-with-ai.ts \
 *     --input scripts/cds-data/top100-missing-all-2026-04-28.json \
 *     --out   scripts/cds-data/cds-discovered-by-ai-2026-04-28.json \
 *     --model gpt-5.4 \
 *     --concurrency 4
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface InputRow {
  schoolName: string;
  schoolNameNorm: string;
  website?: string | null;
  usNewsRank?: number;
}

interface AiResult {
  schoolNameNorm: string;
  selectedUrl: string | null;
  format: 'pdf' | 'html' | null;
  cycleYear: number | null;
  pdfFollowUrl: string | null;
  verified: boolean;
  notes?: string;
}

interface OutputRow extends AiResult {
  schoolId?: string;
  schoolName: string;
  sourceUrl: string;
}

function loadDotEnv() {
  for (const f of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/api/.env'),
  ]) {
    if (!fs.existsSync(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(t);
      if (!m || process.env[m[1]] != null) continue;
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function args() {
  const a = process.argv.slice(2);
  const get = (n: string) => {
    const i = a.indexOf(`--${n}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  return {
    input: get('input') ?? '',
    out: get('out') ?? '',
    model: get('model') ?? 'gpt-5.4',
    concurrency: Number(get('concurrency') ?? 4),
    limit: Number(get('limit') ?? 200),
  };
}

function buildPrompt(row: InputRow): string {
  const hint = row.website ? ` (school's main domain: ${row.website})` : '';
  return `Find the OFFICIAL Common Data Set (CDS) for ${row.schoolName}${hint}.

Goal: locate the most recent CDS available. Prefer 2024-25 (cycle 2024); fall back to 2025-26 (cycle 2025) or 2023-24 (cycle 2023).

Steps:
1. Search for the school's institutional research / institutional analytics / OIR / OIRA / IRDS office page that hosts CDS publications.
2. Verify the URL is on the school's own .edu domain (not collegetransitions.com, not nces.ed.gov, not commondataset.org, not gradgpt.com — those are aggregators, not official sources).
3. If the page contains a direct link to the CDS PDF file, extract that PDF URL.
4. If the school only publishes CDS as separate HTML sections (e.g. Harvard, Yale, Stanford, Pomona), use the HTML landing page URL.
5. If no CDS is published anywhere on the school's site for the cycles 2023, 2024, or 2025, return selectedUrl: null.

Return ONLY this JSON shape (no prose, no markdown):
{
  "schoolNameNorm": "${row.schoolNameNorm}",
  "selectedUrl": "<canonical URL — PDF preferred, HTML acceptable as fallback>" | null,
  "format": "pdf" | "html" | null,
  "cycleYear": 2024 | 2025 | 2023 | null,
  "pdfFollowUrl": "<direct PDF URL extracted from an HTML landing page, if any>" | null,
  "verified": <true if you opened the URL and confirmed it contains CDS data; false otherwise>,
  "notes": "<one-sentence rationale>"
}`;
}

interface OpenAiResponse {
  status: string;
  output?: Array<{
    type: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
  error?: { message: string };
}

async function callOpenAi(
  prompt: string,
  model: string,
): Promise<AiResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY required');
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';

  const r = await fetch(`${baseUrl.replace(/\/$/, '')}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search' }],
      input: prompt,
    }),
  });
  const body = await r.text();
  if (!r.ok)
    throw new Error(`OpenAI failed ${r.status}: ${body.slice(0, 300)}`);
  const data = JSON.parse(body) as OpenAiResponse;
  if (data.status !== 'completed') return null;

  // Find last message content
  for (const o of data.output ?? []) {
    if (o.type === 'message' && o.content) {
      for (const c of o.content) {
        if (c.type === 'output_text' && c.text) {
          // Parse JSON in the text
          const start = c.text.indexOf('{');
          const end = c.text.lastIndexOf('}');
          if (start >= 0 && end > start) {
            try {
              return JSON.parse(c.text.slice(start, end + 1));
            } catch {
              return null;
            }
          }
        }
      }
    }
  }
  return null;
}

async function processSchool(
  row: InputRow,
  model: string,
): Promise<OutputRow | null> {
  try {
    const result = await callOpenAi(buildPrompt(row), model);
    if (!result || !result.selectedUrl) {
      console.log(`miss  ${row.schoolName}: ${result?.notes ?? 'no result'}`);
      return null;
    }
    const out: OutputRow = {
      schoolName: row.schoolName,
      schoolNameNorm: row.schoolNameNorm,
      sourceUrl: result.selectedUrl,
      selectedUrl: result.selectedUrl,
      format: result.format,
      cycleYear: result.cycleYear,
      pdfFollowUrl: result.pdfFollowUrl,
      verified: result.verified,
      notes: result.notes,
    };
    const tag = result.format === 'pdf' ? '📄' : '🌐';
    console.log(
      `${tag} ${row.schoolName}: ${result.selectedUrl.slice(0, 80)} (cycle ${result.cycleYear})`,
    );
    return out;
  } catch (e) {
    console.error(
      `err   ${row.schoolName}: ${e instanceof Error ? e.message.slice(0, 100) : ''}`,
    );
    return null;
  }
}

async function main() {
  loadDotEnv();
  const a = args();
  if (!a.input || !a.out) throw new Error('--input and --out required');

  const raw = JSON.parse(fs.readFileSync(a.input, 'utf8'));
  const rows: InputRow[] = (raw.schools ?? raw).slice(0, a.limit);
  console.log(
    `Discovering CDS URLs for ${rows.length} schools using ${a.model} + web_search`,
  );

  const results: OutputRow[] = [];
  // Process in chunks of `concurrency`
  for (let i = 0; i < rows.length; i += a.concurrency) {
    const batch = rows.slice(i, i + a.concurrency);
    const batchResults = await Promise.all(
      batch.map((r) => processSchool(r, a.model)),
    );
    for (const r of batchResults) if (r) results.push(r);
  }

  const out = {
    _meta: {
      generatedAt: new Date().toISOString(),
      model: a.model,
      source: 'OpenAI Responses API + web_search tool',
      scanned: rows.length,
      hits: results.length,
    },
    schools: results,
  };
  fs.mkdirSync(path.dirname(a.out), { recursive: true });
  fs.writeFileSync(a.out, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { out: a.out, scanned: rows.length, hits: results.length },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
