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
import { runStructuralBenchmarkProgrammatic } from './m3-structural-benchmark';

const prisma = new PrismaClient();

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

async function runV3Cases(): Promise<CaseReplayResult[]> {
  // Use Alice Zhang's seeded profile if present; fall back to a synthetic
  // top-bracket profile so the script still works on a fresh DB.
  let profile: any = await prisma.profile.findFirst({
    where: { user: { email: 'alice.zhang@demo.studyabroad.com' } },
    include: { activities: true, awards: true, testScores: true },
  });
  if (!profile) {
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
    });
  }
  return out;
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

  console.log('Running 4 v3 ADMITTED case replays...');
  const cases = await runV3Cases();
  console.log(`  ${cases.length} cases replayed`);

  const summary = {
    structuralTestsPassed: structural.passed,
    structuralTestsTotal: structural.total,
    casesReplayed: cases.length,
    casesAdmittedMeanProb:
      cases.length > 0 ? cases.reduce((a, c) => a + c.predictedProbability, 0) / cases.length : 0,
    casesAdmittedMaxProb: Math.max(...cases.map((c) => c.predictedProbability), 0),
    casesAdmittedMinProb: Math.min(...cases.map((c) => c.predictedProbability), 1),
  };

  const run = await prisma.predictionBenchmarkRun.create({
    data: {
      label,
      engineVersion: `m3-${gitSha()}`,
      testsPassed: structural.passed,
      testsTotal: structural.total,
      summary: summary as any,
      tests: structural.results as any,
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
