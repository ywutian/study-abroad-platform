#!/usr/bin/env -S ts-node --transpile-only
/**
 * Merge + normalize + validate externally-gathered admission cases.
 *
 * Reads every `*.json` file in `scripts/external-cases-raw/` (each one a
 * Claude-agent output array of case / aggregate-rate rows from a channel —
 * 一亩三分地 / 知乎 / 小红书 / Reddit-A2C / CollegeConfidential / consultancy
 * reports / boarding-school reports), then:
 *   1. validates each row against the union schema
 *   2. normalizes (GPA → 4.0 scale, nationality → 2-letter, hook tags, school
 *      name → matched to a normalized key)
 *   3. dedups (same school + year + round + gpa + sat + result + source)
 *   4. scores data quality per row
 *   5. writes the merged corpus + a summary markdown report
 *
 * IMPORTANT — this corpus is for OFFLINE prediction-coefficient analysis only.
 * It is NOT inserted into the `AdmissionCase` DB table:
 *   - These are scraped/forum self-reports — ToS + provenance + quality
 *     concerns make them unsuitable for the user-facing case gallery.
 *   - The prediction-coefficient scripts (learn-prediction-coefficients.ts,
 *     fit-residual-regression.ts) can read this JSON as ADDITIONAL training
 *     rows, source-tagged so propensity weighting can down/up-weight them
 *     vs. our own verified AdmissionCase pool.
 *
 * Run:
 *   pnpm --filter api exec tsx scripts/merge-external-admit-cases.ts
 *
 * Output:
 *   scripts/training-data/external-admit-cases.json        (merged corpus)
 *   verification-report/external-admit-cases-<ts>.md       (summary, gitignored)
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(__dirname, '..');
const RAW_DIR = resolve(ROOT_DIR, 'scripts/external-cases-raw');
const TRAINING_DIR = resolve(ROOT_DIR, 'scripts/training-data');
const REPORT_DIR = resolve(ROOT_DIR, 'verification-report');
const OUT_FILE = resolve(TRAINING_DIR, 'external-admit-cases.json');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// ───────────────────────────────────────────────────────────────────────────
// Schema
// ───────────────────────────────────────────────────────────────────────────

type Result = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
type Round = 'RD' | 'ED' | 'ED2' | 'EA' | 'REA' | 'UNKNOWN';

interface RawRow {
  type?: 'case' | 'aggregate_rate';
  schoolName?: string;
  applicationYear?: number;
  applicationRound?: string;
  nationality?: string;
  isInternational?: boolean;
  gpa?: number | null;
  gpaScale?: number | null;
  sat?: number | null;
  act?: number | null;
  toefl?: number | null;
  hooks?: string[];
  major?: string;
  highSchoolType?: string;
  activitiesSummary?: string;
  awardsSummary?: string;
  result?: string;
  // aggregate-rate-only
  cohort?: string;
  cohortDescription?: string;
  applied?: number | null;
  admitted?: number | null;
  admitRate?: number | null;
  // provenance
  source?: string;
  sourceUrl?: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface NormalizedCase {
  kind: 'case';
  schoolNameNorm: string;
  schoolNameRaw: string;
  applicationYear: number | null;
  applicationRound: Round;
  nationality: string | null;
  isInternational: boolean | null;
  gpa4: number | null; // normalized to 4.0 scale
  gpaRaw: number | null;
  gpaScale: number | null;
  sat: number | null;
  act: number | null;
  toefl: number | null;
  hooks: string[];
  major: string | null;
  highSchoolType: string | null;
  activitiesSummary: string;
  awardsSummary: string;
  result: Result;
  source: string;
  sourceUrl: string;
  confidence: 'high' | 'medium' | 'low';
  qualityScore: number; // 0-1
}

interface NormalizedAggregate {
  kind: 'aggregate_rate';
  schoolNameNorm: string;
  schoolNameRaw: string;
  cohort: string;
  cohortDescription: string;
  applicationYear: number | null;
  applied: number | null;
  admitted: number | null;
  admitRate: number | null;
  source: string;
  sourceUrl: string;
  confidence: 'high' | 'medium' | 'low';
  qualityScore: number;
}

type Normalized = NormalizedCase | NormalizedAggregate;

// ───────────────────────────────────────────────────────────────────────────
// Normalizers
// ───────────────────────────────────────────────────────────────────────────

function normalizeSchoolName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .replace(/^the /, '');
}

function normalizeNationality(raw: string | undefined): string | null {
  if (!raw) return null;
  const u = raw.trim().toUpperCase();
  if (['CHINA', 'CN', 'PRC', '中国'].includes(u)) return 'CN';
  if (['INDIA', 'IN'].includes(u)) return 'IN';
  if (['KOREA', 'SOUTH KOREA', 'KR'].includes(u)) return 'KR';
  if (['UNITED STATES', 'USA', 'US', 'AMERICA'].includes(u)) return 'US';
  if (u.length === 2) return u;
  return u.slice(0, 2);
}

function normalizeRound(raw: string | undefined): Round {
  if (!raw) return 'UNKNOWN';
  const u = raw
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, '');
  if (u === 'ED' || u === 'EARLYDECISION' || u === 'ED1') return 'ED';
  if (u === 'ED2' || u === 'EDII' || u === 'EARLYDECISION2') return 'ED2';
  if (u === 'EA' || u === 'EARLYACTION') return 'EA';
  if (u === 'REA' || u === 'SCEA' || u === 'RESTRICTIVEEA') return 'REA';
  if (u === 'RD' || u === 'REGULAR' || u === 'REGULARDECISION') return 'RD';
  return 'UNKNOWN';
}

function normalizeResult(raw: string | undefined): Result | null {
  if (!raw) return null;
  const u = raw.trim().toUpperCase();
  if (
    ['ADMITTED', 'ADMIT', 'ACCEPTED', 'ACCEPT', '录取', 'OFFER'].some((k) =>
      u.includes(k),
    )
  )
    return 'ADMITTED';
  if (
    ['REJECTED', 'REJECT', 'DENIED', 'DENY', '拒', 'REJ'].some((k) =>
      u.includes(k),
    )
  )
    return 'REJECTED';
  if (['WAITLIST', 'WAITLISTED', 'WL', '候补'].some((k) => u.includes(k)))
    return 'WAITLISTED';
  if (['DEFER', 'DEFERRED', '延期'].some((k) => u.includes(k)))
    return 'DEFERRED';
  return null;
}

function normalizeHooks(raw: string[] | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  const map: Record<string, string> = {
    firstgen: 'first_gen',
    first_gen: 'first_gen',
    fgli: 'first_gen',
    legacy: 'legacy',
    athlete: 'athlete',
    recruited: 'athlete',
    recruitedathlete: 'athlete',
    urm: 'urm',
    undocumented: 'undocumented',
  };
  const out = new Set<string>();
  for (const h of raw) {
    const k = h
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, '');
    if (map[k]) out.add(map[k]);
  }
  return Array.from(out);
}

/** GPA → 4.0 scale. Handles 4.0 / 4.3 / 5.0 / 100-point conventions. */
function normalizeGpa(
  gpa: number | null | undefined,
  scale: number | null | undefined,
): number | null {
  if (gpa == null || !Number.isFinite(gpa)) return null;
  const s = scale && scale > 0 ? scale : gpa > 5 ? 100 : 4.0;
  if (s === 100) return Math.min(4.0, (gpa / 100) * 4.0);
  return Math.min(4.0, (gpa / s) * 4.0);
}

