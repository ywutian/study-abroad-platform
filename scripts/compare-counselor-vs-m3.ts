/**
 * Compare CounselorEngineService (prod served path) vs M3 Bayesian (yesterday's
 * benchmark engine) for Alice Zhang × 4 V3_CASES schools.
 *
 * Strategy: directly instantiate CounselorEngineService with PrismaClient
 * (skipping AnchorResolverService — it falls back to a built-in resolver in
 * the engine itself).
 *
 * Usage:
 *   DATABASE_URL='postgresql://studyabroad:<pwd>@127.0.0.1:5433/study_abroad' \
 *     pnpm exec tsx scripts/compare-counselor-vs-m3.ts
 */
import { PrismaClient } from '@prisma/client';
import { predict as m3Predict } from './m3-bayesian-engine';

// Import counselor service from the API
import { CounselorEngineService } from '../apps/api/src/modules/prediction/counselor/counselor-engine.service';
import { AnchorResolverService } from '../apps/api/src/modules/prediction/counselor/anchor-resolver.service';

const prisma = new PrismaClient();

const V3_CASES = [
  { nameNorm: 'stanford university', display: 'Stanford', round: 'REA' },
  { nameNorm: 'massachusetts institute of technology', display: 'MIT', round: 'EA' },
  { nameNorm: 'carnegie mellon university', display: 'CMU', round: 'ED' },
  { nameNorm: 'university of michigan, ann arbor', display: 'UMich', round: 'EA' },
];

function schoolToCounselorInput(school: any) {
  return {
    id: school.id,
    name: school.name,
    nameZh: school.nameZh,
    country: school.country,
    state: school.state,
    isPrivate: school.isPrivate,
    acceptanceRate: school.acceptanceRate ? Number(school.acceptanceRate) : undefined,
    intlAcceptanceRate: school.intlAcceptanceRate ? Number(school.intlAcceptanceRate) : undefined,
    oosAcceptanceRate: school.oosAcceptanceRate ? Number(school.oosAcceptanceRate) : undefined,
    needBlindInternational: school.needBlindInternational,
    sat25: school.sat25 ? Number(school.sat25) : undefined,
    sat75: school.sat75 ? Number(school.sat75) : undefined,
    actAvg: school.actAvg ? Number(school.actAvg) : undefined,
    act25: school.act25 ? Number(school.act25) : undefined,
    act75: school.act75 ? Number(school.act75) : undefined,
    usNewsRank: school.usNewsRank,
    edAcceptanceRate: school.edAcceptanceRate ? Number(school.edAcceptanceRate) : undefined,
    eaAcceptanceRate: school.eaAcceptanceRate ? Number(school.eaAcceptanceRate) : undefined,
    yieldRate: school.yieldRate ? Number(school.yieldRate) : undefined,
    institutionType: school.institutionType,
    gpaDistribution: school.gpaDistribution,
    testingPolicy: school.testingPolicy,
    testOptional: school.testOptional,
    hasEarlyDecision: school.hasEarlyDecision,
    hasEarlyAction: school.hasEarlyAction,
    hasRestrictiveEa: school.hasRestrictiveEa,
  };
}

function profileToCounselorInput(profile: any, isInternational: boolean) {
  const testScores = profile.testScores.map((t: any) => ({
    type: t.type,
    score: Number(t.score),
    subScores: t.subScores,
  }));
  return {
    gpa: profile.gpa ? Number(profile.gpa) : undefined,
    gpaScale: profile.gpaScale ? Number(profile.gpaScale) : undefined,
    targetMajor: profile.targetMajor,
    isInternational,
    nationality: isInternational ? 'CN' : 'US',
    currentSchoolType: profile.currentSchoolType,
    testScores,
    activities: profile.activities.map((a: any) => ({
      name: a.name,
      category: a.category,
      role: a.role,
      hoursPerWeek: a.hoursPerWeek,
      weeksPerYear: a.weeksPerYear,
      yearsActive: a.yearsActive,
    })),
    awards: profile.awards.map((a: any) => ({
      level: a.level,
      name: a.name,
      year: a.year,
    })),
    isFirstGen: false,
    recruitedAthlete: false,
    isLegacy: false,
  };
}

