/**
 * 人工抽查：案例异常值 + 学校缺失字段
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseNum(val?: string | null) {
  if (!val) return null;
  const m = String(val).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

async function main() {
  const cases = await prisma.admissionCase.findMany({
    include: { school: { select: { nameZh: true } } },
  });

  const gpaOut = cases.filter((c) => {
    const g = parseNum(c.gpaRange);
    return g !== null && (g < 2.5 || g > 4.3);
  });
  const satOut = cases.filter((c) => {
    const s = parseNum(c.satRange);
    return s !== null && (s < 1100 || s > 1600);
  });
  const actOut = cases.filter((c) => {
    const a = parseNum(c.actRange);
    return a !== null && (a < 22 || a > 36);
  });

  console.log('🔎 异常值抽查 (AdmissionCase)');
  console.log('GPA <2.5 或 >4.3:', gpaOut.length);
  console.log('SAT <1100 或 >1600:', satOut.length);
  console.log('ACT <22 或 >36:', actOut.length);

  const sample = (arr: typeof cases, n: number) =>
    arr.slice(0, n).map((c) => ({
      school: c.school?.nameZh || '未知',
      year: c.year,
      result: c.result,
      gpa: c.gpaRange,
      sat: c.satRange,
      act: c.actRange,
      major: c.major,
      round: c.round,
    }));

  console.log('\n样例 - GPA异常:');
  console.log(JSON.stringify(sample(gpaOut, 10), null, 2));
  console.log('\n样例 - SAT异常:');
  console.log(JSON.stringify(sample(satOut, 10), null, 2));
  console.log('\n样例 - ACT异常:');
  console.log(JSON.stringify(sample(actOut, 10), null, 2));

  const schools = await prisma.school.findMany();
  const schoolIssues = schools.filter(
    (s) =>
      !s.website ||
      !s.description ||
      !s.acceptanceRate ||
      !s.tuition ||
      !s.satAvg ||
      !s.studentCount ||
      !s.graduationRate,
  );
  console.log('\n🏫 School 缺失字段:', schoolIssues.length);

  await prisma.$disconnect();
}

main().catch(console.error);