function qualityScore(row: RawRow, isAggregate: boolean): number {
  let score = 0;
  // Confidence base
  score +=
    row.confidence === 'high' ? 0.4 : row.confidence === 'medium' ? 0.25 : 0.1;
  // Has verifiable URL
  if (row.sourceUrl && /^https?:\/\//.test(row.sourceUrl)) score += 0.2;
  if (isAggregate) {
    // aggregate quality: has raw counts > has just a rate
    if (row.applied != null && row.admitted != null) score += 0.4;
    else if (row.admitRate != null) score += 0.2;
  } else {
    // case quality: more fields present = higher
    if (row.gpa != null) score += 0.1;
    if (row.sat != null || row.act != null) score += 0.1;
    if (row.result) score += 0.1;
    if (row.applicationYear) score += 0.05;
    if (row.applicationRound) score += 0.05;
  }
  return Math.min(1.0, score);
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

function main() {
  let files: string[];
  try {
    files = readdirSync(RAW_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    console.error(
      `No raw dir at ${RAW_DIR}. Drop agent-output JSON arrays there first.`,
    );
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(
      `No *.json files in ${RAW_DIR}. Drop agent-output JSON arrays there first.`,
    );
    process.exit(1);
  }

  const cases: NormalizedCase[] = [];
  const aggregates: NormalizedAggregate[] = [];
  let skipped = 0;
  const perFile: Record<
    string,
    { cases: number; agg: number; skipped: number }
  > = {};

  for (const file of files) {
    perFile[file] = { cases: 0, agg: 0, skipped: 0 };
    let rows: RawRow[];
    try {
      const parsed = JSON.parse(readFileSync(resolve(RAW_DIR, file), 'utf8'));
      rows = Array.isArray(parsed)
        ? parsed
        : (parsed.rows ?? parsed.cases ?? []);
    } catch (e) {
      console.warn(`  skip ${file}: parse error ${(e as Error).message}`);
      continue;
    }

    for (const row of rows) {
      const isAggregate =
        row.type === 'aggregate_rate' ||
        (row.admitRate != null && row.result == null && !row.gpa);
      if (!row.schoolName) {
        skipped++;
        perFile[file].skipped++;
        continue;
      }
      const schoolNameNorm = normalizeSchoolName(row.schoolName);

      if (isAggregate) {
        aggregates.push({
          kind: 'aggregate_rate',
          schoolNameNorm,
          schoolNameRaw: row.schoolName,
          cohort: row.cohort ?? 'unknown',
          cohortDescription: row.cohortDescription ?? '',
          applicationYear: row.applicationYear ?? null,
          applied: row.applied ?? null,
          admitted: row.admitted ?? null,
          admitRate:
            row.admitRate ??
            (row.applied && row.admitted ? row.admitted / row.applied : null),
          source: row.source ?? 'unknown',
          sourceUrl: row.sourceUrl ?? '',
          confidence: row.confidence ?? 'low',
          qualityScore: qualityScore(row, true),
        });
        perFile[file].agg++;
      } else {
        const result = normalizeResult(row.result);
        if (!result) {
          skipped++;
          perFile[file].skipped++;
          continue;
        }
        cases.push({
          kind: 'case',
          schoolNameNorm,
          schoolNameRaw: row.schoolName,
          applicationYear: row.applicationYear ?? null,
          applicationRound: normalizeRound(row.applicationRound),
          nationality: normalizeNationality(row.nationality),
          isInternational: row.isInternational ?? null,
          gpa4: normalizeGpa(row.gpa, row.gpaScale),
          gpaRaw: row.gpa ?? null,
          gpaScale: row.gpaScale ?? null,
          sat: row.sat ?? null,
          act: row.act ?? null,
          toefl: row.toefl ?? null,
          hooks: normalizeHooks(row.hooks),
          major: row.major ?? null,
          highSchoolType: row.highSchoolType ?? null,
          activitiesSummary: row.activitiesSummary ?? '',
          awardsSummary: row.awardsSummary ?? '',
          result,
          source: row.source ?? 'unknown',
          sourceUrl: row.sourceUrl ?? '',
          confidence: row.confidence ?? 'low',
          qualityScore: qualityScore(row, false),
        });
        perFile[file].cases++;
      }
    }
  }

  // Dedup cases by (schoolNameNorm | year | round | gpa | sat | result | source)
  const seen = new Set<string>();
  const dedupedCases = cases.filter((c) => {
    const key = `${c.schoolNameNorm}|${c.applicationYear}|${c.applicationRound}|${c.gpa4?.toFixed(2)}|${c.sat}|${c.result}|${c.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const dupRemoved = cases.length - dedupedCases.length;

  // Dedup aggregates by (schoolNameNorm | cohort | year)
  const seenAgg = new Set<string>();
  const dedupedAgg = aggregates.filter((a) => {
    const key = `${a.schoolNameNorm}|${a.cohort}|${a.applicationYear}`;
    if (seenAgg.has(key)) return false;
    seenAgg.add(key);
    return true;
  });

  // Write merged corpus
  mkdirSync(TRAINING_DIR, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    note: 'External-source admit cases for OFFLINE prediction-coefficient analysis only. NOT inserted into AdmissionCase DB (ToS / provenance / quality). Self-report biased; source-tagged for propensity weighting.',
    caseCount: dedupedCases.length,
    aggregateCount: dedupedAgg.length,
    cases: dedupedCases,
    aggregates: dedupedAgg,
  };
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));

  // Summary report
  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = resolve(
    REPORT_DIR,
    `external-admit-cases-${TIMESTAMP}.md`,
  );
  const byResult: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byNat: Record<string, number> = {};
  for (const c of dedupedCases) {
    byResult[c.result] = (byResult[c.result] ?? 0) + 1;
    bySource[c.source] = (bySource[c.source] ?? 0) + 1;
    const n = c.nationality ?? 'unknown';
    byNat[n] = (byNat[n] ?? 0) + 1;
  }
  const lines: string[] = [];
  lines.push(`# External admit-case corpus — ${TIMESTAMP}`);
  lines.push('');
  lines.push(
    `**Merged**: ${dedupedCases.length} cases (${dupRemoved} dups removed) + ${dedupedAgg.length} aggregate-rate cells, from ${files.length} channel files. ${skipped} rows skipped (no school / no usable result).`,
  );
  lines.push('');
  lines.push('## Cases by result');
  lines.push('');
  for (const r of Object.keys(byResult).sort()) {
    const pct = ((byResult[r] / dedupedCases.length) * 100).toFixed(1);
    lines.push(`- ${r}: ${byResult[r]} (${pct}%)`);
  }
  const admitShare =
    (byResult.ADMITTED ?? 0) / Math.max(dedupedCases.length, 1);
  lines.push('');
  lines.push(
    `**Selection-bias check**: ADMITTED share = ${(admitShare * 100).toFixed(1)}%. ` +
      (admitShare > 0.6
        ? '⚠️ Heavily admit-skewed — typical of self-report. Reject/WL rows are scarce; per-cell admit rates from this corpus will be biased HIGH without propensity correction.'
        : 'Reasonably balanced for self-report data.'),
  );
  lines.push('');
  lines.push('## Cases by source channel');
  lines.push('');
  for (const s of Object.keys(bySource).sort(
    (a, b) => bySource[b] - bySource[a],
  )) {
    lines.push(`- ${s}: ${bySource[s]}`);
  }
  lines.push('');
  lines.push('## Cases by nationality');
  lines.push('');
  for (const n of Object.keys(byNat).sort((a, b) => byNat[b] - byNat[a])) {
    lines.push(`- ${n}: ${byNat[n]}`);
  }
  lines.push('');
  lines.push('## Per-file ingestion');
  lines.push('');
  lines.push('| file | cases | aggregates | skipped |');
  lines.push('|---|---|---|---|');
  for (const f of Object.keys(perFile)) {
    lines.push(
      `| ${f} | ${perFile[f].cases} | ${perFile[f].agg} | ${perFile[f].skipped} |`,
    );
  }
  lines.push('');
  lines.push('## Aggregate-rate cells (defined-cohort admit rates)');
  lines.push('');
  if (dedupedAgg.length === 0) {
    lines.push('_None._');
  } else {
    lines.push(
      '| school | cohort | year | applied | admitted | rate | source |',
    );
    lines.push('|---|---|---|---|---|---|---|');
    for (const a of dedupedAgg) {
      lines.push(
        `| ${a.schoolNameRaw} | ${a.cohort} | ${a.applicationYear ?? '?'} | ${a.applied ?? '?'} | ${a.admitted ?? '?'} | ${a.admitRate != null ? (a.admitRate * 100).toFixed(0) + '%' : '?'} | ${a.source} |`,
      );
    }
  }
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push(
    '- **This corpus is offline-analysis-only.** Not inserted into the `AdmissionCase` DB table (ToS, provenance, quality). Used as additional training rows for prediction-coefficient scripts, source-tagged so propensity weighting can adjust.',
  );
  lines.push(
    '- **Self-report selection bias** persists — these channels over-report admits. Reject/WL rows are the scarce, valuable ones.',
  );
  lines.push(
    '- **GPA normalized to 4.0** via gpaScale; 100-point scales mapped linearly (imperfect for Chinese 百分制).',
  );
  lines.push(
    '- **No verification**: these are forum self-reports; some profiles may be embellished or fabricated by posters.',
  );

  writeFileSync(reportPath, lines.join('\n'));

  console.log(`Merged corpus written → ${OUT_FILE}`);
  console.log(
    `  ${dedupedCases.length} cases + ${dedupedAgg.length} aggregates (${dupRemoved} dups, ${skipped} skipped)`,
  );
  console.log(
    `  ADMITTED share: ${(admitShare * 100).toFixed(1)}% ${admitShare > 0.6 ? '(admit-skewed)' : ''}`,
  );
  console.log(`Report → ${reportPath}`);
}

main();
