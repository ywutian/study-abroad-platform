/**
 * 案例数据清洗脚本
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CleanupIssue {
  id: string;
  type: 'gpa' | 'sat' | 'school' | 'duplicate';
  original: string;
  suggested: string | null;
  schoolName: string;
}

async function main() {
  const cases = await prisma.admissionCase.findMany({
    include: { school: { select: { id: true, name: true, nameZh: true } } },
    orderBy: { createdAt: 'desc' },
  });

  console.log('=== 数据质量检查 ===\n');
  console.log(`总案例数: ${cases.length}\n`);

  const issues: CleanupIssue[] = [];
  const toDelete: string[] = [];
  const schoolsToDelete: string[] = [];

  // 检查每条案例
  for (const c of cases) {
    // 1. GPA 异常值检查
    if (c.gpaRange) {
      const num = parseFloat(c.gpaRange);
      if (num > 5) {
        // 可能是百分制 GPA，转换为 4.0 制
        if (num >= 90 && num <= 100) {
          issues.push({
            id: c.id,
            type: 'gpa',
            original: c.gpaRange,
            suggested: ((num / 100) * 4).toFixed(2),
            schoolName: c.school.name,
          });
        } else if (num > 100) {
          // 可能是 SAT 被误识别为 GPA
          issues.push({
            id: c.id,
            type: 'gpa',
            original: c.gpaRange,
            suggested: null, // 删除
            schoolName: c.school.name,
          });
        }
      } else if (num < 1 && num > 0) {
        // 可能是小数点问题
        issues.push({
          id: c.id,
          type: 'gpa',
          original: c.gpaRange,
          suggested: (num * 10).toFixed(2),
          schoolName: c.school.name,
        });
      }
    }

    // 2. 学校名异常检查
    const badSchoolPatterns = [
      /^•/,
      /^-/,
      /^Decision/,
      /^Additional/,
      /^Those/,
      /^\+/,
      /^State$/,
      /^Honors/,
      /^College$/,
      /^\d+/,
    ];

    const isBadSchool =
      badSchoolPatterns.some((p) => p.test(c.school.name)) ||
      c.school.name.length < 4;

    if (isBadSchool) {
      toDelete.push(c.id);
      if (!schoolsToDelete.includes(c.school.id)) {
        schoolsToDelete.push(c.school.id);
      }
    }
  }

  // 输出问题报告
  console.log('--- GPA 异常值 ---');
  const gpaIssues = issues.filter((i) => i.type === 'gpa');
  if (gpaIssues.length === 0) {
    console.log('无异常\n');
  } else {
    gpaIssues.forEach((i) => {
      console.log(
        `  ${i.id.slice(0, 8)} | ${i.original} -> ${i.suggested || '删除'} | ${i.schoolName.slice(0, 30)}`,
      );
    });
    console.log();
  }

  console.log('--- 需要删除的无效案例 ---');
  if (toDelete.length === 0) {
    console.log('无\n');
  } else {
    const toDeleteCases = cases.filter((c) => toDelete.includes(c.id));
    toDeleteCases.forEach((c) => {
      console.log(`  ${c.id.slice(0, 8)} | ${c.school.name} | ${c.result}`);
    });
    console.log();
  }

  // 执行清洗
  console.log('=== 开始清洗 ===\n');

  let fixed = 0;
  let deleted = 0;

  // 修复 GPA
  for (const issue of gpaIssues) {
    if (issue.suggested) {
      await prisma.admissionCase.update({
        where: { id: issue.id },
        data: { gpaRange: issue.suggested },
      });
      console.log(`✅ 修复 GPA: ${issue.original} -> ${issue.suggested}`);
      fixed++;
    } else {
      await prisma.admissionCase.update({
        where: { id: issue.id },
        data: { gpaRange: null },
      });
      console.log(`✅ 清除无效 GPA: ${issue.original}`);
      fixed++;
    }
  }

  // 删除无效案例
  if (toDelete.length > 0) {
    await prisma.admissionCase.deleteMany({
      where: { id: { in: toDelete } },
    });
    deleted = toDelete.length;
    console.log(`\n🗑️  删除无效案例: ${deleted} 条`);
  }

  // 删除无效学校
  if (schoolsToDelete.length > 0) {
    // 检查学校是否还有其他案例
    for (const schoolId of schoolsToDelete) {
      const count = await prisma.admissionCase.count({ where: { schoolId } });
      if (count === 0) {
        await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
        console.log(`🗑️  删除无效学校记录`);
      }
    }
  }

  // 最终统计
  console.log('\n=== 清洗完成 ===');
  console.log(`修复: ${fixed} 条`);
  console.log(`删除: ${deleted} 条`);

  const finalCount = await prisma.admissionCase.count();
  console.log(`\n当前案例总数: ${finalCount}`);

  // 显示清洗后的数据样本
  console.log('\n--- 清洗后数据样本 (前20条) ---');
  const sample = await prisma.admissionCase.findMany({
    include: { school: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  sample.forEach((c) => {
    console.log(
      `${c.school.name.slice(0, 28).padEnd(28)} | ${c.result.padEnd(10)} | GPA: ${(c.gpaRange || '-').padEnd(8)} | SAT: ${(c.satRange || '-').padEnd(6)} | ${c.tags.slice(0, 3).join(',')}`,
    );
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
