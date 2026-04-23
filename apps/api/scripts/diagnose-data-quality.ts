/**
 * 一次性查数据质量：
 *   - 10 条 self-report 是真的 10 个独立用户/学校，还是测试数据重复？
 *   - AdmissionCase 里 admit/reject/waitlist 的真实分布
 *   - 预测覆盖的学校集中度
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Self-reported outcome 明细 ===\n');
  const selfReports = await prisma.predictionOutcomeLabelRecord.findMany({
    where: {
      status: 'SELF_REPORTED',
      result: { in: ['ADMITTED', 'REJECTED'] },
    },
    select: {
      id: true,
      result: true,
      createdAt: true,
      predictionResult: {
        select: {
          profileId: true,
          schoolId: true,
          probability: true,
          modelVersion: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const schoolIds = [
    ...new Set(selfReports.map((r) => r.predictionResult.schoolId)),
  ];
  const profileIds = [
    ...new Set(selfReports.map((r) => r.predictionResult.profileId)),
  ];
  const schools = await prisma.school.findMany({
    where: { id: { in: schoolIds } },
    select: { id: true, name: true },
  });
  const smap = new Map(schools.map((s) => [s.id, s.name]));

  console.log(`总共 ${selfReports.length} 条 self-report`);
  console.log(`独立 profile 数: ${profileIds.length}`);
  console.log(`独立 school 数: ${schoolIds.length}\n`);

  console.log(
    'createdAt'.padEnd(22) +
      'result'.padEnd(10) +
      'profile'.padEnd(12) +
      'school'.padEnd(32) +
      'prob',
  );
  console.log('-'.repeat(90));
  for (const r of selfReports) {
    console.log(
      r.createdAt.toISOString().slice(0, 19).padEnd(22) +
        r.result.padEnd(10) +
        r.predictionResult.profileId.slice(0, 10).padEnd(12) +
        (smap.get(r.predictionResult.schoolId) ?? '?').slice(0, 30).padEnd(32) +
        Number(r.predictionResult.probability).toFixed(2),
    );
  }

  console.log('\n=== AdmissionCase 按 result 分布（所有 case）===\n');
  const caseByResult = await prisma.admissionCase.groupBy({
    by: ['result', 'isVerified'],
    _count: { _all: true },
  });
  for (const row of caseByResult) {
    console.log(
      `result=${row.result}  isVerified=${row.isVerified}  count=${row._count._all}`,
    );
  }

  console.log('\n=== verified AdmissionCase 的学校和结果 ===\n');
  const verifiedCases = await prisma.admissionCase.findMany({
    where: {
      isVerified: true,
      result: { in: ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'] },
    },
    select: {
      id: true,
      userId: true,
      schoolId: true,
      result: true,
      round: true,
      year: true,
      gpaRange: true,
      satRange: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const caseSchoolIds = [...new Set(verifiedCases.map((c) => c.schoolId))];
  const caseSchools = await prisma.school.findMany({
    where: { id: { in: caseSchoolIds } },
    select: { id: true, name: true },
  });
  const csmap = new Map(caseSchools.map((s) => [s.id, s.name]));
  for (const c of verifiedCases) {
    console.log(
      (csmap.get(c.schoolId) ?? '?').slice(0, 32).padEnd(32) +
        c.result.padEnd(12) +
        (c.round ?? '?').padEnd(6) +
        (c.year ?? 0).toString().padEnd(6) +
        `gpa=${c.gpaRange ?? '?'}  sat=${c.satRange ?? '?'}`,
    );
  }

  console.log('\n=== PredictionResult 按学校覆盖 top 10 ===\n');
  const bySchool = await prisma.predictionResult.groupBy({
    by: ['schoolId'],
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });
  const topSchools = await prisma.school.findMany({
    where: { id: { in: bySchool.map((x) => x.schoolId) } },
    select: { id: true, name: true },
  });
  const tmap = new Map(topSchools.map((s) => [s.id, s.name]));
  for (const s of bySchool) {
    console.log(
      (tmap.get(s.schoolId) ?? '?').slice(0, 40).padEnd(40) +
        String(s._count._all).padStart(6),
    );
  }

  console.log('\n=== PredictionResult 按 profile 覆盖 top 10 ===\n');
  const byProfile = await prisma.predictionResult.groupBy({
    by: ['profileId'],
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });
  for (const p of byProfile) {
    console.log(p.profileId.padEnd(30) + String(p._count._all).padStart(6));
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
