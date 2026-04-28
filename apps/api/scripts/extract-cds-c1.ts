#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

type RegistryRow = {
  schoolId?: string;
  schoolName?: string;
  schoolNameNorm: string;
  selectedUrl?: string | null;
  sourceUrl?: string | null;
  candidates?: Array<{ url: string; score?: number }>;
};

type ExtractedC1 = {
  found?: boolean;
  applicants?: Counts;
  admitted?: Counts;
  enrolled?: Counts;
  notes?: string;
  confidence?: number;
};

type Counts = {
  total?: number | null;
  inState?: number | null;
  outOfState?: number | null;
  international?: number | null;
};

type CdsOutputRow = {
  schoolNameNorm: string;
  cycleYear: number;
  sourceUrl: string;
  applicants: Counts;
  admitted: Counts;
  enrolled: Counts;
  rates: {
    acceptanceRate: number | null;
    intlAcceptanceRate: number | null;
    oosAcceptanceRate: number | null;
    transferAcceptanceRate: null;
  };
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
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match || process.env[match[1]] != null) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  const today = new Date().toISOString().slice(0, 10);
  return {
    input:
      get('input') ??
      path.join(
        process.cwd(),
        'scripts/cds-data',
        `cds-pdf-registry-${today}.json`,
      ),
    out:
      get('out') ??
      path.join(
        process.cwd(),
        'scripts/cds-data',
        `cds-2024-25-llm-extracted-${today}.json`,
      ),
    cycleYear: Number(get('cycle-year') ?? 2024),
    limit: Number(get('limit') ?? 80),
    model: get('model') ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    requireIntl: !has('allow-no-intl'),
  };
}

function parseRows(input: string): RegistryRow[] {
  const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
  const rows = Array.isArray(raw) ? raw : raw.schools;
  if (!Array.isArray(rows)) {
    throw new Error(`No schools[] array found in ${input}`);
  }
  return rows
    .map((row: RegistryRow) => ({
      ...row,
      selectedUrl:
        row.selectedUrl ??
        row.sourceUrl ??
        row.candidates?.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
          ?.url ??
        null,
    }))
    .filter((row: RegistryRow) => row.schoolNameNorm && row.selectedUrl);
}

