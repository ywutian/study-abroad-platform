/**
 * Seed a PredictionBenchmarkRun row from a fresh local run of:
 *   - scripts/m3-structural-benchmark.ts  (7 structural tests)
 *   - scripts/m3-bayesian-engine.ts       (4 v3 ADMITTED cases)
 *
 * Captures both as a single PredictionBenchmarkRun row so the admin
 * /admin/prediction-benchmark page can co-review.
 *
 * Run:
 *   pnpm exec tsx scripts/seed-prediction-benchmark.ts \
 *     [--label="post-T100-seed"] [--notes="brief context"]
 *
 * Idempotency: NOT idempotent — each invocation creates a new row.
 * That's by design (history of runs over time is the whole point).
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

import { predict, type PredictionOutput } from './m3-bayesian-engine';
import { runGoldenFixtures, type FixtureResult } from './m3-golden-fixtures';
import { runStructuralBenchmarkProgrammatic } from './m3-structural-benchmark';

const prisma = new PrismaClient();

interface ProfileSnapshot {
  source: 'real-user' | 'synthetic';
  gpa: number | null;
  gpaScale: number | null;
  satTotal: number | null;
  actComposite: number | null;
  toefl: number | null;
  applicationRound: string | null;
  targetMajor: string | null;
  isInternational: boolean;
  isFirstGeneration: boolean;
  isRecruitedAthlete: boolean;
  legacyAtSchools: string[];
  activityCount: number;
  awardCount: number;
  topAwardLevel: string | null;
  apCount: number | null;
  gpaTrend: string | null;
  testOptional: boolean;
}

interface SchoolAnchorSnapshot {
  schoolId: string;
  acceptanceRate: number | null;
  edAcceptanceRate: number | null;
  eaAcceptanceRate: number | null;
  intlAcceptanceRate: number | null;
  sat25: number | null;
  sat75: number | null;
  act25: number | null;
  act75: number | null;
  hasGpaDistribution: boolean;
  legacyClassPct: number | null;
  athleteClassPct: number | null;
  firstGenClassPct: number | null;
  legacyAdmitMultiplier: number | null;
  athleteAdmitMultiplier: number | null;
  admitProfileConfidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  admitProfileSource: string | null;
  admitProfileCycleYear: number | null;
  cdsBandCount: number;
}

interface CaseReplayResult {
  caseId: string;
  schoolName: string;
  round: string;
  expectedOutcome: 'ADMITTED' | 'WAITLISTED' | 'REJECTED' | 'DEFERRED';
  predictedProbability: number;
  tier: string;
  confidence: string;
  contributions: Array<{
    dimension: string;
    studentValue: string | number | boolean | null;
    schoolAnchor: string;
    likelihoodRatio: number;
    weight: number;
    tier: string;
    deltaPp: number;
    source: string;
  }>;
  profileSnapshot?: ProfileSnapshot;
  schoolAnchorSnapshot?: SchoolAnchorSnapshot;
}

function nullableNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildProfileSnapshot(
  profile: any,
  source: 'real-user' | 'synthetic',
  round: string
): ProfileSnapshot {
  const testScores = Array.isArray(profile.testScores) ? profile.testScores : [];
  const findScore = (type: string) => testScores.find((s: any) => s?.type === type)?.score ?? null;
  const awards = Array.isArray(profile.awards) ? profile.awards : [];
  const awardLevels = awards.map((a: any) => a?.level).filter(Boolean) as string[];
  const levelRank: Record<string, number> = {
    INTERNATIONAL: 5,
    National: 4,
    NATIONAL: 4,
    STATE: 3,
    REGIONAL: 2,
    SCHOOL: 1,
  };
  const topLevel =
    awardLevels.length === 0
      ? null
      : awardLevels.reduce((max, lvl) =>
          (levelRank[lvl] ?? 0) > (levelRank[max] ?? 0) ? lvl : max
        );

  return {
    source,
    gpa: nullableNumber(profile.gpa),
    gpaScale: nullableNumber(profile.gpaScale),
    satTotal:
      nullableNumber(profile.sat) ?? nullableNumber(profile.satWritingOrTotal) ?? findScore('SAT'),
    actComposite: nullableNumber(profile.act) ?? findScore('ACT'),
    toefl: findScore('TOEFL'),
    applicationRound: round ?? profile.applicationRound ?? null,
    targetMajor: profile.intendedMajor ?? profile.targetMajor ?? null,
    isInternational: !!profile.international || !!profile.isInternational,
    isFirstGeneration: !!profile.firstGeneration || !!profile.isFirstGen,
    isRecruitedAthlete: !!profile.recruitedAthlete,
    legacyAtSchools: Array.isArray(profile.legacy)
      ? profile.legacy.filter((s: any) => typeof s === 'string')
      : [],
    activityCount: Array.isArray(profile.activities) ? profile.activities.length : 0,
    awardCount: awards.length,
    topAwardLevel: topLevel,
    apCount: nullableNumber(profile.apCount),
    gpaTrend: profile.gpaTrend ?? null,
    testOptional: !!profile.testOptional,
  };
}

async function buildSchoolAnchorSnapshot(schoolId: string): Promise<SchoolAnchorSnapshot> {
  const school: any = await prisma.school.findUnique({
    where: { id: schoolId },
  });
  const cdsBandCount = await prisma.schoolCdsAdmitBand.count({
    where: { schoolId },
  });
  return {
    schoolId,
    acceptanceRate: nullableNumber(school?.acceptanceRate),
    edAcceptanceRate: nullableNumber(school?.edAcceptanceRate),
    eaAcceptanceRate: nullableNumber(school?.eaAcceptanceRate),
    intlAcceptanceRate: nullableNumber(school?.intlAcceptanceRate),
    sat25: nullableNumber(school?.sat25),
    sat75: nullableNumber(school?.sat75),
    act25: nullableNumber(school?.act25),
    act75: nullableNumber(school?.act75),
    hasGpaDistribution: !!school?.gpaDistribution,
    legacyClassPct: nullableNumber(school?.legacyClassPct),
    athleteClassPct: nullableNumber(school?.athleteClassPct),
    firstGenClassPct: nullableNumber(school?.firstGenClassPct),
    legacyAdmitMultiplier: nullableNumber(school?.legacyAdmitMultiplier),
    athleteAdmitMultiplier: nullableNumber(school?.athleteAdmitMultiplier),
    admitProfileConfidenceTier:
      (school?.admitProfileConfidenceTier as 'HIGH' | 'MEDIUM' | 'LOW' | null) ?? null,
    admitProfileSource: school?.admitProfileSource ?? null,
    admitProfileCycleYear: school?.admitProfileCycleYear ?? null,
    cdsBandCount,
  };
}

const V3_CASES: Array<{
  caseId: string;
  nameNorm: string;
  displayName: string;
  round: string;
  expectedOutcome: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
}> = [
  {
    caseId: 'stanford-rea',
    nameNorm: 'stanford university',
    displayName: 'Stanford University',
    round: 'REA',
    expectedOutcome: 'ADMITTED',
  },
  {
    caseId: 'mit-ea',
    nameNorm: 'massachusetts institute of technology',
    displayName: 'Massachusetts Institute of Technology',
    round: 'EA',
    expectedOutcome: 'ADMITTED',
  },
  {
    caseId: 'cmu-ed',
    nameNorm: 'carnegie mellon university',
    displayName: 'Carnegie Mellon University',
    round: 'ED',
    expectedOutcome: 'ADMITTED',
  },
  {
    caseId: 'umich-ea',
    nameNorm: 'university of michigan, ann arbor',
    displayName: 'University of Michigan, Ann Arbor',
    round: 'EA',
    expectedOutcome: 'ADMITTED',
  },
];

async function runV3Cases(): Promise<{
  cases: CaseReplayResult[];
  profileSource: 'real-user' | 'synthetic';
}> {
  // Use Alice Zhang's seeded profile if present; fall back to a synthetic
  // top-bracket profile so the script still works on a fresh DB.
  let profile: any = await prisma.profile.findFirst({
    where: { user: { email: 'alice.zhang@demo.studyabroad.com' } },
    include: { activities: true, awards: true, testScores: true },
  });
  let profileSource: 'real-user' | 'synthetic' = 'real-user';
  if (!profile) {
    profileSource = 'synthetic';
    profile = {
      gpa: 3.95,
      gpaScale: 4.0,
      sat: 1580,
      satWritingOrTotal: 1580,
      applicationRound: 'RD',
      intendedMajor: 'Computer Science',
      activities: [
        {
          name: 'Robotics Club',
          role: 'Captain',
          hoursPerWeek: 15,
          weeksPerYear: 40,
          yearsActive: 4,
        },
        {
          name: 'Math Olympiad',
          role: 'Member',
          hoursPerWeek: 5,
          weeksPerYear: 40,
          yearsActive: 3,
        },
      ],
      awards: [{ name: 'USAMO Honor Roll', level: 'National' }],
      apCount: 12,
      international: false,
      firstGeneration: false,
      recruitedAthlete: false,
      legacy: [],
      gpaTrend: 'UPWARD',
      testOptional: false,
    };
  }

  const out: CaseReplayResult[] = [];
  for (const c of V3_CASES) {
    const school = await prisma.school.findFirst({
      where: { nameNorm: c.nameNorm },
    });
    if (!school) {
      console.warn(`  ⚠️  School not found: ${c.displayName}, skipping`);
      continue;
    }
    const bands = await prisma.schoolCdsAdmitBand.findMany({
      where: { schoolId: school.id },
    });
    (school as any)._cdsBands = bands.map((b) => ({
      gpaBand: b.gpaBand,
      testType: b.testType,
      testBand: b.testBand,
      admitRate: Number(b.admitRate),
    }));

    const stagedProfile = { ...profile, applicationRound: c.round };
    const prediction: PredictionOutput = predict(stagedProfile, school);
    const schoolAnchorSnapshot = await buildSchoolAnchorSnapshot(school.id);
    out.push({
      caseId: c.caseId,
      schoolName: c.displayName,
      round: c.round,
      expectedOutcome: c.expectedOutcome,
      predictedProbability: prediction.probability,
      tier: prediction.tier,
      confidence: prediction.confidence,
      contributions: (prediction.contributions ?? []).map((cb: any) => ({
        dimension: cb.dimension,
        studentValue:
          typeof cb.studentValue === 'object'
            ? JSON.stringify(cb.studentValue)
            : (cb.studentValue ?? null),
        schoolAnchor: cb.schoolAnchor ?? '',
        likelihoodRatio: cb.likelihoodRatio ?? 0,
        weight: cb.weight ?? 0,
        tier: cb.tier ?? 'UNKNOWN',
        deltaPp: cb.deltaPp ?? 0,
        source: cb.source ?? '',
      })),
      profileSnapshot: buildProfileSnapshot(profile, profileSource, c.round),
      schoolAnchorSnapshot,
    });
  }
  return { cases: out, profileSource };
}

/**
 * Aggregate tier breakdown across all schools touched by this run.
 * Powers the "Data Sources" card on the admin page so reviewers know
 * what fraction of school anchors are Claude-inferred (MEDIUM) vs real
 * (HIGH) vs global fallback (LOW).
 */
