/**
 * 补充数据：US News 排名 + 申请信息
 *
 * 数据来源：手动整理自公开信息
 * 更新频率：每年 9 月 (新排名发布后)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 2025 US News Top 100 排名 + 申请信息
const rankings = [
  {
    name: 'Princeton University',
    usNewsRank: 1,
    intlRate: 12,
    deadline: '1月1日',
    essays: 1,
  },
  {
    name: 'Massachusetts Institute of Technology',
    usNewsRank: 2,
    intlRate: 10,
    deadline: '1月1日',
    essays: 5,
  },
  {
    name: 'Harvard University',
    usNewsRank: 3,
    intlRate: 12,
    deadline: '1月1日',
    essays: 1,
  },
  {
    name: 'Stanford University',
    usNewsRank: 3,
    intlRate: 8,
    deadline: '1月2日',
    essays: 3,
  },
  {
    name: 'Yale University',
    usNewsRank: 5,
    intlRate: 11,
    deadline: '1月2日',
    essays: 3,
  },
  {
    name: 'University of Pennsylvania',
    usNewsRank: 6,
    intlRate: 13,
    deadline: '1月5日',
    essays: 2,
  },
  {
    name: 'California Institute of Technology',
    usNewsRank: 7,
    intlRate: 9,
    deadline: '1月3日',
    essays: 4,
  },
  {
    name: 'Duke University',
    usNewsRank: 7,
    intlRate: 10,
    deadline: '1月3日',
    essays: 2,
  },
  {
    name: 'Brown University',
    usNewsRank: 9,
    intlRate: 12,
    deadline: '1月5日',
    essays: 5,
  },
  {
    name: 'Johns Hopkins University',
    usNewsRank: 9,
    intlRate: 11,
    deadline: '1月3日',
    essays: 1,
  },
  {
    name: 'Northwestern University',
    usNewsRank: 9,
    intlRate: 10,
    deadline: '1月3日',
    essays: 2,
  },
  {
    name: 'Columbia University',
    usNewsRank: 12,
    intlRate: 15,
    deadline: '1月1日',
    essays: 3,
  },
  {
    name: 'Cornell University',
    usNewsRank: 12,
    intlRate: 11,
    deadline: '1月2日',
    essays: 1,
  },
  {
    name: 'University of Chicago',
    usNewsRank: 12,
    intlRate: 14,
    deadline: '1月4日',
    essays: 2,
  },
  {
    name: 'University of California, Berkeley',
    usNewsRank: 15,
    intlRate: 14,
    deadline: '11月30日',
    essays: 4,
  },
  {
    name: 'University of California, Los Angeles',
    usNewsRank: 15,
    intlRate: 13,
    deadline: '11月30日',
    essays: 4,
  },
  {
    name: 'Rice University',
    usNewsRank: 17,
    intlRate: 12,
    deadline: '1月4日',
    essays: 3,
  },
  {
    name: 'Dartmouth College',
    usNewsRank: 18,
    intlRate: 9,
    deadline: '1月3日',
    essays: 3,
  },
  {
    name: 'Vanderbilt University',
    usNewsRank: 18,
    intlRate: 8,
    deadline: '1月1日',
    essays: 1,
  },
  {
    name: 'University of Notre Dame',
    usNewsRank: 20,
    intlRate: 6,
    deadline: '1月1日',
    essays: 1,
  },
  // ... 继续添加更多学校
];

// 热门专业排名 (CS Top 20)
const csRankings = [
  { name: 'Massachusetts Institute of Technology', csRank: 1 },
  { name: 'Carnegie Mellon University', csRank: 1 },
  { name: 'Stanford University', csRank: 1 },
  { name: 'University of California, Berkeley', csRank: 1 },
  { name: 'University of Illinois Urbana-Champaign', csRank: 5 },
  { name: 'Cornell University', csRank: 5 },
  { name: 'Georgia Institute of Technology', csRank: 7 },
  { name: 'University of Washington', csRank: 7 },
  { name: 'Princeton University', csRank: 9 },
  { name: 'California Institute of Technology', csRank: 9 },
];

async function main() {
  console.log('📊 更新排名和申请信息...');

  for (const data of rankings) {
    const school = await prisma.school.findFirst({
      where: { name: data.name },
    });

    if (school) {
      await prisma.school.update({
        where: { id: school.id },
        data: {
          usNewsRank: data.usNewsRank,
          metadata: {
            ...((school.metadata as object) || {}),
            intlAcceptanceRate: data.intlRate,
            rdDeadline: data.deadline,
            essayCount: data.essays,
            lastRankingUpdate: '2025',
          },
        },
      });
      console.log(`✅ ${data.name}: Rank #${data.usNewsRank}`);
    }
  }

  console.log('\n💻 更新 CS 专业排名...');

  for (const data of csRankings) {
    const school = await prisma.school.findFirst({
      where: { name: data.name },
    });

    if (school) {
      // 存储到 SchoolMetric 表
      await prisma.schoolMetric.upsert({
        where: {
          schoolId_year_metricKey: {
            schoolId: school.id,
            year: 2025,
            metricKey: 'cs_rank',
          },
        },
        update: { value: data.csRank },
        create: {
          schoolId: school.id,
          year: 2025,
          metricKey: 'cs_rank',
          value: data.csRank,
        },
      });
      console.log(`✅ ${data.name}: CS Rank #${data.csRank}`);
    }
  }

  console.log('\n🎉 完成!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
