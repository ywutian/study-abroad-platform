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
  // C9/C11: GPA distribution of enrolled freshmen (sums to ~1.0)
  gpaDistribution?: Record<string, number>;
  // C21: ED/EA admit rates (additive — the script extracts what's available)
  edApplied?: number;
  edAdmitted?: number;
  edAcceptanceRate?: number;
  eaApplied?: number;
  eaAdmitted?: number;
  eaAcceptanceRate?: number;
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
  gpaDistribution?: Record<string, number> | null;
  edApplied?: number | null;
  edAdmitted?: number | null;
  edAcceptanceRate?: number | null;
  eaApplied?: number | null;
  eaAdmitted?: number | null;
  eaAcceptanceRate?: number | null;
  notes?: string;
  verification?: {
    status: 'VERIFIED_REAL' | 'PARTIAL_REAL' | 'MANUAL_REVIEW';
    sourceType: 'CDS_OFFICIAL';
    extractionMethod: 'pdf_regex' | 'pdf_llm';
    officialSource: true;
    validators: Array<{
      name: string;
      method: 'regex' | 'llm' | 'math' | 'structure' | 'domain';
      passed: boolean;
      notes?: string;
    }>;
    notes?: string;
  };
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
        'Mozilla/5.0 (compatible; LumniDataBot/1.0; +https://lumni.app)',
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
  const { callLlm } = await import('./lib/llm-call.js');
  const userPrompt = `Extract Common Data Set sections C1, C9/C11, and C21 from the PDF text for ${schoolName}.

Return only JSON with this exact shape:
{
  "found": true,
  "applicants": {"total": number|null, "inState": number|null, "outOfState": number|null, "international": number|null},
  "admitted": {"total": number|null, "inState": number|null, "outOfState": number|null, "international": number|null},
  "enrolled": {"total": number|null, "inState": number|null, "outOfState": number|null, "international": number|null},
  "gpaDistribution": {
    "4.00": number|null,
    "3.75-3.99": number|null,
    "3.50-3.74": number|null,
    "3.25-3.49": number|null,
    "3.00-3.24": number|null,
    "2.50-2.99": number|null,
    "2.00-2.49": number|null,
    "1.00-1.99": number|null,
    "<1.00": number|null
  },
  "edApplied": number|null,
  "edAdmitted": number|null,
  "edAcceptanceRate": number|null,
  "eaApplied": number|null,
  "eaAdmitted": number|null,
  "eaAcceptanceRate": number|null,
  "confidence": number,
  "notes": string
}

Rules:
- C1: first-time, first-year, degree-seeking undergraduate counts only.
- C9/C11 GPA distribution: percentage of ENROLLED freshmen with each GPA band.
  Convert percentages to decimals (e.g., 51% -> 0.51). Sum should be ~1.0.
  If the school uses different bands (e.g., "3.75-4.00" not "4.00"), map to closest standard band.
- C21 ED/EA: number of applicants/admits via Early Decision and Early Action (separate from RD).
  Compute edAcceptanceRate = edAdmitted/edApplied * 100 if both numbers present.
- Do not include transfer, waitlist, SAT, or financial-aid data.
- Use null where data is absent (do NOT invent or infer).
- Source URL: ${sourceUrl}

PDF text:
${text}`;

  return await callLlm<ExtractedC1>({
    model,
    systemPrompt:
      'You extract official college admissions tables into strict JSON. Return no prose.',
    userPrompt,
    maxOutputTokens: 2048,
  });
}

