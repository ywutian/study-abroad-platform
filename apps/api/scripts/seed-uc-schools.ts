/**
 * 补充 UC 系列学校数据 + 学校简介
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// UC 系列学校完整数据（手动整理）
const UC_SCHOOLS = [
  {
    name: 'University of California, Berkeley',
    nameZh: '加州大学伯克利分校',
    state: 'CA',
    city: 'Berkeley',
    usNewsRank: 15,
    acceptanceRate: 11.6,
    tuition: 44066,
    satAvg: 1440,
    actAvg: 32,
    studentCount: 45307,
    graduationRate: 93,
    website: 'https://www.berkeley.edu',
    description:
      'UC Berkeley is a world-renowned public research university known for its academic excellence, groundbreaking research, and vibrant campus culture in the San Francisco Bay Area.',
    descriptionZh:
      '加州大学伯克利分校是世界顶尖的公立研究型大学，以学术卓越、开创性研究和旧金山湾区充满活力的校园文化闻名。',
  },
  {
    name: 'University of California, Los Angeles',
    nameZh: '加州大学洛杉矶分校',
    state: 'CA',
    city: 'Los Angeles',
    usNewsRank: 15,
    acceptanceRate: 8.6,
    tuition: 44830,
    satAvg: 1405,
    actAvg: 31,
    studentCount: 46116,
    graduationRate: 91,
    website: 'https://www.ucla.edu',
    description:
      'UCLA is a top-tier public research university in Los Angeles, renowned for its diverse academic programs, championship athletics, and influential arts and entertainment connections.',
    descriptionZh:
      'UCLA 是洛杉矶顶尖的公立研究型大学，以多元化的学术项目、冠军级运动队以及与艺术和娱乐界的紧密联系而闻名。',
  },
  {
    name: 'University of California, San Diego',
    nameZh: '加州大学圣地亚哥分校',
    state: 'CA',
    city: 'La Jolla',
    usNewsRank: 28,
    acceptanceRate: 24.7,
    tuition: 44487,
    satAvg: 1380,
    actAvg: 31,
    studentCount: 42006,
    graduationRate: 87,
    website: 'https://www.ucsd.edu',
    description:
      'UC San Diego is a leading research university known for its strengths in science, engineering, and health sciences, located on the stunning La Jolla coastline.',
    descriptionZh:
      '加州大学圣地亚哥分校是领先的研究型大学，以科学、工程和健康科学见长，位于美丽的拉霍亚海岸。',
  },
  {
    name: 'University of California, Davis',
    nameZh: '加州大学戴维斯分校',
    state: 'CA',
    city: 'Davis',
    usNewsRank: 28,
    acceptanceRate: 37.3,
    tuition: 44408,
    satAvg: 1290,
    actAvg: 28,
    studentCount: 40031,
    graduationRate: 86,
    website: 'https://www.ucdavis.edu',
    description:
      'UC Davis is recognized globally for agriculture, veterinary medicine, and environmental sciences, with a friendly college-town atmosphere.',
    descriptionZh:
      '加州大学戴维斯分校在农业、兽医学和环境科学领域享有全球声誉，校园拥有友好的大学城氛围。',
  },
  {
    name: 'University of California, Irvine',
    nameZh: '加州大学尔湾分校',
    state: 'CA',
    city: 'Irvine',
    usNewsRank: 33,
    acceptanceRate: 21.0,
    tuition: 43709,
    satAvg: 1305,
    actAvg: 28,
    studentCount: 36303,
    graduationRate: 85,
    website: 'https://www.uci.edu',
    description:
      'UC Irvine combines academic excellence with Southern California lifestyle, known for its innovative research and diverse student body.',
    descriptionZh:
      '加州大学尔湾分校将学术卓越与南加州生活方式相结合，以创新研究和多元化学生群体著称。',
  },
  {
    name: 'University of California, Santa Barbara',
    nameZh: '加州大学圣塔芭芭拉分校',
    state: 'CA',
    city: 'Santa Barbara',
    usNewsRank: 35,
    acceptanceRate: 25.9,
    tuition: 44196,
    satAvg: 1355,
    actAvg: 30,
    studentCount: 26179,
    graduationRate: 83,
    website: 'https://www.ucsb.edu',
    description:
      'UCSB is a premier research university on the Pacific Coast, known for its stunning beachside campus and strong programs in STEM and social sciences.',
    descriptionZh:
      '加州大学圣塔芭芭拉分校是太平洋沿岸一流的研究型大学，以绝美的海滨校园和强大的STEM及社会科学项目闻名。',
  },
];

// 其他热门学校简介
const SCHOOL_DESCRIPTIONS: Record<
  string,
  {
    description: string;
    descriptionZh: string;
    website?: string;
    city?: string;
  }
> = {
  'Massachusetts Institute of Technology': {
    description:
      'MIT is a world-leading research university in Cambridge, Massachusetts, renowned for its pioneering work in science, engineering, and technology.',
    descriptionZh:
      '麻省理工学院是位于马萨诸塞州剑桥市的世界领先研究型大学，以其在科学、工程和技术领域的开创性工作闻名。',
    website: 'https://www.mit.edu',
    city: 'Cambridge',
  },
  'Harvard University': {
    description:
      'Harvard is the oldest institution of higher education in the United States, known for its world-class faculty, rigorous academics, and influential alumni network.',
    descriptionZh:
      '哈佛大学是美国最古老的高等教育机构，以其世界级师资、严谨学术和有影响力的校友网络闻名。',
    website: 'https://www.harvard.edu',
    city: 'Cambridge',
  },
  'Stanford University': {
    description:
      'Stanford is a leading research university in Silicon Valley, known for entrepreneurship, innovation, and producing tech industry leaders.',
    descriptionZh:
      '斯坦福大学是硅谷的顶尖研究型大学，以创业精神、创新能力和培养科技行业领袖而闻名。',
    website: 'https://www.stanford.edu',
    city: 'Stanford',
  },
  'Yale University': {
    description:
      'Yale is an Ivy League research university known for its residential college system, distinguished faculty, and strengths in law, drama, and the humanities.',
    descriptionZh:
      '耶鲁大学是一所常春藤联盟研究型大学，以其住宿学院制度、杰出师资以及在法学、戏剧和人文学科的优势闻名。',
    website: 'https://www.yale.edu',
    city: 'New Haven',
  },
  'Princeton University': {
    description:
      'Princeton is an Ivy League research university known for its focus on undergraduate education, beautiful campus, and generous financial aid.',
    descriptionZh:
      '普林斯顿大学是一所常春藤联盟研究型大学，以专注本科教育、美丽校园和慷慨的助学金而闻名。',
    website: 'https://www.princeton.edu',
    city: 'Princeton',
  },
  'Columbia University': {
    description:
      "Columbia is an Ivy League university in the heart of New York City, known for its Core Curriculum and location in the world's cultural capital.",
    descriptionZh:
      '哥伦比亚大学是位于纽约市中心的常春藤联盟大学，以其核心课程和世界文化之都的地理位置闻名。',
    website: 'https://www.columbia.edu',
    city: 'New York',
  },
  'University of Pennsylvania': {
    description:
      'Penn is an Ivy League university in Philadelphia known for its business school (Wharton), interdisciplinary approach, and pre-professional programs.',
    descriptionZh:
      '宾夕法尼亚大学是位于费城的常春藤联盟大学，以其商学院（沃顿）、跨学科方法和职前项目闻名。',
    website: 'https://www.upenn.edu',
    city: 'Philadelphia',
  },
  'Duke University': {
    description:
      'Duke is a leading research university in Durham, NC, known for its medical center, basketball program, and Gothic architecture.',
    descriptionZh:
      '杜克大学是位于北卡罗来纳州达勒姆的顶尖研究型大学，以其医学中心、篮球队和哥特式建筑闻名。',
    website: 'https://www.duke.edu',
    city: 'Durham',
  },
  'Northwestern University': {
    description:
      'Northwestern is a private research university near Chicago, known for its journalism school, theater program, and strong academics across disciplines.',
    descriptionZh:
      '西北大学是芝加哥附近的私立研究型大学，以其新闻学院、戏剧项目和跨学科的强大学术实力闻名。',
    website: 'https://www.northwestern.edu',
    city: 'Evanston',
  },
  'Cornell University': {
    description:
      'Cornell is an Ivy League university in Ithaca, NY, known for its diverse colleges, beautiful gorges, and strengths in engineering and hospitality.',
    descriptionZh:
      '康奈尔大学是位于纽约州伊萨卡的常春藤联盟大学，以其多元化的学院、美丽的峡谷以及在工程和酒店管理方面的优势闻名。',
    website: 'https://www.cornell.edu',
    city: 'Ithaca',
  },
  'Brown University': {
    description:
      'Brown is an Ivy League university in Providence, RI, known for its open curriculum, creative atmosphere, and student-driven education.',
    descriptionZh:
      '布朗大学是位于罗德岛州普罗维登斯的常春藤联盟大学，以其开放课程、创意氛围和学生主导的教育闻名。',
    website: 'https://www.brown.edu',
    city: 'Providence',
  },
  'Dartmouth College': {
    description:
      'Dartmouth is an Ivy League college in rural New Hampshire, known for its strong undergraduate focus, close-knit community, and outdoor culture.',
    descriptionZh:
      '达特茅斯学院是位于新罕布什尔州乡村的常春藤联盟学院，以其对本科教育的重视、紧密的社区和户外文化闻名。',
    website: 'https://www.dartmouth.edu',
    city: 'Hanover',
  },
  'Carnegie Mellon University': {
    description:
      'CMU is a leading research university in Pittsburgh, world-renowned for computer science, robotics, drama, and interdisciplinary innovation.',
    descriptionZh:
      '卡内基梅隆大学是位于匹兹堡的顶尖研究型大学，在计算机科学、机器人技术、戏剧和跨学科创新方面享有世界声誉。',
    website: 'https://www.cmu.edu',
    city: 'Pittsburgh',
  },
  'Johns Hopkins University': {
    description:
      'Johns Hopkins is a leading research university in Baltimore, known for its medical school, public health program, and research-intensive environment.',
    descriptionZh:
      '约翰霍普金斯大学是位于巴尔的摩的顶尖研究型大学，以其医学院、公共卫生项目和研究密集型环境闻名。',
    website: 'https://www.jhu.edu',
    city: 'Baltimore',
  },
  'University of Chicago': {
    description:
      'UChicago is known for its intellectual rigor, Core Curriculum, and Nobel Prize-winning faculty across economics, physics, and more.',
    descriptionZh:
      '芝加哥大学以其学术严谨、核心课程以及在经济学、物理学等领域获得诺贝尔奖的教师而闻名。',
    website: 'https://www.uchicago.edu',
    city: 'Chicago',
  },
  'Rice University': {
    description:
      'Rice is a leading research university in Houston, known for its residential college system, strong STEM programs, and collaboration with NASA.',
    descriptionZh:
      '莱斯大学是位于休斯顿的顶尖研究型大学，以其住宿学院制度、强大的STEM项目和与NASA的合作闻名。',
    website: 'https://www.rice.edu',
    city: 'Houston',
  },
  'Vanderbilt University': {
    description:
      'Vanderbilt is a leading research university in Nashville, known for its beautiful campus, strong academics, and vibrant music city location.',
    descriptionZh:
      '范德堡大学是位于纳什维尔的顶尖研究型大学，以其美丽校园、强大学术实力和充满活力的音乐城市位置闻名。',
    website: 'https://www.vanderbilt.edu',
    city: 'Nashville',
  },
  'Georgia Institute of Technology': {
    description:
      'Georgia Tech is a top public research university in Atlanta, renowned for engineering, computing, and innovation with strong industry connections.',
    descriptionZh:
      '佐治亚理工学院是位于亚特兰大的顶尖公立研究型大学，以工程、计算和创新以及与业界的紧密联系闻名。',
    website: 'https://www.gatech.edu',
    city: 'Atlanta',
  },
  'New York University': {
    description:
      'NYU is a global research university with its heart in New York City, known for arts, business, and its urban campus experience.',
    descriptionZh:
      'NYU 是一所以纽约市为中心的全球研究型大学，以艺术、商业和城市校园体验闻名。',
    website: 'https://www.nyu.edu',
    city: 'New York',
  },
  'University of Michigan, Ann Arbor': {
    description:
      'Michigan is a top public research university known for its strong academics across disciplines, passionate sports culture, and beautiful campus.',
    descriptionZh:
      '密歇根大学安娜堡分校是顶尖的公立研究型大学，以其跨学科的强大学术实力、热情的体育文化和美丽校园闻名。',
    website: 'https://umich.edu',
    city: 'Ann Arbor',
  },
  'Emory University': {
    description:
      'Emory is a leading research university in Atlanta, known for its medical school, business school, and beautiful Southern campus.',
    descriptionZh:
      '埃默里大学是位于亚特兰大的顶尖研究型大学，以其医学院、商学院和美丽的南方校园闻名。',
    website: 'https://www.emory.edu',
    city: 'Atlanta',
  },
  'University of Southern California': {
    description:
      'USC is a leading private research university in Los Angeles, known for film, business, engineering, and a strong alumni network in entertainment.',
    descriptionZh:
      '南加州大学是位于洛杉矶的顶尖私立研究型大学，以电影、商业、工程和在娱乐界的强大校友网络闻名。',
    website: 'https://www.usc.edu',
    city: 'Los Angeles',
  },
  'Boston University': {
    description:
      'BU is a large private research university in Boston, known for its urban campus along the Charles River and diverse academic programs.',
    descriptionZh:
      '波士顿大学是位于波士顿的大型私立研究型大学，以其沿查尔斯河的城市校园和多元化的学术项目闻名。',
    website: 'https://www.bu.edu',
    city: 'Boston',
  },
  'Tufts University': {
    description:
      'Tufts is a research university near Boston known for international relations, engineering, and a globally-minded student community.',
    descriptionZh:
      '塔夫茨大学是波士顿附近的研究型大学，以国际关系、工程和具有全球视野的学生群体闻名。',
    website: 'https://www.tufts.edu',
    city: 'Medford',
  },
  'Georgetown University': {
    description:
      'Georgetown is a prestigious university in Washington D.C., known for international affairs, law, and its Jesuit tradition of service.',
    descriptionZh:
      '乔治城大学是位于华盛顿特区的著名大学，以国际事务、法学和耶稣会服务传统闻名。',
    website: 'https://www.georgetown.edu',
    city: 'Washington',
  },
  'University of Virginia': {
    description:
      'UVA is a top public university founded by Thomas Jefferson, known for its honor code, beautiful grounds, and strong academics.',
    descriptionZh:
      '弗吉尼亚大学是托马斯·杰斐逊创立的顶尖公立大学，以其荣誉准则、美丽校园和强大学术实力闻名。',
    website: 'https://www.virginia.edu',
    city: 'Charlottesville',
  },
  'University of North Carolina at Chapel Hill': {
    description:
      'UNC is the oldest public university in the US, known for its basketball tradition, journalism school, and Southern hospitality.',
    descriptionZh:
      '北卡罗来纳大学教堂山分校是美国最古老的公立大学，以其篮球传统、新闻学院和南方热情好客闻名。',
    website: 'https://www.unc.edu',
    city: 'Chapel Hill',
  },
  'University of Texas at Austin': {
    description:
      'UT Austin is a flagship public university known for its size, research output, and strong programs in business, engineering, and computer science.',
    descriptionZh:
      '德克萨斯大学奥斯汀分校是旗舰公立大学，以其规模、研究成果以及在商业、工程和计算机科学方面的强大项目闻名。',
    website: 'https://www.utexas.edu',
    city: 'Austin',
  },
  'University of Illinois Urbana-Champaign': {
    description:
      'UIUC is a leading public research university known for engineering, computer science, and agricultural sciences.',
    descriptionZh:
      '伊利诺伊大学厄巴纳-香槟分校是顶尖的公立研究型大学，以工程、计算机科学和农业科学闻名。',
    website: 'https://illinois.edu',
    city: 'Urbana-Champaign',
  },
  'Purdue University': {
    description:
      'Purdue is a leading public university known for engineering, aviation, and a strong tradition of space exploration.',
    descriptionZh:
      '普渡大学是顶尖的公立大学，以工程、航空和深厚的太空探索传统闻名。',
    website: 'https://www.purdue.edu',
    city: 'West Lafayette',
  },
  'University of Florida': {
    description:
      'UF is a top public research university in Gainesville, known for its size, athletic programs, and diverse academic offerings.',
    descriptionZh:
      '佛罗里达大学是位于盖恩斯维尔的顶尖公立研究型大学，以其规模、体育项目和多元化的学术课程闻名。',
    website: 'https://www.ufl.edu',
    city: 'Gainesville',
  },
  'Boston College': {
    description:
      'BC is a Jesuit university known for its beautiful campus, strong business and law programs, and vibrant campus life.',
    descriptionZh:
      '波士顿学院是一所耶稣会大学，以其美丽校园、强大的商业和法律项目以及充满活力的校园生活闻名。',
    website: 'https://www.bc.edu',
    city: 'Chestnut Hill',
  },
  'Northeastern University': {
    description:
      'Northeastern is known for its co-op program, which integrates classroom learning with professional experience, located in the heart of Boston.',
    descriptionZh:
      '东北大学以其将课堂学习与专业经验相结合的合作项目闻名，位于波士顿市中心。',
    website: 'https://www.northeastern.edu',
    city: 'Boston',
  },
  'University of Washington': {
    description:
      'UW is a leading public research university in Seattle, known for computer science, medicine, and its stunning Pacific Northwest campus.',
    descriptionZh:
      '华盛顿大学是位于西雅图的顶尖公立研究型大学，以计算机科学、医学和美丽的太平洋西北校园闻名。',
    website: 'https://www.washington.edu',
    city: 'Seattle',
  },
  'University of Notre Dame': {
    description:
      'Notre Dame is a prestigious Catholic university known for its football tradition, beautiful campus, and strong undergraduate programs.',
    descriptionZh:
      '圣母大学是著名的天主教大学，以其橄榄球传统、美丽校园和强大的本科项目闻名。',
    website: 'https://www.nd.edu',
    city: 'Notre Dame',
  },
  'Washington University in St. Louis': {
    description:
      'WashU is a leading research university known for its medical school, collaborative atmosphere, and beautiful campus in St. Louis.',
    descriptionZh:
      '圣路易斯华盛顿大学是顶尖的研究型大学，以其医学院、协作氛围和位于圣路易斯的美丽校园闻名。',
    website: 'https://www.wustl.edu',
    city: 'St. Louis',
  },
};

async function main() {
  console.log('🏫 补充学校详细数据...\n');

  let updated = 0;

  // 更新 UC 系列
  for (const ucSchool of UC_SCHOOLS) {
    const existing = await prisma.school.findFirst({
      where: { name: ucSchool.name },
    });

    if (existing) {
      await prisma.school.update({
        where: { id: existing.id },
        data: {
          city: ucSchool.city,
          satAvg: ucSchool.satAvg,
          actAvg: ucSchool.actAvg,
          studentCount: ucSchool.studentCount,
          graduationRate: ucSchool.graduationRate,
          website: ucSchool.website,
          description: ucSchool.description,
          descriptionZh: ucSchool.descriptionZh,
        },
      });
      console.log(`✅ ${ucSchool.nameZh}`);
      updated++;
    }
  }

  // 更新其他学校简介
  for (const [name, info] of Object.entries(SCHOOL_DESCRIPTIONS)) {
    const school = await prisma.school.findFirst({
      where: { name },
    });

    if (school) {
      const updateData: any = {
        description: info.description,
        descriptionZh: info.descriptionZh,
      };
      if (info.website) updateData.website = info.website;
      if (info.city) updateData.city = info.city;

      await prisma.school.update({
        where: { id: school.id },
        data: updateData,
      });
      console.log(`✅ ${school.nameZh || name}`);
      updated++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 完成: 更新 ${updated} 所学校`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