function pct(numerator?: number | null, denominator?: number | null) {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function cleanCount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number')
    return Number.isFinite(value) ? Math.round(value) : null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function normalizeCounts(counts: Counts | undefined): Counts {
  return {
    total: cleanCount(counts?.total),
    inState: cleanCount(counts?.inState),
    outOfState: cleanCount(counts?.outOfState),
    international: cleanCount(counts?.international),
  };
}

async function download(url: string, dest: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; StudyAbroadDataBot/1.0; +https://studyabroad.app)',
    },
  });
  if (!response.ok) {
    throw new Error(`Download failed ${response.status}: ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(dest, buffer);
}

function pdfToText(pdfPath: string) {
  return execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function c1Window(text: string) {
  const lower = text.toLowerCase();
  const strongAnchors = [
    'c. first-time, first-year admission',
    'c. first-time first-year admission',
    'c1-c2: applications',
    'first-time, first-year student applicants',
  ];
  const strongIndexes = strongAnchors
    .map((anchor) => lower.indexOf(anchor))
    .filter((index) => index >= 0);
  if (strongIndexes.length > 0) {
    const start = Math.max(0, Math.min(...strongIndexes) - 1500);
    return text.slice(start, start + 16000);
  }
  const weakAnchors = [
    'c1. first-time',
    'c1 first-time',
    'first-time, first-year',
    'first-time first-year',
    'degree-seeking undergraduates',
  ];
  const indexes = weakAnchors
    .map((anchor) => lower.indexOf(anchor))
    .filter((index) => index >= 0);
  const start =
    indexes.length > 0 ? Math.max(0, Math.min(...indexes) - 2500) : 0;
  return text.slice(start, start + 22000);
}

function parseCountLine(window: string, label: string): Counts | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `${escaped}[^\\n\\r]*?([0-9][0-9,]*)\\s+([0-9][0-9,]*)\\s+([0-9][0-9,]*)\\s+([0-9][0-9,]*)`,
    'i',
  );
  const match = pattern.exec(window);
  if (!match) return null;
  return {
    total: cleanCount(match[1]),
    inState: cleanCount(match[2]),
    outOfState: cleanCount(match[3]),
    international: cleanCount(match[4]),
  };
}

function extractByRegex(text: string): ExtractedC1 | null {
  const window = c1Window(text);
  if (!/in-state\s+out-of-state\s+international/i.test(window)) return null;
  const applicants = parseCountLine(
    window,
    'Total first-time, first-year who applied',
  );
  const admitted = parseCountLine(
    window,
    'Total first-time, first-year who were admitted',
  );
  const enrolled = parseCountLine(
    window,
    'Total first-time, first-year who enrolled',
  );
  if (!applicants?.international || !admitted?.international) return null;
  return {
    found: true,
    applicants,
    admitted,
    enrolled: enrolled ?? undefined,
    confidence: 0.99,
    notes: 'Parsed by deterministic CDS C1 residency table regex.',
  };
}

function extractJson(text: string) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error(`LLM did not return JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callOpenAi(
  schoolName: string,
  sourceUrl: string,
  text: string,
  model: string,
) {
  const { callLlm } = await import('./lib/llm-call');
  const userPrompt = `Extract Common Data Set section C1 from the PDF text for ${schoolName}.

Return only JSON with this exact shape:
{
  "found": true,
  "applicants": {"total": number|null, "inState": number|null, "outOfState": number|null, "international": number|null},
  "admitted": {"total": number|null, "inState": number|null, "outOfState": number|null, "international": number|null},
  "enrolled": {"total": number|null, "inState": number|null, "outOfState": number|null, "international": number|null},
  "confidence": number,
  "notes": string
}

Rules:
- Use C1 first-time, first-year, degree-seeking undergraduate counts only.
- Do not use transfer, waitlist, SAT, or financial-aid tables.
- Preserve null when a residency row is absent.
- Do not infer counts from percentages.
- Source URL: ${sourceUrl}

PDF text:
${text}`;

  return await callLlm<ExtractedC1>({
    model,
    systemPrompt:
      'You extract official college admissions tables into strict JSON. Return no prose.',
    userPrompt,
    maxOutputTokens: 1024,
  });
}

function toOutputRow(
  row: RegistryRow,
  sourceUrl: string,
  cycleYear: number,
  extracted: ExtractedC1,
): CdsOutputRow {
  const applicants = normalizeCounts(extracted.applicants);
  const admitted = normalizeCounts(extracted.admitted);
  const enrolled = normalizeCounts(extracted.enrolled);
  return {
    schoolNameNorm: row.schoolNameNorm,
    cycleYear,
    sourceUrl,
    applicants,
    admitted,
    enrolled,
    rates: {
      acceptanceRate: pct(admitted.total, applicants.total),
      intlAcceptanceRate: pct(admitted.international, applicants.international),
      oosAcceptanceRate: pct(admitted.outOfState, applicants.outOfState),
      transferAcceptanceRate: null,
    },
    notes: extracted.notes,
  };
}

async function main() {
  loadDotEnv();
  const args = parseArgs();
  const rows = parseRows(args.input).slice(0, args.limit);
  const output: CdsOutputRow[] = [];
  const failures = [];

  for (const row of rows) {
    const sourceUrl = row.selectedUrl as string;
    const tmp = path.join(
      os.tmpdir(),
      `cds-${row.schoolNameNorm.replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}.pdf`,
    );
    try {
      await download(sourceUrl, tmp);
      const fullText = pdfToText(tmp);
      const extracted =
        extractByRegex(fullText) ??
        (await callOpenAi(
          row.schoolName ?? row.schoolNameNorm,
          sourceUrl,
          c1Window(fullText),
          args.model,
        ));
      const outRow = toOutputRow(row, sourceUrl, args.cycleYear, extracted);
      if (args.requireIntl && outRow.rates.intlAcceptanceRate == null) {
        throw new Error(
          'C1 extraction returned no international admit-rate counts',
        );
      }
      output.push(outRow);
      console.log(
        `${row.schoolName ?? row.schoolNameNorm}: intl=${outRow.rates.intlAcceptanceRate ?? 'null'} overall=${outRow.rates.acceptanceRate ?? 'null'}`,
      );
    } catch (error) {
      failures.push({
        schoolNameNorm: row.schoolNameNorm,
        schoolName: row.schoolName,
        sourceUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`${row.schoolName ?? row.schoolNameNorm}: failed`);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  const file = {
    _meta: {
      extractedAt: new Date().toISOString(),
      source: 'LLM extraction from official CDS PDF text',
      model: args.model,
      input: args.input,
      success: output.length,
      failures: failures.length,
    },
    schools: output,
    failures,
  };
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(file, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        out: args.out,
        success: output.length,
        failures: failures.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
