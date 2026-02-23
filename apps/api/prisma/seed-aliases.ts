/**
 * 学校别名种子脚本
 *
 * 为所有学校添加常用简称、缩写和昵称，提升搜索命中率。
 *
 * 运行方式:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-aliases.ts
 */

import { PrismaClient } from '@prisma/client';
import { normalizeSchoolName } from '../src/common/utils/school-name.util';

const prisma = new PrismaClient();

/**
 * 学校别名映射表
 * key: 学校全称 (name 字段)
 * value: 别名数组 (包括英文缩写、中文简称、昵称等)
 */
const SCHOOL_ALIASES: Record<string, string[]> = {
  // ==========================================
  // Top 20 National Universities
  // ==========================================
  'Princeton University': ['Princeton', '普林斯顿', '普林'],
  'Massachusetts Institute of Technology': ['MIT', '麻省理工', '麻省理工学院'],
  'Harvard University': ['Harvard', '哈佛', '哈佛大学'],
  'Stanford University': ['Stanford', '斯坦福', '斯坦福大学'],
  'Yale University': ['Yale', '耶鲁', '耶鲁大学'],
  'University of Pennsylvania': [
    'UPenn',
    'Penn',
    '宾大',
    '宾夕法尼亚',
    '宾州大学',
  ],
  'Duke University': ['Duke', '杜克', '杜克大学'],
  'California Institute of Technology': [
    'Caltech',
    'Cal Tech',
    '加州理工',
    'CIT',
  ],
  'Johns Hopkins University': [
    'JHU',
    'Johns Hopkins',
    '约翰霍普金斯',
    '霍普金斯',
  ],
  'Brown University': ['Brown', '布朗', '布朗大学'],
  'Northwestern University': ['Northwestern', 'NU', '西北大学', '西北'],
  'Cornell University': ['Cornell', '康奈尔', '康奈尔大学'],
  'Columbia University': ['Columbia', '哥大', '哥伦比亚', '哥伦比亚大学'],
  'University of Chicago': [
    'UChicago',
    'Chicago',
    '芝大',
    '芝加哥大学',
    '芝加哥',
  ],
  'University of California, Los Angeles': [
    'UCLA',
    '加州大学洛杉矶',
    'UC LA',
    '洛杉矶分校',
  ],
  'University of California, Berkeley': [
    'UC Berkeley',
    'UCB',
    'Berkeley',
    'Cal',
    '伯克利',
    '加州大学伯克利',
  ],
  'Rice University': ['Rice', '莱斯', '莱斯大学'],
  'Vanderbilt University': ['Vanderbilt', 'Vandy', '范德堡', '范德堡大学'],
  'Dartmouth College': ['Dartmouth', '达特茅斯', '达特茅斯学院'],
  'University of Notre Dame': ['Notre Dame', 'ND', '圣母', '圣母大学'],

  // ==========================================
  // Top 21-50 National Universities
  // ==========================================
  'University of Michigan, Ann Arbor': [
    'UMich',
    'Michigan',
    '密歇根',
    '密大',
    'Ann Arbor',
    '安娜堡',
  ],
  'University of North Carolina at Chapel Hill': [
    'UNC',
    'Chapel Hill',
    '北卡',
    '北卡教堂山',
  ],
  'Georgetown University': ['Georgetown', '乔治城', '乔治城大学'],
  'Carnegie Mellon University': ['CMU', '卡梅', '卡内基梅隆', '卡内基'],
  'Emory University': ['Emory', '埃默里', '埃默里大学'],
  'University of Virginia': ['UVA', 'UVa', '弗吉尼亚大学', '弗大'],
  'Washington University in St. Louis': [
    'WashU',
    'WUSTL',
    '圣路易斯华盛顿',
    '华大',
  ],
  'University of Southern California': [
    'USC',
    '南加大',
    '南加州',
    '南加州大学',
  ],
  'University of California, San Diego': [
    'UCSD',
    'UC San Diego',
    '加州大学圣地亚哥',
    '圣地亚哥分校',
  ],
  'University of Florida': ['UF', 'UFlorida', '佛罗里达大学', '佛大'],
  'University of California, Davis': [
    'UC Davis',
    'UCD',
    '加州大学戴维斯',
    '戴维斯分校',
  ],
  'University of Texas at Austin': [
    'UT Austin',
    'UT',
    'Texas',
    '德州大学奥斯汀',
    '德大',
    'UT-Austin',
  ],
  'University of California, Irvine': [
    'UCI',
    'UC Irvine',
    '加州大学尔湾',
    '尔湾分校',
  ],
  'Georgia Institute of Technology': [
    'Georgia Tech',
    'GT',
    'GaTech',
    '佐治亚理工',
    '乔治亚理工',
  ],
  'New York University': ['NYU', '纽大', '纽约大学'],
  'University of California, Santa Barbara': [
    'UCSB',
    'UC Santa Barbara',
    '加州大学圣塔芭芭拉',
    '圣芭分校',
  ],
  'University of Wisconsin-Madison': [
    'UW-Madison',
    'UWisc',
    'Wisconsin',
    '威斯康星',
    '威大',
  ],
  'University of Illinois Urbana-Champaign': [
    'UIUC',
    'Illinois',
    '伊利诺伊',
    'U of I',
    '香槟分校',
  ],
  'Boston College': ['BC', '波士顿学院', '波士顿学院BC'],
  'Tufts University': ['Tufts', '塔夫茨', '塔夫茨大学'],

  // ==========================================
  // Top 51-100 National Universities
  // ==========================================
  'Rutgers University-New Brunswick': ['Rutgers', '罗格斯', '罗格斯大学'],
  'University of Washington': ['UW', 'UDub', '华盛顿大学', '华大西雅图'],
  'Ohio State University': ['OSU', 'Ohio State', '俄亥俄州立', '俄亥俄'],
  'Purdue University': ['Purdue', '普渡', '普渡大学'],
  'Boston University': ['BU', '波士顿大学', '波大'],
  'University of Maryland, College Park': [
    'UMD',
    'Maryland',
    '马里兰',
    '马里兰大学',
  ],
  'Wake Forest University': ['Wake Forest', 'WFU', '维克森林'],
  'University of Georgia': ['UGA', 'Georgia', '佐治亚大学'],
  'Lehigh University': ['Lehigh', '里海', '里海大学'],
  'Texas A&M University': ['TAMU', 'Texas A&M', 'A&M', '德州农工', '农工大学'],
  'University of Rochester': ['Rochester', 'UR', '罗切斯特', '罗切斯特大学'],
  'Case Western Reserve University': [
    'Case Western',
    'CWRU',
    '凯斯西储',
    '凯斯',
  ],
  'University of Minnesota, Twin Cities': [
    'UMN',
    'Minnesota',
    '明大',
    '明尼苏达',
  ],
  'Northeastern University': ['NEU', 'Northeastern', '东北大学NEU'],
  'Florida State University': ['FSU', 'Florida State', '佛罗里达州立'],
  'University of Connecticut': ['UConn', 'Connecticut', '康涅狄格', '康大'],
  'Santa Clara University': ['SCU', 'Santa Clara', '圣克拉拉'],
  'Rensselaer Polytechnic Institute': ['RPI', 'Rensselaer', '伦斯勒理工'],
  'Brandeis University': ['Brandeis', '布兰迪斯', '布兰迪斯大学'],
  'Virginia Tech': ['VT', 'Virginia Tech', '弗吉尼亚理工', 'VTech'],
  'University of Massachusetts Amherst': [
    'UMass',
    'UMass Amherst',
    '马萨诸塞大学',
    '麻大',
  ],
  'George Washington University': ['GWU', 'GW', '乔治华盛顿', '乔华'],
  'University of Miami': ['UMiami', 'Miami', '迈阿密大学'],
  'University of Pittsburgh': ['Pitt', 'Pittsburgh', '匹兹堡', '匹大'],
  'Villanova University': ['Villanova', '维拉诺瓦'],
  'North Carolina State University': ['NC State', 'NCSU', '北卡州立'],

  // ==========================================
  // Ranked 72-100+
  // ==========================================
  'American University': ['AU', 'American', '美利坚大学'],
  'Tulane University': ['Tulane', '杜兰', '杜兰大学'],
  'Stevens Institute of Technology': ['Stevens', 'SIT', '史蒂文斯理工'],
  'Pepperdine University': ['Pepperdine', '佩珀代因'],
  'Michigan State University': ['MSU', 'Michigan State', '密歇根州立'],
  'Penn State University': ['Penn State', 'PSU', '宾州州立', '宾夕法尼亚州立'],
  'Stony Brook University': ['Stony Brook', 'SBU', '石溪', '石溪大学'],
  'Clemson University': ['Clemson', '克莱姆森'],
  'SUNY Binghamton University': ['Binghamton', '宾汉姆顿', 'SUNY Binghamton'],
  'Indiana University Bloomington': [
    'IU',
    'IUB',
    'Indiana',
    '印第安纳大学',
    '印大',
  ],
  'University of California, Santa Cruz': [
    'UCSC',
    'UC Santa Cruz',
    '加州大学圣克鲁兹',
  ],
  'University of California, Riverside': [
    'UCR',
    'UC Riverside',
    '加州大学河滨',
  ],
  'University at Buffalo': ['UB', 'Buffalo', 'SUNY Buffalo', '布法罗大学'],
  'Marquette University': ['Marquette', '马凯特'],
  'Syracuse University': ['Syracuse', 'Cuse', '雪城', '雪城大学', '锡拉丘兹'],
  'Fordham University': ['Fordham', '福特汉姆', '福坦莫'],
  'Southern Methodist University': ['SMU', '南方卫理公会', '南卫理'],
  'University of Iowa': ['Iowa', 'UIowa', '爱荷华大学', '爱荷华'],
  'University of San Diego': ['USD', 'San Diego', '圣地亚哥大学'],
  'Baylor University': ['Baylor', '贝勒', '贝勒大学'],
  'Worcester Polytechnic Institute': ['WPI', 'Worcester', '伍斯特理工'],
  'University of Colorado Boulder': [
    'CU Boulder',
    'Colorado',
    '科罗拉多大学',
    '科大',
  ],
  'University of California, Merced': ['UC Merced', 'UCM', '加州大学默塞德'],
  'Auburn University': ['Auburn', '奥本', '奥本大学'],
  'Colorado School of Mines': ['Mines', 'CSM', '科罗拉多矿业'],
  'University of Oregon': ['UO', 'Oregon', '俄勒冈大学', '俄勒冈'],
  'Rochester Institute of Technology': ['RIT', '罗切斯特理工'],
  'Drexel University': ['Drexel', '德雷塞尔'],

  // ==========================================
  // Ranked 105+
  // ==========================================
  'University of Arizona': ['UA', 'Arizona', '亚利桑那大学', '亚大'],
  'Arizona State University': [
    'ASU',
    'Arizona State',
    '亚利桑那州立',
    '亚州大',
  ],
  'University of Texas at Dallas': ['UTD', 'UT Dallas', '德克萨斯大学达拉斯'],
  'University of San Francisco': ['USF', 'San Francisco', '旧金山大学'],
  'University of Tennessee': ['UTK', 'Tennessee', '田纳西大学', '田纳西'],
  'University of Utah': ['UU', 'Utah', '犹他大学', '犹他'],
  'University of South Carolina': [
    'USC-Columbia',
    'South Carolina',
    '南卡大学',
    '南卡',
  ],
  'Clarkson University': ['Clarkson', '克拉克森'],
  'University of Houston': ['UH', 'Houston', '休斯顿大学', '休大'],
  'University of Oklahoma': ['OU', 'Oklahoma', '俄克拉荷马大学'],
  'Iowa State University': ['ISU', 'Iowa State', '爱荷华州立'],
  'University of Kentucky': ['UK', 'Kentucky', '肯塔基大学'],
  'University of Vermont': ['UVM', 'Vermont', '佛蒙特大学'],
  'University of New Hampshire': ['UNH', 'New Hampshire', '新罕布什尔大学'],
  'University of Nebraska-Lincoln': ['UNL', 'Nebraska', '内布拉斯加大学'],
  'George Mason University': ['GMU', 'Mason', '乔治梅森'],
  'University of Kansas': ['KU', 'Kansas', '堪萨斯大学'],
  'Colorado State University': ['CSU', 'Colorado State', '科罗拉多州立'],
  'University of Alabama': ['Bama', 'Alabama', '阿拉巴马大学'],
  'Seton Hall University': ['Seton Hall', 'SHU', '西东大学'],
  'University of Central Florida': ['UCF', 'Central Florida', '中佛罗里达大学'],
  'San Diego State University': ['SDSU', 'San Diego State', '圣地亚哥州立'],
  'Rowan University': ['Rowan', '罗文'],
  'University of Rhode Island': ['URI', 'Rhode Island', '罗德岛大学'],
  'San Jose State University': ['SJSU', 'San Jose State', '圣何塞州立'],
  'University of Maine': ['UMaine', 'Maine', '缅因大学'],
  'Towson University': ['Towson', '陶森'],
  'Georgia State University': ['GSU', 'Georgia State', '乔治亚州立'],
  'Wichita State University': ['Wichita', 'Wichita State', '威奇托州立'],
  'University of North Texas': ['UNT', 'North Texas', '北德克萨斯大学'],

  // ==========================================
  // Top Liberal Arts Colleges
  // ==========================================
  'Williams College': ['Williams', '威廉姆斯', '威廉姆斯学院'],
  'Amherst College': ['Amherst', '阿默斯特', '阿默斯特学院'],
  'Swarthmore College': ['Swarthmore', '斯沃斯莫尔'],
  'Pomona College': ['Pomona', '波莫纳', '波莫纳学院'],
  'Wellesley College': ['Wellesley', '韦尔斯利', '卫斯理女子学院'],
  'Bowdoin College': ['Bowdoin', '鲍登', '鲍登学院'],
  'Carleton College': ['Carleton', '卡尔顿', '卡尔顿学院'],
  'Middlebury College': ['Middlebury', '明德', '明德学院'],
  'Harvey Mudd College': ['Harvey Mudd', 'HMC', '哈维穆德'],
  'Claremont McKenna College': ['CMC', 'Claremont McKenna', '克莱蒙特麦肯纳'],
  'Grinnell College': ['Grinnell', '格林内尔'],
  'Barnard College': ['Barnard', '巴纳德', '巴纳德学院'],
  'Hamilton College': ['Hamilton', '汉密尔顿学院'],
  'Vassar College': ['Vassar', '瓦萨', '瓦萨学院'],
  'Davidson College': ['Davidson', '戴维森'],
  'Haverford College': ['Haverford', '哈弗福德'],
  'Colgate University': ['Colgate', '科尔盖特'],
  'Colby College': ['Colby', '科尔比', '科尔比学院'],
  'Bates College': ['Bates', '贝茨', '贝茨学院'],

  // ==========================================
  // Specialized Institutions (Art, Music, Engineering)
  // ==========================================
  'Pratt Institute': ['Pratt', '普瑞特', '普瑞特艺术学院'],
  'Rose-Hulman Institute of Technology': ['Rose-Hulman', 'RHIT', '罗斯霍曼'],
  'New England Conservatory': ['NEC', '新英格兰音乐学院'],
  'Rhode Island School of Design': ['RISD', '罗德岛设计学院', '罗德岛设计'],
  'Berklee College of Music': ['Berklee', '伯克利音乐学院', '伯克利音乐'],
  'California Institute of the Arts': ['CalArts', '加州艺术学院', '加州艺院'],
  'Olin College of Engineering': ['Olin', '欧林工程学院', '欧林'],
  'Savannah College of Art and Design': ['SCAD', '萨凡纳艺术', '萨凡纳设计'],
  'Cooper Union': ['Cooper Union', '库柏联盟', '库柏'],
  'The Juilliard School': ['Juilliard', '茱莉亚', '朱莉亚', '茱莉亚音乐学院'],
};

async function seedAliases() {
  console.log('🏫 Starting school aliases seed...\n');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [schoolName, aliases] of Object.entries(SCHOOL_ALIASES)) {
    const school = await prisma.school.findUnique({
      where: { nameNorm: normalizeSchoolName(schoolName) },
      select: { id: true, name: true, aliases: true },
    });

    if (!school) {
      console.log(`  ❌ Not found: ${schoolName}`);
      notFound++;
      continue;
    }

    // Merge existing aliases with new ones (deduplicate)
    const existingAliases = school.aliases || [];
    const mergedAliases = [...new Set([...existingAliases, ...aliases])];

    // Only update if there are new aliases
    if (mergedAliases.length === existingAliases.length) {
      skipped++;
      continue;
    }

    await prisma.school.update({
      where: { id: school.id },
      data: { aliases: mergedAliases },
    });

    updated++;
    console.log(`  ✅ ${schoolName}: [${mergedAliases.join(', ')}]`);
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (no change): ${skipped}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Total aliases entries: ${Object.keys(SCHOOL_ALIASES).length}`);
}

seedAliases()
  .then(() => {
    console.log('\n✅ Aliases seed completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
