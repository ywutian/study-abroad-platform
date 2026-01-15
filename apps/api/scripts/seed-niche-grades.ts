/**
 * Niche Grades 模拟数据生成器
 *
 * 基于学校排名生成合理的 Niche 评分数据
 * 用于开发和演示目的
 *
 * 用法: npx ts-node scripts/seed-niche-grades.ts [--limit=100]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 评分等级 (从高到低)
const GRADES = [
  'A+',
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
  'C-',
  'D+',
  'D',
  'D-',
  'F',
];

/**
 * 基于排名生成评分
 *
 * 逻辑：
 * - 排名 1-10: 主要 A+/A/A-
 * - 排名 11-30: 主要 A-/B+/B
 * - 排名 31-50: 主要 B+/B/B-
 * - 排名 51-100: 主要 B/B-/C+
 * - 排名 100+: 更多 B-/C 范围
 */
function generateGrade(
  rank: number | null,
  category: 'safety' | 'life' | 'food' | 'overall',
): string {
  // 如果没有排名，生成中等评分
  const effectiveRank = rank ?? 75;

  // 基础评分索引 (0 = A+, 12 = F)
  let baseIndex: number;

  if (effectiveRank <= 10) {
    baseIndex = 0; // A+ 区间
  } else if (effectiveRank <= 30) {
    baseIndex = 2; // A- 区间
  } else if (effectiveRank <= 50) {
    baseIndex = 4; // B 区间
  } else if (effectiveRank <= 100) {
    baseIndex = 5; // B- 区间
  } else {
    baseIndex = 6; // C+ 区间
  }

  // 不同类别的偏移
  // - 安全：与排名关系较弱，更随机
  // - 生活/美食：与排名中等相关
  // - 总体：与排名强相关
  let categoryOffset = 0;
  let randomRange = 2;

  switch (category) {
    case 'safety':
      // 安全评分更随机，高排名学校不一定更安全
      categoryOffset = Math.floor(Math.random() * 3) - 1;
      randomRange = 3;
      break;
    case 'life':
      // 校园生活与排名中等相关
      categoryOffset = Math.floor(Math.random() * 2);
      randomRange = 2;
      break;
    case 'food':
      // 美食评分相对独立
      categoryOffset = Math.floor(Math.random() * 3);
      randomRange = 3;
      break;
    case 'overall':
      // 总体评分与排名强相关
      categoryOffset = 0;
      randomRange = 1;
      break;
  }

  // 添加随机性
  const randomOffset =
    Math.floor(Math.random() * (randomRange * 2 + 1)) - randomRange;

  // 计算最终索引
  let finalIndex = baseIndex + categoryOffset + randomOffset;

  // 确保在有效范围内 (0-12)
  finalIndex = Math.max(0, Math.min(12, finalIndex));

  return GRADES[finalIndex];
}

/**
 * 为学校生成所有 Niche 评分
 */
function generateNicheGrades(rank: number | null): {
  nicheSafetyGrade: string;
  nicheLifeGrade: string;
  nicheFoodGrade: string;
  nicheOverallGrade: string;
} {
  return {
    nicheSafetyGrade: generateGrade(rank, 'safety'),
    nicheLifeGrade: generateGrade(rank, 'life'),
    nicheFoodGrade: generateGrade(rank, 'food'),
    nicheOverallGrade: generateGrade(rank, 'overall'),
  };
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 200;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    }
  }

  console.log('🎓 Niche Grades 模拟数据生成器');
  console.log('='.repeat(60));
  console.log(`📊 将为最多 ${limit} 所学校生成评分数据\n`);
  console.log('⚠️  注意: 这是模拟数据，仅用于开发和演示\n');

  try {
    // 获取需要填充的学校 (没有 Niche 评分的)
    const schools = await prisma.school.findMany({
      where: {
        OR: [
          { nicheSafetyGrade: null },
          { nicheLifeGrade: null },
          { nicheFoodGrade: null },
          { nicheOverallGrade: null },
        ],
      },
      orderBy: { usNewsRank: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        usNewsRank: true,
      },
    });

    console.log(`📋 找到 ${schools.length} 所需要填充的学校\n`);

    let updated = 0;

    for (const school of schools) {
      const grades = generateNicheGrades(school.usNewsRank);

      await prisma.school.update({
        where: { id: school.id },
        data: grades,
      });

      console.log(`  ✅ ${school.name} (Rank: ${school.usNewsRank || 'N/A'})`);
      console.log(
        `     Safety: ${grades.nicheSafetyGrade}, Life: ${grades.nicheLifeGrade}, Food: ${grades.nicheFoodGrade}, Overall: ${grades.nicheOverallGrade}`,
      );

      updated++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`  ✅ 已更新: ${updated} 所学校`);
    console.log('\n💡 提示: 这些是模拟数据。如需真实数据，请通过以下方式获取:');
    console.log('   1. 联系 Niche.com 获取 API 访问权限');
    console.log('   2. 手动从 Niche.com 网站收集数据');
    console.log('   3. 使用其他公开数据源 (如 Campus Safety 报告)');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
