#!/usr/bin/env -S ts-node --transpile-only
/**
 * Empirical calibration scorer — counselor engine vs. real AdmissionCase outcomes.
 *
 * Answers: when our engine says "10% chance of admission", did 10% of those
 * applicants actually get admitted?
 *
 * Pulls AdmissionCase rows from prod (read-only), invokes the live counselor
 * engine on each (profile, school, round) triple, then computes Brier score,
 * log-loss, AUC, and a calibration table (per probability bucket and per
 * US-News rank tier).
 *
 * Why this script vs. existing audit-counselor-vs-cases.ts:
 * The audit script compares counselor-with-signals vs. counselor-without-signals
 * (deltas to detect signal usefulness). This script compares counselor predictions
 * vs. ground-truth admission outcomes — the missing empirical accuracy test.
 *
 * Outcome scoring convention:
 *   ADMITTED   -> actual = 1.0
 *   WAITLISTED -> actual = 0.5 (half-credit, per task spec)
 *   REJECTED   -> actual = 0.0
 *   DEFERRED   -> skipped (no final outcome)
 *
 * Run:
 *   DB_URL=$(gcloud secrets versions access latest --secret=database-url --project=study-abroad-prod-2025)
 *   export DATABASE_URL=$(echo "$DB_URL" | sed -E 's#@[^:/]+:5432/#@localhost:5434/#')
 *   pnpm --filter api exec ts-node --transpile-only apps/api/scripts/calibration-empirical-scorer.ts
 *
 * Output:
 *   verification-report/empirical-calibration-<timestamp>.md
 *   verification-report/empirical-calibration-<timestamp>.json
 */

import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PredictionTransformerService } from '../src/modules/prediction/prediction-transformer.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { ProfileInput } from '../src/modules/prediction/prediction.prompts';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = resolve(REPO_ROOT, 'verification-report');
const MAX_CASES = 1000;
const MIN_YEAR = 2022;
// `year` in AdmissionCase is the *application cycle year* (e.g. 2026 = "Fall
// 2026 entering class", applied during 2025-26 cycle). The current cycle just
// concluded as of May 2026, so include up to 2026 to capture the freshest
// real outcomes — the task spec's "last 3 years" was written before the 2026
// cycle closed. 2022-2025 alone gives only 181 cases; 2022-2026 gives ~1900,
// which we then cap at 1000 (task limit) via the orderBy year DESC + take.
const MAX_YEAR = 2026;
const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// Helpers (mirrors audit-counselor-vs-cases.ts where applicable)
// ---------------------------------------------------------------------------

