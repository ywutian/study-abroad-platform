/**
 * 补充最后 10 所学校，达到 Top 100
 */

import { PrismaClient } from '@prisma/client';
import { batchUpsertSchools, SeedSchoolData } from './lib/seed-helpers';

const prisma = new PrismaClient();

export const FINAL_SCHOOLS: SeedSchoolData[] = [
  {
    name: 'Brandeis University',
    nameZh: '布兰迪斯大学',
    state: 'MA',
    city: 'Waltham',
    usNewsRank: 60,
    acceptanceRate: 35.0,
    tuition: 62974,
    satAvg: 1430,
    actAvg: 32,
    studentCount: 5943,
    graduationRate: 88,
    website: 'https://www.brandeis.edu',
    description:
      'Brandeis is a private research university near Boston, known for its strong humanities, social sciences, and Jewish heritage.',
    descriptionZh:
      '布兰迪斯大学是位于波士顿附近的私立研究型大学，以其人文学科、社会科学和犹太传统闻名。',
  },
  {
    name: 'University of California, Merced',
    nameZh: '加州大学默塞德分校',
    state: 'CA',
    city: 'Merced',
    usNewsRank: 100,
    acceptanceRate: 90.0,
    tuition: 43836,
    satAvg: 1150,
    actAvg: 23,
    studentCount: 9069,
    graduationRate: 64,
    website: 'https://www.ucmerced.edu',
    description:
      'UC Merced is the newest UC campus, focused on sustainability, research, and providing access to UC education in the Central Valley.',
    descriptionZh:
      '加州大学默塞德分校是最新的UC校区，专注于可持续发展、研究以及为中央山谷提供UC教育机会。',
  },
  {
    name: 'Saint Louis University',
    nameZh: '圣路易斯大学',
    state: 'MO',
    city: 'St. Louis',
    usNewsRank: 95,
    acceptanceRate: 55.0,
    tuition: 52620,
    satAvg: 1290,
    actAvg: 28,
    studentCount: 16112,
    graduationRate: 75,
    website: 'https://www.slu.edu',
    description:
      'SLU is a Jesuit research university known for its health sciences, law school, and commitment to service.',
    descriptionZh:
      '圣路易斯大学是一所耶稣会研究型大学，以其健康科学、法学院和服务承诺闻名。',
  },
  {
    name: 'Loyola Marymount University',
    nameZh: '洛约拉玛丽蒙特大学',
    state: 'CA',
    city: 'Los Angeles',
    usNewsRank: 79,
    acceptanceRate: 47.0,
    tuition: 58250,
    satAvg: 1310,
    actAvg: 29,
    studentCount: 9603,
    graduationRate: 82,
    website: 'https://www.lmu.edu',
    description:
      'LMU is a Jesuit university in Los Angeles with beautiful campus views, known for film, business, and strong community.',
    descriptionZh:
      '洛约拉玛丽蒙特大学是位于洛杉矶的耶稣会大学，拥有美丽的校园景观，以电影、商业和强大社区闻名。',
  },
  {
    name: 'Southern Methodist University',
    nameZh: '南卫理公会大学',
    state: 'TX',
    city: 'Dallas',
    usNewsRank: 74,
    acceptanceRate: 53.0,
    tuition: 60942,
    satAvg: 1380,
    actAvg: 31,
    studentCount: 12397,
    graduationRate: 82,
    website: 'https://www.smu.edu',
    description:
      'SMU is a private university in Dallas known for its business school, law school, and arts programs.',
    descriptionZh:
      '南卫理公会大学是位于达拉斯的私立大学，以其商学院、法学院和艺术项目闻名。',
  },
  {
    name: 'University of Denver',
    nameZh: '丹佛大学',
    state: 'CO',
    city: 'Denver',
    usNewsRank: 90,
    acceptanceRate: 66.0,
    tuition: 57642,
    satAvg: 1300,
    actAvg: 29,
    studentCount: 12904,
    graduationRate: 80,
    website: 'https://www.du.edu',
    description:
      'University of Denver is the oldest private university in the Rocky Mountain region, known for international studies and hospitality.',
    descriptionZh:
      '丹佛大学是落基山脉地区最古老的私立大学，以国际研究和酒店管理闻名。',
  },
  {
    name: 'Colorado School of Mines',
    nameZh: '科罗拉多矿业大学',
    state: 'CO',
    city: 'Golden',
    usNewsRank: 95,
    acceptanceRate: 51.0,
    tuition: 44916,
    satAvg: 1400,
    actAvg: 31,
    studentCount: 6965,
    graduationRate: 78,
    website: 'https://www.mines.edu',
    description:
      'Mines is a public research university focused on engineering and applied sciences, with strong ties to the mining and energy industries.',
    descriptionZh:
      '科罗拉多矿业大学是专注于工程和应用科学的公立研究型大学，与采矿和能源行业有着紧密联系。',
  },
  {
    name: 'University of San Diego',
    nameZh: '圣地亚哥大学',
    state: 'CA',
    city: 'San Diego',
    usNewsRank: 90,
    acceptanceRate: 49.0,
    tuition: 56900,
    satAvg: 1310,
    actAvg: 29,
    studentCount: 9116,
    graduationRate: 80,
    website: 'https://www.sandiego.edu',
    description:
      'USD is a Catholic university with a stunning Spanish Renaissance campus overlooking Mission Bay.',
    descriptionZh:
      '圣地亚哥大学是一所天主教大学，拥有俯瞰米逊湾的壮观西班牙文艺复兴风格校园。',
  },
  {
    name: 'Gonzaga University',
    nameZh: '冈萨加大学',
    state: 'WA',
    city: 'Spokane',
    usNewsRank: 79,
    acceptanceRate: 65.0,
    tuition: 53620,
    satAvg: 1290,
    actAvg: 29,
    studentCount: 7435,
    graduationRate: 86,
    website: 'https://www.gonzaga.edu',
    description:
      'Gonzaga is a Jesuit university known for its basketball program, engineering, and strong community values.',
    descriptionZh:
      '冈萨加大学是一所耶稣会大学，以其篮球项目、工程和强大的社区价值观闻名。',
  },
  {
    name: 'Villanova University',
    nameZh: '维拉诺瓦大学',
    state: 'PA',
    city: 'Villanova',
    usNewsRank: 52,
    acceptanceRate: 23.0,
    tuition: 62078,
    satAvg: 1445,
    actAvg: 33,
    studentCount: 10804,
    graduationRate: 91,
    website: 'https://www.villanova.edu',
    description:
      'Villanova is an Augustinian Catholic university known for its business school, engineering, and basketball tradition.',
    descriptionZh:
      '维拉诺瓦大学是一所奥古斯丁天主教大学，以其商学院、工程和篮球传统闻名。',
  },
];

async function main() {
  const schools: SeedSchoolData[] = FINAL_SCHOOLS;
  await batchUpsertSchools(prisma, schools, '最终补充学校数据');
}

if (require.main === module) {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
