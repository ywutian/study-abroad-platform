/**
 * 导出 Top50 学校全部案例（仅导出，不做判断）
 *
 * 使用方法：
 * pnpm exec ts-node --transpile-only scripts/export-top50-cases.ts
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const top50Schools = await prisma.school.findMany({
    where: { usNewsRank: { lte: 50 } },
    select: { id: true, name: true, nameZh: true, usNewsRank: true },
    orderBy: { usNewsRank: 'asc' },
  });

  const schoolIdSet = new Set(top50Schools.map((s) => s.id));

  const cases = await prisma.admissionCase.findMany({
    where: { schoolId: { in: Array.from(schoolIdSet) } },
    include: {
      school: { select: { name: true, nameZh: true, usNewsRank: true } },
    },
    orderBy: [{ year: 'desc' }],
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    top50Count: top50Schools.length,
    caseCount: cases.length,
    schools: top50Schools,
    cases: cases.map((c) => ({
      id: c.id,
      school: c.school?.nameZh || c.school?.name || '未知',
      schoolEn: c.school?.name || 'Unknown',
      usNewsRank: c.school?.usNewsRank ?? null,
      year: c.year,
      result: c.result,
      round: c.round,
      major: c.major,
      gpa: c.gpaRange,
      sat: c.satRange,
      act: c.actRange,
      toefl: c.toeflRange,
      tags: c.tags,
      createdAt: c.createdAt,
    })),
  };

  const outPath = join(process.cwd(), 'scripts', 'top50-cases.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log('✅ 导出完成');
  console.log('Top50 学校数:', payload.top50Count);
  console.log('案例数:', payload.caseCount);
  console.log('文件:', outPath);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