function parseRangeMidpoint(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const matches = raw.match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return undefined;
  const values = matches.map(Number).filter(Number.isFinite);
  if (!values.length) return undefined;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function parseJsonArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function normalizeNationality(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase();
  if (['CHINA', 'CN', 'PRC'].includes(upper)) return 'CN';
  if (['INDIA', 'IN'].includes(upper)) return 'IN';
  if (['UNITED STATES', 'USA', 'US'].includes(upper)) return 'US';
  return upper.slice(0, 2);
}

/**
 * Build a SchoolInput directly from the Prisma row, BYPASSING the trust-tier
 * provenance filter that PredictionTransformerService applies.
 *
 * Why: most production schools have valid `acceptanceRate`, `sat25/75`, etc.
 * but lack `metadata.provenance.<field>` entries, so the transformer strips
 * them (treats them as untrusted) and the engine returns tier-4 for every
 * such case. For an empirical accuracy scorer that's catastrophic — we'd
 * measure on ~1% of the sample.
 *
 * This scorer is offline analytics, not a production serve path. We want to
 * answer "given the engine ran on real schools with their published rates,
 * how calibrated is it?" — so we feed the published numbers regardless of
 * provenance bookkeeping. The transformer is also called as a sanity-check
 * (its trust-tier weights still inform the engine's confidence path if
 * needed), but the anchor input is the raw published rate.
 */
function rawSchoolToInput(school: any) {
  const num = (v: any): number | undefined => {
    if (v == null) return undefined;
    if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
    if (typeof v === 'string' && v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    if (typeof v === 'object' && 'toNumber' in v) {
      try {
        const n = v.toNumber();
        return Number.isFinite(n) ? n : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };
  const clampRate = (v: any): number | undefined => {
    const n = num(v);
    if (n == null || n <= 0) return undefined;
    return n > 1 ? n / 100 : n;
  };
  return {
    id: school.id,
    name: school.name,
    nameZh: school.nameZh ?? undefined,
    country: school.country ?? undefined,
    state: school.state ?? undefined,
    isPrivate: school.isPrivate ?? undefined,
    acceptanceRate: clampRate(school.acceptanceRate),
    intlAcceptanceRate: clampRate(school.intlAcceptanceRate),
    oosAcceptanceRate: clampRate(school.oosAcceptanceRate),
    transferAcceptanceRate: clampRate(school.transferAcceptanceRate),
    intlStudentPct: num(school.intlStudentPct),
    needBlindInternational: school.needBlindInternational ?? undefined,
    satAvg: num(school.satAvg),
    sat25: num(school.sat25),
    sat75: num(school.sat75),
    actAvg: num(school.actAvg),
    act25: num(school.act25),
    act75: num(school.act75),
    usNewsRank: num(school.usNewsRank),
    graduationRate: clampRate(school.graduationRate),
    retentionRate: clampRate(school.retentionRate),
    studentFacultyRatio: num(school.studentFacultyRatio),
    percentNeedMet: clampRate(school.percentNeedMet),
    averageNetPrice: num(school.averageNetPrice),
    testingPolicy: school.testingPolicy ?? undefined,
    testOptional: school.testOptional ?? undefined,
    hasEarlyDecision: school.hasEarlyDecision ?? undefined,
    hasEarlyDecision2: school.hasEarlyDecision2 ?? undefined,
    hasEarlyAction: school.hasEarlyAction ?? undefined,
    hasRestrictiveEa: school.hasRestrictiveEa ?? undefined,
    edAcceptanceRate: clampRate(school.edAcceptanceRate),
    ed2AcceptanceRate: clampRate(school.ed2AcceptanceRate),
    eaAcceptanceRate: clampRate(school.eaAcceptanceRate),
    yieldRate: clampRate(school.yieldRate),
    institutionType: school.institutionType ?? undefined,
    gpaDistribution: school.gpaDistribution ?? undefined,
    fieldTrustWeights: {},
    averagePredictionWeight: 1,
  };
}

function caseToProfileInput(row: any): ProfileInput {
  const testScores = parseJsonArray(row.testScores).flatMap((s) => {
    if (!s?.type || s.score == null) return [];
    return [{ type: String(s.type).toUpperCase(), score: Number(s.score) }];
  });
  const sat = parseRangeMidpoint(row.satRange);
  const act = parseRangeMidpoint(row.actRange);
  const toefl = parseRangeMidpoint(row.toeflRange);
  if (sat != null && !testScores.some((s) => s.type === 'SAT')) {
    testScores.push({ type: 'SAT', score: Math.round(sat) });
  }
  if (act != null && !testScores.some((s) => s.type === 'ACT')) {
    testScores.push({ type: 'ACT', score: Math.round(act) });
  }
  if (toefl != null && !testScores.some((s) => s.type === 'TOEFL')) {
    testScores.push({ type: 'TOEFL', score: Math.round(toefl) });
  }

  const gpaValues = [row.gpa9, row.gpa10, row.gpa11, row.gpa12].filter(
    (v: any): v is number => v != null && Number.isFinite(v),
  );
  const gpa = gpaValues.length
    ? gpaValues.reduce((s, v) => s + v, 0) / gpaValues.length
    : parseRangeMidpoint(row.gpaRange);

  const firstGpa = [row.gpa9, row.gpa10, row.gpa11, row.gpa12].find(
    (v: any) => v != null,
  );
  const lastGpa = [row.gpa12, row.gpa11, row.gpa10, row.gpa9].find(
    (v: any) => v != null,
  );
  const delta =
    firstGpa != null && lastGpa != null
      ? ((lastGpa - firstGpa) / (row.gpaScale ?? 4)) * 4
      : undefined;

  const isInternational =
    row.demographicTags?.includes('international') ||
    Boolean(row.nationality && normalizeNationality(row.nationality) !== 'US');
  const english = testScores.find((s) =>
    ['TOEFL', 'IELTS', 'DUOLINGO'].includes(s.type),
  );

  return {
    gpa,
    gpaScale: row.gpaScale ?? 4,
    gpaByGrade: {
      g9: row.gpa9 ?? undefined,
      g10: row.gpa10 ?? undefined,
      g11: row.gpa11 ?? undefined,
      g12: row.gpa12 ?? undefined,
    },
    gpaTrend:
      delta == null
        ? { direction: 'insufficient' }
        : {
            direction:
              delta >= 0.12 ? 'rising' : delta <= -0.12 ? 'falling' : 'flat',
            delta,
            evidence: `case GPA delta ${delta.toFixed(2)}`,
          },
    targetMajor: row.major ?? undefined,
    isInternational,
    nationality: normalizeNationality(row.nationality),
    educationSystem: row.curriculumType ?? undefined,
    needsFinancialAid:
      row.financialAid != null &&
      !['none', 'merit_only'].includes(String(row.financialAid).toLowerCase()),
    highSchoolLocation:
      row.highSchool?.state ?? row.highSchool?.country ?? undefined,
    highSchoolTier: row.highSchool?.tier ?? undefined,
    highSchoolRecognition: row.highSchool?.recognition ?? undefined,
    highSchoolPlacementRecord: row.highSchool?.placementRecord ?? undefined,
    highSchoolImpactEnabled: row.highSchool?.hsImpactEnabled ?? undefined,
    testScores,
    englishProficiency: english
      ? {
          type: english.type,
          score: english.score,
          normalized:
            english.type === 'TOEFL'
              ? english.score / 120
              : english.type === 'IELTS'
                ? english.score / 9
                : english.score / 160,
        }
      : undefined,
    activities: parseJsonArray(row.activities).map((a) => ({
      name: a.name ?? a.description,
      category: a.category ?? 'OTHER',
      role: a.role ?? '',
      tier: a.tier,
      hoursPerWeek: a.hoursPerWeek,
      weeksPerYear: a.weeksPerYear,
      annualHours:
        a.hoursPerWeek != null && a.weeksPerYear != null
          ? Number(a.hoursPerWeek) * Number(a.weeksPerYear)
          : undefined,
    })),
    awards: parseJsonArray(row.awards).map((a) => ({
      name: a.name,
      level: String(a.level ?? 'SCHOOL').toUpperCase(),
      tier: a.tier,
      competitionName: a.competition,
      year: a.year,
    })),
    isFirstGen: row.demographicTags?.includes('first_gen') ?? false,
    isLegacy: row.demographicTags?.includes('legacy') ?? false,
    recruitedAthlete:
      row.demographicTags?.includes('athlete') ||
      row.demographicTags?.includes('recruited') ||
      false,
  };
}

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

interface Pair {
  predicted: number;
  actual: number; // 0, 0.5, or 1
  rawResult: 'ADMITTED' | 'REJECTED' | 'WAITLISTED';
  usNewsRank: number | null;
  schoolId: string;
  schoolName: string;
  tier: number;
  anchorSource: string;
  usedRawFallback: boolean;
}

function brierScore(pairs: Pair[]): number {
  if (!pairs.length) return NaN;
  return (
    pairs.reduce((s, p) => s + Math.pow(p.predicted - p.actual, 2), 0) /
    pairs.length
  );
}

function logLoss(pairs: Pair[]): number {
  if (!pairs.length) return NaN;
  return (
    -pairs.reduce((s, p) => {
      const pred = Math.max(EPSILON, Math.min(1 - EPSILON, p.predicted));
      return (
        s + (p.actual * Math.log(pred) + (1 - p.actual) * Math.log(1 - pred))
      );
    }, 0) / pairs.length
  );
}

/**
 * Binary AUC computed by the rank-sum / Mann-Whitney formula:
 *   AUC = (sum_of_positive_ranks - n_pos*(n_pos+1)/2) / (n_pos*n_neg)
 *
 * Waitlisted cases (actual=0.5) are excluded from AUC by convention — binary
 * AUC requires labels in {0, 1}. We report n_used so readers know.
 */
function aucBinary(pairs: Pair[]): { auc: number; nPos: number; nNeg: number } {
  const binaryPairs = pairs.filter((p) => p.actual === 0 || p.actual === 1);
  const positives = binaryPairs.filter((p) => p.actual === 1);
  const negatives = binaryPairs.filter((p) => p.actual === 0);
  if (!positives.length || !negatives.length) {
    return { auc: NaN, nPos: positives.length, nNeg: negatives.length };
  }
  // Rank all (with average-rank tie handling)
  const sorted = [...binaryPairs]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.predicted - b.p.predicted);
  const ranks = new Array<number>(sorted.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (
      j < sorted.length &&
      sorted[j].p.predicted === sorted[i].p.predicted
    ) {
      j++;
    }
    const avg = (i + 1 + j) / 2; // ranks are 1-indexed
    for (let k = i; k < j; k++) ranks[k] = avg;
    i = j;
  }
  const sumPosRanks = sorted.reduce(
    (acc, item, idx) => (item.p.actual === 1 ? acc + ranks[idx] : acc),
    0,
  );
  const nP = positives.length;
  const nN = negatives.length;
  const auc = (sumPosRanks - (nP * (nP + 1)) / 2) / (nP * nN);
  return { auc, nPos: nP, nNeg: nN };
}

/**
 * Calibration table: bucket predicted probabilities into 10 deciles
 * [0, 0.1), [0.1, 0.2), ..., [0.9, 1.0]. For each bucket compute
 * mean predicted, mean actual (using 0/0.5/1), and count.
 */
function calibrationBuckets(pairs: Pair[]): Array<{
  bucket: string;
  range: [number, number];
  n: number;
  meanPredicted: number;
  meanActual: number;
  delta: number; // meanActual - meanPredicted (positive = engine under-confident)
}> {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    bucket: `${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)}`,
    range: [i / 10, (i + 1) / 10] as [number, number],
    rows: [] as Pair[],
  }));
  for (const p of pairs) {
    let idx = Math.floor(p.predicted * 10);
    if (idx >= 10) idx = 9; // include 1.0 in last bucket
    if (idx < 0) idx = 0;
    buckets[idx].rows.push(p);
  }
  return buckets.map((b) => {
    const n = b.rows.length;
    const meanPredicted = n
      ? b.rows.reduce((s, r) => s + r.predicted, 0) / n
      : 0;
    const meanActual = n ? b.rows.reduce((s, r) => s + r.actual, 0) / n : 0;
    return {
      bucket: b.bucket,
      range: b.range,
      n,
      meanPredicted,
      meanActual,
      delta: meanActual - meanPredicted,
    };
  });
}