async function buildDataSourceBreakdown(usedSchoolIds: string[]) {
  if (usedSchoolIds.length === 0) {
    return {
      schoolsUsed: 0,
      byTier: { HIGH: 0, MEDIUM: 0, LOW: 0, UNFLAGGED: 0 },
      cdsBandsAvailable: 0,
      globalBaselinesUsed: 0,
    };
  }
  const tierRows = await prisma.$queryRaw<Array<{ tier: string | null; n: bigint }>>`
    SELECT "admitProfileConfidenceTier" AS tier, COUNT(*)::bigint AS n
    FROM "School"
    WHERE id = ANY(${usedSchoolIds}::text[])
    GROUP BY "admitProfileConfidenceTier"
  `;
  const byTier = { HIGH: 0, MEDIUM: 0, LOW: 0, UNFLAGGED: 0 };
  for (const row of tierRows) {
    const key =
      row.tier === 'HIGH' || row.tier === 'MEDIUM' || row.tier === 'LOW' ? row.tier : 'UNFLAGGED';
    byTier[key] = Number(row.n);
  }
  const cdsBandsAvailable = await prisma.schoolCdsAdmitBand.count({
    where: { schoolId: { in: usedSchoolIds } },
  });
  const globalBaselinesUsed = await prisma.globalAdmitBaseline.count();
  return {
    schoolsUsed: usedSchoolIds.length,
    byTier,
    cdsBandsAvailable,
    globalBaselinesUsed,
  };
}

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function main() {
  const args = process.argv.slice(2);
  const label = args.find((a) => a.startsWith('--label='))?.split('=')[1] ?? null;
  const notes = args.find((a) => a.startsWith('--notes='))?.split('=')[1] ?? null;

  console.log('Running M3 structural benchmark (7 tests)...');
  const structural = await runStructuralBenchmarkProgrammatic();
  console.log(`  ${structural.passed}/${structural.total} tests passed`);

  console.log('Running M3 golden fixtures (20 cases)...');
  const fixtures = await runGoldenFixtures();
  console.log(`  ${fixtures.passed}/${fixtures.total} fixtures passed`);

  console.log('Running 4 v3 ADMITTED case replays...');
  const { cases, profileSource } = await runV3Cases();
  console.log(`  ${cases.length} cases replayed (profile source: ${profileSource})`);

  const usedSchoolIds = cases
    .map((c) => c.schoolAnchorSnapshot?.schoolId)
    .filter((v): v is string => !!v);
  const dataSources = await buildDataSourceBreakdown(usedSchoolIds);
  console.log(
    `  Data tier breakdown: HIGH=${dataSources.byTier.HIGH}, MEDIUM=${dataSources.byTier.MEDIUM}, LOW=${dataSources.byTier.LOW}, UNFLAGGED=${dataSources.byTier.UNFLAGGED}`
  );

  // Convert FixtureResult → same shape as structural TestResult so the admin
  // UI renders them in the same `tests` list. The fixture id + group prefix
  // makes the source identifiable when scanning the UI.
  const fixtureTestEntries = fixtures.results.map((fx: FixtureResult) => ({
    name: `Fixture ${fx.id} (${fx.group}) — ${fx.schoolDisplay} (${fx.baseRound})`,
    passed: fx.passed,
    details: fx.details,
    metrics: {
      group: fx.group,
      school: fx.schoolDisplay,
      round: fx.baseRound,
      primaryProb: `${(fx.outputs.primary.probability * 100).toFixed(1)}%`,
      primaryTier: fx.outputs.primary.tier,
      primaryConfidence: fx.outputs.primary.confidence,
      ...(fx.outputs.secondary
        ? {
            secondaryLabel: fx.outputs.secondary.label,
            secondaryProb: `${(fx.outputs.secondary.probability * 100).toFixed(1)}%`,
            secondaryTier: fx.outputs.secondary.tier,
          }
        : {}),
    },
    failures: fx.failures.length > 0 ? fx.failures : undefined,
  }));

  // Group fixtures by scenario for the summary card.
  const fixturesByGroup: Record<string, { passed: number; total: number }> = {};
  for (const fx of fixtures.results) {
    const g = fixturesByGroup[fx.group] ?? { passed: 0, total: 0 };
    g.total += 1;
    if (fx.passed) g.passed += 1;
    fixturesByGroup[fx.group] = g;
  }

  const summary = {
    structuralTestsPassed: structural.passed,
    structuralTestsTotal: structural.total,
    fixturesPassed: fixtures.passed,
    fixturesTotal: fixtures.total,
    fixturesByGroup,
    casesReplayed: cases.length,
    casesAdmittedMeanProb:
      cases.length > 0 ? cases.reduce((a, c) => a + c.predictedProbability, 0) / cases.length : 0,
    casesAdmittedMaxProb: Math.max(...cases.map((c) => c.predictedProbability), 0),
    casesAdmittedMinProb: Math.min(...cases.map((c) => c.predictedProbability), 1),
    dataSources,
  };

  const allTests = [...structural.results, ...fixtureTestEntries];

  const run = await prisma.predictionBenchmarkRun.create({
    data: {
      label,
      engineVersion: `m3-${gitSha()}`,
      testsPassed: structural.passed + fixtures.passed,
      testsTotal: structural.total + fixtures.total,
      summary: summary as any,
      tests: allTests as any,
      cases: cases as any,
      notes,
    },
  });

  console.log(`\n✅ PredictionBenchmarkRun created: id=${run.id}`);
  console.log(`   View at: /admin/prediction-benchmark`);
  console.log(`   Summary:`, JSON.stringify(summary, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
