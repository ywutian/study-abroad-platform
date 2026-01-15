/**
 * 案例数据清理与补充脚本
 *
 * 功能：
 * 1. 清理模板/重复数据
 * 2. 为国际学生补充 TOEFL 估算值
 * 3. 数据质量报告
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TOEFL 估算规则（基于 SAT 分数）
function estimateToefl(
  satRange: string | null,
  isInternational: boolean,
): string | null {
  if (!isInternational || !satRange) return null;

  const sat = parseInt(satRange.replace(/[^\d]/g, ''));
  if (isNaN(sat)) return null;

  // SAT 与 TOEFL 相关性估算
  if (sat >= 1550) return '115-120';
  if (sat >= 1500) return '110-115';
  if (sat >= 1450) return '105-110';
  if (sat >= 1400) return '100-105';
  if (sat >= 1350) return '95-100';
  if (sat >= 1300) return '90-95';
  return '85-90';
}

async function main() {
  console.log('=== 案例数据清理与补充 ===\n');

  // 1. 统计当前数据质量
  const total = await prisma.admissionCase.count();
  const templateCount = await prisma.admissionCase.count({
    where: { gpaRange: '3.1', satRange: '1190' },
  });

  console.log(`📊 当前数据: ${total} 条`);
  console.log(`🗑️  模板数据: ${templateCount} 条\n`);

  // 2. 删除模板数据（备份ID先）
  if (templateCount > 0) {
    const templateCases = await prisma.admissionCase.findMany({
      where: { gpaRange: '3.1', satRange: '1190' },
      select: { id: true },
    });
    console.log(
      '待删除模板数据ID:',
      templateCases.map((c) => c.id),
    );

    const deleted = await prisma.admissionCase.deleteMany({
      where: { gpaRange: '3.1', satRange: '1190' },
    });
    console.log(`✅ 已删除 ${deleted.count} 条模板数据\n`);
  }

  // 3. 为国际学生补充 TOEFL 估算值
  const internationalCases = await prisma.admissionCase.findMany({
    where: {
      tags: { has: 'international' },
      toeflRange: null,
      satRange: { not: null },
    },
  });

  console.log(`🌍 需补充TOEFL的国际学生案例: ${internationalCases.length} 条`);

  let enrichedCount = 0;
  for (const c of internationalCases) {
    const toefl = estimateToefl(c.satRange, true);
    if (toefl) {
      await prisma.admissionCase.update({
        where: { id: c.id },
        data: { toeflRange: toefl },
      });
      enrichedCount++;
    }
  }
  console.log(`✅ 已补充 ${enrichedCount} 条 TOEFL 估算值\n`);

  // 4. 最终统计
  const finalStats = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE "toeflRange" IS NOT NULL) as has_toefl,
      COUNT(*) FILTER (WHERE "satRange" IS NOT NULL) as has_sat,
      COUNT(*) FILTER (WHERE "actRange" IS NOT NULL) as has_act
    FROM "AdmissionCase"
  `;

  console.log('📈 最终数据质量:');
  console.log(`  总数: ${finalStats[0].total}`);
  console.log(
    `  有SAT: ${finalStats[0].has_sat} (${((Number(finalStats[0].has_sat) * 100) / Number(finalStats[0].total)).toFixed(1)}%)`,
  );
  console.log(
    `  有ACT: ${finalStats[0].has_act} (${((Number(finalStats[0].has_act) * 100) / Number(finalStats[0].total)).toFixed(1)}%)`,
  );
  console.log(
    `  有TOEFL: ${finalStats[0].has_toefl} (${((Number(finalStats[0].has_toefl) * 100) / Number(finalStats[0].total)).toFixed(1)}%)`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
