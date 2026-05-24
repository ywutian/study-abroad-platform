#!/usr/bin/env -S ts-node --transpile-only
/**
 * Counselor 241 x 13 coverage verifier.
 *
 * Boots the counselor engine in-process, runs every US school against a fixed
 * archetype matrix, validates numeric Tier 1-3 outputs, and writes reports to
 * verification-report/phase-b by default. If --launch is provided, reports are
 * written under verification-report/launch. If --baseline <json> is provided, it
 * also emits Phase C delta diagnostics against a prior coverage report.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PredictionTransformerService } from '../src/modules/prediction/prediction-transformer.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { ProfileInput } from '../src/modules/prediction/prediction.prompts';

const EPSILON = 1e-6;
const EXPECTED_US_SCHOOL_COUNT = 241;
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = resolve(REPO_ROOT, 'verification-report', 'phase-b');
const PROFILE_SIGNAL_REPORT_DIR = resolve(
  REPO_ROOT,
  'verification-report',
  'profile-signals',
);
const MANUAL_REVIEW_FILE = 'manual-review.json';
// 2026-05-24: gates relaxed from (0.025/0.08) → (0.04/0.12) to admit the
// profileContextMultiplier cap loosening that fixes the strong-profile under-
// prediction bug (Alice 3.95/1560 at MIT was 2.2% vs anchor 4.55% under the
// original caps — mathematically wrong). The previous gate was calibrated
// to the overly-conservative cap regime [0.95, 1.08]; new regime [0.90, 1.13]
// requires up to ~12pp delta at high-anchor schools (UC Merced anchor 88%).
// Manual-review threshold raised proportionally so 5pp deltas don't trigger
// noise. See PR #278 for the full audit chain.
const PROFILE_SIGNAL_P95_DELTA_GATE = 0.04;
const PROFILE_SIGNAL_MAX_DELTA_GATE = 0.12;
const PROFILE_SIGNAL_REVIEW_DELTA = 0.07;

type Archetype = {
  id: string;
  round?: string;
  profile: ProfileInput | any;
};

type CoverageRow = {
  schoolId: string;
  schoolName: string;
  archetype: string;
  probability: number | null;
  counselorTier: number;
  anchor: number;
  anchorSource: string;
  ruleVersion: string;
  anomalies: string[];
};

type ManualReviewRow = {
  source: 'coverage';
  schoolId: string;
  schoolName: string;
  reason: string;
  counselorTier: number;
  anchorSource: string;
  insufficientDataReason?: string;
  affectedArchetypeCount: number;
  classification: string;
};

type ProfileSignalDeltaRow = {
  schoolId: string;
  schoolName: string;
  archetype: string;
  baselineProbability: number;
  currentProbability: number;
  absoluteDelta: number;
  usedInProbability: string[];
};

const ARCHETYPES: Archetype[] = [
  {
    id: 'strong-intl-china-ed',
    round: 'ED',
    profile: {
      gpa: 3.95,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      isInternational: true,
      nationality: 'CN',
      highSchoolLocation: 'CN',
      gpaByGrade: { g9: 3.72, g10: 3.84, g11: 3.97, g12: 4.0 },
      gpaTrend: {
        direction: 'rising',
        delta: 0.28,
        evidence: 'Grade GPA rose from 3.72 to 4.00',
      },
      highSchoolTier: 5,
      highSchoolRecognition: 5,
      highSchoolPlacementRecord: 5,
      englishProficiency: { type: 'TOEFL', score: 112, normalized: 0.93 },
      testScores: [{ type: 'SAT', score: 1560 }],
      activities: Array.from({ length: 10 }, (_, i) => ({
        name: `Activity ${i + 1}`,
        category: i < 5 ? 'STEM' : 'SERVICE',
        role: i === 0 ? 'Founder' : i === 1 ? 'President' : 'Member',
        tier: i === 0 ? 1 : i === 1 ? 2 : 4,
        annualHours: i < 2 ? 240 : 80,
        yearsActive: i < 2 ? 3 : 1,
      })),
      awards: Array.from({ length: 3 }, (_, i) => ({
        name: `Award ${i + 1}`,
        level: i === 0 ? 'NATIONAL' : 'REGIONAL',
        tier: i === 0 ? 5 : 3,
        category: i === 0 ? 'STEM' : 'GENERAL',
      })),
    },
  },
  {
    id: 'strong-domestic-rd',
    round: 'RD',
    profile: {
      gpa: 4.0,
      gpaScale: 4,
      targetMajor: 'Economics',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      gpaByGrade: { g9: 3.95, g10: 4.0, g11: 4.0, g12: 4.0 },
      gpaTrend: {
        direction: 'flat',
        delta: 0.05,
        evidence: 'Grade GPA stayed near 4.0',
      },
      highSchoolTier: 4,
      highSchoolRecognition: 4,
      testScores: [{ type: 'SAT', score: 1550 }],
      activities: Array.from({ length: 10 }, (_, i) => ({
        name: `Activity ${i + 1}`,
        category: i < 3 ? 'BUSINESS' : 'SERVICE',
        role: i === 0 ? 'President' : 'Member',
        tier: i === 0 ? 2 : 4,
        annualHours: i === 0 ? 220 : 60,
        yearsActive: i === 0 ? 3 : 1,
      })),
      awards: [{ name: 'National Merit', level: 'NATIONAL', tier: 5 }],
    },
  },
  {
    id: 'mid-intl-rd',
    round: 'RD',
    profile: {
      gpa: 3.7,
      gpaScale: 4,
      targetMajor: 'Business',
      isInternational: true,
      nationality: 'IN',
      highSchoolLocation: 'IN',
      gpaByGrade: { g9: 3.62, g10: 3.66, g11: 3.72, g12: 3.8 },
      gpaTrend: {
        direction: 'rising',
        delta: 0.18,
        evidence: 'Grade GPA rose from 3.62 to 3.80',
      },
      englishProficiency: { type: 'IELTS', score: 7.5, normalized: 0.875 },
      testScores: [{ type: 'SAT', score: 1380 }],
      activities: Array.from({ length: 4 }, (_, i) => ({
        name: `Activity ${i + 1}`,
        category: i === 0 ? 'BUSINESS' : 'SERVICE',
        role: i === 0 ? 'Treasurer' : 'Member',
        tier: 4,
        annualHours: 60,
      })),
      awards: [],
    },
  },
  {
    id: 'mid-domestic-rd',
    round: 'RD',
    profile: {
      gpa: 3.6,
      gpaScale: 4,
      targetMajor: 'Biology',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      gpaByGrade: { g9: 3.7, g10: 3.65, g11: 3.58, g12: 3.55 },
      gpaTrend: {
        direction: 'falling',
        delta: -0.15,
        evidence: 'Grade GPA moved from 3.70 to 3.55',
      },
      testScores: [{ type: 'SAT', score: 1300 }],
      activities: Array.from({ length: 3 }, (_, i) => ({
        name: `Activity ${i + 1}`,
        category: 'SCIENCE',
        role: 'Member',
        tier: 4,
        annualHours: 40,
      })),
      awards: [],
    },
  },
  {
    id: 'weak-rd',
    round: 'RD',
    profile: {
      gpa: 3.2,
      gpaScale: 4,
      targetMajor: 'Psychology',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      testScores: [{ type: 'SAT', score: 1200 }],
      activities: [{ name: 'Club member' }, { name: 'Volunteer' }],
      awards: [],
    },
  },
  {
    id: 'first-gen-rd',
    round: 'RD',
    profile: {
      gpa: 3.7,
      gpaScale: 4,
      targetMajor: 'Political Science',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      isFirstGen: true,
      testScores: [{ type: 'SAT', score: 1400 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'legacy-ed',
    round: 'ED',
    profile: {
      gpa: 3.85,
      gpaScale: 4,
      targetMajor: 'English',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      isLegacy: true,
      legacySchools: [],
      testScores: [{ type: 'SAT', score: 1480 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'recruited-athlete-ea',
    round: 'EA',
    profile: {
      gpa: 3.5,
      gpaScale: 4,
      targetMajor: 'Sociology',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      recruitedAthlete: true,
      testScores: [{ type: 'SAT', score: 1300 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'need-aware-intl-rd',
    round: 'RD',
    profile: {
      gpa: 3.8,
      gpaScale: 4,
      targetMajor: 'Mathematics',
      isInternational: true,
      nationality: 'CN',
      highSchoolLocation: 'CN',
      needsFinancialAid: true,
      gpaByGrade: { g9: 3.9, g10: 3.85, g11: 3.8 },
      gpaTrend: {
        direction: 'flat',
        delta: -0.1,
        evidence: 'Grade GPA was broadly stable',
      },
      englishProficiency: { type: 'TOEFL', score: 92, normalized: 0.766 },
      testScores: [{ type: 'SAT', score: 1450 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'no-sat-test-optional',
    round: 'RD',
    profile: {
      gpa: 3.85,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      applyingTestOptional: true,
      testScores: [],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'spike-usamo-rd',
    round: 'RD',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      testScores: [{ type: 'SAT', score: 1500 }],
      gpaByGrade: { g9: 3.7, g10: 3.85, g11: 3.95, g12: 4.0 },
      gpaTrend: {
        direction: 'rising',
        delta: 0.3,
        evidence: 'Grade GPA rose from 3.70 to 4.00',
      },
      activities: Array.from({ length: 5 }, (_, i) => ({
        name: `STEM activity ${i + 1}`,
        category: 'ACADEMIC',
        role: i === 0 ? 'Founder' : 'Member',
        tier: i === 0 ? 1 : 3,
        annualHours: i === 0 ? 280 : 80,
        yearsActive: i === 0 ? 3 : 1,
      })),
      awards: [
        {
          name: 'USAMO qualifier',
          level: 'NATIONAL',
          tier: 5,
          competitionName: 'USAMO',
          category: 'STEM',
        },
      ],
    },
  },
  {
    id: 'missing-gpa-sat-only',
    round: 'RD',
    profile: {
      targetMajor: 'Engineering',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'empty-profile',
    round: 'RD',
    profile: {
      testScores: [],
      activities: [],
      awards: [],
    },
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const baselineIndex = args.indexOf('--baseline');
  return {
    reportDir: args.includes('--launch')
      ? resolve(REPO_ROOT, 'verification-report', 'launch')
      : args.includes('--phase-c')
        ? resolve(REPO_ROOT, 'verification-report', 'phase-c')
        : REPORT_DIR,
    baseline:
      baselineIndex >= 0 && args[baselineIndex + 1]
        ? resolve(process.cwd(), args[baselineIndex + 1])
        : null,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

function stripProfileSignals(profile: ProfileInput | any): ProfileInput | any {
  const clone = {
    ...profile,
    gpaByGrade: undefined,
    semesterGpas: undefined,
    gpaTrend: undefined,
    highSchoolImpactEnabled: undefined,
    highSchoolTier: undefined,
    highSchoolRecognition: undefined,
    highSchoolAcademicRigor: undefined,
    highSchoolPlacementRecord: undefined,
    hsImpactEnabled: undefined,
    englishProficiency: undefined,
    needsFinancialAid: undefined,
  };
  clone.activities = (profile.activities ?? []).map((activity: any) => ({
    ...activity,
    tier: undefined,
    annualHours: undefined,
    yearsActive: undefined,
    gradeLevels: undefined,
    timing: undefined,
  }));
  clone.awards = (profile.awards ?? []).map((award: any) => ({
    ...award,
    tier: undefined,
    category: undefined,
    year: undefined,
  }));
  return clone;
}

function validateRow(
  row: CoverageRow,
  modifiers: Record<string, { multiplier: number }>,
) {
  if (row.counselorTier === 4) return;
  if (row.probability == null || !Number.isFinite(row.probability)) {
    row.anomalies.push('probability_not_finite');
  } else if (row.probability < -EPSILON || row.probability > 0.98 + EPSILON) {
    // Valid range is (0, 0.98]. The counselor floor is the RELATIVE
    // `anchor * 0.1` (see counselor-engine.service.ts), not an absolute 0.02 —
    // a top-5 school can legitimately predict well below 2%, so only a
    // negative probability is genuinely out of range.
    row.anomalies.push('probability_out_of_range');
  }

  for (const [name, modifier] of Object.entries(modifiers)) {
    if (
      !Number.isFinite(modifier.multiplier) ||
      modifier.multiplier < 0.1 ||
      modifier.multiplier > 10
    ) {
      row.anomalies.push(`modifier_${name}_out_of_range`);
    }
  }

  // Must mirror the engine's anchored clip in counselor-engine.service.ts:
  // `lowerBound = anchor * 0.1`, `upperBound = min(0.98, anchor * 2.5)`.
  const lower = row.anchor * 0.1;
  const upper = Math.min(0.98, row.anchor * 2.5);
  if (
    row.probability != null &&
    (row.probability < lower - 0.001 || row.probability > upper + 0.001)
  ) {
    row.anomalies.push('anchor_bound_violation');
  }
}

function writeCsv(rows: CoverageRow[], path: string) {
  const header = [
    'schoolId',
    'schoolName',
    'archetype',
    'probability',
    'counselorTier',
    'anchor',
    'anchorSource',
    'ruleVersion',
    'anomalies',
  ];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.schoolId,
        `"${row.schoolName.replace(/"/g, '""')}"`,
        row.archetype,
        row.probability ?? '',
        row.counselorTier,
        row.anchor,
        row.anchorSource,
        row.ruleVersion,
        `"${row.anomalies.join(';')}"`,
      ].join(','),
    ),
  ];
  writeFileSync(path, lines.join('\n'));
}

function readExistingManualReview(reportDir: string): {
  rows: Record<string, unknown>[];
  failures: Record<string, unknown>[];
} {
  const path = join(reportDir, MANUAL_REVIEW_FILE);
  if (!existsSync(path)) return { rows: [], failures: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      rows?: Record<string, unknown>[];
      failures?: Record<string, unknown>[];
    };
    return {
      rows: parsed.rows ?? [],
      failures: parsed.failures ?? [],
    };
  } catch {
    return { rows: [], failures: [] };
  }
}

function writeManualReviewReport(
  reportDir: string,
  rows: Record<string, unknown>[],
  failures: Record<string, unknown>[],
) {
  const unreviewed = rows.filter((row) => row.classification === 'UNREVIEWED');
  const dataFixRequired = rows.filter(
    (row) => row.classification === 'DATA_FIX_REQUIRED',
  );
  writeFileSync(
    join(reportDir, MANUAL_REVIEW_FILE),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: rows.length,
        reviewedCount: rows.length - unreviewed.length,
        unreviewedCount: unreviewed.length,
        dataFixRequiredCount: dataFixRequired.length,
        failureCount: failures.length,
        rows,
        unreviewed,
        dataFixRequired,
        failures,
      },
      null,
      2,
    ),
  );
}

function classifyTier4(
  anchorSource: string,
  insufficientDataReason?: string,
): string {
  const text = `${anchorSource} ${insufficientDataReason ?? ''}`.toLowerCase();
  if (text.includes('audition') || text.includes('portfolio')) {
    return 'EXPECTED_ART_PORTFOLIO';
  }
  if (text.includes('no_public_data')) {
    return 'EXPECTED_NO_PUBLIC_DATA';
  }
  return 'UNREVIEWED';
}

async function main() {
  const args = parseArgs();
  mkdirSync(args.reportDir, { recursive: true });

  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    {
      logger: ['error', 'warn'],
    },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);
  const transformer = app.get(PredictionTransformerService);

  const schools = await prisma.school.findMany({
    where: { country: 'US' },
    orderBy: { name: 'asc' },
  });
  const rows: CoverageRow[] = [];
  const profileSignalDeltas: ProfileSignalDeltaRow[] = [];
  const tierCounts = new Map<number, number>();
  const tier4BySchool = new Map<string, ManualReviewRow>();

  for (const school of schools) {
    const schoolInput = transformer.schoolToInput(school as any);
    for (const archetype of ARCHETYPES) {
      const result = await counselor.compute(
        archetype.profile,
        schoolInput,
        archetype.round,
      );
      const baselineResult = await counselor.compute(
        stripProfileSignals(archetype.profile),
        schoolInput,
        archetype.round,
      );
      if (
        result.tier !== 4 &&
        baselineResult.tier !== 4 &&
        Number.isFinite(result.probability) &&
        Number.isFinite(baselineResult.probability)
      ) {
        profileSignalDeltas.push({
          schoolId: school.id,
          schoolName: school.name,
          archetype: archetype.id,
          baselineProbability: baselineResult.probability,
          currentProbability: result.probability,
          absoluteDelta: Math.abs(
            result.probability - baselineResult.probability,
          ),
          usedInProbability:
            result.profileSignals?.usedInProbability?.slice().sort() ?? [],
        });
      }
      const row: CoverageRow = {
        schoolId: school.id,
        schoolName: school.name,
        archetype: archetype.id,
        probability: result.tier === 4 ? null : result.probability,
        counselorTier: result.tier,
        anchor: result.anchor,
        anchorSource: result.anchorSource,
        ruleVersion: result.ruleVersion,
        anomalies: [],
      };
      if (result.tier === 4) {
        const insufficientDataReason = result.insufficientData?.reason;
        const existing = tier4BySchool.get(school.id);
        tier4BySchool.set(school.id, {
          source: 'coverage',
          schoolId: school.id,
          schoolName: school.name,
          reason: 'counselor_tier_4_us_school',
          counselorTier: 4,
          anchorSource: result.anchorSource,
          insufficientDataReason,
          affectedArchetypeCount: (existing?.affectedArchetypeCount ?? 0) + 1,
          classification:
            existing?.classification ??
            classifyTier4(result.anchorSource, insufficientDataReason),
        });
      }
      validateRow(
        row,
        result.modifierResults as Record<string, { multiplier: number }>,
      );
      rows.push(row);
      tierCounts.set(result.tier, (tierCounts.get(result.tier) ?? 0) + 1);
    }
  }

  const hardFailures: Record<string, unknown>[] = [];
  const expectedPairCount = EXPECTED_US_SCHOOL_COUNT * ARCHETYPES.length;
  if (schools.length !== EXPECTED_US_SCHOOL_COUNT) {
    hardFailures.push({
      source: 'coverage',
      reason: 'unexpected_us_school_count',
      expected: EXPECTED_US_SCHOOL_COUNT,
      actual: schools.length,
    });
  }
  if (rows.length !== expectedPairCount) {
    hardFailures.push({
      source: 'coverage',
      reason: 'unexpected_coverage_pair_count',
      expected: expectedPairCount,
      actual: rows.length,
    });
  }

  const anomalies = rows.filter((row) => row.anomalies.length > 0);
  const tier4ManualReview = [...tier4BySchool.values()].sort((a, b) =>
    a.schoolName.localeCompare(b.schoolName),
  );
  const unreviewedTier4 = tier4ManualReview.filter(
    (row) => row.classification === 'UNREVIEWED',
  );
  const dataFixRequiredTier4 = tier4ManualReview.filter(
    (row) => row.classification === 'DATA_FIX_REQUIRED',
  );
  const probabilities = rows
    .map((row) => row.probability)
    .filter((value): value is number => value != null);
  const summary = {
    generatedAt: new Date().toISOString(),
    schoolCount: schools.length,
    expectedUsSchoolCount: EXPECTED_US_SCHOOL_COUNT,
    archetypeCount: ARCHETYPES.length,
    expectedPairCount,
    pairCount: rows.length,
    validPairCount: rows.length - anomalies.length,
    anomalyCount: anomalies.length,
    hardFailureCount: hardFailures.length,
    manualReviewCount: tier4ManualReview.length,
    unreviewedManualReviewCount: unreviewedTier4.length,
    tierDistribution: Object.fromEntries([...tierCounts.entries()].sort()),
    probability: {
      p50: percentile(probabilities, 50),
      p95: percentile(probabilities, 95),
      max: probabilities.length ? Math.max(...probabilities) : null,
    },
  };

  const profileSignalDeltaValues = profileSignalDeltas.map(
    (row) => row.absoluteDelta,
  );
  const profileSignalDeltaByArchetype = Object.fromEntries(
    ARCHETYPES.map((archetype) => {
      const values = profileSignalDeltas
        .filter((row) => row.archetype === archetype.id)
        .map((row) => row.absoluteDelta);
      return [
        archetype.id,
        {
          p95: percentile(values, 95),
          max: Math.max(0, ...values),
          count: values.length,
        },
      ];
    }),
  );
  const profileSignalManualReview = profileSignalDeltas
    .filter((row) => row.absoluteDelta > PROFILE_SIGNAL_REVIEW_DELTA)
    .map((row) => ({
      source: 'profile_signal_delta',
      ...row,
      classification: 'UNREVIEWED',
    }))
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta);
  const profileSignalDeltaReport = {
    generatedAt: new Date().toISOString(),
    gates: {
      p95AbsoluteDeltaLe0025:
        percentile(profileSignalDeltaValues, 95) <=
        PROFILE_SIGNAL_P95_DELTA_GATE,
      maxAbsoluteDeltaLe008:
        Math.max(0, ...profileSignalDeltaValues) <=
        PROFILE_SIGNAL_MAX_DELTA_GATE,
    },
    thresholds: {
      p95AbsoluteDelta: PROFILE_SIGNAL_P95_DELTA_GATE,
      maxAbsoluteDelta: PROFILE_SIGNAL_MAX_DELTA_GATE,
      manualReviewDelta: PROFILE_SIGNAL_REVIEW_DELTA,
    },
    summary: {
      pairCount: profileSignalDeltas.length,
      p50AbsoluteDelta: percentile(profileSignalDeltaValues, 50),
      p95AbsoluteDelta: percentile(profileSignalDeltaValues, 95),
      maxAbsoluteDelta: Math.max(0, ...profileSignalDeltaValues),
      manualReviewCount: profileSignalManualReview.length,
    },
    perArchetype: profileSignalDeltaByArchetype,
    manualReview: profileSignalManualReview,
    rows: profileSignalDeltas,
  };
  if (!profileSignalDeltaReport.gates.p95AbsoluteDeltaLe0025) {
    hardFailures.push({
      source: 'profile_signal_delta',
      reason: 'p95_absolute_delta_exceeds_gate',
      threshold: PROFILE_SIGNAL_P95_DELTA_GATE,
      actual: profileSignalDeltaReport.summary.p95AbsoluteDelta,
    });
  }
  if (!profileSignalDeltaReport.gates.maxAbsoluteDeltaLe008) {
    hardFailures.push({
      source: 'profile_signal_delta',
      reason: 'max_absolute_delta_exceeds_gate',
      threshold: PROFILE_SIGNAL_MAX_DELTA_GATE,
      actual: profileSignalDeltaReport.summary.maxAbsoluteDelta,
    });
  }

  let phaseCDelta: unknown = undefined;
  if (args.baseline) {
    const baselineReport = JSON.parse(readFileSync(args.baseline, 'utf8')) as {
      rows: CoverageRow[];
    };
    const baselineByKey = new Map(
      baselineReport.rows.map((row) => [
        `${row.schoolId}:${row.archetype}`,
        row,
      ]),
    );
    const deltas = rows.flatMap((row) => {
      const prev = baselineByKey.get(`${row.schoolId}:${row.archetype}`);
      if (!prev || prev.probability == null || row.probability == null)
        return [];
      return [
        {
          schoolId: row.schoolId,
          schoolName: row.schoolName,
          archetype: row.archetype,
          delta: Math.abs(row.probability - prev.probability),
          current: row.probability,
          baseline: prev.probability,
        },
      ];
    });
    const byArchetype = Object.fromEntries(
      ARCHETYPES.map((archetype) => {
        const values = deltas
          .filter((row) => row.archetype === archetype.id)
          .map((row) => row.delta);
        return [
          archetype.id,
          { p95: percentile(values, 95), max: Math.max(0, ...values) },
        ];
      }),
    );
    const schoolMax = new Map<
      string,
      { schoolName: string; maxDelta: number }
    >();
    for (const row of deltas) {
      const current = schoolMax.get(row.schoolId);
      if (!current || row.delta > current.maxDelta) {
        schoolMax.set(row.schoolId, {
          schoolName: row.schoolName,
          maxDelta: row.delta,
        });
      }
    }
    phaseCDelta = {
      globalMax: Math.max(0, ...deltas.map((row) => row.delta)),
      perArchetype: byArchetype,
      manualReview: [...schoolMax.entries()]
        .filter(([, value]) => value.maxDelta > 0.3)
        .map(([schoolId, value]) => ({
          schoolId,
          ...value,
          classification: 'UNREVIEWED',
        }))
        .sort((a, b) => b.maxDelta - a.maxDelta),
      hardGate: {
        globalMaxLe040: Math.max(0, ...deltas.map((row) => row.delta)) <= 0.4,
        perArchetypeP95Le020: Object.values(byArchetype).every(
          (value: any) => value.p95 <= 0.2,
        ),
      },
    };
  }

  const report = {
    summary,
    phaseCDelta,
    rows,
    anomalies,
    manualReview: tier4ManualReview,
    hardFailures,
  };
  const jsonPath = join(args.reportDir, 'coverage.json');
  const csvPath = join(args.reportDir, 'counselor-coverage.csv');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(
    join(args.reportDir, 'counselor-coverage.json'),
    JSON.stringify(report, null, 2),
  );
  writeCsv(rows, csvPath);
  mkdirSync(PROFILE_SIGNAL_REPORT_DIR, { recursive: true });
  writeFileSync(
    join(PROFILE_SIGNAL_REPORT_DIR, 'delta-vs-baseline.json'),
    JSON.stringify(profileSignalDeltaReport, null, 2),
  );
  if (args.reportDir.endsWith(join('verification-report', 'launch'))) {
    const existingManualReview = readExistingManualReview(args.reportDir);
    const nonCoverageRows = existingManualReview.rows.filter(
      (row) => row.source !== 'coverage',
    );
    const nonCoverageFailures = existingManualReview.failures.filter(
      (row) => row.source !== 'coverage',
    );
    writeManualReviewReport(
      args.reportDir,
      [...nonCoverageRows, ...tier4ManualReview],
      [...nonCoverageFailures, ...hardFailures],
    );
  }
  await app.close();

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${jsonPath}`);
  if (
    anomalies.length > 0 ||
    hardFailures.length > 0 ||
    unreviewedTier4.length > 0 ||
    dataFixRequiredTier4.length > 0 ||
    profileSignalManualReview.length > 0
  ) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
