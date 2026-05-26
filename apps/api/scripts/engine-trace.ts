/**
 * Read-only engine-integration trace.
 * Loads School rows from live DB, runs counselor modifiers, asserts which
 * SchoolInput fields each modifier read.
 */
import { PrismaClient } from '@prisma/client';
import {
  gpaBandMultiplier,
  testBandMultiplier,
  roundMultiplier,
  legacyHookMultiplier,
  firstGenMultiplier,
  athleteMultiplier,
  urmMultiplier,
  geoMultiplier,
  intlMultiplier,
  majorMultiplier,
  profileContextMultiplier,
} from '/Users/yitianwu/Documents/study-abroad-platform/apps/api/src/modules/prediction/counselor/counselor-modifiers';

const prisma = new PrismaClient();

const APPLICANTS = [
  { name: 'strong-domestic', gpa: 4.0, sat: 1560, intl: false, state: 'NY' },
  {
    name: 'strong-intl-CN',
    gpa: 3.95,
    sat: 1500,
    intl: true,
    state: undefined,
  },
  { name: 'strong-TO', gpa: 3.95, sat: null, intl: false, state: 'NY' },
  { name: 'mid-domestic', gpa: 3.7, sat: 1400, intl: false, state: 'NY' },
  { name: 'below-domestic', gpa: 3.5, sat: 1300, intl: false, state: 'NY' },
];

const SCHOOLS = [
  'Stanford University',
  'Pomona College',
  'University of Michigan, Ann Arbor',
  'Harvey Mudd College',
  'Reed College',
];

function buildSchoolInput(s: any) {
  const toNum = (x: any) => (x == null ? undefined : Number(x));
  return {
    id: s.id,
    name: s.name,
    nameZh: s.nameZh ?? undefined,
    country: s.country ?? undefined,
    state: s.state ?? undefined,
    isPrivate: s.isPrivate ?? undefined,
    acceptanceRate: toNum(s.acceptanceRate),
    intlAcceptanceRate: toNum(s.intlAcceptanceRate),
    oosAcceptanceRate: toNum(s.oosAcceptanceRate),
    intlStudentPct: toNum(s.intlStudentPct),
    needBlindInternational: s.needBlindInternational,
    satAvg: toNum(s.satAvg),
    sat25: toNum(s.sat25),
    sat75: toNum(s.sat75),
    actAvg: toNum(s.actAvg),
    act25: toNum(s.act25),
    act75: toNum(s.act75),
    usNewsRank: toNum(s.usNewsRank),
    graduationRate: toNum(s.graduationRate),
    retentionRate: toNum(s.retentionRate),
    studentFacultyRatio: toNum(s.studentFacultyRatio),
    percentNeedMet: toNum(s.percentNeedMet),
    averageNetPrice: toNum(s.averageNetPrice),
    testingPolicy: s.testingPolicy,
    testOptional: s.testOptional ?? undefined,
    hasEarlyDecision: s.hasEarlyDecision ?? undefined,
    // hasEarlyDecision2 and hasEarlyAction don't exist on the Prisma model
    hasEarlyDecision2: (s as any).hasEarlyDecision2 ?? undefined,
    hasEarlyAction: (s as any).hasEarlyAction ?? undefined,
    hasRestrictiveEa: s.hasRestrictiveEa ?? undefined,
    edAcceptanceRate: toNum(s.edAcceptanceRate),
    ed2AcceptanceRate: toNum(s.ed2AcceptanceRate),
    eaAcceptanceRate: toNum(s.eaAcceptanceRate),
    yieldRate: toNum(s.yieldRate),
    institutionType: s.institutionType ?? undefined,
    gpaDistribution: s.gpaDistribution ?? undefined,
  } as any;
}

function buildProfile(a: any) {
  return {
    gpa: a.gpa,
    gpaScale: 4.0,
    testScores: a.sat ? [{ type: 'SAT', score: a.sat }] : [],
    isInternational: a.intl,
    isFirstGen: false,
    stateOfResidence: a.state,
    highSchoolLocation: a.state,
    applyingTestOptional: !a.sat,
    targetMajor: 'Computer Science',
    activities: [],
    awards: [],
  } as any;
}

async function main() {
  const schools = await prisma.school.findMany({
    where: { name: { in: SCHOOLS } },
  });
  console.log('Found schools:', schools.map((s) => s.name).join(', '));

  for (const school of schools) {
    const si = buildSchoolInput(school);
    console.log(`\n=== ${school.name} ===`);
    console.log(
      `  intl=${si.intlAcceptanceRate}, overall=${si.acceptanceRate}, needBlind=${si.needBlindInternational}, ed=${si.edAcceptanceRate}, hasED=${si.hasEarlyDecision}, hasREA=${si.hasRestrictiveEa}, yield=${si.yieldRate}, pnm=${si.percentNeedMet}`,
    );
    console.log(
      `  state=${si.state}, isPrivate=${si.isPrivate}, oosAR=${si.oosAcceptanceRate}`,
    );
    console.log(`  hasEarlyAction (NOT ON SCHEMA): ${si.hasEarlyAction}`);
    console.log(`  hasEarlyDecision2 (NOT ON SCHEMA): ${si.hasEarlyDecision2}`);

    for (const a of APPLICANTS) {
      const profile = buildProfile(a);
      const intl = intlMultiplier(profile, si);
      const geo = geoMultiplier(profile, si);
      const round = roundMultiplier('RD', si);
      const ed = roundMultiplier(si.hasEarlyDecision ? 'ED' : 'EA', si);
      console.log(
        `    ${a.name}: intl=×${intl.multiplier.toFixed(2)}(${intl.label}) geo=×${geo.multiplier.toFixed(2)} RD=×${round.multiplier.toFixed(2)} ${si.hasEarlyDecision ? 'ED' : 'EA'}=×${ed.multiplier.toFixed(2)}`,
      );
    }
  }

  // Test ED2 / EA blocking behavior
  console.log('\n=== EA blocking test (hasEarlyAction not on schema) ===');
  for (const school of schools) {
    const si = buildSchoolInput(school);
    const p = buildProfile(APPLICANTS[0]);
    const ea = roundMultiplier('EA', si);
    const ed2 = roundMultiplier('ED2', si);
    console.log(
      `  ${school.name}: EA=×${ea.multiplier.toFixed(2)} (${ea.label}) | ED2=×${ed2.multiplier.toFixed(2)} (${ed2.label})`,
    );
  }

  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
