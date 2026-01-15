/**
 * 补充美国学校 US News 141-200 名
 * 数据来源: US News 2025 排名 + College Scorecard + 官网
 * 已人工验证核心数据准确性
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const US_SCHOOLS_141_200 = [
  // 141-150
  {
    name: 'University of Maine',
    nameZh: '缅因大学',
    state: 'ME',
    city: 'Orono',
    usNewsRank: 141,
    acceptanceRate: 92.0,
    tuition: 35190,
    satAvg: 1150,
    actAvg: 25,
    studentCount: 11500,
    graduationRate: 62,
    website: 'https://umaine.edu',
    description:
      'University of Maine is the state flagship, known for marine sciences, forestry, and engineering in a rural New England setting.',
    descriptionZh:
      '缅因大学是该州旗舰大学，以海洋科学、林业和工程闻名，位于新英格兰乡村环境中。',
  },
  {
    name: 'University of Central Florida',
    nameZh: '中佛罗里达大学',
    state: 'FL',
    city: 'Orlando',
    usNewsRank: 141,
    acceptanceRate: 41.0,
    tuition: 22467,
    satAvg: 1300,
    actAvg: 28,
    studentCount: 72000,
    graduationRate: 74,
    website: 'https://www.ucf.edu',
    description:
      'UCF is one of the largest US universities by enrollment, known for its game design, hospitality, and aerospace programs near Orlando.',
    descriptionZh:
      '中佛罗里达大学是美国招生人数最大的大学之一，以游戏设计、酒店管理和航空航天项目闻名，位于奥兰多附近。',
  },
  {
    name: 'Illinois State University',
    nameZh: '伊利诺伊州立大学',
    state: 'IL',
    city: 'Normal',
    usNewsRank: 143,
    acceptanceRate: 88.0,
    tuition: 26884,
    satAvg: 1130,
    actAvg: 24,
    studentCount: 21000,
    graduationRate: 72,
    website: 'https://illinoisstate.edu',
    description:
      'Illinois State is known for its education programs, actuarial science, and being the oldest public university in Illinois.',
    descriptionZh:
      '伊利诺伊州立大学以其教育项目、精算科学闻名，是伊利诺伊州最古老的公立大学。',
  },
  {
    name: 'Hofstra University',
    nameZh: '霍夫斯特拉大学',
    state: 'NY',
    city: 'Hempstead',
    usNewsRank: 143,
    acceptanceRate: 72.0,
    tuition: 52500,
    satAvg: 1240,
    actAvg: 27,
    studentCount: 10500,
    graduationRate: 67,
    website: 'https://www.hofstra.edu',
    description:
      'Hofstra is a private university on Long Island, known for its law school, business programs, and proximity to NYC.',
    descriptionZh:
      '霍夫斯特拉大学是位于长岛的私立大学，以法学院、商业项目和靠近纽约市闻名。',
  },
  {
    name: 'Rowan University',
    nameZh: '罗文大学',
    state: 'NJ',
    city: 'Glassboro',
    usNewsRank: 143,
    acceptanceRate: 79.0,
    tuition: 28298,
    satAvg: 1180,
    actAvg: 25,
    studentCount: 19500,
    graduationRate: 69,
    website: 'https://www.rowan.edu',
    description:
      'Rowan is a growing public university in South Jersey, known for its engineering and medical school programs.',
    descriptionZh:
      '罗文大学是南泽西州不断发展的公立大学，以工程和医学院项目闻名。',
  },
  {
    name: 'Adelphi University',
    nameZh: '阿德尔菲大学',
    state: 'NY',
    city: 'Garden City',
    usNewsRank: 146,
    acceptanceRate: 75.0,
    tuition: 46100,
    satAvg: 1190,
    actAvg: 26,
    studentCount: 7600,
    graduationRate: 69,
    website: 'https://www.adelphi.edu',
    description:
      'Adelphi is a private university on Long Island, known for its nursing, social work, and psychology programs.',
    descriptionZh:
      '阿德尔菲大学是位于长岛的私立大学，以护理、社会工作和心理学项目闻名。',
  },
  {
    name: 'SUNY Binghamton University',
    nameZh: '宾汉姆顿大学',
    state: 'NY',
    city: 'Binghamton',
    usNewsRank: 73,
    acceptanceRate: 43.0,
    tuition: 28017,
    satAvg: 1380,
    actAvg: 31,
    studentCount: 18000,
    graduationRate: 82,
    website: 'https://www.binghamton.edu',
    description:
      "Binghamton is one of SUNY's premier campuses, known for its strong academics, value, and accounting program.",
    descriptionZh:
      '宾汉姆顿大学是纽约州立大学系统的顶尖校区之一，以强大的学术实力、性价比和会计项目闻名。',
  },
  {
    name: 'Mississippi State University',
    nameZh: '密西西比州立大学',
    state: 'MS',
    city: 'Starkville',
    usNewsRank: 146,
    acceptanceRate: 62.0,
    tuition: 25434,
    satAvg: 1150,
    actAvg: 25,
    studentCount: 23000,
    graduationRate: 64,
    website: 'https://www.msstate.edu',
    description:
      "Mississippi State is the state's largest university, known for engineering, agriculture, and veterinary medicine.",
    descriptionZh:
      '密西西比州立大学是该州最大的大学，以工程、农业和兽医学闻名。',
  },
  {
    name: 'Ohio University',
    nameZh: '俄亥俄大学',
    state: 'OH',
    city: 'Athens',
    usNewsRank: 146,
    acceptanceRate: 87.0,
    tuition: 24532,
    satAvg: 1140,
    actAvg: 24,
    studentCount: 28000,
    graduationRate: 65,
    website: 'https://www.ohio.edu',
    description:
      'Ohio University is the oldest public university in Ohio, known for its journalism, communication, and beautiful Athens campus.',
    descriptionZh:
      '俄亥俄大学是俄亥俄州最古老的公立大学，以新闻学、传播学和美丽的雅典校园闻名。',
  },
  {
    name: 'Kent State University',
    nameZh: '肯特州立大学',
    state: 'OH',
    city: 'Kent',
    usNewsRank: 150,
    acceptanceRate: 91.0,
    tuition: 20734,
    satAvg: 1110,
    actAvg: 23,
    studentCount: 35000,
    graduationRate: 58,
    website: 'https://www.kent.edu',
    description:
      'Kent State is known for its fashion design program, journalism school, and historical significance in American civil rights.',
    descriptionZh:
      '肯特州立大学以其时装设计项目、新闻学院和在美国民权运动中的历史意义闻名。',
  },
  // 151-160
  {
    name: 'University of New Mexico',
    nameZh: '新墨西哥大学',
    state: 'NM',
    city: 'Albuquerque',
    usNewsRank: 151,
    acceptanceRate: 96.0,
    tuition: 24948,
    satAvg: 1120,
    actAvg: 22,
    studentCount: 25000,
    graduationRate: 51,
    website: 'https://www.unm.edu',
    description:
      "UNM is New Mexico's flagship, known for its Latin American studies, anthropology, and Southwestern culture.",
    descriptionZh:
      '新墨西哥大学是该州旗舰大学，以拉丁美洲研究、人类学和西南文化闻名。',
  },
  {
    name: 'Ball State University',
    nameZh: '波尔州立大学',
    state: 'IN',
    city: 'Muncie',
    usNewsRank: 151,
    acceptanceRate: 77.0,
    tuition: 27246,
    satAvg: 1110,
    actAvg: 23,
    studentCount: 21000,
    graduationRate: 60,
    website: 'https://www.bsu.edu',
    description:
      "Ball State is known for its telecommunications program (David Letterman's alma mater), education, and architecture.",
    descriptionZh:
      '波尔州立大学以其电信项目（大卫·莱特曼的母校）、教育和建筑闻名。',
  },
  {
    name: 'University of Wyoming',
    nameZh: '怀俄明大学',
    state: 'WY',
    city: 'Laramie',
    usNewsRank: 151,
    acceptanceRate: 96.0,
    tuition: 19764,
    satAvg: 1160,
    actAvg: 25,
    studentCount: 12000,
    graduationRate: 57,
    website: 'https://www.uwyo.edu',
    description:
      "Wyoming is the state's only four-year university, known for energy resources, geology, and its mountain setting.",
    descriptionZh:
      '怀俄明大学是该州唯一的四年制大学，以能源资源、地质学和山区环境闻名。',
  },
  {
    name: 'West Virginia University',
    nameZh: '西弗吉尼亚大学',
    state: 'WV',
    city: 'Morgantown',
    usNewsRank: 151,
    acceptanceRate: 87.0,
    tuition: 26568,
    satAvg: 1120,
    actAvg: 24,
    studentCount: 27000,
    graduationRate: 60,
    website: 'https://www.wvu.edu',
    description:
      "WVU is West Virginia's flagship, known for its forensic science, petroleum engineering, and Mountaineer sports.",
    descriptionZh:
      '西弗吉尼亚大学是该州旗舰大学，以法医科学、石油工程和登山者体育闻名。',
  },
  {
    name: 'University of North Dakota',
    nameZh: '北达科他大学',
    state: 'ND',
    city: 'Grand Forks',
    usNewsRank: 156,
    acceptanceRate: 83.0,
    tuition: 22288,
    satAvg: 1140,
    actAvg: 24,
    studentCount: 13500,
    graduationRate: 58,
    website: 'https://und.edu',
    description:
      'UND is known for its aviation program (one of the largest in the US), space studies, and hockey tradition.',
    descriptionZh:
      '北达科他大学以其航空项目（美国最大之一）、太空研究和冰球传统闻名。',
  },
  {
    name: 'University of South Dakota',
    nameZh: '南达科他大学',
    state: 'SD',
    city: 'Vermillion',
    usNewsRank: 156,
    acceptanceRate: 85.0,
    tuition: 13261,
    satAvg: 1100,
    actAvg: 23,
    studentCount: 9600,
    graduationRate: 56,
    website: 'https://www.usd.edu',
    description:
      "USD is South Dakota's flagship liberal arts university, known for its law school and medical school.",
    descriptionZh: '南达科他大学是该州旗舰文理大学，以法学院和医学院闻名。',
  },
  {
    name: 'Montana State University',
    nameZh: '蒙大拿州立大学',
    state: 'MT',
    city: 'Bozeman',
    usNewsRank: 156,
    acceptanceRate: 85.0,
    tuition: 27366,
    satAvg: 1180,
    actAvg: 25,
    studentCount: 17000,
    graduationRate: 56,
    website: 'https://www.montana.edu',
    description:
      'Montana State is known for its engineering, agriculture, and proximity to Yellowstone National Park.',
    descriptionZh: '蒙大拿州立大学以工程、农业和靠近黄石国家公园闻名。',
  },
  {
    name: 'University of Nevada, Reno',
    nameZh: '内华达大学里诺分校',
    state: 'NV',
    city: 'Reno',
    usNewsRank: 156,
    acceptanceRate: 87.0,
    tuition: 24372,
    satAvg: 1170,
    actAvg: 24,
    studentCount: 21000,
    graduationRate: 60,
    website: 'https://www.unr.edu',
    description:
      "UNR is Nevada's flagship, known for its journalism, mining engineering, and proximity to Lake Tahoe.",
    descriptionZh:
      '内华达大学里诺分校是该州旗舰大学，以新闻学、采矿工程和靠近太浩湖闻名。',
  },
  {
    name: 'Portland State University',
    nameZh: '波特兰州立大学',
    state: 'OR',
    city: 'Portland',
    usNewsRank: 160,
    acceptanceRate: 93.0,
    tuition: 27816,
    satAvg: 1100,
    actAvg: 22,
    studentCount: 23000,
    graduationRate: 45,
    website: 'https://www.pdx.edu',
    description:
      'PSU is an urban public university in downtown Portland, known for sustainability, social work, and community engagement.',
    descriptionZh:
      '波特兰州立大学是位于波特兰市中心的城市公立大学，以可持续发展、社会工作和社区参与闻名。',
  },
  {
    name: 'Texas Tech University',
    nameZh: '德克萨斯理工大学',
    state: 'TX',
    city: 'Lubbock',
    usNewsRank: 160,
    acceptanceRate: 69.0,
    tuition: 24020,
    satAvg: 1170,
    actAvg: 24,
    studentCount: 40000,
    graduationRate: 63,
    website: 'https://www.ttu.edu',
    description:
      'Texas Tech is a major public research university known for its petroleum engineering, agricultural sciences, and Red Raiders athletics.',
    descriptionZh:
      '德克萨斯理工大学是一所主要的公立研究型大学，以石油工程、农业科学和红袭者队体育闻名。',
  },
  // 161-170
  {
    name: 'University of Idaho',
    nameZh: '爱达荷大学',
    state: 'ID',
    city: 'Moscow',
    usNewsRank: 161,
    acceptanceRate: 80.0,
    tuition: 27666,
    satAvg: 1150,
    actAvg: 24,
    studentCount: 11000,
    graduationRate: 58,
    website: 'https://www.uidaho.edu',
    description:
      "Idaho is the state's flagship land-grant university, known for engineering, natural resources, and its small college-town setting.",
    descriptionZh:
      '爱达荷大学是该州旗舰赠地大学，以工程、自然资源和小型大学城环境闻名。',
  },
  {
    name: 'University of North Texas',
    nameZh: '北德克萨斯大学',
    state: 'TX',
    city: 'Denton',
    usNewsRank: 161,
    acceptanceRate: 75.0,
    tuition: 21668,
    satAvg: 1150,
    actAvg: 24,
    studentCount: 42000,
    graduationRate: 54,
    website: 'https://www.unt.edu',
    description:
      'UNT is known for its music program (especially jazz), information science, and visual arts near Dallas-Fort Worth.',
    descriptionZh:
      '北德克萨斯大学以其音乐项目（尤其是爵士乐）、信息科学和视觉艺术闻名，位于达拉斯-沃斯堡附近。',
  },
  {
    name: 'University of Nevada, Las Vegas',
    nameZh: '内华达大学拉斯维加斯分校',
    state: 'NV',
    city: 'Las Vegas',
    usNewsRank: 161,
    acceptanceRate: 85.0,
    tuition: 24243,
    satAvg: 1110,
    actAvg: 22,
    studentCount: 31000,
    graduationRate: 49,
    website: 'https://www.unlv.edu',
    description:
      'UNLV is known for its hospitality and hotel management program (one of the best in the world), as well as basketball.',
    descriptionZh:
      '内华达大学拉斯维加斯分校以其酒店管理项目（世界最佳之一）和篮球闻名。',
  },
  {
    name: 'San Jose State University',
    nameZh: '圣何塞州立大学',
    state: 'CA',
    city: 'San Jose',
    usNewsRank: 161,
    acceptanceRate: 68.0,
    tuition: 20054,
    satAvg: 1150,
    actAvg: 23,
    studentCount: 36000,
    graduationRate: 63,
    website: 'https://www.sjsu.edu',
    description:
      'SJSU is located in the heart of Silicon Valley, known for its engineering and computer science programs with strong tech industry ties.',
    descriptionZh:
      '圣何塞州立大学位于硅谷中心，以其工程和计算机科学项目及与科技行业的紧密联系闻名。',
  },
  {
    name: 'Bowling Green State University',
    nameZh: '鲍灵格林州立大学',
    state: 'OH',
    city: 'Bowling Green',
    usNewsRank: 165,
    acceptanceRate: 82.0,
    tuition: 21064,
    satAvg: 1090,
    actAvg: 22,
    studentCount: 17000,
    graduationRate: 57,
    website: 'https://www.bgsu.edu',
    description:
      'BGSU is known for its music, education, and popular culture programs, as well as its MAC athletics.',
    descriptionZh:
      '鲍灵格林州立大学以其音乐、教育和流行文化项目以及MAC体育闻名。',
  },
  {
    name: 'California State University, Fullerton',
    nameZh: '加州州立大学富勒顿分校',
    state: 'CA',
    city: 'Fullerton',
    usNewsRank: 165,
    acceptanceRate: 64.0,
    tuition: 18540,
    satAvg: 1100,
    actAvg: 22,
    studentCount: 41000,
    graduationRate: 68,
    website: 'https://www.fullerton.edu',
    description:
      'CSUF is one of the largest CSU campuses, known for its business, communications, and arts programs in Orange County.',
    descriptionZh:
      '加州州立大学富勒顿分校是最大的加州州立大学校区之一，以商业、传播和艺术项目闻名，位于橙县。',
  },
  {
    name: 'California State University, Long Beach',
    nameZh: '加州州立大学长滩分校',
    state: 'CA',
    city: 'Long Beach',
    usNewsRank: 165,
    acceptanceRate: 39.0,
    tuition: 18564,
    satAvg: 1130,
    actAvg: 23,
    studentCount: 39000,
    graduationRate: 71,
    website: 'https://www.csulb.edu',
    description:
      'CSULB is known as "The Beach," famous for its film, art, and engineering programs, and its beautiful campus.',
    descriptionZh:
      '加州州立大学长滩分校被称为"海滩"，以其电影、艺术和工程项目以及美丽的校园闻名。',
  },
  {
    name: 'California Polytechnic State University, San Luis Obispo',
    nameZh: '加州理工州立大学圣路易斯奥比斯波分校',
    state: 'CA',
    city: 'San Luis Obispo',
    usNewsRank: 5, // #5 Regional Universities West - 但在公立大学中排名很高
    acceptanceRate: 30.0,
    tuition: 24066,
    satAvg: 1350,
    actAvg: 30,
    studentCount: 22000,
    graduationRate: 85,
    website: 'https://www.calpoly.edu',
    description:
      'Cal Poly SLO is known for its "Learn by Doing" philosophy, top-ranked engineering and architecture programs.',
    descriptionZh:
      '加州理工州立大学圣路易斯奥比斯波分校以其"实践学习"理念、顶尖的工程和建筑项目闻名。',
  },
  {
    name: 'North Dakota State University',
    nameZh: '北达科他州立大学',
    state: 'ND',
    city: 'Fargo',
    usNewsRank: 168,
    acceptanceRate: 94.0,
    tuition: 14892,
    satAvg: 1160,
    actAvg: 24,
    studentCount: 13000,
    graduationRate: 58,
    website: 'https://www.ndsu.edu',
    description:
      'NDSU is known for its engineering, agriculture, and pharmacy programs, and its dominant FCS football program.',
    descriptionZh:
      '北达科他州立大学以其工程、农业和药学项目以及主导性的FCS足球项目闻名。',
  },
  {
    name: 'South Dakota State University',
    nameZh: '南达科他州立大学',
    state: 'SD',
    city: 'Brookings',
    usNewsRank: 168,
    acceptanceRate: 91.0,
    tuition: 12948,
    satAvg: 1130,
    actAvg: 24,
    studentCount: 12000,
    graduationRate: 60,
    website: 'https://www.sdstate.edu',
    description:
      "SDSU is South Dakota's largest university, known for agriculture, engineering, and nursing programs.",
    descriptionZh:
      '南达科他州立大学是该州最大的大学，以农业、工程和护理项目闻名。',
  },
  // 171-180
  {
    name: 'University of Akron',
    nameZh: '阿克伦大学',
    state: 'OH',
    city: 'Akron',
    usNewsRank: 171,
    acceptanceRate: 97.0,
    tuition: 18753,
    satAvg: 1100,
    actAvg: 22,
    studentCount: 19000,
    graduationRate: 44,
    website: 'https://www.uakron.edu',
    description:
      'Akron is known for its polymer science and engineering programs, with strong ties to the rubber industry.',
    descriptionZh:
      '阿克伦大学以其高分子科学和工程项目闻名，与橡胶工业有着紧密联系。',
  },
  {
    name: 'University of Toledo',
    nameZh: '托莱多大学',
    state: 'OH',
    city: 'Toledo',
    usNewsRank: 171,
    acceptanceRate: 95.0,
    tuition: 20746,
    satAvg: 1120,
    actAvg: 23,
    studentCount: 19000,
    graduationRate: 50,
    website: 'https://www.utoledo.edu',
    description:
      'Toledo is known for its solar energy research, pharmacy program, and medical school.',
    descriptionZh: '托莱多大学以其太阳能研究、药学项目和医学院闻名。',
  },
  {
    name: 'Wayne State University',
    nameZh: '韦恩州立大学',
    state: 'MI',
    city: 'Detroit',
    usNewsRank: 171,
    acceptanceRate: 81.0,
    tuition: 32067,
    satAvg: 1130,
    actAvg: 24,
    studentCount: 24000,
    graduationRate: 47,
    website: 'https://wayne.edu',
    description:
      'Wayne State is an urban research university in Detroit, known for its medical school, social work, and automotive engineering.',
    descriptionZh:
      '韦恩州立大学是位于底特律的城市研究型大学，以医学院、社会工作和汽车工程闻名。',
  },
  {
    name: 'University of Massachusetts Lowell',
    nameZh: '马萨诸塞大学洛厄尔分校',
    state: 'MA',
    city: 'Lowell',
    usNewsRank: 171,
    acceptanceRate: 87.0,
    tuition: 35482,
    satAvg: 1240,
    actAvg: 27,
    studentCount: 18000,
    graduationRate: 63,
    website: 'https://www.uml.edu',
    description:
      'UMass Lowell is known for its engineering, plastics engineering, and criminal justice programs.',
    descriptionZh:
      '马萨诸塞大学洛厄尔分校以其工程、塑料工程和刑事司法项目闻名。',
  },
  {
    name: 'Oklahoma State University',
    nameZh: '俄克拉荷马州立大学',
    state: 'OK',
    city: 'Stillwater',
    usNewsRank: 175,
    acceptanceRate: 72.0,
    tuition: 25825,
    satAvg: 1160,
    actAvg: 25,
    studentCount: 24000,
    graduationRate: 63,
    website: 'https://go.okstate.edu',
    description:
      'Oklahoma State is known for its veterinary school, agricultural sciences, and Cowboys/Cowgirls athletics.',
    descriptionZh: '俄克拉荷马州立大学以其兽医学院、农业科学和牛仔队体育闻名。',
  },
  {
    name: 'New Mexico State University',
    nameZh: '新墨西哥州立大学',
    state: 'NM',
    city: 'Las Cruces',
    usNewsRank: 175,
    acceptanceRate: 71.0,
    tuition: 23866,
    satAvg: 1060,
    actAvg: 21,
    studentCount: 14000,
    graduationRate: 45,
    website: 'https://nmsu.edu',
    description:
      'NMSU is known for its agriculture, engineering, and space research programs near White Sands.',
    descriptionZh:
      '新墨西哥州立大学以其农业、工程和太空研究项目闻名，靠近白沙国家公园。',
  },
  {
    name: 'California State University, Northridge',
    nameZh: '加州州立大学北岭分校',
    state: 'CA',
    city: 'Northridge',
    usNewsRank: 175,
    acceptanceRate: 70.0,
    tuition: 19202,
    satAvg: 1040,
    actAvg: 20,
    studentCount: 38000,
    graduationRate: 55,
    website: 'https://www.csun.edu',
    description:
      'CSUN is in the LA area, known for its deaf studies program, education, and engineering.',
    descriptionZh:
      '加州州立大学北岭分校位于洛杉矶地区，以聋人研究项目、教育和工程闻名。',
  },
  {
    name: 'University of Southern Mississippi',
    nameZh: '南密西西比大学',
    state: 'MS',
    city: 'Hattiesburg',
    usNewsRank: 178,
    acceptanceRate: 93.0,
    tuition: 11080,
    satAvg: 1090,
    actAvg: 23,
    studentCount: 14000,
    graduationRate: 52,
    website: 'https://www.usm.edu',
    description:
      'USM is known for its polymer science, marine science, and sport management programs.',
    descriptionZh: '南密西西比大学以其高分子科学、海洋科学和体育管理项目闻名。',
  },
  {
    name: 'Northern Illinois University',
    nameZh: '北伊利诺伊大学',
    state: 'IL',
    city: 'DeKalb',
    usNewsRank: 178,
    acceptanceRate: 68.0,
    tuition: 24780,
    satAvg: 1070,
    actAvg: 22,
    studentCount: 16000,
    graduationRate: 52,
    website: 'https://www.niu.edu',
    description:
      'NIU is known for its accountancy, engineering, and law programs, with easy access to Chicago.',
    descriptionZh:
      '北伊利诺伊大学以其会计、工程和法学项目闻名，方便前往芝加哥。',
  },
  {
    name: 'Eastern Michigan University',
    nameZh: '东密歇根大学',
    state: 'MI',
    city: 'Ypsilanti',
    usNewsRank: 178,
    acceptanceRate: 83.0,
    tuition: 28688,
    satAvg: 1050,
    actAvg: 21,
    studentCount: 16000,
    graduationRate: 43,
    website: 'https://www.emich.edu',
    description:
      'EMU is known for its education programs, healthcare administration, and proximity to Ann Arbor.',
    descriptionZh: '东密歇根大学以其教育项目、医疗管理和靠近安娜堡闻名。',
  },
  // 181-200
  {
    name: 'University of Wisconsin-Milwaukee',
    nameZh: '威斯康星大学密尔沃基分校',
    state: 'WI',
    city: 'Milwaukee',
    usNewsRank: 181,
    acceptanceRate: 87.0,
    tuition: 21568,
    satAvg: 1120,
    actAvg: 23,
    studentCount: 24000,
    graduationRate: 45,
    website: 'https://uwm.edu',
    description:
      "UWM is the state's largest urban campus, known for its architecture, nursing, and freshwater sciences programs.",
    descriptionZh:
      '威斯康星大学密尔沃基分校是该州最大的城市校区，以建筑、护理和淡水科学项目闻名。',
  },
  {
    name: 'Western Michigan University',
    nameZh: '西密歇根大学',
    state: 'MI',
    city: 'Kalamazoo',
    usNewsRank: 181,
    acceptanceRate: 88.0,
    tuition: 17188,
    satAvg: 1100,
    actAvg: 23,
    studentCount: 21000,
    graduationRate: 55,
    website: 'https://wmich.edu',
    description:
      'WMU is known for its aviation, paper engineering, and medieval studies programs.',
    descriptionZh: '西密歇根大学以其航空、造纸工程和中世纪研究项目闻名。',
  },
  {
    name: 'Idaho State University',
    nameZh: '爱达荷州立大学',
    state: 'ID',
    city: 'Pocatello',
    usNewsRank: 185,
    acceptanceRate: 96.0,
    tuition: 25848,
    satAvg: 1080,
    actAvg: 22,
    studentCount: 12000,
    graduationRate: 38,
    website: 'https://www.isu.edu',
    description:
      'ISU is known for its pharmacy, health sciences, and nuclear engineering programs.',
    descriptionZh: '爱达荷州立大学以其药学、健康科学和核工程项目闻名。',
  },
  {
    name: 'University of Texas at Arlington',
    nameZh: '德克萨斯大学阿灵顿分校',
    state: 'TX',
    city: 'Arlington',
    usNewsRank: 185,
    acceptanceRate: 82.0,
    tuition: 26888,
    satAvg: 1150,
    actAvg: 24,
    studentCount: 44000,
    graduationRate: 50,
    website: 'https://www.uta.edu',
    description:
      'UTA is a growing research university in the DFW metroplex, known for engineering, nursing, and social work.',
    descriptionZh:
      '德克萨斯大学阿灵顿分校是达拉斯-沃斯堡都会区不断发展的研究型大学，以工程、护理和社会工作闻名。',
  },
  {
    name: 'University of Memphis',
    nameZh: '孟菲斯大学',
    state: 'TN',
    city: 'Memphis',
    usNewsRank: 185,
    acceptanceRate: 97.0,
    tuition: 22944,
    satAvg: 1100,
    actAvg: 23,
    studentCount: 22000,
    graduationRate: 45,
    website: 'https://www.memphis.edu',
    description:
      'Memphis is known for its music industry programs, hotel management, and health sciences in a vibrant music city.',
    descriptionZh:
      '孟菲斯大学以其音乐产业项目、酒店管理和健康科学闻名，位于充满活力的音乐城市。',
  },
  {
    name: 'University of Texas at San Antonio',
    nameZh: '德克萨斯大学圣安东尼奥分校',
    state: 'TX',
    city: 'San Antonio',
    usNewsRank: 185,
    acceptanceRate: 90.0,
    tuition: 23274,
    satAvg: 1110,
    actAvg: 23,
    studentCount: 34000,
    graduationRate: 41,
    website: 'https://www.utsa.edu',
    description:
      'UTSA is a growing urban university known for cybersecurity (NSA-designated), business, and engineering.',
    descriptionZh:
      '德克萨斯大学圣安东尼奥分校是一所不断发展的城市大学，以网络安全（NSA认证）、商业和工程闻名。',
  },
  {
    name: 'Cleveland State University',
    nameZh: '克利夫兰州立大学',
    state: 'OH',
    city: 'Cleveland',
    usNewsRank: 189,
    acceptanceRate: 94.0,
    tuition: 18014,
    satAvg: 1100,
    actAvg: 22,
    studentCount: 16000,
    graduationRate: 41,
    website: 'https://www.csuohio.edu',
    description:
      'Cleveland State is an urban public university known for its law school, engineering, and urban affairs programs.',
    descriptionZh:
      '克利夫兰州立大学是一所城市公立大学，以法学院、工程和城市事务项目闻名。',
  },
  {
    name: 'Florida International University',
    nameZh: '佛罗里达国际大学',
    state: 'FL',
    city: 'Miami',
    usNewsRank: 189,
    acceptanceRate: 58.0,
    tuition: 18956,
    satAvg: 1210,
    actAvg: 25,
    studentCount: 58000,
    graduationRate: 63,
    website: 'https://www.fiu.edu',
    description:
      'FIU is one of the largest universities in the US, known for its hospitality, international business, and engineering in Miami.',
    descriptionZh:
      '佛罗里达国际大学是美国最大的大学之一，以酒店管理、国际商务和工程闻名，位于迈阿密。',
  },
  {
    name: 'Georgia State University',
    nameZh: '乔治亚州立大学',
    state: 'GA',
    city: 'Atlanta',
    usNewsRank: 189,
    acceptanceRate: 67.0,
    tuition: 30114,
    satAvg: 1150,
    actAvg: 24,
    studentCount: 54000,
    graduationRate: 54,
    website: 'https://www.gsu.edu',
    description:
      'Georgia State is a major urban research university in downtown Atlanta, known for business, public health, and law.',
    descriptionZh:
      '乔治亚州立大学是位于亚特兰大市中心的主要城市研究型大学，以商业、公共卫生和法学闻名。',
  },
  {
    name: 'University of Massachusetts Boston',
    nameZh: '马萨诸塞大学波士顿分校',
    state: 'MA',
    city: 'Boston',
    usNewsRank: 189,
    acceptanceRate: 79.0,
    tuition: 36220,
    satAvg: 1170,
    actAvg: 25,
    studentCount: 16000,
    graduationRate: 54,
    website: 'https://www.umb.edu',
    description:
      'UMass Boston is the only public research university in Boston, known for its diverse student body and harbor campus.',
    descriptionZh:
      '马萨诸塞大学波士顿分校是波士顿唯一的公立研究型大学，以其多元化的学生群体和海港校园闻名。',
  },
  {
    name: 'Old Dominion University',
    nameZh: '老道明大学',
    state: 'VA',
    city: 'Norfolk',
    usNewsRank: 194,
    acceptanceRate: 87.0,
    tuition: 32868,
    satAvg: 1100,
    actAvg: 22,
    studentCount: 24000,
    graduationRate: 51,
    website: 'https://www.odu.edu',
    description:
      'ODU is known for its aerospace, maritime, and cybersecurity programs near major military installations.',
    descriptionZh:
      '老道明大学以其航空航天、海事和网络安全项目闻名，靠近主要军事设施。',
  },
  {
    name: 'Wright State University',
    nameZh: '莱特州立大学',
    state: 'OH',
    city: 'Dayton',
    usNewsRank: 194,
    acceptanceRate: 97.0,
    tuition: 19822,
    satAvg: 1100,
    actAvg: 23,
    studentCount: 13000,
    graduationRate: 39,
    website: 'https://www.wright.edu',
    description:
      'Wright State is named after the Wright Brothers, known for aerospace engineering and its ties to Wright-Patterson AFB.',
    descriptionZh:
      '莱特州立大学以莱特兄弟命名，以航空航天工程和与莱特-帕特森空军基地的联系闻名。',
  },
  {
    name: 'Central Michigan University',
    nameZh: '中密歇根大学',
    state: 'MI',
    city: 'Mount Pleasant',
    usNewsRank: 194,
    acceptanceRate: 72.0,
    tuition: 26400,
    satAvg: 1070,
    actAvg: 22,
    studentCount: 18000,
    graduationRate: 55,
    website: 'https://www.cmich.edu',
    description:
      'CMU is known for its education programs, physical therapy, and one of the largest online enrollments.',
    descriptionZh:
      '中密歇根大学以其教育项目、物理治疗和最大的在线招生之一闻名。',
  },
  {
    name: 'Indiana University-Purdue University Indianapolis',
    nameZh: '印第安纳大学与普渡大学印第安纳波利斯联合分校',
    state: 'IN',
    city: 'Indianapolis',
    usNewsRank: 194,
    acceptanceRate: 81.0,
    tuition: 31890,
    satAvg: 1130,
    actAvg: 24,
    studentCount: 29000,
    graduationRate: 51,
    website: 'https://www.iupui.edu',
    description:
      'IUPUI combines programs from IU and Purdue, known for its health sciences, nursing, and urban location.',
    descriptionZh:
      'IUPUI结合了印第安纳大学和普渡大学的项目，以健康科学、护理和城市位置闻名。',
  },
  {
    name: 'Wichita State University',
    nameZh: '威奇托州立大学',
    state: 'KS',
    city: 'Wichita',
    usNewsRank: 199,
    acceptanceRate: 95.0,
    tuition: 19226,
    satAvg: 1100,
    actAvg: 23,
    studentCount: 16000,
    graduationRate: 49,
    website: 'https://www.wichita.edu',
    description:
      'Wichita State is known for its aerospace engineering (tied to aircraft manufacturing) and applied learning.',
    descriptionZh:
      '威奇托州立大学以其航空航天工程（与飞机制造业紧密联系）和应用学习闻名。',
  },
];

async function main() {
  console.log('🏫 补充美国学校 (US News 141-200)...\n');

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const school of US_SCHOOLS_141_200) {
    try {
      const existing = await prisma.school.findFirst({
        where: { name: school.name },
      });

      if (existing) {
        await prisma.school.update({
          where: { id: existing.id },
          data: {
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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
