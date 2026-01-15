/**
 * 补充更多美国学校 (US News 101-150)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MORE_US_SCHOOLS = [
  // 101-120
  {
    name: 'Auburn University',
    nameZh: '奥本大学',
    state: 'AL',
    city: 'Auburn',
    usNewsRank: 101,
    acceptanceRate: 44.0,
    tuition: 32580,
    satAvg: 1260,
    actAvg: 28,
    studentCount: 31526,
    graduationRate: 79,
    website: 'https://www.auburn.edu',
    description:
      "Auburn is Alabama's largest university, known for engineering, veterinary medicine, and passionate SEC athletics.",
    descriptionZh:
      '奥本大学是阿拉巴马州最大的大学，以工程、兽医学和热情的SEC体育闻名。',
  },
  {
    name: 'University of South Carolina',
    nameZh: '南卡罗来纳大学',
    state: 'SC',
    city: 'Columbia',
    usNewsRank: 101,
    acceptanceRate: 68.0,
    tuition: 33928,
    satAvg: 1250,
    actAvg: 27,
    studentCount: 35364,
    graduationRate: 77,
    website: 'https://www.sc.edu',
    description:
      "USC is South Carolina's flagship, known for its top-ranked international business program and Honors College.",
    descriptionZh:
      '南卡罗来纳大学是该州旗舰大学，以顶尖的国际商务项目和荣誉学院闻名。',
  },
  {
    name: 'University of Utah',
    nameZh: '犹他大学',
    state: 'UT',
    city: 'Salt Lake City',
    usNewsRank: 101,
    acceptanceRate: 86.0,
    tuition: 31378,
    satAvg: 1260,
    actAvg: 26,
    studentCount: 35000,
    graduationRate: 71,
    website: 'https://www.utah.edu',
    description:
      'University of Utah is known for its computer science, gaming programs, and proximity to world-class skiing.',
    descriptionZh:
      '犹他大学以其计算机科学、游戏项目和世界级滑雪场的便利位置闻名。',
  },
  {
    name: 'DePaul University',
    nameZh: '德保罗大学',
    state: 'IL',
    city: 'Chicago',
    usNewsRank: 105,
    acceptanceRate: 70.0,
    tuition: 44820,
    satAvg: 1220,
    actAvg: 26,
    studentCount: 22100,
    graduationRate: 72,
    website: 'https://www.depaul.edu',
    description:
      'DePaul is the largest Catholic university in the US, located in Chicago with strong business and theater programs.',
    descriptionZh:
      '德保罗大学是美国最大的天主教大学，位于芝加哥，以商业和戏剧项目闻名。',
  },
  {
    name: 'Seton Hall University',
    nameZh: '西东大学',
    state: 'NJ',
    city: 'South Orange',
    usNewsRank: 105,
    acceptanceRate: 76.0,
    tuition: 48640,
    satAvg: 1220,
    actAvg: 27,
    studentCount: 10000,
    graduationRate: 73,
    website: 'https://www.shu.edu',
    description:
      'Seton Hall is a Catholic university near NYC, known for its law school, diplomacy program, and basketball.',
    descriptionZh:
      '西东大学是位于纽约附近的天主教大学，以法学院、外交项目和篮球闻名。',
  },
  {
    name: 'University of Oregon',
    nameZh: '俄勒冈大学',
    state: 'OR',
    city: 'Eugene',
    usNewsRank: 105,
    acceptanceRate: 83.0,
    tuition: 39666,
    satAvg: 1190,
    actAvg: 26,
    studentCount: 23600,
    graduationRate: 74,
    website: 'https://www.uoregon.edu',
    description:
      "UO is Oregon's flagship known for journalism, business, and its Nike-connected athletics program.",
    descriptionZh:
      '俄勒冈大学是该州旗舰大学，以新闻学、商业和与Nike合作的体育项目闻名。',
  },
  {
    name: 'University of San Francisco',
    nameZh: '旧金山大学',
    state: 'CA',
    city: 'San Francisco',
    usNewsRank: 105,
    acceptanceRate: 65.0,
    tuition: 55692,
    satAvg: 1240,
    actAvg: 27,
    studentCount: 10500,
    graduationRate: 74,
    website: 'https://www.usfca.edu',
    description:
      'USF is a Jesuit university in the heart of San Francisco, known for its diverse community and social justice focus.',
    descriptionZh:
      '旧金山大学是位于旧金山市中心的耶稣会大学，以其多元化社区和社会正义关注闻名。',
  },
  {
    name: 'Clarkson University',
    nameZh: '克拉克森大学',
    state: 'NY',
    city: 'Potsdam',
    usNewsRank: 110,
    acceptanceRate: 72.0,
    tuition: 56440,
    satAvg: 1290,
    actAvg: 28,
    studentCount: 4300,
    graduationRate: 75,
    website: 'https://www.clarkson.edu',
    description:
      'Clarkson is a private tech university known for engineering, business, and strong industry connections.',
    descriptionZh:
      '克拉克森大学是一所私立科技大学，以工程、商业和强大的行业联系闻名。',
  },
  {
    name: 'University of Kentucky',
    nameZh: '肯塔基大学',
    state: 'KY',
    city: 'Lexington',
    usNewsRank: 110,
    acceptanceRate: 90.0,
    tuition: 32620,
    satAvg: 1180,
    actAvg: 26,
    studentCount: 31000,
    graduationRate: 67,
    website: 'https://www.uky.edu',
    description:
      "UK is Kentucky's flagship, known for its pharmacy program, basketball tradition, and equine studies.",
    descriptionZh:
      '肯塔基大学是该州旗舰大学，以药学项目、篮球传统和马术研究闻名。',
  },
  {
    name: 'University of Kansas',
    nameZh: '堪萨斯大学',
    state: 'KS',
    city: 'Lawrence',
    usNewsRank: 110,
    acceptanceRate: 90.0,
    tuition: 28870,
    satAvg: 1200,
    actAvg: 25,
    studentCount: 27600,
    graduationRate: 66,
    website: 'https://www.ku.edu',
    description:
      "KU is Kansas's flagship known for its journalism school, basketball heritage, and beautiful campus.",
    descriptionZh:
      '堪萨斯大学是该州旗舰大学，以新闻学院、篮球传统和美丽的校园闻名。',
  },
  {
    name: 'San Diego State University',
    nameZh: '圣地亚哥州立大学',
    state: 'CA',
    city: 'San Diego',
    usNewsRank: 110,
    acceptanceRate: 37.0,
    tuition: 20032,
    satAvg: 1210,
    actAvg: 26,
    studentCount: 36000,
    graduationRate: 74,
    website: 'https://www.sdsu.edu',
    description:
      'SDSU is a leading CSU campus known for business, engineering, and its sunny San Diego location.',
    descriptionZh:
      '圣地亚哥州立大学是领先的加州州立大学校区，以商业、工程和阳光明媚的圣地亚哥位置闻名。',
  },
  {
    name: 'The New School',
    nameZh: '新学院大学',
    state: 'NY',
    city: 'New York',
    usNewsRank: 110,
    acceptanceRate: 56.0,
    tuition: 54180,
    satAvg: 1230,
    actAvg: 27,
    studentCount: 10000,
    graduationRate: 65,
    website: 'https://www.newschool.edu',
    description:
      'The New School is known for Parsons School of Design, performing arts, and progressive education in NYC.',
    descriptionZh: '新学院大学以帕森斯设计学院、表演艺术和纽约的进步教育闻名。',
  },
  {
    name: 'University of Alabama',
    nameZh: '阿拉巴马大学',
    state: 'AL',
    city: 'Tuscaloosa',
    usNewsRank: 115,
    acceptanceRate: 80.0,
    tuition: 31460,
    satAvg: 1210,
    actAvg: 27,
    studentCount: 38500,
    graduationRate: 72,
    website: 'https://www.ua.edu',
    description:
      "UA is Alabama's flagship known for its generous scholarships, football tradition, and growing research profile.",
    descriptionZh:
      '阿拉巴马大学是该州旗舰大学，以慷慨的奖学金、足球传统和不断增长的研究实力闻名。',
  },
  {
    name: 'University of Oklahoma',
    nameZh: '俄克拉荷马大学',
    state: 'OK',
    city: 'Norman',
    usNewsRank: 115,
    acceptanceRate: 83.0,
    tuition: 27733,
    satAvg: 1200,
    actAvg: 26,
    studentCount: 28500,
    graduationRate: 69,
    website: 'https://www.ou.edu',
    description:
      "OU is Oklahoma's flagship known for meteorology, petroleum engineering, and football excellence.",
    descriptionZh:
      '俄克拉荷马大学是该州旗舰大学，以气象学、石油工程和卓越的足球闻名。',
  },
  {
    name: 'Arizona State University',
    nameZh: '亚利桑那州立大学',
    state: 'AZ',
    city: 'Tempe',
    usNewsRank: 115,
    acceptanceRate: 88.0,
    tuition: 32101,
    satAvg: 1230,
    actAvg: 25,
    studentCount: 77000,
    graduationRate: 69,
    website: 'https://www.asu.edu',
    description:
      'ASU is one of the largest US universities, known for innovation, online education, and sustainability research.',
    descriptionZh:
      '亚利桑那州立大学是美国最大的大学之一，以创新、在线教育和可持续发展研究闻名。',
  },
  {
    name: 'University of Missouri',
    nameZh: '密苏里大学',
    state: 'MO',
    city: 'Columbia',
    usNewsRank: 115,
    acceptanceRate: 81.0,
    tuition: 30548,
    satAvg: 1220,
    actAvg: 26,
    studentCount: 31400,
    graduationRate: 72,
    website: 'https://missouri.edu',
    description:
      'Mizzou is known for its journalism school (the first in the world), health sciences, and SEC athletics.',
    descriptionZh:
      '密苏里大学以其新闻学院（世界第一所）、健康科学和SEC体育闻名。',
  },
  {
    name: 'Loyola University Chicago',
    nameZh: '芝加哥洛约拉大学',
    state: 'IL',
    city: 'Chicago',
    usNewsRank: 115,
    acceptanceRate: 68.0,
    tuition: 50568,
    satAvg: 1280,
    actAvg: 28,
    studentCount: 17000,
    graduationRate: 75,
    website: 'https://www.luc.edu',
    description:
      'Loyola Chicago is a Jesuit university known for its nursing, business, and law programs with a lakeside campus.',
    descriptionZh:
      '芝加哥洛约拉大学是一所耶稣会大学，以护理、商业和法学项目及湖畔校园闻名。',
  },
  {
    name: 'Iowa State University',
    nameZh: '爱荷华州立大学',
    state: 'IA',
    city: 'Ames',
    usNewsRank: 120,
    acceptanceRate: 91.0,
    tuition: 25888,
    satAvg: 1210,
    actAvg: 25,
    studentCount: 31000,
    graduationRate: 74,
    website: 'https://www.iastate.edu',
    description:
      'Iowa State is known for its engineering, agriculture, and veterinary medicine programs.',
    descriptionZh: '爱荷华州立大学以其工程、农业和兽医项目闻名。',
  },
  {
    name: 'University of Tennessee',
    nameZh: '田纳西大学',
    state: 'TN',
    city: 'Knoxville',
    usNewsRank: 120,
    acceptanceRate: 78.0,
    tuition: 31664,
    satAvg: 1220,
    actAvg: 27,
    studentCount: 31700,
    graduationRate: 72,
    website: 'https://www.utk.edu',
    description:
      "UTK is Tennessee's flagship known for its business college, nuclear engineering, and Volunteer sports.",
    descriptionZh:
      '田纳西大学是该州旗舰大学，以商学院、核工程和志愿者体育闻名。',
  },
  {
    name: 'University of Nebraska-Lincoln',
    nameZh: '内布拉斯加大学林肯分校',
    state: 'NE',
    city: 'Lincoln',
    usNewsRank: 120,
    acceptanceRate: 80.0,
    tuition: 26900,
    satAvg: 1200,
    actAvg: 25,
    studentCount: 25000,
    graduationRate: 70,
    website: 'https://www.unl.edu',
    description:
      'Nebraska is known for its agricultural sciences, actuarial science, and passionate football culture.',
    descriptionZh: '内布拉斯加大学以其农业科学、精算学和热情的足球文化闻名。',
  },
  // 121-140
  {
    name: 'Oregon State University',
    nameZh: '俄勒冈州立大学',
    state: 'OR',
    city: 'Corvallis',
    usNewsRank: 125,
    acceptanceRate: 82.0,
    tuition: 33393,
    satAvg: 1200,
    actAvg: 25,
    studentCount: 32000,
    graduationRate: 68,
    website: 'https://oregonstate.edu',
    description:
      'Oregon State is known for forestry, marine sciences, and its strong online degree programs.',
    descriptionZh: '俄勒冈州立大学以林业、海洋科学和强大的在线学位项目闻名。',
  },
  {
    name: 'University of New Hampshire',
    nameZh: '新罕布什尔大学',
    state: 'NH',
    city: 'Durham',
    usNewsRank: 125,
    acceptanceRate: 88.0,
    tuition: 36012,
    satAvg: 1200,
    actAvg: 26,
    studentCount: 15000,
    graduationRate: 77,
    website: 'https://www.unh.edu',
    description:
      "UNH is New Hampshire's flagship known for marine biology, hospitality, and its New England setting.",
    descriptionZh:
      '新罕布什尔大学是该州旗舰大学，以海洋生物学、酒店管理和新英格兰环境闻名。',
  },
  {
    name: 'University of Cincinnati',
    nameZh: '辛辛那提大学',
    state: 'OH',
    city: 'Cincinnati',
    usNewsRank: 125,
    acceptanceRate: 80.0,
    tuition: 28424,
    satAvg: 1240,
    actAvg: 26,
    studentCount: 47000,
    graduationRate: 70,
    website: 'https://www.uc.edu',
    description:
      'UC is known for pioneering co-op education, its design school (DAAP), and medical programs.',
    descriptionZh:
      '辛辛那提大学以开创合作教育、设计学院（DAAP）和医学项目闻名。',
  },
  {
    name: 'Colorado State University',
    nameZh: '科罗拉多州立大学',
    state: 'CO',
    city: 'Fort Collins',
    usNewsRank: 125,
    acceptanceRate: 85.0,
    tuition: 32247,
    satAvg: 1190,
    actAvg: 25,
    studentCount: 34000,
    graduationRate: 70,
    website: 'https://www.colostate.edu',
    description:
      'CSU is known for veterinary medicine, atmospheric science, and its Fort Collins college town setting.',
    descriptionZh:
      '科罗拉多州立大学以兽医学、大气科学和柯林斯堡大学城环境闻名。',
  },
  {
    name: 'University of Vermont',
    nameZh: '佛蒙特大学',
    state: 'VT',
    city: 'Burlington',
    usNewsRank: 125,
    acceptanceRate: 59.0,
    tuition: 46458,
    satAvg: 1280,
    actAvg: 29,
    studentCount: 13500,
    graduationRate: 77,
    website: 'https://www.uvm.edu',
    description:
      'UVM is known for its environmental programs, medical school, and picturesque Vermont setting.',
    descriptionZh: '佛蒙特大学以其环境项目、医学院和风景如画的佛蒙特环境闻名。',
  },
  {
    name: 'George Mason University',
    nameZh: '乔治梅森大学',
    state: 'VA',
    city: 'Fairfax',
    usNewsRank: 130,
    acceptanceRate: 90.0,
    tuition: 37740,
    satAvg: 1260,
    actAvg: 27,
    studentCount: 39000,
    graduationRate: 69,
    website: 'https://www.gmu.edu',
    description:
      "GMU is Virginia's largest public university, known for its economics program (Nobel laureates) and DC proximity.",
    descriptionZh:
      '乔治梅森大学是弗吉尼亚州最大的公立大学，以其经济学项目（诺贝尔奖得主）和靠近华盛顿特区闻名。',
  },
  {
    name: 'Louisiana State University',
    nameZh: '路易斯安那州立大学',
    state: 'LA',
    city: 'Baton Rouge',
    usNewsRank: 130,
    acceptanceRate: 76.0,
    tuition: 28639,
    satAvg: 1210,
    actAvg: 26,
    studentCount: 35000,
    graduationRate: 68,
    website: 'https://www.lsu.edu',
    description:
      "LSU is Louisiana's flagship known for its petroleum engineering, coastal sciences, and Tigers athletics.",
    descriptionZh:
      '路易斯安那州立大学是该州旗舰大学，以石油工程、海岸科学和老虎队体育闻名。',
  },
  {
    name: 'University of Houston',
    nameZh: '休斯顿大学',
    state: 'TX',
    city: 'Houston',
    usNewsRank: 130,
    acceptanceRate: 66.0,
    tuition: 22842,
    satAvg: 1200,
    actAvg: 25,
    studentCount: 47000,
    graduationRate: 59,
    website: 'https://www.uh.edu',
    description:
      'UH is a major urban research university known for its law school, hospitality, and energy industry ties.',
    descriptionZh:
      '休斯顿大学是一所主要的城市研究型大学，以法学院、酒店管理和能源行业联系闻名。',
  },
  {
    name: 'University of Arkansas',
    nameZh: '阿肯色大学',
    state: 'AR',
    city: 'Fayetteville',
    usNewsRank: 130,
    acceptanceRate: 79.0,
    tuition: 27358,
    satAvg: 1180,
    actAvg: 26,
    studentCount: 30000,
    graduationRate: 66,
    website: 'https://www.uark.edu',
    description:
      "Arkansas is the state's flagship known for its Walton College of Business (thanks to Walmart connection) and SEC sports.",
    descriptionZh:
      '阿肯色大学是该州旗舰大学，以沃尔顿商学院（与沃尔玛的联系）和SEC体育闻名。',
  },
  {
    name: 'University of Hawaii at Manoa',
    nameZh: '夏威夷大学马诺阿分校',
    state: 'HI',
    city: 'Honolulu',
    usNewsRank: 135,
    acceptanceRate: 83.0,
    tuition: 36186,
    satAvg: 1170,
    actAvg: 24,
    studentCount: 19000,
    graduationRate: 60,
    website: 'https://manoa.hawaii.edu',
    description:
      'UH Manoa is known for its marine biology, astronomy, and Hawaiian studies in a tropical paradise setting.',
    descriptionZh:
      '夏威夷大学马诺阿分校以海洋生物学、天文学和夏威夷研究闻名，位于热带天堂环境中。',
  },
  {
    name: 'Florida State University',
    nameZh: '佛罗里达州立大学',
    state: 'FL',
    city: 'Tallahassee',
    usNewsRank: 135,
    acceptanceRate: 25.0,
    tuition: 21683,
    satAvg: 1320,
    actAvg: 29,
    studentCount: 45000,
    graduationRate: 83,
    website: 'https://www.fsu.edu',
    description:
      'FSU is known for its strong film school, criminology program, and nationally ranked athletics.',
    descriptionZh:
      '佛罗里达州立大学以其强大的电影学院、犯罪学项目和全国排名的体育闻名。',
  },
  {
    name: 'University of Rhode Island',
    nameZh: '罗德岛大学',
    state: 'RI',
    city: 'Kingston',
    usNewsRank: 135,
    acceptanceRate: 75.0,
    tuition: 33632,
    satAvg: 1180,
    actAvg: 25,
    studentCount: 17500,
    graduationRate: 68,
    website: 'https://www.uri.edu',
    description:
      "URI is Rhode Island's flagship known for oceanography, pharmacy, and its coastal New England campus.",
    descriptionZh:
      '罗德岛大学是该州旗舰大学，以海洋学、药学和新英格兰海岸校园闻名。',
  },
  {
    name: 'Kansas State University',
    nameZh: '堪萨斯州立大学',
    state: 'KS',
    city: 'Manhattan',
    usNewsRank: 140,
    acceptanceRate: 95.0,
    tuition: 26590,
    satAvg: 1150,
    actAvg: 24,
    studentCount: 21000,
    graduationRate: 66,
    website: 'https://www.k-state.edu',
    description:
      'K-State is known for its agricultural programs, veterinary college, and the Little Apple college town.',
    descriptionZh: '堪萨斯州立大学以其农业项目、兽医学院和小苹果大学城闻名。',
  },
  {
    name: 'Missouri University of Science and Technology',
    nameZh: '密苏里科技大学',
    state: 'MO',
    city: 'Rolla',
    usNewsRank: 140,
    acceptanceRate: 81.0,
    tuition: 30614,
    satAvg: 1320,
    actAvg: 29,
    studentCount: 7800,
    graduationRate: 66,
    website: 'https://www.mst.edu',
    description:
      'Missouri S&T is known for its engineering programs, especially mining, metallurgical, and aerospace engineering.',
    descriptionZh:
      '密苏里科技大学以其工程项目闻名，特别是采矿、冶金和航空航天工程。',
  },
  {
    name: 'Washington State University',
    nameZh: '华盛顿州立大学',
    state: 'WA',
    city: 'Pullman',
    usNewsRank: 140,
    acceptanceRate: 83.0,
    tuition: 28072,
    satAvg: 1140,
    actAvg: 24,
    studentCount: 31000,
    graduationRate: 63,
    website: 'https://wsu.edu',
    description:
      'WSU is known for its veterinary school, agricultural research, and rivalry with UW.',
    descriptionZh:
      '华盛顿州立大学以其兽医学院、农业研究和与华盛顿大学的竞争闻名。',
  },
];

async function main() {
  console.log('🏫 补充更多美国学校 (101-150)...\n');

  let created = 0;
  let updated = 0;

  for (const school of MORE_US_SCHOOLS) {
    const existing = await prisma.school.findFirst({
      where: { name: school.name },
    });

    if (existing) {
      await prisma.school.update({
        where: { id: existing.id },
        data: {
          city: school.city,
          usNewsRank: school.usNewsRank,
          satAvg: school.satAvg,
          actAvg: school.actAvg,
          studentCount: school.studentCount,
          graduationRate: school.graduationRate,
          website: school.website,
          description: school.description,
          descriptionZh: school.descriptionZh,
        },
      });
      console.log(`📝 更新: ${school.nameZh}`);
      updated++;
    } else {
      await prisma.school.create({
        data: {
          name: school.name,
          nameZh: school.nameZh,
          country: 'US',
          state: school.state,
          city: school.city,
          usNewsRank: school.usNewsRank,
          acceptanceRate: school.acceptanceRate,
          tuition: school.tuition,
          satAvg: school.satAvg,
          actAvg: school.actAvg,
          studentCount: school.studentCount,
          graduationRate: school.graduationRate,
          website: school.website,
          description: school.description,
          descriptionZh: school.descriptionZh,
        },
      });
      console.log(`✅ 新建: ${school.nameZh}`);
      created++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 完成: 新建 ${created}, 更新 ${updated}`);

  const totalSchools = await prisma.school.count();
  console.log(`🏫 学校总数: ${totalSchools}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
