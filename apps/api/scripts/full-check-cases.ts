/**
 * 全量逐条检查 AdmissionCase，并输出详细报告
 *
 * 使用方法：
 * pnpm exec ts-node --transpile-only scripts/full-check-cases.ts
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

function parseNum(val?: string | null) {
  if (!val) return null;
  const m = String(val).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function inRange(val: number | null, min: number, max: number) {
  if (val === null || Number.isNaN(val)) return true;
  return val >= min && val <= max;
}

async function main() {
  const cases = await prisma.admissionCase.findMany({
    include: { school: { select: { name: true, nameZh: true } } },
  });

  const issues: Array<Record<string, any>> = [];
  const ok: Array<Record<string, any>> = [];

  for (const c of cases) {
    const gpa = parseNum(c.gpaRange);
    const sat = parseNum(c.satRange);
    const act = parseNum(c.actRange);

    const errors: string[] = [];
    if (!c.schoolId) errors.push('missing_school');
    if (!c.year) errors.push('missing_year');
    if (!c.result) errors.push('missing_result');
    if (!c.major) errors.push('missing_major');
    if (!c.round) errors.push('missing_round');
    if (gpa !== null && !inRange(gpa, 2.5, 4.3))
      errors.push('gpa_out_of_range');
    if (sat !== null && !inRange(sat, 1100, 1600))
      errors.push('sat_out_of_range');
    if (act !== null && !inRange(act, 22, 36)) errors.push('act_out_of_range');

    const item = {
      id: c.id,
      school: c.school?.nameZh || c.school?.name || '未知',
      year: c.year,
      result: c.result,
      gpa: c.gpaRange,
      sat: c.satRange,
      act: c.actRange,
      major: c.major,
      round: c.round,
      tags: c.tags,
      errors,
    };

    if (errors.length > 0) {
      issues.push(item);
    } else {
      ok.push(item);
    }
  }

  const reportDir = join(process.cwd(), 'scripts');
  const issuesPath = join(reportDir, 'admission-case-issues.json');
  const okPath = join(reportDir, 'admission-case-ok.json');

  writeFileSync(
    issuesPath,
    JSON.stringify({ total: cases.length, issues }, null, 2),
  );
  writeFileSync(okPath, JSON.stringify({ total: cases.length, ok }, null, 2));

  console.log('✅ 全量检查完成');
  console.log(`总数: ${cases.length}`);
  console.log(`异常: ${issues.length}`);
  console.log(`正常: ${ok.length}`);
  console.log(`报告: ${issuesPath}`);
  console.log(`报告: ${okPath}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
});