async function main() {
  const profile: any = await prisma.profile.findFirst({
    where: { user: { email: 'alice.zhang@demo.studyabroad.com' } },
    include: { activities: true, awards: true, testScores: true, user: true },
  });
  if (!profile) {
    console.log('Alice profile not found');
    await prisma.$disconnect();
    return;
  }

  console.log('═══ Alice Zhang from PROD DB ═══');
  console.log(`  GPA: ${profile.gpa} / Scale: ${profile.gpaScale}`);
  console.log(`  Major: ${profile.targetMajor}`);
  console.log(`  SAT: ${profile.testScores.find((t: any) => t.type === 'SAT')?.score}`);
  console.log(`  TOEFL: ${profile.testScores.find((t: any) => t.type === 'TOEFL')?.score}`);
  console.log(`  Activities: ${profile.activities.length}`);
  console.log(`  Awards: ${profile.awards.length}`);

  // AnchorResolverService is a required constructor arg now: it stopped being
  // @Optional() when its duplicate inside the engine was deleted (2026-07-24).
  // Passed explicitly because this script bypasses Nest DI.
  const counselor = new CounselorEngineService(
    prisma as any,
    new AnchorResolverService(prisma as any)
  );

  console.log(
    '\n═══ Counselor (prod served) vs M3 v2 — Alice as INTERNATIONAL (nationality=CN) ═══\n'
  );
  console.log(
    `${'School'.padEnd(10)} ${'Round'.padEnd(5)} | ${'anchor'.padStart(7)} | ${'Counselor'.padStart(10)}  ${'tier'.padStart(5)} | ${'M3 v2'.padStart(8)}  ${'tier'.padStart(5)} | ${'Δ pp'.padStart(7)}`
  );
  console.log('─'.repeat(105));

  const intlProfile = profileToCounselorInput(profile, true);

  for (const c of V3_CASES) {
    const school: any = await prisma.school.findFirst({
      where: { nameNorm: c.nameNorm },
      include: { programs: true },
    });
    if (!school) {
      console.log(`${c.display.padEnd(10)} SCHOOL NOT FOUND`);
      continue;
    }

    const counselorInput = schoolToCounselorInput(school);

    // counselor
    const counselorResult = await counselor.compute(
      intlProfile as any,
      counselorInput as any,
      c.round
    );

    // Print modifier breakdown for the first run
    if (c.display === 'MIT') {
      console.log(`\n  ── MIT INTL counselor breakdown ──`);
      console.log(
        `     anchor: ${(counselorResult.anchor * 100).toFixed(2)}% (${counselorResult.anchorSource}, tier ${counselorResult.tier})`
      );
      for (const [key, m] of Object.entries(counselorResult.modifierResults)) {
        console.log(
          `     ${key.padEnd(18)} × ${(m as any).multiplier.toFixed(3)} [${(m as any).impact}] — ${(m as any).label}`
        );
      }
      console.log(`     final: ${(counselorResult.probability * 100).toFixed(2)}%`);
      console.log();
    }

    // M3
    const bands = await prisma.schoolCdsAdmitBand.findMany({ where: { schoolId: school.id } });
    (school as any)._cdsBands = bands.map((b: any) => ({
      gpaBand: b.gpaBand,
      testType: b.testType,
      testBand: b.testBand,
      admitRate: Number(b.admitRate),
    }));
    const m3Profile = {
      ...profile,
      nationality: 'CN',
      isInternational: true,
      international: true,
      applicationRound: c.round,
      testScores: profile.testScores.map((t: any) => ({ type: t.type, score: Number(t.score) })),
      activities: profile.activities,
      awards: profile.awards,
    };
    const m3Result = m3Predict(m3Profile, school);

    const anchor = `${(counselorResult.anchor * 100).toFixed(1)}%`;
    const counselorProb = `${(counselorResult.probability * 100).toFixed(1)}%`;
    const counselorTier = `T${counselorResult.tier}`;
    const m3Prob = `${(m3Result.probability * 100).toFixed(1)}%`;
    const m3Tier = m3Result.tier;
    const gap = `${((m3Result.probability - counselorResult.probability) * 100).toFixed(1)}pp`;

    console.log(
      `${c.display.padEnd(10)} ${c.round.padEnd(5)} | ${anchor.padStart(7)} | ${counselorProb.padStart(10)}  ${counselorTier.padStart(5)} | ${m3Prob.padStart(8)}  ${m3Tier.padStart(5)} | ${gap.padStart(7)}`
    );
  }

  console.log('\n═══ Same but Alice as DOMESTIC (control) ═══\n');
  const domesticProfile = profileToCounselorInput(profile, false);

  for (const c of V3_CASES) {
    const school: any = await prisma.school.findFirst({
      where: { nameNorm: c.nameNorm },
      include: { programs: true },
    });
    if (!school) continue;

    const counselorInput = schoolToCounselorInput(school);
    const counselorResult = await counselor.compute(
      domesticProfile as any,
      counselorInput as any,
      c.round
    );

    const bands = await prisma.schoolCdsAdmitBand.findMany({ where: { schoolId: school.id } });
    (school as any)._cdsBands = bands.map((b: any) => ({
      gpaBand: b.gpaBand,
      testType: b.testType,
      testBand: b.testBand,
      admitRate: Number(b.admitRate),
    }));
    const m3Profile = {
      ...profile,
      nationality: 'US',
      isInternational: false,
      international: false,
      applicationRound: c.round,
      testScores: profile.testScores.map((t: any) => ({ type: t.type, score: Number(t.score) })),
      activities: profile.activities,
      awards: profile.awards,
    };
    const m3Result = m3Predict(m3Profile, school);

    const counselorProb = `${(counselorResult.probability * 100).toFixed(1)}%`;
    const m3Prob = `${(m3Result.probability * 100).toFixed(1)}%`;
    const gap = `${((m3Result.probability - counselorResult.probability) * 100).toFixed(1)}pp`;

    console.log(
      `${c.display.padEnd(10)} ${c.round.padEnd(5)} | ${counselorProb.padStart(10)}  vs M3 ${m3Prob.padStart(8)}  | Δ ${gap}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