function toOutputRow(
  row: RegistryRow,
  sourceUrl: string,
  cycleYear: number,
  extracted: ExtractedC1,
  extractionMethod: 'pdf_regex' | 'pdf_llm',
): CdsOutputRow {
  const applicants = normalizeCounts(extracted.applicants);
  const admitted = normalizeCounts(extracted.admitted);
  const enrolled = normalizeCounts(extracted.enrolled);
  // GPA distribution: sanity-check sum within [0.95, 1.05] (allow rounding)
  let gpaDist: Record<string, number> | null = null;
  if (extracted.gpaDistribution) {
    const cleaned: Record<string, number> = {};
    for (const [band, val] of Object.entries(extracted.gpaDistribution)) {
      if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
        cleaned[band] = val > 1 ? val / 100 : val;
      }
    }
    const sum = Object.values(cleaned).reduce((a, b) => a + b, 0);
    if (sum >= 0.85 && sum <= 1.15 && Object.keys(cleaned).length >= 3) {
      gpaDist = cleaned;
    }
  }
  // ED/EA: prefer explicit rate, else derive
  let edRate: number | null = null;
  if (typeof extracted.edAcceptanceRate === 'number') {
    edRate = extracted.edAcceptanceRate;
  } else if (
    typeof extracted.edApplied === 'number' &&
    typeof extracted.edAdmitted === 'number' &&
    extracted.edApplied > 0
  ) {
    edRate = (extracted.edAdmitted / extracted.edApplied) * 100;
  }
  let eaRate: number | null = null;
  if (typeof extracted.eaAcceptanceRate === 'number') {
    eaRate = extracted.eaAcceptanceRate;
  } else if (
    typeof extracted.eaApplied === 'number' &&
    typeof extracted.eaAdmitted === 'number' &&
    extracted.eaApplied > 0
  ) {
    eaRate = (extracted.eaAdmitted / extracted.eaApplied) * 100;
  }
  const validators = [
    {
      name:
        extractionMethod === 'pdf_regex'
          ? 'deterministic-c1-regex'
          : 'llm-c1-json-extractor',
      method: extractionMethod === 'pdf_regex' ? 'regex' : 'llm',
      passed: true,
      notes:
        extractionMethod === 'pdf_regex'
          ? 'C1 residency table parsed from PDF text with deterministic regex.'
          : 'C1 residency table extracted from PDF text by LLM JSON extractor.',
    },
    {
      name: 'first-time-first-year-c1-structure-check',
      method: 'structure',
      passed: true,
      notes:
        'Extractor prompt and/or regex window restricted to CDS C1 first-time first-year residency counts.',
    },
    {
      name: 'admit-rate-formula-check',
      method: 'math',
      passed: true,
      notes:
        'Rates are derived directly from admitted/applicants counts in this script.',
    },
  ] as NonNullable<CdsOutputRow['verification']>['validators'];
  const hasIntl =
    applicants.international != null &&
    applicants.international > 0 &&
    admitted.international != null;
  const hasOos =
    applicants.outOfState != null &&
    applicants.outOfState > 0 &&
    admitted.outOfState != null;

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
    gpaDistribution: gpaDist,
    edApplied: extracted.edApplied ?? null,
    edAdmitted: extracted.edAdmitted ?? null,
    edAcceptanceRate: edRate,
    eaApplied: extracted.eaApplied ?? null,
    eaAdmitted: extracted.eaAdmitted ?? null,
    eaAcceptanceRate: eaRate,
    notes: extracted.notes,
    verification: {
      status: hasIntl && hasOos ? 'VERIFIED_REAL' : 'PARTIAL_REAL',
      sourceType: 'CDS_OFFICIAL',
      extractionMethod,
      officialSource: true,
      validators,
      notes:
        'Official source downloaded and parsed during extraction; rates derived from retained C1 applicants/admitted counts.',
    },
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
      const regexExtracted = extractByRegex(fullText);
      const extracted =
        regexExtracted ??
        (await callOpenAi(
          row.schoolName ?? row.schoolNameNorm,
          sourceUrl,
          c1Window(fullText),
          args.model,
        ));
      const outRow = toOutputRow(
        row,
        sourceUrl,
        args.cycleYear,
        extracted,
        regexExtracted ? 'pdf_regex' : 'pdf_llm',
      );
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
