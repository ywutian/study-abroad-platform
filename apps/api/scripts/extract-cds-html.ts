#!/usr/bin/env ts-node
/**
 * Extract CDS data from HTML landing pages (used by HYPSM-tier schools that
 * publish CDS as HTML rather than PDF).
 *
 * Strategy:
 *  1. Fetch HTML page
 *  2. cheerio: collect all <table>, <pre>, <ul>, plus visible body text
 *     (truncated to 30K chars to fit LLM context)
 *  3. LLM extracts C1 (residency rates), C9 (GPA distribution), C21 (ED/EA)
 *     in a single call — same JSON shape as PDF extractors
 *  4. Output: { schools: [{ ..C1.. , ..C9.. , ..C21.. }] }
 *
 * Note: Some HTML CDS pages link out to underlying PDFs/Excel files. This
 * script handles both: if the page contains a strong PDF link to a CDS file,
 * we record the link in `_meta.pdfFollowUrl` so the caller can re-feed it
 * into extract-cds-c1 / c9-c21 for higher fidelity.
 *
 * Usage:
 *   npx tsx apps/api/scripts/extract-cds-html.ts \
 *     --input scripts/cds-data/hardcoded-html-cds-urls.json \
 *     --out   scripts/cds-data/cds-html-2026-04-28.json \
 *     --model gpt-5.4-mini
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cheerio from 'cheerio';

interface InputRow {
  schoolName: string;
  schoolNameNorm: string;
  selectedUrl: string;
  cycleYear?: number;
}

interface OutputRow {
  schoolNameNorm: string;
  schoolName: string;
  cycleYear: number;
  sourceUrl: string;
  kind: 'html';
  // C1 fields
  rates: {
    acceptanceRate: number | null;
    intlAcceptanceRate: number | null;
    oosAcceptanceRate: number | null;
    transferAcceptanceRate: null;
  };
  // C9 fields
  gpaDistribution: Record<string, number> | null;
  // C21 fields
  edAcceptanceRate: number | null;
  eaAcceptanceRate: number | null;
  edApplied: number | null;
  edAdmitted: number | null;
  eaApplied: number | null;
  eaAdmitted: number | null;
  // Provenance
  notes?: string;
  pdfFollowUrl?: string;
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
    model: get('model') ?? process.env.OPENAI_MODEL ?? 'gpt-5.4-mini',
    limit: Number(get('limit') ?? 200),
  };
}

async function fetchHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; LumniDataBot/1.0; +https://lumni.app)',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(`HTML fetch failed ${r.status}: ${url}`);
  return await r.text();
}

interface ExtractedContent {
  text: string; // condensed page text
  pdfLinks: string[]; // PDF URLs found on the page
}

function extractPageContent(html: string, baseUrl: string): ExtractedContent {
  const $ = cheerio.load(html);
  // Drop nav/footer/script
  $('script, style, nav, header, footer, aside').remove();

  // Collect tables as TSV-like text (preserves cell structure for LLM)
  const tableTexts: string[] = [];
  $('table').each((_, t) => {
    const rows: string[] = [];
    $(t)
      .find('tr')
      .each((_, tr) => {
        const cells = $(tr)
          .find('th,td')
          .map((_, c) => $(c).text().replace(/\s+/g, ' ').trim())
          .get();
        if (cells.length > 0) rows.push(cells.join(' | '));
      });
    if (rows.length > 0) tableTexts.push(rows.join('\n'));
  });

  // Collect visible body text
  const bodyText = $('body')
    .text()
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[\t ]{2,}/g, ' ');

  // Find PDF links (likely linked CDS files)
  const pdfLinks: string[] = [];
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (
      /\.pdf(\?|$)/i.test(href) &&
      /(cds|common.?data.?set|c1|c9|c21)/i.test(href + ' ' + $(a).text())
    ) {
      try {
        pdfLinks.push(new URL(href, baseUrl).toString());
      } catch (_) {
        // invalid URL, skip
      }
    }
  });

  // Combine: tables first (most structured), then body
  const combined = [
    '=== TABLES ===',
    tableTexts.slice(0, 30).join('\n\n---\n\n'),
    '=== BODY TEXT ===',
    bodyText.slice(0, 25000),
  ].join('\n\n');

  return {
    text: combined.slice(0, 30000),
    pdfLinks: [...new Set(pdfLinks)].slice(0, 5),
  };
}

interface LlmExtracted {
  rates?: {
    acceptanceRate?: number | null;
    intlAcceptanceRate?: number | null;
    oosAcceptanceRate?: number | null;
  };
  gpaDistribution?: Record<string, number> | null;
  edApplied?: number | null;
  edAdmitted?: number | null;
  eaApplied?: number | null;
  eaAdmitted?: number | null;
  notes?: string;
}

async function callLlm(
  schoolName: string,
  sourceUrl: string,
  content: string,
  model: string,
): Promise<LlmExtracted> {
  const { callLlm: unifiedCall } = await import('./lib/llm-call.js');

  const userPrompt = `Extract Common Data Set data from this HTML page for ${schoolName}.

Return ONLY this JSON (no prose):
{
  "rates": {
    "acceptanceRate": <fraction 0..1 or percent | null>,
    "intlAcceptanceRate": <fraction 0..1 or percent | null>,
    "oosAcceptanceRate": <fraction 0..1 or percent | null>
  },
  "gpaDistribution": {
    "3.75-4.00": <fraction 0..1>,
    "3.50-3.74": <fraction 0..1>,
    "3.25-3.49": <fraction 0..1>,
    "3.00-3.24": <fraction 0..1>,
    "<3.00": <fraction 0..1>
  } | null,
  "edApplied": <number | null>,
  "edAdmitted": <number | null>,
  "eaApplied": <number | null>,
  "eaAdmitted": <number | null>,
  "notes": "<string>"
}

Rules:
- C1: extract from "First-time, first-year admission" applicants/admitted by residency. Express rates as percent (0-100) or fraction; we will normalize.
- C9: high school GPA distribution of enrolled freshmen. Map school's reported bands to canonical 5 bands. If band not reported, set null.
- C21: ED/EA applicants and admitted counts. Do not include RD.
- The data may be in tables or paragraph text. If a value is absent, return null. Do NOT guess.

Source: ${sourceUrl}

HTML content:
${content}`;

  return await unifiedCall<LlmExtracted>({
    model,
    systemPrompt:
      'You extract official college admissions data from HTML into strict JSON. Return no prose.',
    userPrompt,
    maxOutputTokens: 1024,
  });
}

function normalizeRate(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v) || v < 0) return null;
  // Accept either fraction (0.04) or percent (4.0); normalize to percent 0-100
  if (v <= 1) v = v * 100;
  if (v > 100) return null;
  return Math.round(v * 100) / 100;
}

function buildOutputRow(
  input: InputRow,
  extracted: LlmExtracted,
  pdfLinks: string[],
): OutputRow {
  let gpaDist = extracted.gpaDistribution ?? null;
  if (gpaDist) {
    const sum = Object.values(gpaDist).reduce(
      (a, b) => a + (Number(b) || 0),
      0,
    );
    if (sum < 0.85 || sum > 1.15) gpaDist = null;
  }
  const edApplied = extracted.edApplied ?? null;
  const edAdmitted = extracted.edAdmitted ?? null;
  const eaApplied = extracted.eaApplied ?? null;
  const eaAdmitted = extracted.eaAdmitted ?? null;
  const edRate =
    edApplied != null && edAdmitted != null && edApplied > 0
      ? Math.round((edAdmitted / edApplied) * 10000) / 100
      : null;
  const eaRate =
    eaApplied != null && eaAdmitted != null && eaApplied > 0
      ? Math.round((eaAdmitted / eaApplied) * 10000) / 100
      : null;

  return {
    schoolNameNorm: input.schoolNameNorm,
    schoolName: input.schoolName,
    cycleYear: input.cycleYear ?? 2024,
    sourceUrl: input.selectedUrl,
    kind: 'html',
    rates: {
      acceptanceRate: normalizeRate(extracted.rates?.acceptanceRate),
      intlAcceptanceRate: normalizeRate(extracted.rates?.intlAcceptanceRate),
      oosAcceptanceRate: normalizeRate(extracted.rates?.oosAcceptanceRate),
      transferAcceptanceRate: null,
    },
    gpaDistribution: gpaDist,
    edAcceptanceRate: edRate,
    eaAcceptanceRate: eaRate,
    edApplied,
    edAdmitted,
    eaApplied,
    eaAdmitted,
    notes: extracted.notes,
    pdfFollowUrl: pdfLinks[0],
  };
}

async function main() {
  loadDotEnv();
  const a = args();
  if (!a.input || !a.out) throw new Error('--input and --out required');
  const raw = JSON.parse(fs.readFileSync(a.input, 'utf8'));
  const rows: InputRow[] = (raw.schools ?? raw).slice(0, a.limit);

  const out: OutputRow[] = [];
  const failures: Array<{
    schoolNameNorm: string;
    sourceUrl: string;
    error: string;
  }> = [];

  for (const row of rows) {
    try {
      const html = await fetchHtml(row.selectedUrl);
      const content = extractPageContent(html, row.selectedUrl);
      const extracted = await callLlm(
        row.schoolName,
        row.selectedUrl,
        content.text,
        a.model,
      );
      const r = buildOutputRow(row, extracted, content.pdfLinks);
      out.push(r);
      const tags = [
        r.rates.acceptanceRate != null ? `c1=${r.rates.acceptanceRate}%` : null,
        r.rates.intlAcceptanceRate != null
          ? `intl=${r.rates.intlAcceptanceRate}%`
          : null,
        r.gpaDistribution ? 'gpa✓' : null,
        r.edAcceptanceRate != null ? `ed=${r.edAcceptanceRate}%` : null,
        r.pdfFollowUrl ? `pdf-link✓` : null,
      ]
        .filter(Boolean)
        .join(' ');
      console.log(`${row.schoolName}: ${tags || '(no data)'}`);
    } catch (error) {
      failures.push({
        schoolNameNorm: row.schoolNameNorm,
        sourceUrl: row.selectedUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(
        `${row.schoolName}: failed - ${error instanceof Error ? error.message.slice(0, 100) : ''}`,
      );
    }
  }

  const file = {
    _meta: {
      extractedAt: new Date().toISOString(),
      source: 'HTML CDS landing pages (HYPSM-tier schools)',
      model: a.model,
      success: out.length,
      failures: failures.length,
    },
    schools: out,
    failures,
  };
  fs.mkdirSync(path.dirname(a.out), { recursive: true });
  fs.writeFileSync(a.out, `${JSON.stringify(file, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { out: a.out, success: out.length, failures: failures.length },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
