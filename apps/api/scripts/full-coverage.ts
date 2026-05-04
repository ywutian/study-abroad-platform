import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const total = await p.school.count({ where: { country: 'US' } });

  const nonNullableBooleans = new Set([
    'isPrivate',
    'needBlindInternational',
    'testOptional',
  ]);
  const check = async (f: string) => {
    let filled: number;
    if (nonNullableBooleans.has(f)) {
      // Non-nullable booleans: count is always total
      filled = total;
    } else {
      filled = await (p.school as any).count({
        where: { country: 'US', [f]: { not: null } },
      });
    }
    const miss = total - filled;
    const bar = '█'.repeat(Math.round((filled / total) * 20)).padEnd(20, '░');
    const pct = ((filled / total) * 100).toFixed(1);
    return `  ${f.padEnd(28)}${bar} ${(filled + '/' + total).padEnd(8)}${pct.padStart(5)}%${miss > 0 ? '  ⚠️ missing=' + miss : '  ✅'}`;
  };

  console.log(`\n🔮 预测系统字段 (${total} US schools)\n`);
  for (const f of [
    'acceptanceRate',
    'intlAcceptanceRate',
    'oosAcceptanceRate',
    'intlStudentPct',
    'sat25',
    'sat75',
    'satAvg',
    'gpaDistribution',
    'edAcceptanceRate',
    'eaAcceptanceRate',
    'percentNeedMet',
    'needBlindInternational',
  ])
    console.log(await check(f));

  console.log('\n📚 学术数据\n');
  for (const f of [
    'actAvg',
    'act25',
    'act75',
    'satMath25',
    'satMath75',
    'satReading25',
    'satReading75',
    'graduationRate',
    'retentionRate',
    'studentFacultyRatio',
    'transferAcceptanceRate',
  ])
    console.log(await check(f));

  console.log('\n💰 财务数据\n');
  for (const f of [
    'tuition',
    'roomAndBoard',
    'averageNetPrice',
    'averageAidPackage',
    'applicationFee',
    'percentNeedMet',
    'salary6YrPostGrad',
    'avgSalary',
    'loanDefaultRate',
    'monthlyLoanPayment',
  ])
    console.log(await check(f));

  console.log('\n🏫 校园生活\n');
  for (const f of [
    'totalEnrollment',
    'studentCount',
    'studentOrgsCount',
    'countriesRepresented',
    'nicheOverallGrade',
    'nicheSafetyGrade',
    'nicheLifeGrade',
    'nicheFoodGrade',
  ])
    console.log(await check(f));

  console.log('\n📋 基本信息\n');
  for (const f of [
    'nameZh',
    'description',
    'descriptionZh',
    'website',
    'logoUrl',
    'state',
    'city',
    'isPrivate',
    'testOptional',
    'hasEarlyDecision',
    'acceptsCommonApp',
    'acceptsCoalition',
    'usNewsRank',
    'qsRank',
  ])
    console.log(await check(f));

  console.log('\n📦 关联表\n');
  const tables = [
    ['SchoolProgram', p.schoolProgram],
    ['SchoolDeadline', p.schoolDeadline],
    ['EssayPrompt', p.essayPrompt],
    ['SchoolRanking', p.schoolRanking],
    ['SchoolCdsAdmitBand', p.schoolCdsAdmitBand],
    ['AdmissionCase', p.admissionCase],
    ['SchoolCommunityRating', p.schoolCommunityRating],
    ['SchoolMetric', p.schoolMetric],
  ] as const;

  for (const [name, model] of tables) {
    const schools = await (model as any).findMany({
      select: { schoolId: true },
      distinct: ['schoolId'],
    });
    const total2 = await (model as any).count();
    const n = schools.length;
    const bar = '█'.repeat(Math.round((n / total) * 20)).padEnd(20, '░');
    const pct = ((n / total) * 100).toFixed(1);
    console.log(
      `  ${name.padEnd(28)}${bar} ${(n + '/' + total).padEnd(8)}${pct.padStart(5)}%  (${total2} records)`,
    );
  }

  await p.$disconnect();
}

main().catch(console.error);
