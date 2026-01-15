/**
 * 扩展学校数据库
 * 包含：文理学院、艺术院校、音乐学院、工程学院、更多综合大学
 * 数据来源: US News, College Scorecard, 各校官网
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPANDED_SCHOOLS = [
  // ============ 顶尖文理学院 (Liberal Arts Colleges) ============
  {
    name: 'Williams College',
    nameZh: '威廉姆斯学院',
    state: 'MA',
    city: 'Williamstown',
    usNewsRank: 1, // LAC排名
    acceptanceRate: 9.0,
    tuition: 62940,
    satAvg: 1505,
    actAvg: 34,
    studentCount: 2150,
    graduationRate: 95,
    website: 'https://www.williams.edu',
    description:
      'Williams is the #1 liberal arts college in America, known for its tutorial system, art museum, and beautiful Berkshire setting.',
    descriptionZh:
      '威廉姆斯学院是美国排名第一的文理学院，以其导师制、艺术博物馆和美丽的伯克郡环境闻名。',
  },
  {
    name: 'Amherst College',
    nameZh: '阿默斯特学院',
    state: 'MA',
    city: 'Amherst',
    usNewsRank: 2,
    acceptanceRate: 7.0,
    tuition: 65080,
    satAvg: 1500,
    actAvg: 34,
    studentCount: 1900,
    graduationRate: 95,
    website: 'https://www.amherst.edu',
    description:
      'Amherst is a top liberal arts college with an open curriculum and membership in the Five College Consortium.',
    descriptionZh:
      '阿默斯特学院是顶尖的文理学院，采用开放课程体系，是五校联盟成员。',
  },
  {
    name: 'Swarthmore College',
    nameZh: '斯沃斯莫尔学院',
    state: 'PA',
    city: 'Swarthmore',
    usNewsRank: 3,
    acceptanceRate: 7.0,
    tuition: 60550,
    satAvg: 1505,
    actAvg: 34,
    studentCount: 1620,
    graduationRate: 94,
    website: 'https://www.swarthmore.edu',
    description:
      'Swarthmore is known for its honors program, engineering school (rare for LACs), and Quaker heritage.',
    descriptionZh:
      '斯沃斯莫尔学院以其荣誉项目、工程学院（文理学院中罕见）和贵格会传统闻名。',
  },
  {
    name: 'Pomona College',
    nameZh: '波莫纳学院',
    state: 'CA',
    city: 'Claremont',
    usNewsRank: 4,
    acceptanceRate: 7.0,
    tuition: 59918,
    satAvg: 1500,
    actAvg: 34,
    studentCount: 1740,
    graduationRate: 95,
    website: 'https://www.pomona.edu',
    description:
      'Pomona is the flagship of the Claremont Colleges, known for its sunny California campus and strong sciences.',
    descriptionZh:
      '波莫纳学院是克莱蒙特学院联盟的旗舰，以其阳光明媚的加州校园和强大的理科闻名。',
  },
  {
    name: 'Wellesley College',
    nameZh: '韦尔斯利学院',
    state: 'MA',
    city: 'Wellesley',
    usNewsRank: 5,
    acceptanceRate: 13.0,
    tuition: 63390,
    satAvg: 1475,
    actAvg: 33,
    studentCount: 2400,
    graduationRate: 93,
    website: 'https://www.wellesley.edu',
    description:
      "Wellesley is a top women's college known for producing leaders, with cross-registration at MIT.",
    descriptionZh:
      '韦尔斯利学院是顶尖女子学院，以培养领导者闻名，可在MIT跨校选课。',
  },
  {
    name: 'Bowdoin College',
    nameZh: '鲍登学院',
    state: 'ME',
    city: 'Brunswick',
    usNewsRank: 6,
    acceptanceRate: 9.0,
    tuition: 63470,
    satAvg: 1465,
    actAvg: 33,
    studentCount: 1950,
    graduationRate: 95,
    website: 'https://www.bowdoin.edu',
    description:
      'Bowdoin is known for its coastal Maine location, optional SAT policy pioneer, and excellent food.',
    descriptionZh:
      '鲍登学院以其缅因州海岸位置、率先实行SAT可选政策和优秀的餐饮闻名。',
  },
  {
    name: 'Middlebury College',
    nameZh: '明德学院',
    state: 'VT',
    city: 'Middlebury',
    usNewsRank: 7,
    acceptanceRate: 13.0,
    tuition: 63456,
    satAvg: 1440,
    actAvg: 33,
    studentCount: 2750,
    graduationRate: 94,
    website: 'https://www.middlebury.edu',
    description:
      'Middlebury is famous for its language programs, environmental studies, and Vermont skiing.',
    descriptionZh: '明德学院以其语言项目、环境研究和佛蒙特州滑雪闻名。',
  },
  {
    name: 'Carleton College',
    nameZh: '卡尔顿学院',
    state: 'MN',
    city: 'Northfield',
    usNewsRank: 8,
    acceptanceRate: 16.0,
    tuition: 63060,
    satAvg: 1455,
    actAvg: 33,
    studentCount: 2000,
    graduationRate: 93,
    website: 'https://www.carleton.edu',
    description:
      'Carleton is known for its strong sciences, trimester system, and quirky Midwest culture.',
    descriptionZh: '卡尔顿学院以其强大的理科、三学期制和独特的中西部文化闻名。',
  },
  {
    name: 'Claremont McKenna College',
    nameZh: '克莱蒙特麦肯纳学院',
    state: 'CA',
    city: 'Claremont',
    usNewsRank: 9,
    acceptanceRate: 11.0,
    tuition: 62215,
    satAvg: 1470,
    actAvg: 33,
    studentCount: 1400,
    graduationRate: 92,
    website: 'https://www.cmc.edu',
    description:
      'CMC is known for economics, government, and public affairs, with a practical leadership focus.',
    descriptionZh:
      '克莱蒙特麦肯纳学院以经济学、政府和公共事务闻名，注重实践领导力培养。',
  },
  {
    name: 'Hamilton College',
    nameZh: '汉密尔顿学院',
    state: 'NY',
    city: 'Clinton',
    usNewsRank: 10,
    acceptanceRate: 12.0,
    tuition: 63750,
    satAvg: 1450,
    actAvg: 33,
    studentCount: 2000,
    graduationRate: 93,
    website: 'https://www.hamilton.edu',
    description:
      'Hamilton is known for its open curriculum, strong writing program, and upstate NY hilltop campus.',
    descriptionZh:
      '汉密尔顿学院以其开放课程、强大的写作项目和纽约州北部山顶校园闻名。',
  },
  {
    name: 'Haverford College',
    nameZh: '哈弗福德学院',
    state: 'PA',
    city: 'Haverford',
    usNewsRank: 11,
    acceptanceRate: 13.0,
    tuition: 63040,
    satAvg: 1465,
    actAvg: 33,
    studentCount: 1380,
    graduationRate: 93,
    website: 'https://www.haverford.edu',
    description:
      'Haverford is known for its honor code, close-knit community, and consortium with Bryn Mawr and Swarthmore.',
    descriptionZh:
      '哈弗福德学院以其荣誉准则、紧密的社区和与布林莫尔、斯沃斯莫尔的联盟闻名。',
  },
  {
    name: 'Vassar College',
    nameZh: '瓦萨学院',
    state: 'NY',
    city: 'Poughkeepsie',
    usNewsRank: 12,
    acceptanceRate: 19.0,
    tuition: 65490,
    satAvg: 1430,
    actAvg: 32,
    studentCount: 2450,
    graduationRate: 92,
    website: 'https://www.vassar.edu',
    description:
      'Vassar is known for its beautiful campus, strong arts programs, and progressive history.',
    descriptionZh: '瓦萨学院以其美丽的校园、强大的艺术项目和进步的历史闻名。',
  },
  {
    name: 'Grinnell College',
    nameZh: '格林内尔学院',
    state: 'IA',
    city: 'Grinnell',
    usNewsRank: 13,
    acceptanceRate: 11.0,
    tuition: 62244,
    satAvg: 1435,
    actAvg: 32,
    studentCount: 1700,
    graduationRate: 88,
    website: 'https://www.grinnell.edu',
    description:
      'Grinnell is known for its open curriculum, strong endowment, and commitment to social responsibility.',
    descriptionZh:
      '格林内尔学院以其开放课程、强大的捐赠基金和对社会责任的承诺闻名。',
  },
  {
    name: 'Colgate University',
    nameZh: '科尔盖特大学',
    state: 'NY',
    city: 'Hamilton',
    usNewsRank: 14,
    acceptanceRate: 13.0,
    tuition: 65030,
    satAvg: 1430,
    actAvg: 32,
    studentCount: 3100,
    graduationRate: 92,
    website: 'https://www.colgate.edu',
    description:
      'Colgate is known for its beautiful campus, strong alumni network, and Division I athletics.',
    descriptionZh: '科尔盖特大学以其美丽的校园、强大的校友网络和一级体育闻名。',
  },
  {
    name: 'Davidson College',
    nameZh: '戴维森学院',
    state: 'NC',
    city: 'Davidson',
    usNewsRank: 15,
    acceptanceRate: 17.0,
    tuition: 59170,
    satAvg: 1400,
    actAvg: 32,
    studentCount: 1950,
    graduationRate: 94,
    website: 'https://www.davidson.edu',
    description:
      'Davidson is known for its honor code, pre-med program, and Southern charm near Charlotte.',
    descriptionZh:
      '戴维森学院以其荣誉准则、医学预科项目和靠近夏洛特的南方魅力闻名。',
  },
  {
    name: 'Smith College',
    nameZh: '史密斯学院',
    state: 'MA',
    city: 'Northampton',
    usNewsRank: 16,
    acceptanceRate: 21.0,
    tuition: 61700,
    satAvg: 1410,
    actAvg: 32,
    studentCount: 2800,
    graduationRate: 89,
    website: 'https://www.smith.edu',
    description:
      "Smith is the largest women's college, known for engineering, house system, and Five College Consortium.",
    descriptionZh:
      '史密斯学院是最大的女子学院，以工程、宿舍体系和五校联盟闻名。',
  },
  {
    name: 'Washington and Lee University',
    nameZh: '华盛顿与李大学',
    state: 'VA',
    city: 'Lexington',
    usNewsRank: 17,
    acceptanceRate: 17.0,
    tuition: 62070,
    satAvg: 1420,
    actAvg: 32,
    studentCount: 2200,
    graduationRate: 92,
    website: 'https://www.wlu.edu',
    description:
      'W&L is known for its honor system, law school, and beautiful Virginia campus.',
    descriptionZh:
      '华盛顿与李大学以其荣誉制度、法学院和美丽的弗吉尼亚校园闻名。',
  },
  {
    name: 'Colby College',
    nameZh: '科尔比学院',
    state: 'ME',
    city: 'Waterville',
    usNewsRank: 18,
    acceptanceRate: 10.0,
    tuition: 64280,
    satAvg: 1430,
    actAvg: 33,
    studentCount: 2100,
    graduationRate: 91,
    website: 'https://www.colby.edu',
    description:
      'Colby is known for its environmental studies, art museum, and Maine outdoor activities.',
    descriptionZh: '科尔比学院以其环境研究、艺术博物馆和缅因州户外活动闻名。',
  },
  {
    name: 'Bates College',
    nameZh: '贝茨学院',
    state: 'ME',
    city: 'Lewiston',
    usNewsRank: 19,
    acceptanceRate: 14.0,
    tuition: 63478,
    satAvg: 1390,
    actAvg: 32,
    studentCount: 1800,
    graduationRate: 90,
    website: 'https://www.bates.edu',
    description:
      'Bates is known for pioneering test-optional admissions, debate team, and 4-4-1 calendar.',
    descriptionZh: '贝茨学院以率先实行考试可选录取、辩论队和4-4-1学历闻名。',
  },
  {
    name: 'Barnard College',
    nameZh: '巴纳德学院',
    state: 'NY',
    city: 'New York',
    usNewsRank: 20,
    acceptanceRate: 9.0,
    tuition: 63523,
    satAvg: 1460,
    actAvg: 33,
    studentCount: 2750,
    graduationRate: 92,
    website: 'https://barnard.edu',
    description:
      "Barnard is a women's college affiliated with Columbia, offering the best of both worlds in NYC.",
    descriptionZh:
      '巴纳德学院是与哥伦比亚大学附属的女子学院，在纽约市提供两全其美的体验。',
  },

  // ============ 顶尖艺术与设计学院 ============
  {
    name: 'Rhode Island School of Design',
    nameZh: '罗德岛设计学院',
    state: 'RI',
    city: 'Providence',
    usNewsRank: 1, // Art School
    acceptanceRate: 20.0,
    tuition: 58810,
    satAvg: 1350,
    actAvg: 30,
    studentCount: 2500,
    graduationRate: 87,
    website: 'https://www.risd.edu',
    description:
      "RISD is one of the world's top art and design schools, with cross-registration at Brown University.",
    descriptionZh:
      '罗德岛设计学院是世界顶尖的艺术与设计学院，可在布朗大学跨校选课。',
  },
  {
    name: 'Pratt Institute',
    nameZh: '普瑞特艺术学院',
    state: 'NY',
    city: 'Brooklyn',
    usNewsRank: 2,
    acceptanceRate: 52.0,
    tuition: 57836,
    satAvg: 1220,
    actAvg: 27,
    studentCount: 4800,
    graduationRate: 68,
    website: 'https://www.pratt.edu',
    description:
      'Pratt is a leading art school in Brooklyn, known for architecture, industrial design, and fashion.',
    descriptionZh:
      '普瑞特艺术学院是布鲁克林领先的艺术学校，以建筑、工业设计和时尚闻名。',
  },
  {
    name: 'School of the Art Institute of Chicago',
    nameZh: '芝加哥艺术学院',
    state: 'IL',
    city: 'Chicago',
    usNewsRank: 3,
    acceptanceRate: 60.0,
    tuition: 54810,
    satAvg: 1200,
    actAvg: 26,
    studentCount: 3500,
    graduationRate: 67,
    website: 'https://www.saic.edu',
    description:
      'SAIC is connected to the Art Institute of Chicago museum, known for fine arts and experimental media.',
    descriptionZh:
      '芝加哥艺术学院与芝加哥艺术博物馆相连，以美术和实验媒体闻名。',
  },
  {
    name: 'California Institute of the Arts',
    nameZh: '加州艺术学院',
    state: 'CA',
    city: 'Valencia',
    usNewsRank: 4,
    acceptanceRate: 26.0,
    tuition: 55760,
    satAvg: 1180,
    actAvg: 26,
    studentCount: 1500,
    graduationRate: 63,
    website: 'https://calarts.edu',
    description:
      'CalArts was founded by Walt Disney, known for animation, film, and performing arts.',
    descriptionZh:
      '加州艺术学院由华特·迪士尼创立，以动画、电影和表演艺术闻名。',
  },
  {
    name: 'ArtCenter College of Design',
    nameZh: '艺术中心设计学院',
    state: 'CA',
    city: 'Pasadena',
    usNewsRank: 5,
    acceptanceRate: 68.0,
    tuition: 51384,
    satAvg: 1150,
    actAvg: 25,
    studentCount: 2200,
    graduationRate: 72,
    website: 'https://www.artcenter.edu',
    description:
      'ArtCenter is known for transportation design, product design, and strong industry connections.',
    descriptionZh: '艺术中心设计学院以交通设计、产品设计和强大的行业联系闻名。',
  },
  {
    name: 'Savannah College of Art and Design',
    nameZh: '萨凡纳艺术与设计学院',
    state: 'GA',
    city: 'Savannah',
    usNewsRank: 6,
    acceptanceRate: 92.0,
    tuition: 40455,
    satAvg: 1170,
    actAvg: 25,
    studentCount: 15000,
    graduationRate: 67,
    website: 'https://www.scad.edu',
    description:
      'SCAD is one of the largest art schools, known for animation, film, and historic Savannah campus.',
    descriptionZh:
      '萨凡纳艺术与设计学院是最大的艺术学校之一，以动画、电影和历史悠久的萨凡纳校园闻名。',
  },
  {
    name: 'Maryland Institute College of Art',
    nameZh: '马里兰艺术学院',
    state: 'MD',
    city: 'Baltimore',
    usNewsRank: 7,
    acceptanceRate: 64.0,
    tuition: 52680,
    satAvg: 1190,
    actAvg: 26,
    studentCount: 3500,
    graduationRate: 66,
    website: 'https://www.mica.edu',
    description:
      'MICA is the oldest continuously degree-granting art college in the US, known for illustration and graphic design.',
    descriptionZh:
      '马里兰艺术学院是美国历史最悠久的持续授予学位的艺术学院，以插画和平面设计闻名。',
  },
  {
    name: 'California College of the Arts',
    nameZh: '加州艺术学院CCA',
    state: 'CA',
    city: 'San Francisco',
    usNewsRank: 8,
    acceptanceRate: 84.0,
    tuition: 54660,
    satAvg: 1140,
    actAvg: 24,
    studentCount: 1900,
    graduationRate: 56,
    website: 'https://www.cca.edu',
    description:
      'CCA is known for architecture, design, and its San Francisco Bay Area location.',
    descriptionZh: '加州艺术学院CCA以建筑、设计和旧金山湾区位置闻名。',
  },

  // ============ 顶尖音乐学院 ============
  {
    name: 'The Juilliard School',
    nameZh: '茱莉亚音乐学院',
    state: 'NY',
    city: 'New York',
    usNewsRank: 1, // Music
    acceptanceRate: 6.0,
    tuition: 54660,
    satAvg: 1300,
    actAvg: 29,
    studentCount: 850,
    graduationRate: 90,
    website: 'https://www.juilliard.edu',
    description:
      "Juilliard is the world's most prestigious performing arts school, located at Lincoln Center in NYC.",
    descriptionZh:
      '茱莉亚音乐学院是世界上最负盛名的表演艺术学校，位于纽约林肯中心。',
  },
  {
    name: 'Berklee College of Music',
    nameZh: '伯克利音乐学院',
    state: 'MA',
    city: 'Boston',
    usNewsRank: 2,
    acceptanceRate: 42.0,
    tuition: 48950,
    satAvg: 1180,
    actAvg: 26,
    studentCount: 6600,
    graduationRate: 52,
    website: 'https://www.berklee.edu',
    description:
      "Berklee is the world's largest independent music college, known for jazz, contemporary music, and music production.",
    descriptionZh:
      '伯克利音乐学院是世界上最大的独立音乐学院，以爵士乐、当代音乐和音乐制作闻名。',
  },
  {
    name: 'Curtis Institute of Music',
    nameZh: '柯蒂斯音乐学院',
    state: 'PA',
    city: 'Philadelphia',
    usNewsRank: 3,
    acceptanceRate: 4.0,
    tuition: 2925, // Full scholarship for all students
    satAvg: 1280,
    actAvg: 28,
    studentCount: 175,
    graduationRate: 88,
    website: 'https://www.curtis.edu',
    description:
      'Curtis provides full scholarships to all students and is one of the most selective music schools in the world.',
    descriptionZh:
      '柯蒂斯音乐学院为所有学生提供全额奖学金，是世界上最挑剔的音乐学校之一。',
  },
  {
    name: 'New England Conservatory',
    nameZh: '新英格兰音乐学院',
    state: 'MA',
    city: 'Boston',
    usNewsRank: 4,
    acceptanceRate: 31.0,
    tuition: 56290,
    satAvg: 1250,
    actAvg: 27,
    studentCount: 800,
    graduationRate: 71,
    website: 'https://necmusic.edu',
    description:
      "NEC is America's oldest independent music school, known for classical and jazz programs.",
    descriptionZh:
      '新英格兰音乐学院是美国最古老的独立音乐学校，以古典和爵士乐项目闻名。',
  },
  {
    name: 'Manhattan School of Music',
    nameZh: '曼哈顿音乐学院',
    state: 'NY',
    city: 'New York',
    usNewsRank: 5,
    acceptanceRate: 38.0,
    tuition: 56200,
    satAvg: 1200,
    actAvg: 26,
    studentCount: 1000,
    graduationRate: 75,
    website: 'https://www.msmnyc.edu',
    description:
      'MSM is located in the Morningside Heights neighborhood, offering classical and jazz programs.',
    descriptionZh: '曼哈顿音乐学院位于晨边高地社区，提供古典和爵士乐项目。',
  },

  // ============ 工程与理工名校补充 ============
  {
    name: 'Harvey Mudd College',
    nameZh: '哈维穆德学院',
    state: 'CA',
    city: 'Claremont',
    usNewsRank: 1, // Engineering LAC
    acceptanceRate: 13.0,
    tuition: 63988,
    satAvg: 1535,
    actAvg: 35,
    studentCount: 900,
    graduationRate: 92,
    website: 'https://www.hmc.edu',
    description:
      'Harvey Mudd is the top engineering-focused liberal arts college, part of the Claremont Colleges.',
    descriptionZh:
      '哈维穆德学院是顶尖的工程导向文理学院，是克莱蒙特学院联盟成员。',
  },
  {
    name: 'Rose-Hulman Institute of Technology',
    nameZh: '罗斯-霍曼理工学院',
    state: 'IN',
    city: 'Terre Haute',
    usNewsRank: 1, // Engineering (no PhD)
    acceptanceRate: 65.0,
    tuition: 55623,
    satAvg: 1380,
    actAvg: 31,
    studentCount: 2100,
    graduationRate: 83,
    website: 'https://www.rose-hulman.edu',
    description:
      'Rose-Hulman is consistently ranked #1 among engineering schools without a PhD program.',
    descriptionZh: '罗斯-霍曼理工学院在无博士项目的工程学校中持续排名第一。',
  },
  {
    name: 'Cooper Union',
    nameZh: '库柏联盟学院',
    state: 'NY',
    city: 'New York',
    usNewsRank: 2,
    acceptanceRate: 13.0,
    tuition: 46800, // Half-tuition scholarship for all
    satAvg: 1440,
    actAvg: 33,
    studentCount: 950,
    graduationRate: 85,
    website: 'https://cooper.edu',
    description:
      'Cooper Union in NYC is highly selective, known for engineering, architecture, and art programs.',
    descriptionZh: '纽约的库柏联盟学院极具选择性，以工程、建筑和艺术项目闻名。',
  },
  {
    name: 'Olin College of Engineering',
    nameZh: '欧林工程学院',
    state: 'MA',
    city: 'Needham',
    usNewsRank: 3,
    acceptanceRate: 16.0,
    tuition: 58800, // Half-tuition scholarship for all
    satAvg: 1520,
    actAvg: 35,
    studentCount: 390,
    graduationRate: 94,
    website: 'https://www.olin.edu',
    description:
      'Olin is a small engineering-only college known for its project-based curriculum and innovation.',
    descriptionZh:
      '欧林工程学院是一所小型纯工程学院，以其基于项目的课程和创新闻名。',
  },

  // ============ 更多综合大学 (200+) ============
  {
    name: 'Appalachian State University',
    nameZh: '阿巴拉契亚州立大学',
    state: 'NC',
    city: 'Boone',
    usNewsRank: 201,
    acceptanceRate: 84.0,
    tuition: 23818,
    satAvg: 1210,
    actAvg: 26,
    studentCount: 20000,
    graduationRate: 72,
    website: 'https://www.appstate.edu',
    description:
      'App State is known for its education programs, sustainability focus, and Blue Ridge Mountain setting.',
    descriptionZh:
      '阿巴拉契亚州立大学以其教育项目、可持续发展重点和蓝岭山脉环境闻名。',
  },
  {
    name: 'James Madison University',
    nameZh: '詹姆斯麦迪逊大学',
    state: 'VA',
    city: 'Harrisonburg',
    usNewsRank: 201,
    acceptanceRate: 85.0,
    tuition: 30098,
    satAvg: 1210,
    actAvg: 26,
    studentCount: 22000,
    graduationRate: 83,
    website: 'https://www.jmu.edu',
    description:
      'JMU is known for its strong undergraduate focus, business school, and vibrant campus life.',
    descriptionZh:
      '詹姆斯麦迪逊大学以其强大的本科重点、商学院和充满活力的校园生活闻名。',
  },
  {
    name: 'University of North Carolina Wilmington',
    nameZh: '北卡罗来纳大学威明顿分校',
    state: 'NC',
    city: 'Wilmington',
    usNewsRank: 205,
    acceptanceRate: 74.0,
    tuition: 22810,
    satAvg: 1200,
    actAvg: 25,
    studentCount: 18000,
    graduationRate: 71,
    website: 'https://uncw.edu',
    description:
      'UNCW is known for its marine biology, film studies, and beautiful coastal North Carolina location.',
    descriptionZh:
      '北卡罗来纳大学威明顿分校以其海洋生物学、电影研究和美丽的北卡罗来纳海岸位置闻名。',
  },
  {
    name: 'Grand Valley State University',
    nameZh: '大峡谷州立大学',
    state: 'MI',
    city: 'Allendale',
    usNewsRank: 205,
    acceptanceRate: 83.0,
    tuition: 19554,
    satAvg: 1120,
    actAvg: 23,
    studentCount: 24000,
    graduationRate: 63,
    website: 'https://www.gvsu.edu',
    description:
      "GVSU is Michigan's fastest-growing university, known for health sciences and its Grand Rapids campus.",
    descriptionZh:
      '大峡谷州立大学是密歇根州增长最快的大学，以健康科学和大急流城校区闻名。',
  },
  {
    name: 'Towson University',
    nameZh: '陶森大学',
    state: 'MD',
    city: 'Towson',
    usNewsRank: 210,
    acceptanceRate: 75.0,
    tuition: 25840,
    satAvg: 1130,
    actAvg: 23,
    studentCount: 22000,
    graduationRate: 71,
    website: 'https://www.towson.edu',
    description:
      "Towson is Maryland's second-largest university, known for education, health sciences, and proximity to Baltimore.",
    descriptionZh:
      '陶森大学是马里兰州第二大大学，以教育、健康科学和靠近巴尔的摩闻名。',
  },
  {
    name: 'California State University, Sacramento',
    nameZh: '加州州立大学萨克拉门托分校',
    state: 'CA',
    city: 'Sacramento',
    usNewsRank: 210,
    acceptanceRate: 88.0,
    tuition: 18212,
    satAvg: 1060,
    actAvg: 21,
    studentCount: 31000,
    graduationRate: 53,
    website: 'https://www.csus.edu',
    description:
      'Sacramento State is known for its criminal justice, education, and government connections as the state capital.',
    descriptionZh:
      '萨克拉门托州立大学以其刑事司法、教育和作为州首府的政府联系闻名。',
  },
  {
    name: 'University of Texas at Dallas',
    nameZh: '德克萨斯大学达拉斯分校',
    state: 'TX',
    city: 'Richardson',
    usNewsRank: 115,
    acceptanceRate: 82.0,
    tuition: 26648,
    satAvg: 1340,
    actAvg: 30,
    studentCount: 31000,
    graduationRate: 73,
    website: 'https://www.utdallas.edu',
    description:
      'UTD is one of the fastest-rising universities, known for its engineering, business, and computer science programs.',
    descriptionZh:
      '德克萨斯大学达拉斯分校是增长最快的大学之一，以工程、商业和计算机科学项目闻名。',
  },
  {
    name: 'University of South Florida',
    nameZh: '南佛罗里达大学',
    state: 'FL',
    city: 'Tampa',
    usNewsRank: 89,
    acceptanceRate: 43.0,
    tuition: 17324,
    satAvg: 1280,
    actAvg: 28,
    studentCount: 50000,
    graduationRate: 74,
    website: 'https://www.usf.edu',
    description:
      'USF is a major research university in Tampa, known for its health sciences, marine science, and engineering.',
    descriptionZh:
      '南佛罗里达大学是坦帕的主要研究型大学，以健康科学、海洋科学和工程闻名。',
  },
];

async function main() {
  console.log('🏫 扩展学校数据库...\n');
  console.log('包含: 文理学院、艺术院校、音乐学院、工程学院、更多综合大学\n');

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const school of EXPANDED_SCHOOLS) {
    try {
      const existing = await prisma.school.findFirst({
        where: { name: school.name },
      });

      if (existing) {
        await prisma.school.update({
          where: { id: existing.id },
          data: {
            city: school.city,
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
    } catch (error: any) {
      errors.push(`${school.nameZh}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 完成: 新建 ${created}, 更新 ${updated}`);

  if (errors.length > 0) {
    console.log(`\n❌ 错误 (${errors.length}):`);
    errors.forEach((e) => console.log('  ' + e));
  }

  const totalSchools = await prisma.school.count();
  console.log(`\n🏫 学校总数: ${totalSchools}`);

  // 分类统计
  console.log('\n📋 学校分类:');
  const lacCount = EXPANDED_SCHOOLS.filter(
    (s) =>
      s.name.includes('College') &&
      !s.name.includes('University') &&
      s.studentCount < 3500,
  ).length;
  const artCount = EXPANDED_SCHOOLS.filter(
    (s) =>
      s.name.includes('Art') ||
      s.name.includes('Design') ||
      s.description.includes('art'),
  ).length;
  const musicCount = EXPANDED_SCHOOLS.filter(
    (s) =>
      s.name.includes('Music') ||
      s.name.includes('Conservatory') ||
      s.name.includes('Juilliard') ||
      s.name.includes('Berklee'),
  ).length;

  console.log(`   文理学院: ~20 所`);
  console.log(`   艺术院校: ~8 所`);
  console.log(`   音乐学院: ~5 所`);
  console.log(`   工程学院: ~4 所`);
  console.log(`   综合大学: ~${EXPANDED_SCHOOLS.length - 20 - 8 - 5 - 4} 所`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
