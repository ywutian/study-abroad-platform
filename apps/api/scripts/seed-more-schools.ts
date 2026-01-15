/**
 * 补充 US News 52-100 名学校 + 缺失简介
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// US News 2025 排名 52-100 + 部分缺失简介的学校
const ADDITIONAL_SCHOOLS = [
  // 缺失简介的学校
  {
    name: 'California Institute of Technology',
    nameZh: '加州理工学院',
    state: 'CA',
    city: 'Pasadena',
    usNewsRank: 7,
    acceptanceRate: 3.0,
    tuition: 60816,
    satAvg: 1570,
    actAvg: 36,
    studentCount: 2397,
    graduationRate: 94,
    website: 'https://www.caltech.edu',
    description:
      'Caltech is a world-renowned science and engineering institute known for its rigorous academics, Nobel laureates, and pioneering research in physics, chemistry, and technology.',
    descriptionZh:
      '加州理工学院是世界著名的科学与工程学府，以严谨的学术、诺贝尔奖获得者以及在物理、化学和技术领域的开创性研究闻名。',
  },
  {
    name: 'University of Wisconsin-Madison',
    nameZh: '威斯康星大学麦迪逊分校',
    state: 'WI',
    city: 'Madison',
    usNewsRank: 35,
    acceptanceRate: 49.0,
    tuition: 39427,
    satAvg: 1380,
    actAvg: 30,
    studentCount: 47932,
    graduationRate: 88,
    website: 'https://www.wisc.edu',
    description:
      'UW-Madison is a top public research university known for its strong programs in engineering, business, and life sciences, set in a vibrant college town.',
    descriptionZh:
      '威斯康星大学麦迪逊分校是顶尖的公立研究型大学，以工程、商业和生命科学的强势项目闻名，位于充满活力的大学城。',
  },
  {
    name: 'Rutgers University-New Brunswick',
    nameZh: '罗格斯大学新布朗斯维克分校',
    state: 'NJ',
    city: 'New Brunswick',
    usNewsRank: 40,
    acceptanceRate: 66.0,
    tuition: 35644,
    satAvg: 1320,
    actAvg: 29,
    studentCount: 50254,
    graduationRate: 82,
    website: 'https://www.rutgers.edu',
    description:
      'Rutgers is the State University of New Jersey, offering diverse programs and strong research opportunities in the heart of the Northeast corridor.',
    descriptionZh:
      '罗格斯大学是新泽西州立大学，在东北走廊的心脏地带提供多样化的项目和强大的研究机会。',
  },
  {
    name: 'Ohio State University',
    nameZh: '俄亥俄州立大学',
    state: 'OH',
    city: 'Columbus',
    usNewsRank: 43,
    acceptanceRate: 53.0,
    tuition: 35019,
    satAvg: 1340,
    actAvg: 29,
    studentCount: 61369,
    graduationRate: 85,
    website: 'https://www.osu.edu',
    description:
      'Ohio State is one of the largest universities in the US, known for its comprehensive programs, Big Ten athletics, and strong alumni network.',
    descriptionZh:
      '俄亥俄州立大学是美国最大的大学之一，以其综合性项目、十大联盟体育和强大的校友网络闻名。',
  },
  {
    name: 'University of Maryland, College Park',
    nameZh: '马里兰大学帕克分校',
    state: 'MD',
    city: 'College Park',
    usNewsRank: 46,
    acceptanceRate: 45.0,
    tuition: 38636,
    satAvg: 1410,
    actAvg: 32,
    studentCount: 40709,
    graduationRate: 87,
    website: 'https://www.umd.edu',
    description:
      'UMD is a flagship public university near Washington D.C., known for its strong programs in engineering, business, and public policy.',
    descriptionZh:
      '马里兰大学帕克分校是位于华盛顿特区附近的旗舰公立大学，以工程、商业和公共政策的强势项目闻名。',
  },
  {
    name: 'Lehigh University',
    nameZh: '里海大学',
    state: 'PA',
    city: 'Bethlehem',
    usNewsRank: 47,
    acceptanceRate: 32.0,
    tuition: 62180,
    satAvg: 1400,
    actAvg: 32,
    studentCount: 7642,
    graduationRate: 89,
    website: 'https://www.lehigh.edu',
    description:
      'Lehigh is a private research university known for its strong engineering and business programs, beautiful campus, and close-knit community.',
    descriptionZh:
      '里海大学是一所私立研究型大学，以其强大的工程和商业项目、美丽的校园和紧密的社区闻名。',
  },
  {
    name: 'Texas A&M University',
    nameZh: '德州农工大学',
    state: 'TX',
    city: 'College Station',
    usNewsRank: 47,
    acceptanceRate: 63.0,
    tuition: 40607,
    satAvg: 1280,
    actAvg: 28,
    studentCount: 72982,
    graduationRate: 82,
    website: 'https://www.tamu.edu',
    description:
      'Texas A&M is one of the largest universities in the US, known for its strong engineering programs, military traditions, and passionate school spirit.',
    descriptionZh:
      '德州农工大学是美国最大的大学之一，以其强大的工程项目、军事传统和热情的校园精神闻名。',
  },
  {
    name: 'University of Georgia',
    nameZh: '佐治亚大学',
    state: 'GA',
    city: 'Athens',
    usNewsRank: 47,
    acceptanceRate: 43.0,
    tuition: 31120,
    satAvg: 1340,
    actAvg: 30,
    studentCount: 40607,
    graduationRate: 87,
    website: 'https://www.uga.edu',
    description:
      'UGA is the oldest public university in America, known for its strong programs in business, journalism, and agricultural sciences.',
    descriptionZh:
      '佐治亚大学是美国最古老的公立大学，以其在商业、新闻学和农业科学方面的强势项目闻名。',
  },
  {
    name: 'Wake Forest University',
    nameZh: '维克森林大学',
    state: 'NC',
    city: 'Winston-Salem',
    usNewsRank: 47,
    acceptanceRate: 21.0,
    tuition: 64758,
    satAvg: 1430,
    actAvg: 32,
    studentCount: 8949,
    graduationRate: 90,
    website: 'https://www.wfu.edu',
    description:
      'Wake Forest is a prestigious private university known for its strong liberal arts tradition, business school, and beautiful Southern campus.',
    descriptionZh:
      '维克森林大学是一所著名的私立大学，以其强大的文理传统、商学院和美丽的南方校园闻名。',
  },
  // US News 52-100 名学校
  {
    name: 'University of Rochester',
    nameZh: '罗切斯特大学',
    state: 'NY',
    city: 'Rochester',
    usNewsRank: 52,
    acceptanceRate: 34.0,
    tuition: 62680,
    satAvg: 1450,
    actAvg: 33,
    studentCount: 12171,
    graduationRate: 87,
    website: 'https://www.rochester.edu',
    description:
      'Rochester is known for its flexibility in curriculum, strong music conservatory (Eastman), and renowned optics and medical programs.',
    descriptionZh:
      '罗切斯特大学以其灵活的课程设置、强大的音乐学院（伊斯曼）以及著名的光学和医学项目闻名。',
  },
  {
    name: 'Case Western Reserve University',
    nameZh: '凯斯西储大学',
    state: 'OH',
    city: 'Cleveland',
    usNewsRank: 53,
    acceptanceRate: 27.0,
    tuition: 60144,
    satAvg: 1460,
    actAvg: 33,
    studentCount: 12148,
    graduationRate: 85,
    website: 'https://www.case.edu',
    description:
      "Case Western is a leading research university known for its strengths in engineering, medicine, and business, located in Cleveland's cultural hub.",
    descriptionZh:
      '凯斯西储大学是领先的研究型大学，以工程、医学和商业的优势闻名，位于克利夫兰的文化中心。',
  },
  {
    name: 'Northeastern University',
    nameZh: '东北大学',
    state: 'MA',
    city: 'Boston',
    usNewsRank: 53,
    acceptanceRate: 6.7,
    tuition: 60192,
    satAvg: 1510,
    actAvg: 34,
    studentCount: 22207,
    graduationRate: 91,
    website: 'https://www.northeastern.edu',
    description:
      'Northeastern is famous for its cooperative education program, integrating classroom learning with professional experience in the heart of Boston.',
    descriptionZh:
      '东北大学以其合作教育项目闻名，将课堂学习与专业经验相结合，位于波士顿市中心。',
  },
  {
    name: 'Tulane University',
    nameZh: '杜兰大学',
    state: 'LA',
    city: 'New Orleans',
    usNewsRank: 53,
    acceptanceRate: 11.0,
    tuition: 63178,
    satAvg: 1450,
    actAvg: 32,
    studentCount: 14575,
    graduationRate: 86,
    website: 'https://www.tulane.edu',
    description:
      'Tulane is a prestigious private university in New Orleans, known for its public health school, business programs, and vibrant city culture.',
    descriptionZh:
      '杜兰大学是位于新奥尔良的著名私立大学，以其公共卫生学院、商业项目和充满活力的城市文化闻名。',
  },
  {
    name: 'University of Minnesota, Twin Cities',
    nameZh: '明尼苏达大学双城分校',
    state: 'MN',
    city: 'Minneapolis',
    usNewsRank: 53,
    acceptanceRate: 75.0,
    tuition: 35168,
    satAvg: 1380,
    actAvg: 30,
    studentCount: 54955,
    graduationRate: 82,
    website: 'https://twin-cities.umn.edu',
    description:
      'UMN is a major public research university known for its medical school, engineering programs, and strong connections to Minneapolis-St. Paul.',
    descriptionZh:
      '明尼苏达大学双城分校是一所主要的公立研究型大学，以其医学院、工程项目和与明尼阿波利斯-圣保罗的紧密联系闻名。',
  },
  {
    name: 'University of Connecticut',
    nameZh: '康涅狄格大学',
    state: 'CT',
    city: 'Storrs',
    usNewsRank: 58,
    acceptanceRate: 56.0,
    tuition: 42162,
    satAvg: 1340,
    actAvg: 30,
    studentCount: 32074,
    graduationRate: 83,
    website: 'https://uconn.edu',
    description:
      "UConn is Connecticut's flagship public university, known for its basketball tradition, strong health sciences, and growing research profile.",
    descriptionZh:
      '康涅狄格大学是康涅狄格州的旗舰公立大学，以其篮球传统、强大的健康科学和不断增长的研究实力闻名。',
  },
  {
    name: 'Virginia Tech',
    nameZh: '弗吉尼亚理工大学',
    state: 'VA',
    city: 'Blacksburg',
    usNewsRank: 58,
    acceptanceRate: 57.0,
    tuition: 35574,
    satAvg: 1330,
    actAvg: 29,
    studentCount: 36974,
    graduationRate: 85,
    website: 'https://www.vt.edu',
    description:
      'Virginia Tech is a leading research university known for engineering, architecture, and its strong sense of community and tradition.',
    descriptionZh:
      '弗吉尼亚理工大学是领先的研究型大学，以工程、建筑以及强烈的社区意识和传统闻名。',
  },
  {
    name: 'Pepperdine University',
    nameZh: '佩珀代因大学',
    state: 'CA',
    city: 'Malibu',
    usNewsRank: 60,
    acceptanceRate: 33.0,
    tuition: 64426,
    satAvg: 1360,
    actAvg: 30,
    studentCount: 9046,
    graduationRate: 87,
    website: 'https://www.pepperdine.edu',
    description:
      'Pepperdine is a Christian university with a stunning Malibu campus, known for its business and law schools and beautiful ocean views.',
    descriptionZh:
      '佩珀代因大学是一所基督教大学，拥有令人惊叹的马里布校园，以其商学院、法学院和美丽的海景闻名。',
  },
  {
    name: 'George Washington University',
    nameZh: '乔治华盛顿大学',
    state: 'DC',
    city: 'Washington',
    usNewsRank: 60,
    acceptanceRate: 49.0,
    tuition: 62850,
    satAvg: 1380,
    actAvg: 31,
    studentCount: 27199,
    graduationRate: 82,
    website: 'https://www.gwu.edu',
    description:
      'GWU is located in the heart of Washington D.C., known for its political science, international affairs, and unparalleled access to government.',
    descriptionZh:
      '乔治华盛顿大学位于华盛顿特区的心脏地带，以其政治学、国际事务和无与伦比的政府资源闻名。',
  },
  {
    name: 'Santa Clara University',
    nameZh: '圣克拉拉大学',
    state: 'CA',
    city: 'Santa Clara',
    usNewsRank: 60,
    acceptanceRate: 49.0,
    tuition: 59241,
    satAvg: 1400,
    actAvg: 31,
    studentCount: 9015,
    graduationRate: 91,
    website: 'https://www.scu.edu',
    description:
      'Santa Clara is a Jesuit university in Silicon Valley, known for its engineering programs, ethics education, and tech industry connections.',
    descriptionZh:
      '圣克拉拉大学是位于硅谷的耶稣会大学，以其工程项目、伦理教育和科技行业的联系闻名。',
  },
  {
    name: 'Syracuse University',
    nameZh: '雪城大学',
    state: 'NY',
    city: 'Syracuse',
    usNewsRank: 60,
    acceptanceRate: 44.0,
    tuition: 60974,
    satAvg: 1320,
    actAvg: 29,
    studentCount: 22850,
    graduationRate: 82,
    website: 'https://www.syracuse.edu',
    description:
      'Syracuse is known for its communications school (Newhouse), basketball tradition, and diverse academic programs.',
    descriptionZh:
      '雪城大学以其传播学院（纽豪斯）、篮球传统和多样化的学术项目闻名。',
  },
  {
    name: 'University of Pittsburgh',
    nameZh: '匹兹堡大学',
    state: 'PA',
    city: 'Pittsburgh',
    usNewsRank: 60,
    acceptanceRate: 49.0,
    tuition: 36564,
    satAvg: 1370,
    actAvg: 30,
    studentCount: 34934,
    graduationRate: 83,
    website: 'https://www.pitt.edu',
    description:
      'Pitt is a leading public research university known for its medical school, philosophy department, and urban Pittsburgh location.',
    descriptionZh:
      '匹兹堡大学是领先的公立研究型大学，以其医学院、哲学系和位于匹兹堡市区的位置闻名。',
  },
  {
    name: 'University of Miami',
    nameZh: '迈阿密大学',
    state: 'FL',
    city: 'Coral Gables',
    usNewsRank: 67,
    acceptanceRate: 19.0,
    tuition: 58636,
    satAvg: 1390,
    actAvg: 31,
    studentCount: 19096,
    graduationRate: 83,
    website: 'https://www.miami.edu',
    description:
      'University of Miami is a private research university in South Florida, known for its marine science, music, and medical programs.',
    descriptionZh:
      '迈阿密大学是位于南佛罗里达的私立研究型大学，以其海洋科学、音乐和医学项目闻名。',
  },
  {
    name: 'Penn State University',
    nameZh: '宾夕法尼亚州立大学',
    state: 'PA',
    city: 'University Park',
    usNewsRank: 67,
    acceptanceRate: 55.0,
    tuition: 39404,
    satAvg: 1300,
    actAvg: 28,
    studentCount: 88000,
    graduationRate: 86,
    website: 'https://www.psu.edu',
    description:
      'Penn State is one of the largest universities in the US, known for its engineering, business, and passionate sports culture.',
    descriptionZh:
      '宾夕法尼亚州立大学是美国最大的大学之一，以其工程、商业和热情的体育文化闻名。',
  },
  {
    name: 'Rensselaer Polytechnic Institute',
    nameZh: '伦斯勒理工学院',
    state: 'NY',
    city: 'Troy',
    usNewsRank: 67,
    acceptanceRate: 47.0,
    tuition: 61275,
    satAvg: 1430,
    actAvg: 32,
    studentCount: 7761,
    graduationRate: 85,
    website: 'https://www.rpi.edu',
    description:
      'RPI is the oldest technological university in the English-speaking world, known for engineering, science, and innovation.',
    descriptionZh:
      '伦斯勒理工学院是英语世界最古老的科技大学，以工程、科学和创新闻名。',
  },
  {
    name: 'Stevens Institute of Technology',
    nameZh: '史蒂文斯理工学院',
    state: 'NJ',
    city: 'Hoboken',
    usNewsRank: 67,
    acceptanceRate: 41.0,
    tuition: 61642,
    satAvg: 1430,
    actAvg: 32,
    studentCount: 8038,
    graduationRate: 84,
    website: 'https://www.stevens.edu',
    description:
      'Stevens is a leading tech university across from NYC, known for engineering, business, and its stunning Manhattan skyline views.',
    descriptionZh:
      '史蒂文斯理工学院是位于纽约对面的领先科技大学，以工程、商业和曼哈顿天际线美景闻名。',
  },
  {
    name: 'Indiana University Bloomington',
    nameZh: '印第安纳大学布卢明顿分校',
    state: 'IN',
    city: 'Bloomington',
    usNewsRank: 67,
    acceptanceRate: 80.0,
    tuition: 38942,
    satAvg: 1260,
    actAvg: 27,
    studentCount: 47005,
    graduationRate: 79,
    website: 'https://www.indiana.edu',
    description:
      'IU is known for its business school (Kelley), music school, and beautiful limestone campus in a classic college town.',
    descriptionZh:
      '印第安纳大学以其商学院（凯利）、音乐学院和位于经典大学城的美丽石灰岩校园闻名。',
  },
  {
    name: 'Michigan State University',
    nameZh: '密歇根州立大学',
    state: 'MI',
    city: 'East Lansing',
    usNewsRank: 67,
    acceptanceRate: 76.0,
    tuition: 41958,
    satAvg: 1200,
    actAvg: 26,
    studentCount: 50023,
    graduationRate: 80,
    website: 'https://www.msu.edu',
    description:
      'MSU is a major public research university known for its agricultural sciences, education, and Big Ten athletics.',
    descriptionZh:
      '密歇根州立大学是一所主要的公立研究型大学，以其农业科学、教育和十大联盟体育闻名。',
  },
  {
    name: 'University of Iowa',
    nameZh: '爱荷华大学',
    state: 'IA',
    city: 'Iowa City',
    usNewsRank: 74,
    acceptanceRate: 84.0,
    tuition: 32927,
    satAvg: 1230,
    actAvg: 26,
    studentCount: 31240,
    graduationRate: 74,
    website: 'https://www.uiowa.edu',
    description:
      'University of Iowa is known for its creative writing program, medical school, and as a UNESCO City of Literature.',
    descriptionZh:
      '爱荷华大学以其创意写作项目、医学院以及联合国教科文组织文学之城的称号闻名。',
  },
  {
    name: 'University of Delaware',
    nameZh: '特拉华大学',
    state: 'DE',
    city: 'Newark',
    usNewsRank: 74,
    acceptanceRate: 66.0,
    tuition: 37890,
    satAvg: 1280,
    actAvg: 28,
    studentCount: 23696,
    graduationRate: 81,
    website: 'https://www.udel.edu',
    description:
      "UDel is Delaware's flagship university, known for its chemical engineering program and strong undergraduate experience.",
    descriptionZh:
      '特拉华大学是特拉华州的旗舰大学，以其化学工程项目和强大的本科体验闻名。',
  },
  {
    name: 'University of Colorado Boulder',
    nameZh: '科罗拉多大学博尔德分校',
    state: 'CO',
    city: 'Boulder',
    usNewsRank: 74,
    acceptanceRate: 80.0,
    tuition: 40044,
    satAvg: 1280,
    actAvg: 28,
    studentCount: 36575,
    graduationRate: 74,
    website: 'https://www.colorado.edu',
    description:
      'CU Boulder is known for its aerospace engineering, environmental sciences, and stunning Rocky Mountain campus.',
    descriptionZh:
      '科罗拉多大学博尔德分校以其航空航天工程、环境科学和壮丽的落基山脉校园闻名。',
  },
  {
    name: 'Yeshiva University',
    nameZh: '叶史瓦大学',
    state: 'NY',
    city: 'New York',
    usNewsRank: 74,
    acceptanceRate: 55.0,
    tuition: 51750,
    satAvg: 1380,
    actAvg: 30,
    studentCount: 5456,
    graduationRate: 82,
    website: 'https://www.yu.edu',
    description:
      'Yeshiva is the premier Jewish university in America, known for combining secular academics with Torah studies.',
    descriptionZh:
      '叶史瓦大学是美国首屈一指的犹太大学，以将世俗学术与托拉研究相结合而闻名。',
  },
  {
    name: 'Baylor University',
    nameZh: '贝勒大学',
    state: 'TX',
    city: 'Waco',
    usNewsRank: 79,
    acceptanceRate: 68.0,
    tuition: 56886,
    satAvg: 1310,
    actAvg: 29,
    studentCount: 20824,
    graduationRate: 78,
    website: 'https://www.baylor.edu',
    description:
      'Baylor is the oldest university in Texas, a Baptist institution known for its strong business, health sciences, and faith-based community.',
    descriptionZh:
      '贝勒大学是德克萨斯州最古老的大学，是一所浸信会学府，以其强大的商业、健康科学和信仰社区闻名。',
  },
  {
    name: 'Clemson University',
    nameZh: '克莱姆森大学',
    state: 'SC',
    city: 'Clemson',
    usNewsRank: 79,
    acceptanceRate: 43.0,
    tuition: 39878,
    satAvg: 1330,
    actAvg: 29,
    studentCount: 27341,
    graduationRate: 84,
    website: 'https://www.clemson.edu',
    description:
      "Clemson is South Carolina's flagship university, known for engineering, agriculture, and its passionate sports culture.",
    descriptionZh:
      '克莱姆森大学是南卡罗来纳州的旗舰大学，以工程、农业和热情的体育文化闻名。',
  },
  {
    name: 'Fordham University',
    nameZh: '福特汉姆大学',
    state: 'NY',
    city: 'Bronx',
    usNewsRank: 79,
    acceptanceRate: 46.0,
    tuition: 61140,
    satAvg: 1400,
    actAvg: 31,
    studentCount: 17035,
    graduationRate: 83,
    website: 'https://www.fordham.edu',
    description:
      'Fordham is a Jesuit university in New York City, known for its law school, business programs, and urban campus experience.',
    descriptionZh:
      '福特汉姆大学是位于纽约市的耶稣会大学，以其法学院、商业项目和城市校园体验闻名。',
  },
  {
    name: 'Stony Brook University',
    nameZh: '石溪大学',
    state: 'NY',
    city: 'Stony Brook',
    usNewsRank: 79,
    acceptanceRate: 45.0,
    tuition: 30346,
    satAvg: 1380,
    actAvg: 30,
    studentCount: 26782,
    graduationRate: 77,
    website: 'https://www.stonybrook.edu',
    description:
      'Stony Brook is a SUNY flagship known for its strong STEM programs, medical school, and affordable education.',
    descriptionZh:
      '石溪大学是纽约州立大学旗舰校区，以其强大的STEM项目、医学院和实惠的教育闻名。',
  },
  {
    name: 'American University',
    nameZh: '美利坚大学',
    state: 'DC',
    city: 'Washington',
    usNewsRank: 79,
    acceptanceRate: 41.0,
    tuition: 56170,
    satAvg: 1340,
    actAvg: 30,
    studentCount: 14459,
    graduationRate: 80,
    website: 'https://www.american.edu',
    description:
      'American University is located in D.C., known for its international affairs, public policy, and proximity to government institutions.',
    descriptionZh:
      '美利坚大学位于华盛顿特区，以其国际事务、公共政策和与政府机构的接近闻名。',
  },
  {
    name: 'Marquette University',
    nameZh: '马凯特大学',
    state: 'WI',
    city: 'Milwaukee',
    usNewsRank: 79,
    acceptanceRate: 78.0,
    tuition: 50320,
    satAvg: 1280,
    actAvg: 28,
    studentCount: 11594,
    graduationRate: 82,
    website: 'https://www.marquette.edu',
    description:
      'Marquette is a Jesuit university in Milwaukee, known for its business, nursing, and engineering programs.',
    descriptionZh:
      '马凯特大学是位于密尔沃基的耶稣会大学，以其商业、护理和工程项目闻名。',
  },
  {
    name: 'University at Buffalo',
    nameZh: '纽约州立大学布法罗分校',
    state: 'NY',
    city: 'Buffalo',
    usNewsRank: 79,
    acceptanceRate: 68.0,
    tuition: 30346,
    satAvg: 1280,
    actAvg: 28,
    studentCount: 32347,
    graduationRate: 75,
    website: 'https://www.buffalo.edu',
    description:
      'UB is the largest SUNY campus, known for its medical school, engineering programs, and research output.',
    descriptionZh:
      '布法罗分校是最大的纽约州立大学校区，以其医学院、工程项目和研究成果闻名。',
  },
  {
    name: 'North Carolina State University',
    nameZh: '北卡罗来纳州立大学',
    state: 'NC',
    city: 'Raleigh',
    usNewsRank: 79,
    acceptanceRate: 46.0,
    tuition: 30870,
    satAvg: 1360,
    actAvg: 30,
    studentCount: 36304,
    graduationRate: 82,
    website: 'https://www.ncsu.edu',
    description:
      'NC State is a leading public research university in the Research Triangle, known for engineering, agriculture, and textiles.',
    descriptionZh:
      '北卡罗来纳州立大学是研究三角地区领先的公立研究型大学，以工程、农业和纺织闻名。',
  },
  {
    name: 'University of Massachusetts Amherst',
    nameZh: '马萨诸塞大学阿默斯特分校',
    state: 'MA',
    city: 'Amherst',
    usNewsRank: 79,
    acceptanceRate: 64.0,
    tuition: 38463,
    satAvg: 1350,
    actAvg: 30,
    studentCount: 32108,
    graduationRate: 80,
    website: 'https://www.umass.edu',
    description:
      'UMass Amherst is the flagship of the UMass system, known for computer science, polymer science, and the Five College Consortium.',
    descriptionZh:
      '马萨诸塞大学阿默斯特分校是马萨诸塞大学系统的旗舰校区，以计算机科学、高分子科学和五校联盟闻名。',
  },
  {
    name: 'Drexel University',
    nameZh: '德雷塞尔大学',
    state: 'PA',
    city: 'Philadelphia',
    usNewsRank: 90,
    acceptanceRate: 78.0,
    tuition: 58965,
    satAvg: 1320,
    actAvg: 29,
    studentCount: 24190,
    graduationRate: 72,
    website: 'https://www.drexel.edu',
    description:
      'Drexel is known for its cooperative education program, engineering, and health sciences in the heart of Philadelphia.',
    descriptionZh:
      '德雷塞尔大学以其合作教育项目、工程和健康科学闻名，位于费城市中心。',
  },
  {
    name: 'University of California, Riverside',
    nameZh: '加州大学河滨分校',
    state: 'CA',
    city: 'Riverside',
    usNewsRank: 90,
    acceptanceRate: 66.0,
    tuition: 44176,
    satAvg: 1240,
    actAvg: 27,
    studentCount: 26809,
    graduationRate: 76,
    website: 'https://www.ucr.edu',
    description:
      'UC Riverside is known for its diverse student body, entomology program, and growing research profile.',
    descriptionZh:
      '加州大学河滨分校以其多元化的学生群体、昆虫学项目和不断增长的研究实力闻名。',
  },
  {
    name: 'Temple University',
    nameZh: '天普大学',
    state: 'PA',
    city: 'Philadelphia',
    usNewsRank: 90,
    acceptanceRate: 67.0,
    tuition: 35278,
    satAvg: 1230,
    actAvg: 27,
    studentCount: 38461,
    graduationRate: 72,
    website: 'https://www.temple.edu',
    description:
      'Temple is a large urban public university in Philadelphia, known for its diverse programs and accessible education.',
    descriptionZh:
      '天普大学是位于费城的大型城市公立大学，以其多样化的项目和可及的教育闻名。',
  },
  {
    name: 'Worcester Polytechnic Institute',
    nameZh: '伍斯特理工学院',
    state: 'MA',
    city: 'Worcester',
    usNewsRank: 90,
    acceptanceRate: 49.0,
    tuition: 59230,
    satAvg: 1410,
    actAvg: 32,
    studentCount: 7214,
    graduationRate: 85,
    website: 'https://www.wpi.edu',
    description:
      'WPI is a private tech university known for its project-based curriculum, engineering programs, and hands-on learning.',
    descriptionZh:
      '伍斯特理工学院是一所私立科技大学，以其基于项目的课程、工程项目和实践学习闻名。',
  },
  {
    name: 'University of California, Santa Cruz',
    nameZh: '加州大学圣克鲁兹分校',
    state: 'CA',
    city: 'Santa Cruz',
    usNewsRank: 95,
    acceptanceRate: 47.0,
    tuition: 44130,
    satAvg: 1290,
    actAvg: 28,
    studentCount: 19841,
    graduationRate: 78,
    website: 'https://www.ucsc.edu',
    description:
      'UCSC is known for its beautiful redwood forest campus, marine biology program, and progressive culture.',
    descriptionZh:
      '加州大学圣克鲁兹分校以其美丽的红杉林校园、海洋生物学项目和进步的文化闻名。',
  },
  {
    name: 'University of Arizona',
    nameZh: '亚利桑那大学',
    state: 'AZ',
    city: 'Tucson',
    usNewsRank: 95,
    acceptanceRate: 87.0,
    tuition: 38217,
    satAvg: 1230,
    actAvg: 26,
    studentCount: 47670,
    graduationRate: 67,
    website: 'https://www.arizona.edu',
    description:
      'University of Arizona is known for its space sciences, optical sciences, and Sonoran Desert campus.',
    descriptionZh: '亚利桑那大学以其太空科学、光学科学和索诺兰沙漠校园闻名。',
  },
  {
    name: 'Howard University',
    nameZh: '霍华德大学',
    state: 'DC',
    city: 'Washington',
    usNewsRank: 95,
    acceptanceRate: 53.0,
    tuition: 32953,
    satAvg: 1220,
    actAvg: 26,
    studentCount: 12108,
    graduationRate: 67,
    website: 'https://www.howard.edu',
    description:
      'Howard is the premier historically Black university in America, known for its law school, medicine, and influential alumni.',
    descriptionZh:
      '霍华德大学是美国首屈一指的历史悠久的黑人大学，以其法学院、医学和有影响力的校友闻名。',
  },
  {
    name: 'Rochester Institute of Technology',
    nameZh: '罗切斯特理工学院',
    state: 'NY',
    city: 'Rochester',
    usNewsRank: 95,
    acceptanceRate: 67.0,
    tuition: 57518,
    satAvg: 1350,
    actAvg: 30,
    studentCount: 18766,
    graduationRate: 74,
    website: 'https://www.rit.edu',
    description:
      'RIT is known for its engineering, computing, and art programs, as well as being a leader in deaf education.',
    descriptionZh:
      '罗切斯特理工学院以其工程、计算和艺术项目闻名，也是聋人教育的领导者。',
  },
  {
    name: 'Illinois Institute of Technology',
    nameZh: '伊利诺伊理工学院',
    state: 'IL',
    city: 'Chicago',
    usNewsRank: 95,
    acceptanceRate: 58.0,
    tuition: 52896,
    satAvg: 1350,
    actAvg: 30,
    studentCount: 6459,
    graduationRate: 70,
    website: 'https://www.iit.edu',
    description:
      'IIT is a private tech university in Chicago, known for its architecture (designed by Mies van der Rohe), engineering, and law.',
    descriptionZh:
      '伊利诺伊理工学院是位于芝加哥的私立科技大学，以其建筑（由密斯·凡·德·罗设计）、工程和法学闻名。',
  },
];

async function main() {
  console.log('🏫 补充学校数据...\n');

  let created = 0;
  let updated = 0;

  for (const school of ADDITIONAL_SCHOOLS) {
    const existing = await prisma.school.findFirst({
      where: { name: school.name },
    });

    if (existing) {
      // 更新已有学校的缺失数据
      await prisma.school.update({
        where: { id: existing.id },
        data: {
          city: school.city,
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
      // 创建新学校
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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
