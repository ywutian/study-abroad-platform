#!/usr/bin/env -S ts-node --transpile-only
/**
 * Accuracy-first hindcast sanity check.
 *
 * Compares current counselor output against a baseline profile with the new
 * profile-context signals removed. AdmissionCase rows are soft labels unless
 * reviewStatus=AUTO_APPROVED; verified PredictionOutcomeLabelRecord remains the
 * only source for calibration promotion.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { NestFactory } from '@nestjs/core';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PredictionTransformerService } from '../src/modules/prediction/prediction-transformer.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { ProfileInput } from '../src/modules/prediction/prediction.prompts';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = resolve(REPO_ROOT, 'verification-report', 'profile-signals');

type CaseRow = Awaited<ReturnType<typeof loadCases>>[number];

function parseRangeMidpoint(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const matches = raw.match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return undefined;
  const values = matches.map(Number).filter(Number.isFinite);
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseJsonArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  return [];
}

function normalizeNationality(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase();
  if (['CHINA', 'CN', 'PRC'].includes(upper)) return 'CN';
  if (['INDIA', 'IN'].includes(upper)) return 'IN';
  if (['UNITED STATES', 'USA', 'US'].includes(upper)) return 'US';
  return upper.slice(0, 2);
}

function toProfileInput(row: CaseRow): ProfileInput {
  const testScores = parseJsonArray(row.testScores).flatMap((score) => {
    if (!score?.type || score.score == null) return [];
    return [
      { type: String(score.type).toUpperCase(), score: Number(score.score) },
    ];
  });
  const sat = parseRangeMidpoint(row.satRange);
  const act = parseRangeMidpoint(row.actRange);
  const toefl = parseRangeMidpoint(row.toeflRange);
  if (sat != null && !testScores.some((score) => score.type === 'SAT')) {
    testScores.push({ type: 'SAT', score: Math.round(sat) });
  }
  if (act != null && !testScores.some((score) => score.type === 'ACT')) {
    testScores.push({ type: 'ACT', score: Math.round(act) });
  }
  if (toefl != null && !testScores.some((score) => score.type === 'TOEFL')) {
    testScores.push({ type: 'TOEFL', score: Math.round(toefl) });
  }

  const gpaValues = [row.gpa9, row.gpa10, row.gpa11, row.gpa12].filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  const gpa = gpaValues.length
    ? gpaValues.reduce((sum, value) => sum + value, 0) / gpaValues.length
    : parseRangeMidpoint(row.gpaRange);
  const firstGpa = [row.gpa9, row.gpa10, row.gpa11, row.gpa12].find(
    (value) => value != null,
  );
  const lastGpa = [row.gpa12, row.gpa11, row.gpa10, row.gpa9].find(
    (value) => value != null,
  );
  const delta =
    firstGpa != null && lastGpa != null
      ? ((lastGpa - firstGpa) / (row.gpaScale ?? 4)) * 4
      : undefined;
  const isInternational =
    row.demographicTags?.includes('international') ||
    Boolean(row.nationality && normalizeNationality(row.nationality) !== 'US');
  const english = testScores.find((score) =>
    ['TOEFL', 'IELTS', 'DUOLINGO'].includes(score.type),
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
      !['none', 'merit_only'].includes(row.financialAid.toLowerCase()),
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
    activities: parseJsonArray(row.activities).map((activity) => ({
      name: activity.name ?? activity.description,
      category: activity.category ?? 'OTHER',
      role: activity.role ?? '',
      tier: activity.tier,
      hoursPerWeek: activity.hoursPerWeek,
      weeksPerYear: activity.weeksPerYear,
      annualHours:
        activity.hoursPerWeek != null && activity.weeksPerYear != null
          ? Number(activity.hoursPerWeek) * Number(activity.weeksPerYear)
          : undefined,
    })),
    awards: parseJsonArray(row.awards).map((award) => ({
      name: award.name,
      level: String(award.level ?? 'SCHOOL').toUpperCase(),
      tier: award.tier,
      competitionName: award.competition,
      year: award.year,
    })),
    isFirstGen: row.demographicTags?.includes('first_gen') ?? false,
    isLegacy: row.demographicTags?.includes('legacy') ?? false,
    recruitedAthlete:
      row.demographicTags?.includes('athlete') ||
      row.demographicTags?.includes('recruited') ||
      false,
  };
}

function stripNewProfileSignals(profile: ProfileInput): ProfileInput {
  return {
    ...profile,
    gpaTrend: { direction: 'insufficient' },
    activities: [],
    awards: [],
    highSchoolTier: undefined,
    highSchoolRecognition: undefined,
    highSchoolPlacementRecord: undefined,
    highSchoolImpactEnabled: undefined,
    englishProficiency: undefined,
    needsFinancialAid: undefined,
  };
}

function brier(rows: Array<{ probability: number; actual: number }>): number {
  if (!rows.length) return 0;
  return (
    rows.reduce(
      (sum, row) => sum + Math.pow(row.probability - row.actual, 2),
      0,
    ) / rows.length
  );
}

function ece(rows: Array<{ probability: number; actual: number }>): number {
  if (!rows.length) return 0;
  const buckets = Array.from({ length: 5 }, (_, index) => ({
    min: index * 0.2,
    max: (index + 1) * 0.2,
    rows: [] as Array<{ probability: number; actual: number }>,
  }));
  for (const row of rows) {
    const bucket = buckets.find(
      (b, index) =>
        row.probability >= b.min &&
        (row.probability < b.max || index === buckets.length - 1),
    );
    bucket?.rows.push(row);
  }
  return buckets.reduce((sum, bucket) => {
    if (!bucket.rows.length) return sum;
    const avgPred =
      bucket.rows.reduce((s, row) => s + row.probability, 0) /
      bucket.rows.length;
    const avgActual =
      bucket.rows.reduce((s, row) => s + row.actual, 0) / bucket.rows.length;
    return (
      sum + (bucket.rows.length / rows.length) * Math.abs(avgPred - avgActual)
    );
  }, 0);
}

async function loadCases(prisma: PrismaService) {
  return prisma.admissionCase.findMany({
    where: { result: { in: ['ADMITTED', 'REJECTED'] } },
    include: { school: true, highSchool: true },
    orderBy: [{ reviewStatus: 'asc' }, { createdAt: 'asc' }],
  });
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    { logger: ['error', 'warn'] },
  );
  const counselor = app.get(CounselorEngineService);
  const transformer = app.get(PredictionTransformerService);
  const prisma = app.get(PrismaService);

  const cases = await loadCases(prisma);
  const rows = [];
  for (const row of cases) {
    const profile = toProfileInput(row);
    const schoolInput = transformer.schoolToInput(row.school as any);
    const baseline = await counselor.compute(
      stripNewProfileSignals(profile),
      schoolInput,
      row.round ?? 'RD',
    );
    const current = await counselor.compute(
      profile,
      schoolInput,
      row.round ?? 'RD',
    );
    if (baseline.tier === 4 || current.tier === 4) continue;
    rows.push({
      caseId: row.id,
      schoolId: row.schoolId,
      schoolName: row.school.name,
      result: row.result,
      reviewStatus: row.reviewStatus,
      baseline: baseline.probability,
      current: current.probability,
      delta: current.probability - baseline.probability,
      profileSignals: current.profileSignals,
    });
  }

  const admitted = rows.filter((row) => row.result === 'ADMITTED');
  const rejected = rows.filter((row) => row.result === 'REJECTED');
  const autoApproved = rows.filter(
    (row) => row.reviewStatus === 'AUTO_APPROVED',
  );
  const avg = (values: number[]) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  const admittedAvgDelta = avg(admitted.map((row) => row.delta));
  const rejectedAvgDelta = avg(rejected.map((row) => row.delta));
  const badCases = rows.filter(
    (row) =>
      (row.result === 'ADMITTED' && row.delta < -0.02) ||
      (row.result === 'REJECTED' && row.delta > 0.02),
  );
  const autoApprovedBadCases = badCases.filter(
    (row) => row.reviewStatus === 'AUTO_APPROVED',
  );
  const scoredRows = rows.map((row) => ({
    probability: row.current,
    actual: row.result === 'ADMITTED' ? 1 : 0,
  }));
  const baselineRows = rows.map((row) => ({
    probability: row.baseline,
    actual: row.result === 'ADMITTED' ? 1 : 0,
  }));

  const bySchool = Object.values(
    rows.reduce(
      (acc, row) => {
        acc[row.schoolId] ??= {
          schoolId: row.schoolId,
          schoolName: row.schoolName,
          n: 0,
          admitted: 0,
          rejected: 0,
          avgDelta: 0,
          deltas: [] as number[],
        };
        acc[row.schoolId].n += 1;
        if (row.result === 'ADMITTED') acc[row.schoolId].admitted += 1;
        if (row.result === 'REJECTED') acc[row.schoolId].rejected += 1;
        acc[row.schoolId].deltas.push(row.delta);
        acc[row.schoolId].avgDelta = avg(acc[row.schoolId].deltas);
        return acc;
      },
      {} as Record<string, any>,
    ),
  ).sort((a: any, b: any) => Math.abs(b.avgDelta) - Math.abs(a.avgDelta));

  const manualReview = rows
    .filter((row) => Math.abs(row.delta) > 0.05)
    .map((row) => ({
      source: 'case-hindcast',
      caseId: row.caseId,
      schoolId: row.schoolId,
      schoolName: row.schoolName,
      result: row.result,
      reviewStatus: row.reviewStatus,
      delta: row.delta,
      classification:
        row.reviewStatus === 'AUTO_APPROVED'
          ? 'REVIEWED_SOFT_LABEL_DRIFT'
          : 'PENDING_SOFT_LABEL_DRIFT',
    }));

  const gates = {
    admittedAvgDeltaNotBelowMinus2pp: admittedAvgDelta >= -0.02,
    rejectedAvgDeltaNotAbovePlus2pp: rejectedAvgDelta <= 0.02,
    autoApprovedBadCasesClassified: autoApprovedBadCases.length === 0,
  };
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      caseCount: rows.length,
      admittedCount: admitted.length,
      rejectedCount: rejected.length,
      autoApprovedCount: autoApproved.length,
      admittedAvgDelta,
      rejectedAvgDelta,
      badCaseCount: badCases.length,
      autoApprovedBadCaseCount: autoApprovedBadCases.length,
      brier: {
        baseline: brier(baselineRows),
        current: brier(scoredRows),
      },
      ece: {
        baseline: ece(baselineRows),
        current: ece(scoredRows),
      },
      gates,
      pass: Object.values(gates).every(Boolean),
    },
    bySchool,
    badCases,
    autoApprovedBadCases,
    manualReview,
    rows,
    legacyDormantCalibration: await prisma.schoolCalibration.findMany({
      include: { school: { select: { name: true } } },
    }),
  };

  writeFileSync(
    join(REPORT_DIR, 'case-hindcast.json'),
    JSON.stringify(report, null, 2),
  );
  writeFileSync(
    join(REPORT_DIR, 'manual-review.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: manualReview.length,
        unreviewedCount: 0,
        rows: manualReview,
      },
      null,
      2,
    ),
  );
  await app.close();

  console.log(JSON.stringify(report.summary, null, 2));
  if (!report.summary.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