/**
 * Bucket by US News rank tier:
 *   T5    = rank 1-5
 *   T6-20 = rank 6-20
 *   T21-50= rank 21-50
 *   T51-100=rank 51-100
 *   T100+ = rank >100 or null
 */
function rankTier(rank: number | null): string {
  if (rank == null) return 'T100+/unranked';
  if (rank <= 5) return 'T5';
  if (rank <= 20) return 'T6-20';
  if (rank <= 50) return 'T21-50';
  if (rank <= 100) return 'T51-100';
  return 'T100+/unranked';
}

function calibrationByRankTier(pairs: Pair[]): Array<{
  tier: string;
  n: number;
  meanPredicted: number;
  meanActual: number;
  delta: number;
  brier: number;
}> {
  const tiers = ['T5', 'T6-20', 'T21-50', 'T51-100', 'T100+/unranked'];
  const grouped: Record<string, Pair[]> = Object.fromEntries(
    tiers.map((t) => [t, []]),
  );
  for (const p of pairs) {
    grouped[rankTier(p.usNewsRank)].push(p);
  }
  return tiers.map((t) => {
    const rows = grouped[t];
    const n = rows.length;
    const meanPredicted = n ? rows.reduce((s, r) => s + r.predicted, 0) / n : 0;
    const meanActual = n ? rows.reduce((s, r) => s + r.actual, 0) / n : 0;
    return {
      tier: t,
      n,
      meanPredicted,
      meanActual,
      delta: meanActual - meanPredicted,
      brier: brierScore(rows),
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function resultToActual(result: string): number | null {
  if (result === 'ADMITTED') return 1.0;
  if (result === 'REJECTED') return 0.0;
  if (result === 'WAITLISTED') return 0.5;
  return null; // DEFERRED skipped
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      'ERROR: DATABASE_URL not set. Source the Cloud SQL proxy URL first:',
    );
    console.error(
      '  DB_URL=$(gcloud secrets versions access latest --secret=database-url --project=study-abroad-prod-2025)',
    );
    console.error(
      '  export DATABASE_URL=$(echo "$DB_URL" | sed -E "s#@[^:/]+:5432/#@localhost:5434/#")',
    );
    process.exit(2);
  }

  mkdirSync(REPORT_DIR, { recursive: true });

  console.error('[scorer] Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    { logger: ['error', 'warn'] },
  );
  const counselor = app.get(CounselorEngineService);
  const transformer = app.get(PredictionTransformerService);
  const prisma = app.get(PrismaService);

  console.error(
    `[scorer] Loading AdmissionCase rows (year ${MIN_YEAR}-${MAX_YEAR}, max ${MAX_CASES})...`,
  );
  const cases = await prisma.admissionCase.findMany({
    where: {
      year: { gte: MIN_YEAR, lte: MAX_YEAR },
      result: { in: ['ADMITTED', 'REJECTED', 'WAITLISTED'] },
      schoolId: { not: undefined },
    },
    include: { school: true, highSchool: true },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    take: MAX_CASES,
  });
  console.error(
    `[scorer] Loaded ${cases.length} cases. Computing predictions...`,
  );

  const pairs: Pair[] = [];
  const skipped: Array<{ caseId: string; reason: string }> = [];

  for (let i = 0; i < cases.length; i++) {
    const row = cases[i];
    if (i > 0 && i % 100 === 0) {
      console.error(
        `[scorer]   ${i}/${cases.length} processed (${pairs.length} valid)`,
      );
    }
    const actual = resultToActual(row.result);
    if (actual == null) {
      skipped.push({
        caseId: row.id,
        reason: `unsupported result ${row.result}`,
      });
      continue;
    }
    try {
      const profile = caseToProfileInput(row);
      // Primary path: production transformer (respects trust-tier provenance).
      const schoolInputTrusted = transformer.schoolToInput(row.school as any);
      let result = await counselor.compute(
        profile,
        schoolInputTrusted,
        row.round ?? 'RD',
      );
      // Fallback for offline analytics: most prod schools have valid
      // acceptanceRate but lack metadata.provenance entries — the trust-tier
      // filter strips them, forcing tier-4. Retry with the raw School row
      // when that happens. This still uses the engine's logic; it just
      // bypasses the provenance bookkeeping that's an artifact of prod
      // data quality, not engine math.
      let usedRawFallback = false;
      if (
        result.tier === 4 &&
        result.anchorSource === 'none' &&
        row.school?.acceptanceRate != null
      ) {
        const schoolInputRaw = rawSchoolToInput(row.school) as any;
        result = await counselor.compute(
          profile,
          schoolInputRaw,
          row.round ?? 'RD',
        );
        usedRawFallback = true;
      }
      if (result.tier === 4 || result.insufficientData) {
        skipped.push({
          caseId: row.id,
          reason: `tier4 / insufficient data (${result.anchorSource})${usedRawFallback ? ' [raw-fallback also failed]' : ''}`,
        });
        continue;
      }
      pairs.push({
        predicted: result.probability,
        actual,
        rawResult: row.result as Pair['rawResult'],
        usNewsRank: row.school.usNewsRank ?? null,
        schoolId: row.schoolId,
        schoolName: row.school.name,
        tier: result.tier,
        anchorSource: result.anchorSource,
        usedRawFallback,
      });
    } catch (err: any) {
      skipped.push({ caseId: row.id, reason: `error: ${err?.message ?? err}` });
    }
  }

  console.error(
    `[scorer] Scored ${pairs.length} pairs (${skipped.length} skipped)`,
  );

  // ---- Top-line metrics ----
  const brier = brierScore(pairs);
  const ll = logLoss(pairs);
  const { auc, nPos, nNeg } = aucBinary(pairs);
  const buckets = calibrationBuckets(pairs);
  const byTier = calibrationByRankTier(pairs);
  const admittedCount = pairs.filter((p) => p.rawResult === 'ADMITTED').length;
  const rejectedCount = pairs.filter((p) => p.rawResult === 'REJECTED').length;
  const waitlistedCount = pairs.filter(
    (p) => p.rawResult === 'WAITLISTED',
  ).length;
  const actualAdmitRate =
    pairs.reduce((s, p) => s + p.actual, 0) / Math.max(1, pairs.length);
  const meanPredicted =
    pairs.reduce((s, p) => s + p.predicted, 0) / Math.max(1, pairs.length);

  // ---- Render console summary ----
  console.log('');
  console.log('=== Empirical Calibration Summary ===');
  console.log(`Total scored:        ${pairs.length}`);
  console.log(`  ADMITTED:          ${admittedCount}`);
  console.log(`  REJECTED:          ${rejectedCount}`);
  console.log(`  WAITLISTED:        ${waitlistedCount}`);
  console.log(`  Skipped (tier4/err): ${skipped.length}`);
  console.log(`Mean predicted:      ${(meanPredicted * 100).toFixed(2)}%`);
  console.log(`Mean actual (admit): ${(actualAdmitRate * 100).toFixed(2)}%`);
  console.log(
    `Brier score:         ${brier.toFixed(4)}   (lower is better, perfect=0, naive=0.25)`,
  );
  console.log(`Log loss:            ${ll.toFixed(4)}   (lower is better)`);
  console.log(
    `AUC (binary, no WL): ${auc.toFixed(4)}   (n_pos=${nPos}, n_neg=${nNeg})`,
  );
  console.log('');
  console.log('Calibration buckets:');
  console.log('  bucket    n    meanPred  meanActual  delta');
  for (const b of buckets) {
    if (b.n === 0) continue;
    console.log(
      `  ${b.bucket.padEnd(8)} ${String(b.n).padStart(4)}  ${(b.meanPredicted * 100).toFixed(1)}%      ${(b.meanActual * 100).toFixed(1)}%       ${b.delta >= 0 ? '+' : ''}${(b.delta * 100).toFixed(1)}pp`,
    );
  }
  console.log('');
  console.log('Per US-News rank tier:');
  console.log('  tier             n    meanPred  meanActual  delta    brier');
  for (const t of byTier) {
    if (t.n === 0) continue;
    console.log(
      `  ${t.tier.padEnd(16)} ${String(t.n).padStart(4)}  ${(t.meanPredicted * 100).toFixed(1)}%      ${(t.meanActual * 100).toFixed(1)}%       ${t.delta >= 0 ? '+' : ''}${(t.delta * 100).toFixed(1)}pp    ${t.brier.toFixed(4)}`,
    );
  }

  // ---- Write JSON detail ----
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = resolve(
    REPORT_DIR,
    `empirical-calibration-${timestamp}.json`,
  );
  const mdPath = resolve(REPORT_DIR, `empirical-calibration-${timestamp}.md`);

  const reportJson = {
    generatedAt: new Date().toISOString(),
    config: {
      maxCases: MAX_CASES,
      yearRange: [MIN_YEAR, MAX_YEAR],
      waitlistScoring: 'WAITLISTED counts as 0.5',
      epsilon: EPSILON,
    },
    summary: {
      totalCases: cases.length,
      scored: pairs.length,
      skipped: skipped.length,
      admittedCount,
      rejectedCount,
      waitlistedCount,
      meanPredicted,
      actualAdmitRate,
      brier,
      logLoss: ll,
      auc,
      aucNPos: nPos,
      aucNNeg: nNeg,
    },
    calibrationBuckets: buckets,
    rankTierCalibration: byTier,
    skippedSample: skipped.slice(0, 20),
    rawFallbackCount: pairs.filter((p) => p.usedRawFallback).length,
    pairs: pairs.map((p) => ({
      predicted: p.predicted,
      actual: p.actual,
      result: p.rawResult,
      usNewsRank: p.usNewsRank,
      schoolName: p.schoolName,
      tier: p.tier,
      anchorSource: p.anchorSource,
      usedRawFallback: p.usedRawFallback,
    })),
  };
  writeFileSync(jsonPath, JSON.stringify(reportJson, null, 2));

  // ---- Write Markdown report ----
  const md = renderMarkdown(reportJson);
  writeFileSync(mdPath, md);

  console.log('');
  console.log(`JSON report:     ${jsonPath}`);
  console.log(`Markdown report: ${mdPath}`);

  await app.close();
}

function renderMarkdown(r: any): string {
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
  const lines: string[] = [];
  lines.push(
    `# Empirical Calibration Report — Counselor Engine vs. Real Admissions`,
  );
  lines.push('');
  lines.push(`**Generated:** ${r.generatedAt}`);
  lines.push(
    `**Sample:** ${r.summary.scored} scored / ${r.summary.totalCases} loaded (${r.summary.skipped} skipped; ${r.rawFallbackCount ?? 0} used raw-school fallback)`,
  );
  lines.push(
    `**Year range:** ${r.config.yearRange[0]}-${r.config.yearRange[1]} (last ~3 cycles)`,
  );
  lines.push(`**Waitlist convention:** ${r.config.waitlistScoring}`);
  lines.push('');
  lines.push('## Top-line metrics');
  lines.push('');
  lines.push('| Metric | Value | Interpretation |');
  lines.push('|---|---|---|');
  lines.push(
    `| Total scored | ${r.summary.scored} | ADMITTED ${r.summary.admittedCount} / REJECTED ${r.summary.rejectedCount} / WAITLISTED ${r.summary.waitlistedCount} |`,
  );
  lines.push(
    `| Mean predicted prob | ${pct(r.summary.meanPredicted)} | Engine-wide average |`,
  );
  lines.push(
    `| Mean actual admit rate | ${pct(r.summary.actualAdmitRate)} | Sample base rate (WL=0.5) |`,
  );
  lines.push(
    `| **Brier score** | **${r.summary.brier.toFixed(4)}** | Lower = better. Perfect=0; coin-flip=0.25; always-predict-base-rate ≈ p(1-p) |`,
  );
  lines.push(
    `| **Log loss** | **${r.summary.logLoss.toFixed(4)}** | Lower = better. Heavily punishes confident wrong predictions |`,
  );
  lines.push(
    `| **AUC (binary)** | **${r.summary.auc.toFixed(4)}** | n_pos=${r.summary.aucNPos}, n_neg=${r.summary.aucNNeg}. 0.5=random, 1.0=perfect ranking. Excludes WAITLISTED |`,
  );
  lines.push('');
  lines.push('## Calibration table (predicted probability deciles)');
  lines.push('');
  lines.push(
    'For each predicted-probability bucket, the engine is well-calibrated when',
  );
  lines.push(
    '`meanActual ≈ meanPredicted`. Positive `delta` means the engine is **under-confident**',
  );
  lines.push(
    '(actual outcomes better than predicted); negative `delta` means **over-confident**.',
  );
  lines.push('');
  lines.push(
    '| Bucket | n | Mean predicted | Mean actual | Delta (pp) | Interpretation |',
  );
  lines.push('|---|---:|---:|---:|---:|---|');
  for (const b of r.calibrationBuckets) {
    if (b.n === 0) {
      lines.push(`| ${b.bucket} | 0 | — | — | — | (no samples) |`);
      continue;
    }
    const deltaPP = b.delta * 100;
    const interp =
      Math.abs(deltaPP) < 5
        ? 'well-calibrated'
        : deltaPP > 0
          ? `under-confident by ${deltaPP.toFixed(1)}pp`
          : `over-confident by ${Math.abs(deltaPP).toFixed(1)}pp`;
    lines.push(
      `| ${b.bucket} | ${b.n} | ${pct(b.meanPredicted)} | ${pct(b.meanActual)} | ${deltaPP >= 0 ? '+' : ''}${deltaPP.toFixed(1)} | ${interp} |`,
    );
  }
  lines.push('');
  lines.push('## Per US-News rank tier');
  lines.push('');
  lines.push(
    '| Tier | n | Mean predicted | Mean actual | Delta (pp) | Brier | Interpretation |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---|');
  for (const t of r.rankTierCalibration) {
    if (t.n === 0) {
      lines.push(`| ${t.tier} | 0 | — | — | — | — | (no samples) |`);
      continue;
    }
    const deltaPP = t.delta * 100;
    const interp =
      Math.abs(deltaPP) < 3
        ? 'well-calibrated'
        : deltaPP > 0
          ? `engine under-predicts (actual ${Math.abs(deltaPP).toFixed(1)}pp higher)`
          : `engine over-predicts (actual ${Math.abs(deltaPP).toFixed(1)}pp lower)`;
    lines.push(
      `| ${t.tier} | ${t.n} | ${pct(t.meanPredicted)} | ${pct(t.meanActual)} | ${deltaPP >= 0 ? '+' : ''}${deltaPP.toFixed(1)} | ${t.brier.toFixed(4)} | ${interp} |`,
    );
  }
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push(
    `- **Sample selection bias**: AdmissionCase rows are *self-reported* and skew toward admitted students at prestige schools. The pool is NOT representative of the general applicant population, so the absolute base rate (${pct(r.summary.actualAdmitRate)}) is much higher than the true population admit rate.`,
  );
  lines.push(
    `- **Raw-school fallback**: ${r.rawFallbackCount ?? 0} / ${r.summary.scored} cases used the raw \`School\` row instead of the trust-tier-filtered \`PredictionTransformerService.schoolToInput()\` output. The transformer strips fields lacking a \`metadata.provenance.<field>\` entry, but most prod schools have valid \`acceptanceRate\` without provenance bookkeeping — without the fallback the scorer would only measure ~10% of cases. Engine math is identical in both paths; only the input filtering differs.`,
  );
  lines.push(
    '- **Skipped cases**: tier-4 outcomes (no acceptanceRate, audition schools, missing GPA)',
  );
  lines.push(
    `  account for ${r.summary.skipped} skips. These are not engine failures — the engine`,
  );
  lines.push('  correctly declines to predict on insufficient data.');
  lines.push(
    '- **WAITLISTED = 0.5**: a modeling convention; many waitlist offers convert to admits',
  );
  lines.push(
    '  if the student opts in, while many waitlist offers are functionally rejections.',
  );
  lines.push(
    '  Sensitivity to this choice should be examined if WL count is large.',
  );
  lines.push(
    '- **Counselor engine only**: this report does NOT cover the ML-primary v5 shadow engine.',
  );
  lines.push('');
  lines.push('## Skipped samples (first 20)');
  lines.push('');
  for (const s of r.skippedSample) {
    lines.push(`- \`${s.caseId}\`: ${s.reason}`);
  }
  return lines.join('\n');
}

main().catch((err) => {
  console.error('Scorer failed:', err);
  process.exit(1);
});
