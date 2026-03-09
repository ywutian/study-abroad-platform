import { PrismaClient, ActivityCategory } from '@prisma/client';

const prisma = new PrismaClient();

interface TemplateData {
  name: string;
  nameZh?: string;
  aliases?: string[];
  category: ActivityCategory;
  tier: number; // 1=elite, 2=significant, 3=notable, 4=general
  description?: string;
}

const ACTIVITY_TEMPLATES: TemplateData[] = [
  // Tier 1 (National/International Elite)
  {
    name: 'Research Science Institute (RSI)',
    nameZh: 'RSI科学研究项目',
    aliases: ['RSI'],
    category: 'ACADEMIC',
    tier: 1,
    description: 'Highly selective summer research program at MIT',
  },
  {
    name: 'Telluride Association Summer Program (TASP)',
    nameZh: 'TASP',
    aliases: ['TASP', 'Telluride'],
    category: 'ACADEMIC',
    tier: 1,
    description: 'Prestigious free summer seminar program',
  },
  {
    name: 'MITES/MOSTEC',
    nameZh: 'MIT MITES项目',
    aliases: ['MITES', 'MOSTEC', 'MIT MITES'],
    category: 'ACADEMIC',
    tier: 1,
    description: 'MIT Introduction to Technology, Engineering, and Science',
  },
  {
    name: 'Stanford Mathematics Camp (SUMaC)',
    nameZh: 'SUMaC斯坦福数学营',
    aliases: ['SUMaC', 'Stanford Math Camp'],
    category: 'ACADEMIC',
    tier: 1,
    description: 'Stanford University Mathematics Camp',
  },
  {
    name: 'PROMYS',
    nameZh: 'PROMYS数学项目',
    aliases: ['PROMYS'],
    category: 'ACADEMIC',
    tier: 1,
    description:
      'Program in Mathematics for Young Scientists at Boston University',
  },
  {
    name: 'Ross Mathematics Program',
    nameZh: 'Ross数学营',
    aliases: ['Ross Math', 'Ross Program'],
    category: 'ACADEMIC',
    tier: 1,
    description: 'Intensive summer math program at Ohio State',
  },
  {
    name: 'Published Research (Peer-Reviewed)',
    nameZh: '同行评审学术发表',
    aliases: ['peer-reviewed publication', 'research publication'],
    category: 'RESEARCH',
    tier: 1,
    description: 'Published paper in peer-reviewed academic journal',
  },
  {
    name: 'Founded Nonprofit (National Impact)',
    nameZh: '创立全国性非营利组织',
    aliases: [],
    category: 'LEADERSHIP',
    tier: 1,
    description:
      'Founded nonprofit organization with demonstrated national impact',
  },
  {
    name: 'Garcia Research Program (Stony Brook)',
    nameZh: 'Garcia研究项目',
    aliases: ['Garcia Program'],
    category: 'RESEARCH',
    tier: 1,
    description: 'Polymer science and technology research program',
  },
  {
    name: 'Clark Scholars Program',
    nameZh: 'Clark学者项目',
    aliases: ['Clark Scholars'],
    category: 'RESEARCH',
    tier: 1,
    description: 'Texas Tech intensive research program',
  },

  // Tier 2 (State/Regional + Significant Impact)
  {
    name: 'Science Olympiad (State+)',
    nameZh: '科学奥林匹克(州级以上)',
    aliases: ['Science Olympiad', 'SciOly'],
    category: 'ACADEMIC',
    tier: 2,
    description: 'National STEM competition, team-based',
  },
  {
    name: 'DECA ICDC',
    nameZh: 'DECA国际赛',
    aliases: ['DECA', 'DECA ICDC'],
    category: 'LEADERSHIP',
    tier: 2,
    description: 'International Career Development Conference',
  },
  {
    name: 'FBLA National Leadership Conference',
    nameZh: 'FBLA全国领袖峰会',
    aliases: ['FBLA', 'FBLA NLC'],
    category: 'LEADERSHIP',
    tier: 2,
    description: 'Future Business Leaders of America nationals',
  },
  {
    name: 'All-State Orchestra/Band/Choir',
    nameZh: '全州管弦乐/合唱团',
    aliases: ['All-State Orchestra', 'All-State Band', 'All-State Choir'],
    category: 'ARTS',
    tier: 2,
    description: 'State-level music ensemble selection',
  },
  {
    name: 'Mock Trial (State+)',
    nameZh: '模拟审判(州级以上)',
    aliases: ['Mock Trial'],
    category: 'ACADEMIC',
    tier: 2,
    description: 'Competitive legal simulation, state level or above',
  },
  {
    name: "Governor's School",
    nameZh: '州长学校',
    aliases: ['Governors School'],
    category: 'ACADEMIC',
    tier: 2,
    description: 'State-sponsored academic enrichment program',
  },
  {
    name: 'Hospital Volunteering (200+ hrs)',
    nameZh: '医院志愿服务(200+小时)',
    aliases: ['Hospital Volunteer'],
    category: 'COMMUNITY_SERVICE',
    tier: 2,
    description: 'Sustained hospital volunteering with significant hours',
  },
  {
    name: 'Varsity Captain (State-Ranked)',
    nameZh: '校队队长(州级排名)',
    aliases: ['Varsity Captain'],
    category: 'ATHLETICS',
    tier: 2,
    description: 'Captain of state-ranked varsity sports team',
  },
  {
    name: 'Math Olympiad Camp (MATHCOUNTS/AMC)',
    nameZh: '数学竞赛集训',
    aliases: ['MATHCOUNTS', 'AMC Training'],
    category: 'ACADEMIC',
    tier: 2,
    description: 'Competitive math training program',
  },
  {
    name: 'Moot Court (Regional+)',
    nameZh: '模拟法庭(区域以上)',
    aliases: ['Moot Court'],
    category: 'ACADEMIC',
    tier: 2,
    description: 'Appellate advocacy competition',
  },
  {
    name: 'Research Internship (University Lab)',
    nameZh: '大学实验室科研实习',
    aliases: ['University Research', 'Lab Internship'],
    category: 'RESEARCH',
    tier: 2,
    description: 'Research internship at a university laboratory',
  },
  {
    name: 'Congressional Award Gold Medal',
    nameZh: '国会金奖',
    aliases: ['Congressional Award'],
    category: 'COMMUNITY_SERVICE',
    tier: 2,
    description: 'Highest civilian honor for youth in the US',
  },

  // Tier 3 (School Leadership + Commitment)
  {
    name: 'Student Government Officer',
    nameZh: '学生会干部',
    aliases: ['Student Government', 'Student Council', '学生会'],
    category: 'LEADERSHIP',
    tier: 3,
    description: 'Officer position in student government',
  },
  {
    name: 'School Newspaper/Yearbook Editor',
    nameZh: '校报/年鉴编辑',
    aliases: ['School Newspaper', 'Yearbook Editor'],
    category: 'LEADERSHIP',
    tier: 3,
    description: 'Editor of school publication',
  },
  {
    name: 'Debate Team (Active Competitor)',
    nameZh: '辩论队成员',
    aliases: ['Debate Team', 'Speech and Debate'],
    category: 'ACADEMIC',
    tier: 3,
    description: 'Active participation in competitive debate',
  },
  {
    name: 'National Honor Society Officer',
    nameZh: 'NHS干部',
    aliases: ['NHS', 'National Honor Society'],
    category: 'LEADERSHIP',
    tier: 3,
    description: 'Officer in NHS chapter',
  },
  {
    name: 'Eagle Scout / Gold Award',
    nameZh: '鹰级童军/金奖女童军',
    aliases: ['Eagle Scout', 'Gold Award'],
    category: 'COMMUNITY_SERVICE',
    tier: 3,
    description: 'Highest rank in Scouts BSA or Girl Scouts',
  },
  {
    name: 'Tutoring Program Leader',
    nameZh: '辅导项目负责人',
    aliases: ['Peer Tutor', 'Tutoring'],
    category: 'COMMUNITY_SERVICE',
    tier: 3,
    description: 'Leading or organizing tutoring programs',
  },
  {
    name: 'Theater/Drama Lead Roles',
    nameZh: '戏剧主角',
    aliases: ['Theater', 'Drama'],
    category: 'ARTS',
    tier: 3,
    description: 'Lead roles in school or community theater',
  },
  {
    name: 'Model United Nations (Active Delegate)',
    nameZh: '模拟联合国',
    aliases: ['MUN', 'Model UN', '模联'],
    category: 'ACADEMIC',
    tier: 3,
    description: 'Active MUN participation and awards',
  },
  {
    name: 'Key Club / Interact Officer',
    nameZh: 'Key Club/Interact干部',
    aliases: ['Key Club', 'Interact Club'],
    category: 'COMMUNITY_SERVICE',
    tier: 3,
    description: 'Service club officer position',
  },
  {
    name: 'Robotics Club (FRC/FTC/VEX)',
    nameZh: '机器人社团',
    aliases: ['FRC', 'FTC', 'VEX Robotics', 'Robotics'],
    category: 'ACADEMIC',
    tier: 3,
    description: 'Competitive robotics team member',
  },
  {
    name: 'Math Club President',
    nameZh: '数学社团社长',
    aliases: ['Math Club'],
    category: 'ACADEMIC',
    tier: 3,
    description: 'President of school math club',
  },
  {
    name: 'Cultural Club Leader',
    nameZh: '文化社团负责人',
    aliases: ['Cultural Club', 'Heritage Club'],
    category: 'CLUB',
    tier: 3,
    description: 'Leading cultural or heritage-related club',
  },

  // Chinese/International Tier 1-2
  {
    name: '丘成桐科学奖 (Yau Science Award)',
    nameZh: '丘成桐科学奖',
    aliases: ['丘成桐', 'Yau Science Award', 'Yau Award'],
    category: 'RESEARCH',
    tier: 1,
    description:
      'Prestigious international science competition for high school students',
  },
  {
    name: 'CMO (Chinese Mathematical Olympiad)',
    nameZh: '全国数学奥林匹克(CMO)',
    aliases: ['CMO', '数学奥赛', '全国数学竞赛'],
    category: 'ACADEMIC',
    tier: 2,
    description: 'China national mathematics olympiad',
  },
  {
    name: 'CPhO (Chinese Physics Olympiad)',
    nameZh: '全国物理奥林匹克(CPhO)',
    aliases: ['CPhO', '物理奥赛', '全国物理竞赛'],
    category: 'ACADEMIC',
    tier: 2,
    description: 'China national physics olympiad',
  },
  {
    name: 'CChO (Chinese Chemistry Olympiad)',
    nameZh: '全国化学奥林匹克(CChO)',
    aliases: ['CChO', '化学奥赛', '全国化学竞赛'],
    category: 'ACADEMIC',
    tier: 2,
    description: 'China national chemistry olympiad',
  },
  {
    name: 'NOI (National Olympiad in Informatics)',
    nameZh: '全国信息学奥林匹克(NOI)',
    aliases: ['NOI', '信息学奥赛'],
    category: 'ACADEMIC',
    tier: 2,
    description: 'China national informatics olympiad',
  },
  {
    name: 'CBO (Chinese Biology Olympiad)',
    nameZh: '全国生物奥林匹克(CBO)',
    aliases: ['CBO', '生物奥赛'],
    category: 'ACADEMIC',
    tier: 2,
    description: 'China national biology olympiad',
  },

  // Chinese/International Tier 3
  {
    name: 'CTB (China Thinks Big)',
    nameZh: 'CTB全国创新研究大赛',
    aliases: ['CTB', 'China Thinks Big'],
    category: 'RESEARCH',
    tier: 3,
    description: 'Harvard-initiated academic research competition',
  },
  {
    name: 'NEC (National Economics Challenge)',
    nameZh: 'NEC全美经济学挑战赛',
    aliases: ['NEC', 'National Economics Challenge'],
    category: 'ACADEMIC',
    tier: 3,
    description: 'Economics knowledge competition',
  },
  {
    name: 'NSDA China',
    nameZh: 'NSDA全美演讲与辩论联赛(中国)',
    aliases: ['NSDA', 'NSDA China'],
    category: 'ACADEMIC',
    tier: 3,
    description: 'National Speech and Debate Association China chapter',
  },
  {
    name: 'HOSA China',
    nameZh: 'HOSA未来健康专业人才联盟',
    aliases: ['HOSA'],
    category: 'ACADEMIC',
    tier: 3,
    description: 'Health Occupations Students of America China chapter',
  },
  {
    name: 'BPA (Business Professionals of America)',
    nameZh: 'BPA商业精英挑战赛',
    aliases: ['BPA'],
    category: 'LEADERSHIP',
    tier: 3,
    description: 'Business and IT competition',
  },
  {
    name: 'Physics Bowl China',
    nameZh: 'Physics Bowl物理碗',
    aliases: ['Physics Bowl'],
    category: 'ACADEMIC',
    tier: 3,
    description:
      'American Association of Physics Teachers competition in China',
  },
  {
    name: 'BBO (British Biology Olympiad)',
    nameZh: 'BBO英国生物奥林匹克',
    aliases: ['BBO'],
    category: 'ACADEMIC',
    tier: 3,
    description: 'British Biology Olympiad competition',
  },
  {
    name: '学生会主席 (International School)',
    nameZh: '国际学校学生会主席',
    aliases: ['Student Body President', '学生会主席'],
    category: 'LEADERSHIP',
    tier: 3,
    description: 'Student body president at international school',
  },
  {
    name: '全国新概念作文大赛',
    nameZh: '全国新概念作文大赛',
    aliases: ['新概念作文', 'New Concept Writing'],
    category: 'ARTS',
    tier: 3,
    description: 'National New Concept Writing Competition',
  },
  {
    name: 'Euclid Mathematics Contest',
    nameZh: '欧几里得数学竞赛',
    aliases: ['Euclid Contest', 'Waterloo Math'],
    category: 'ACADEMIC',
    tier: 3,
    description: 'University of Waterloo mathematics contest',
  },
  {
    name: 'UKMT (UK Math Trust)',
    nameZh: 'UKMT英国数学竞赛',
    aliases: ['UKMT', 'UK Math Trust'],
    category: 'ACADEMIC',
    tier: 3,
    description: 'United Kingdom Mathematics Trust competitions',
  },

  // Tier 4 (General, common activities)
  {
    name: 'Sports Team Member',
    nameZh: '运动队成员',
    aliases: ['Varsity', 'JV', 'Sports'],
    category: 'ATHLETICS',
    tier: 4,
    description: 'Member of school sports team',
  },
  {
    name: 'Band/Orchestra Member',
    nameZh: '乐队/管弦乐成员',
    aliases: ['Band', 'Orchestra'],
    category: 'ARTS',
    tier: 4,
    description: 'Member of school music ensemble',
  },
  {
    name: 'Part-Time Job',
    nameZh: '兼职工作',
    aliases: ['Part Time', 'Employment'],
    category: 'WORK',
    tier: 4,
    description: 'Regular part-time employment',
  },
  {
    name: 'Religious/Faith Community',
    nameZh: '宗教/信仰团体',
    aliases: ['Church', 'Youth Group'],
    category: 'COMMUNITY_SERVICE',
    tier: 4,
    description: 'Active participation in faith-based community',
  },
  {
    name: 'Family Responsibilities',
    nameZh: '家庭责任',
    aliases: ['Caregiving', 'Family Caretaker'],
    category: 'OTHER',
    tier: 4,
    description: 'Significant family caregiving responsibilities',
  },
  {
    name: 'Personal Blog/YouTube Channel',
    nameZh: '个人博客/YouTube频道',
    aliases: ['Blog', 'YouTube', 'Content Creator'],
    category: 'HOBBY',
    tier: 4,
    description: 'Creating and maintaining content platform',
  },
  {
    name: 'Coding Projects (GitHub)',
    nameZh: '编程项目(GitHub)',
    aliases: ['GitHub', 'Open Source', 'Coding Projects'],
    category: 'ACADEMIC',
    tier: 4,
    description: 'Personal coding projects and open source contributions',
  },
];

export async function seedActivityTemplates() {
  console.log('Seeding activity templates...');

  for (const tmpl of ACTIVITY_TEMPLATES) {
    await prisma.activityTemplate.upsert({
      where: { name: tmpl.name },
      update: {
        nameZh: tmpl.nameZh,
        aliases: tmpl.aliases ?? [],
        category: tmpl.category,
        tier: tmpl.tier,
        description: tmpl.description,
      },
      create: {
        name: tmpl.name,
        nameZh: tmpl.nameZh,
        aliases: tmpl.aliases ?? [],
        category: tmpl.category,
        tier: tmpl.tier,
        description: tmpl.description,
      },
    });
  }

  console.log(`Seeded ${ACTIVITY_TEMPLATES.length} activity templates`);
}

if (require.main === module) {
  seedActivityTemplates()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
