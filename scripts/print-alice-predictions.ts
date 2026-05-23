/**
 * Standalone debug script: print M3 predictions for Alice Zhang's profile
 * against each of the 4 V3 benchmark schools, plus key contributions.
 *
 * Does NOT write to DB. Pure local diagnostic.
 *
 * Usage: pnpm exec tsx scripts/print-alice-predictions.ts
 */
import { PrismaClient } from '@prisma/client';
import { predict } from './m3-bayesian-engine';

const prisma = new PrismaClient();

const ALICE_PROFILE = {
  gpa: 3.95,
  gpaScale: 4.0,
  satWritingOrTotal: 1560,
  applicationRound: 'EA', // overridden per case
  targetMajor: 'Computer Science',
  intendedMajor: 'Computer Science',
  international: true,
  isInternational: true,
  firstGeneration: false,
  recruitedAthlete: false,
  legacy: [],
  gpaTrend: 'UPWARD',
  testOptional: false,
  testScores: [
    { type: 'SAT', score: 1560 },
    { type: 'TOEFL', score: 115 },
    { type: 'AP', score: 5 },
    { type: 'AP', score: 5 },
    { type: 'AP', score: 5 },
  ],
  apCount: 3,
  activities: [
    {
      name: 'AI for Education Research',
      category: 'RESEARCH',
      role: 'Lead Researcher',
      hoursPerWeek: 15,
      weeksPerYear: 40,
    },
    {
      name: 'Programming Club',
      category: 'ACADEMIC',
      role: 'President & Founder',
      hoursPerWeek: 10,
      weeksPerYear: 36,
    },
    {
      name: 'Rural Education Volunteer',
      category: 'COMMUNITY_SERVICE',
      role: 'Program Director',
      hoursPerWeek: 8,
      weeksPerYear: 30,
    },
    {
      name: 'Competitive Programming',
      category: 'ACADEMIC',
      role: 'Team Captain',
      hoursPerWeek: 12,
      weeksPerYear: 40,
    },
  ],
  awards: [
    { name: 'USACO Platinum', level: 'NATIONAL', year: 2025 },
    { name: 'NOIP First Prize', level: 'NATIONAL', year: 2024 },
    { name: 'AMC 12 140+', level: 'NATIONAL', year: 2025 },
    { name: 'Intel ISEF Finalist', level: 'INTERNATIONAL', year: 2025 },
  ],
};

const CASES = [
  { nameNorm: 'stanford university', round: 'REA' },
  { nameNorm: 'massachusetts institute of technology', round: 'EA' },
  { nameNorm: 'carnegie mellon university', round: 'ED' },
  { nameNorm: 'university of michigan, ann arbor', round: 'EA' },
];

async function main() {
  for (const c of CASES) {
    const school = await prisma.school.findFirst({ where: { nameNorm: c.nameNorm } });
    if (!school) {
      console.log(`SKIP: ${c.nameNorm} (not in local DB)`);
      continue;
    }
    const bands = await prisma.schoolCdsAdmitBand.findMany({ where: { schoolId: school.id } });
    (school as any)._cdsBands = bands.map((b) => ({
      gpaBand: b.gpaBand,
      testType: b.testType,
      testBand: b.testBand,
      admitRate: Number(b.admitRate),
    }));

    const profile = { ...ALICE_PROFILE, applicationRound: c.round };
    const out = predict(profile, school);

    console.log(`\n═══ ${school.name} (${c.round}) ═══`);
    console.log(`  Predicted: ${(out.probability * 100).toFixed(1)}%`);
    console.log(`  Tier: ${out.tier}    Confidence: ${out.confidence}`);
    console.log(`  School overall accept: ${school.acceptanceRate ?? 'n/a'}%`);
    console.log(
      `  School ED/EA rate:     ${school.edAcceptanceRate ?? school.eaAcceptanceRate ?? 'n/a'}%`
    );
    console.log(`  CDS bands available:   ${bands.length}`);
    console.log(
      `  Data tier:             ${(school as any).admitProfileConfidenceTier ?? 'UNFLAGGED'}`
    );
    if (out.contributions && out.contributions.length > 0) {
      console.log(`  Top contributions:`);
      const sorted = [...out.contributions].sort(
        (a: any, b: any) => Math.abs(b.deltaPp ?? 0) - Math.abs(a.deltaPp ?? 0)
      );
      for (const c of sorted.slice(0, 5)) {
        const cb = c as any;
        console.log(
          `    • ${cb.dimension.padEnd(20)} value=${String(cb.studentValue).slice(0, 30).padEnd(30)} LR=${(cb.likelihoodRatio ?? 0).toFixed(2)}× Δ=${((cb.deltaPp ?? 0) * 100).toFixed(1)}pp [${cb.tier ?? '?'}]`
        );
      }
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
