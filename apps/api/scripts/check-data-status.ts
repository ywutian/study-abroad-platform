/**
 * 检查数据库各表数据状态
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 数据库数据状态检查\n');
  console.log('='.repeat(50));

  // 学校数据
  const schoolCount = await prisma.school.count();
  const schoolsWithDesc = await prisma.school.count({
    where: { description: { not: null } },
  });
  const schoolsWithWebsite = await prisma.school.count({
    where: { website: { not: null } },
  });
  const schoolsWithRank = await prisma.school.count({
    where: { usNewsRank: { not: null } },
  });
  console.log(`\n🏫 学校 (School): ${schoolCount}`);
  console.log(`   - 有简介: ${schoolsWithDesc}`);
  console.log(`   - 有网站: ${schoolsWithWebsite}`);
  console.log(`   - 有排名: ${schoolsWithRank}`);

  // 录取案例
  const caseCount = await prisma.admissionCase.count();
  console.log(`\n📋 录取案例 (AdmissionCase): ${caseCount}`);

  // 论坛
  const categoryCount = await prisma.forumCategory.count();
  const postCount = await prisma.forumPost.count();
  const commentCount = await prisma.forumComment.count();
  console.log(`\n💬 论坛:`);
  console.log(`   - 分类: ${categoryCount}`);
  console.log(`   - 帖子: ${postCount}`);
  console.log(`   - 评论: ${commentCount}`);

  // 用户
  const userCount = await prisma.user.count();
  const profileCount = await prisma.profile.count();
  const verifiedCount = await prisma.user.count({
    where: { role: 'VERIFIED' },
  });
  console.log(`\n👥 用户:`);
  console.log(`   - 用户总数: ${userCount}`);
  console.log(`   - 有档案: ${profileCount}`);
  console.log(`   - 已认证: ${verifiedCount}`);

  // 评测
  const assessmentCount = await prisma.assessmentResult.count();
  console.log(`\n📝 评测结果: ${assessmentCount}`);

  // 系统设置
  const settingCount = await prisma.systemSetting.count();
  console.log(`\n⚙️  系统设置: ${settingCount}`);

  // 列出缺失数据
  console.log('\n' + '='.repeat(50));
  console.log('⚠️  可能需要补充的数据:\n');

  if (schoolCount < 100) {
    console.log(`❌ 学校数量不足 (${schoolCount}/100)`);
  }
  if (schoolsWithDesc < schoolCount * 0.5) {
    console.log(`❌ 学校简介覆盖率低 (${schoolsWithDesc}/${schoolCount})`);
  }
  if (caseCount < 50) {
    console.log(`❌ 录取案例较少 (${caseCount} 条)`);
  }
  if (postCount < 10) {
    console.log(`❌ 论坛帖子较少 (${postCount} 条)`);
  }

  // 列出没有简介的学校
  const schoolsWithoutDesc = await prisma.school.findMany({
    where: { description: null },
    select: { name: true, nameZh: true, usNewsRank: true },
    orderBy: { usNewsRank: 'asc' },
    take: 20,
  });

  if (schoolsWithoutDesc.length > 0) {
    console.log(`\n📋 缺少简介的学校 (前20所):`);
    schoolsWithoutDesc.forEach((s) => {
      console.log(`   - #${s.usNewsRank || '?'} ${s.nameZh || s.name}`);
    });
  }

  console.log('\n' + '='.repeat(50));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
