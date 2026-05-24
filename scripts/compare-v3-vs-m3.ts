/**
 * Compare v3 fusion (prod persisted) vs M3 Bayesian (live) for Alice Zhang ×
 * the 4 V3_CASES schools. Throwaway diagnostic — answers the question
 * "what number do users actually see vs what M3 says they should see?"
 *
 * Usage: with Cloud SQL Proxy live:
 *   DATABASE_URL='postgresql://studyabroad:<password>@127.0.0.1:5433/study_abroad' \
 *     pnpm exec tsx scripts/compare-v3-vs-m3.ts
 */
import { PrismaClient } from '@prisma/client';
import { predict } from './m3-bayesian-engine';

const prisma = new PrismaClient();

const V3_CASES = [
  { nameNorm: 'stanford university', display: 'Stanford', round: 'REA' },
  { nameNorm: 'massachusetts institute of technology', display: 'MIT', round: 'EA' },
  { nameNorm: 'carnegie mellon university', display: 'CMU', round: 'ED' },
  { nameNorm: 'university of michigan, ann arbor', display: 'UMich', round: 'EA' },
];

async function main() {
  const profile: any = await prisma.profile.findFirst({
    where: { user: { email: 'alice.zhang@demo.studyabroad.com' } },
    include: { activities: true, awards: true, testScores: true, user: true },
  });
  if (!profile) {
    console.log('Alice profile not found in prod DB');
    await prisma.$disconnect();
    return;
  }

  console.log('═══ Alice Zhang on PROD DB ═══');
  console.log(`  profileId:      ${profile.id}`);
  console.log(`  GPA / scale:    ${profile.gpa} / ${profile.gpaScale}`);
  console.log(`  Major:          ${profile.targetMajor}`);
  console.log(`  Round:          ${profile.applicationRound}`);
  console.log(`  Activities:     ${profile.activities.length}`);
  console.log(`  Awards:         ${profile.awards.length}`);
  console.log(`  TestScores:     ${profile.testScores.length}`);
  console.log(`  nationality:    ${profile.nationality ?? '(null — engine treats as domestic)'}`);

  console.log('\n═══ Side-by-side: v3 fusion (persisted) vs M3 v2 (live) ═══\n');
  console.log(
    `${'School'.padEnd(10)} ${'Round'.padEnd(5)} | ${'v3 prob'.padStart(8)}  ${'v3 tier'.padStart(8)}  ${'v3 conf'.padStart(7)} | ${'M3 prob'.padStart(8)}  ${'M3 tier'.padStart(8)}  ${'M3 conf'.padStart(7)} | ${'gap'.padStart(7)}`
  );
  console.log('─'.repeat(125));

  for (const c of V3_CASES) {
    const school: any = await prisma.school.findFirst({
      where: { nameNorm: c.nameNorm },
      include: { programs: true },
    });
    if (!school) {
      console.log(`${c.display.padEnd(10)} SCHOOL NOT FOUND`);
      continue;
    }
    const bands = await prisma.schoolCdsAdmitBand.findMany({ where: { schoolId: school.id } });
    (school as any)._cdsBands = bands.map((b: any) => ({
      gpaBand: b.gpaBand,
      testType: b.testType,
      testBand: b.testBand,
      admitRate: Number(b.admitRate),
    }));

    const v3 = await prisma.predictionResult.findFirst({
      where: { profileId: profile.id, schoolId: school.id },
      orderBy: { createdAt: 'desc' },
      select: {
        probability: true,
        tier: true,
        confidence: true,
        createdAt: true,
        modelVersion: true,
      },
    });

    const stagedProfile = {
      ...profile,
      applicationRound: c.round,
      testScores: profile.testScores.map((t: any) => ({ type: t.type, score: Number(t.score) })),
    };
    const m3 = predict(stagedProfile, school);

    const v3Prob = v3 ? `${(Number(v3.probability) * 100).toFixed(1)}%` : 'no record';
    const v3Tier = v3?.tier ?? '—';
    const v3Conf = v3?.confidence ?? '—';
    const m3Prob = `${(m3.probability * 100).toFixed(1)}%`;
    const m3Tier = m3.tier;
    const m3Conf = m3.confidence;
    const gap = v3 ? `${((m3.probability - Number(v3.probability)) * 100).toFixed(1)}pp` : '—';

    console.log(
      `${c.display.padEnd(10)} ${c.round.padEnd(5)} | ${v3Prob.padStart(8)}  ${v3Tier.padStart(8)}  ${v3Conf.padStart(7)} | ${m3Prob.padStart(8)}  ${m3Tier.padStart(8)}  ${m3Conf.padStart(7)} | ${gap.padStart(7)}  ${v3?.modelVersion ?? ''}`
    );
  }

  const total = await prisma.predictionResult.count();
  const byModel: any = await prisma.$queryRaw`
    SELECT "modelVersion", COUNT(*)::int AS n
    FROM "PredictionResult"
    GROUP BY "modelVersion"
    ORDER BY n DESC
    LIMIT 8
  `;
  console.log(`\nTotal PredictionResult rows in prod: ${total}`);
  console.log('Top model versions:');
  byModel.forEach((r: any) => console.log(`  ${r.modelVersion ?? '(null)'}: ${r.n}`));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
