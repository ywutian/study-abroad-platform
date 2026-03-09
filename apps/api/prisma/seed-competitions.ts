/**
 * 竞赛数据库种子脚本
 * Seed competition reference data (90+ competitions)
 *
 * Usage:
 *   pnpm --filter api ts-node prisma/seed-competitions.ts
 */

import { PrismaClient, CompetitionCategory, AwardLevel } from '@prisma/client';

const prisma = new PrismaClient();

interface CompetitionSeed {
  name: string;
  abbreviation: string;
  nameZh: string;
  category: CompetitionCategory;
  level: AwardLevel;
  tier: number; // 1-5 (5 = highest prestige)
  description: string;
  website?: string;
}

const competitions: CompetitionSeed[] = [
  // ============================================
  // MATH — Tier 5 (Olympiad Gold)
  // ============================================
  {
    name: 'International Mathematical Olympiad',
    abbreviation: 'IMO',
    nameZh: '国际数学奥林匹克',
    category: 'MATH',
    level: 'INTERNATIONAL',
    tier: 5,
    description:
      'The most prestigious international mathematics competition for high school students.',
    website: 'https://www.imo-official.org',
  },
  // MATH — Tier 4
  {
    name: 'USA Mathematical Olympiad',
    abbreviation: 'USAMO',
    nameZh: '美国数学奥林匹克',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 4,
    description: 'Top-tier national math olympiad for top AIME qualifiers.',
  },
  {
    name: 'USA Junior Mathematical Olympiad',
    abbreviation: 'USAJMO',
    nameZh: '美国初级数学奥林匹克',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 4,
    description:
      'National math olympiad for younger students qualifying through AMC 10/AIME.',
  },
  {
    name: 'Putnam Mathematical Competition',
    abbreviation: 'Putnam',
    nameZh: '普特南数学竞赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 4,
    description:
      'Prestigious undergraduate mathematics competition, occasionally taken by exceptional HS students.',
  },
  // MATH — Tier 3
  {
    name: 'American Invitational Mathematics Examination',
    abbreviation: 'AIME',
    nameZh: '美国数学邀请赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 3,
    description: 'Invitation-only exam for top AMC 10/12 scorers.',
  },
  {
    name: 'AMC 12',
    abbreviation: 'AMC 12',
    nameZh: 'AMC 12 数学竞赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 2,
    description: 'Nationwide math contest for students in grade 12 and below.',
  },
  {
    name: 'AMC 10',
    abbreviation: 'AMC 10',
    nameZh: 'AMC 10 数学竞赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 2,
    description: 'Nationwide math contest for students in grade 10 and below.',
  },
  {
    name: 'AMC 8',
    abbreviation: 'AMC 8',
    nameZh: 'AMC 8 数学竞赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 1,
    description: 'Nationwide math contest for students in grade 8 and below.',
  },
  {
    name: 'MATHCOUNTS',
    abbreviation: 'MATHCOUNTS',
    nameZh: 'MATHCOUNTS 数学竞赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 2,
    description:
      'National math competition for middle school students with state and national rounds.',
  },
  {
    name: 'Harvard-MIT Mathematics Tournament',
    abbreviation: 'HMMT',
    nameZh: '哈佛-MIT数学锦标赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 3,
    description:
      'One of the largest and most prestigious high school math tournaments in the US.',
    website: 'https://www.hmmt.org',
  },
  {
    name: 'Princeton University Mathematics Competition',
    abbreviation: 'PUMaC',
    nameZh: '普林斯顿大学数学竞赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 3,
    description: 'Prestigious university-hosted math competition.',
  },
  {
    name: 'ARML - American Regions Mathematics League',
    abbreviation: 'ARML',
    nameZh: '美国地区数学联赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 2,
    description: 'Annual team math competition between US regional teams.',
  },
  {
    name: 'Mandelbrot Competition',
    abbreviation: 'Mandelbrot',
    nameZh: '曼德布洛特数学竞赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 2,
    description: 'Team-based high school math competition.',
  },
  {
    name: 'Math Olympiad for Elementary Schools',
    abbreviation: 'MOEMS',
    nameZh: '小学数学奥林匹克',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 1,
    description:
      'Math olympiad program for elementary and middle school students.',
  },

  // ============================================
  // BIOLOGY — Tier 5
  // ============================================
  {
    name: 'International Biology Olympiad',
    abbreviation: 'IBO',
    nameZh: '国际生物奥林匹克',
    category: 'BIOLOGY',
    level: 'INTERNATIONAL',
    tier: 5,
    description: 'The most prestigious international biology competition.',
    website: 'https://www.ibo-info.org',
  },
  // BIOLOGY — Tier 4
  {
    name: 'USA Biology Olympiad',
    abbreviation: 'USABO',
    nameZh: '美国生物奥林匹克',
    category: 'BIOLOGY',
    level: 'NATIONAL',
    tier: 4,
    description: 'National biology olympiad selecting the US IBO team.',
  },
  // BIOLOGY — Tier 3
  {
    name: 'USABO Open Exam',
    abbreviation: 'USABO Open',
    nameZh: 'USABO公开赛',
    category: 'BIOLOGY',
    level: 'NATIONAL',
    tier: 3,
    description: 'First round of the USA Biology Olympiad selection.',
  },
  {
    name: 'Science Olympiad - Biology Events',
    abbreviation: 'SciOly-Bio',
    nameZh: '科学奥林匹克-生物',
    category: 'BIOLOGY',
    level: 'NATIONAL',
    tier: 2,
    description: 'Biology-focused events within Science Olympiad.',
  },
  {
    name: 'BioGENEius Challenge',
    abbreviation: 'BioGENEius',
    nameZh: 'BioGENEius生物技术挑战',
    category: 'BIOLOGY',
    level: 'NATIONAL',
    tier: 3,
    description: 'Biotechnology research competition for high school students.',
  },

  // ============================================
  // PHYSICS — Tier 5
  // ============================================
  {
    name: 'International Physics Olympiad',
    abbreviation: 'IPhO',
    nameZh: '国际物理奥林匹克',
    category: 'PHYSICS',
    level: 'INTERNATIONAL',
    tier: 5,
    description: 'The most prestigious international physics competition.',
    website: 'https://www.ipho-new.org',
  },
  // PHYSICS — Tier 4
  {
    name: 'USA Physics Olympiad',
    abbreviation: 'USAPhO',
    nameZh: '美国物理奥林匹克',
    category: 'PHYSICS',
    level: 'NATIONAL',
    tier: 4,
    description: 'National physics olympiad selecting the US IPhO team.',
  },
  // PHYSICS — Tier 3
  {
    name: 'Physics Bowl',
    abbreviation: 'PhysicsBowl',
    nameZh: 'Physics Bowl 物理碗',
    category: 'PHYSICS',
    level: 'NATIONAL',
    tier: 3,
    description: 'AAPT-organized nationwide physics competition.',
  },
  {
    name: 'F=ma Exam',
    abbreviation: 'F=ma',
    nameZh: 'F=ma物理竞赛',
    category: 'PHYSICS',
    level: 'NATIONAL',
    tier: 3,
    description: 'First round selection exam for the US Physics Olympiad team.',
  },
  // PHYSICS — Tier 2
  {
    name: 'Science Olympiad - Physics Events',
    abbreviation: 'SciOly-Physics',
    nameZh: '科学奥林匹克-物理',
    category: 'PHYSICS',
    level: 'NATIONAL',
    tier: 2,
    description: 'Physics-focused events within Science Olympiad.',
  },

  // ============================================
  // CHEMISTRY — Tier 5
  // ============================================
  {
    name: 'International Chemistry Olympiad',
    abbreviation: 'IChO',
    nameZh: '国际化学奥林匹克',
    category: 'CHEMISTRY',
    level: 'INTERNATIONAL',
    tier: 5,
    description: 'The most prestigious international chemistry competition.',
    website: 'https://www.icho.us',
  },
  // CHEMISTRY — Tier 4
  {
    name: 'USA National Chemistry Olympiad',
    abbreviation: 'USNCO',
    nameZh: '美国国家化学奥林匹克',
    category: 'CHEMISTRY',
    level: 'NATIONAL',
    tier: 4,
    description: 'National chemistry olympiad selecting the US IChO team.',
  },
  // CHEMISTRY — Tier 3
  {
    name: 'USNCO Local Section Exam',
    abbreviation: 'USNCO Local',
    nameZh: 'USNCO地区赛',
    category: 'CHEMISTRY',
    level: 'REGIONAL',
    tier: 2,
    description: 'First round of the US National Chemistry Olympiad.',
  },
  {
    name: 'Chemistry Olympiad National Exam',
    abbreviation: 'USNCO National',
    nameZh: 'USNCO全国赛',
    category: 'CHEMISTRY',
    level: 'NATIONAL',
    tier: 3,
    description:
      'National round of the US Chemistry Olympiad selecting study camp attendees.',
  },
  {
    name: 'You Be The Chemist Challenge',
    abbreviation: 'YBTC',
    nameZh: '你来做化学家挑战赛',
    category: 'CHEMISTRY',
    level: 'NATIONAL',
    tier: 2,
    description: 'National chemistry competition for middle school students.',
  },

  // ============================================
  // COMPUTER SCIENCE — Tier 5
  // ============================================
  {
    name: 'International Olympiad in Informatics',
    abbreviation: 'IOI',
    nameZh: '国际信息学奥林匹克',
    category: 'COMPUTER_SCIENCE',
    level: 'INTERNATIONAL',
    tier: 5,
    description: 'The most prestigious international programming competition.',
    website: 'https://ioinformatics.org',
  },
  // COMPUTER SCIENCE — Tier 4
  {
    name: 'USA Computing Olympiad',
    abbreviation: 'USACO',
    nameZh: '美国计算机奥林匹克',
    category: 'COMPUTER_SCIENCE',
    level: 'NATIONAL',
    tier: 4,
    description:
      'National computing olympiad with Bronze/Silver/Gold/Platinum divisions.',
    website: 'http://www.usaco.org',
  },
  // COMPUTER SCIENCE — Tier 3
  {
    name: 'USACO Gold Division',
    abbreviation: 'USACO Gold',
    nameZh: 'USACO金级',
    category: 'COMPUTER_SCIENCE',
    level: 'NATIONAL',
    tier: 3,
    description: 'Gold division of USACO indicating strong algorithmic skills.',
  },
  {
    name: 'USACO Silver Division',
    abbreviation: 'USACO Silver',
    nameZh: 'USACO银级',
    category: 'COMPUTER_SCIENCE',
    level: 'NATIONAL',
    tier: 2,
    description: 'Silver division of USACO.',
  },
  {
    name: 'ACSL - American Computer Science League',
    abbreviation: 'ACSL',
    nameZh: '美国计算机科学联盟',
    category: 'COMPUTER_SCIENCE',
    level: 'NATIONAL',
    tier: 2,
    description:
      'Team-based computer science competition with multiple divisions.',
  },
  {
    name: 'Google Code Jam',
    abbreviation: 'Google Code Jam',
    nameZh: '谷歌编程大赛',
    category: 'COMPUTER_SCIENCE',
    level: 'INTERNATIONAL',
    tier: 3,
    description: 'Global competitive programming competition hosted by Google.',
  },
  {
    name: 'Codeforces Competitive Programming',
    abbreviation: 'Codeforces',
    nameZh: 'Codeforces编程竞赛',
    category: 'COMPUTER_SCIENCE',
    level: 'INTERNATIONAL',
    tier: 2,
    description:
      'Online competitive programming platform with regular contests.',
    website: 'https://codeforces.com',
  },
  {
    name: 'Kaggle Competitions',
    abbreviation: 'Kaggle',
    nameZh: 'Kaggle数据科学竞赛',
    category: 'COMPUTER_SCIENCE',
    level: 'INTERNATIONAL',
    tier: 3,
    description: 'Data science and machine learning competition platform.',
    website: 'https://www.kaggle.com',
  },
  {
    name: 'Congressional App Challenge',
    abbreviation: 'CAC',
    nameZh: '国会App挑战赛',
    category: 'COMPUTER_SCIENCE',
    level: 'NATIONAL',
    tier: 2,
    description: 'US congressional competition for student-created apps.',
  },

  // ============================================
  // ENGINEERING & RESEARCH — Tier 5
  // ============================================
  {
    name: 'Regeneron International Science and Engineering Fair',
    abbreviation: 'ISEF',
    nameZh: '英特尔/再生元国际科学与工程大赛',
    category: 'ENGINEERING_RESEARCH',
    level: 'INTERNATIONAL',
    tier: 5,
    description:
      "The world's largest international pre-college science competition.",
    website: 'https://www.societyforscience.org/isef/',
  },
  {
    name: 'Regeneron Science Talent Search',
    abbreviation: 'Regeneron STS',
    nameZh: '再生元科学天才奖',
    category: 'ENGINEERING_RESEARCH',
    level: 'NATIONAL',
    tier: 5,
    description:
      "The nation's oldest and most prestigious pre-college science and math competition.",
    website: 'https://www.societyforscience.org/regeneron-sts/',
  },
  // ENGINEERING & RESEARCH — Tier 4
  {
    name: 'Siemens Competition in Math, Science & Technology',
    abbreviation: 'Siemens',
    nameZh: '西门子数学科学技术竞赛',
    category: 'ENGINEERING_RESEARCH',
    level: 'NATIONAL',
    tier: 4,
    description:
      'National research competition for high school students (now discontinued, legacy prestige).',
  },
  {
    name: 'Davidson Fellows Scholarship',
    abbreviation: 'Davidson Fellows',
    nameZh: 'Davidson Fellow奖学金',
    category: 'ENGINEERING_RESEARCH',
    level: 'NATIONAL',
    tier: 4,
    description:
      'Scholarship for exceptional young people with significant research projects.',
    website: 'https://www.davidsongifted.org/fellows-scholarship',
  },
  // ENGINEERING & RESEARCH — Tier 3
  {
    name: 'Science Olympiad',
    abbreviation: 'SciOly',
    nameZh: '科学奥林匹克',
    category: 'ENGINEERING_RESEARCH',
    level: 'NATIONAL',
    tier: 3,
    description: 'National team-based STEM competition with 23 events.',
    website: 'https://www.soinc.org',
  },
  {
    name: 'FIRST Robotics Competition',
    abbreviation: 'FRC',
    nameZh: 'FIRST机器人竞赛',
    category: 'ENGINEERING_RESEARCH',
    level: 'INTERNATIONAL',
    tier: 3,
    description:
      'International robotics competition combining engineering and teamwork.',
    website: 'https://www.firstinspires.org',
  },
  {
    name: 'VEX Robotics Competition',
    abbreviation: 'VEX',
    nameZh: 'VEX机器人竞赛',
    category: 'ENGINEERING_RESEARCH',
    level: 'INTERNATIONAL',
    tier: 2,
    description:
      'International robotics competition with multiple age divisions.',
  },
  {
    name: 'Google Science Fair',
    abbreviation: 'GSF',
    nameZh: '谷歌科学博览会',
    category: 'ENGINEERING_RESEARCH',
    level: 'INTERNATIONAL',
    tier: 3,
    description:
      'Global online science and technology competition for students ages 13-18.',
  },
  {
    name: 'MIT THINK Scholars Program',
    abbreviation: 'MIT THINK',
    nameZh: 'MIT THINK学者计划',
    category: 'ENGINEERING_RESEARCH',
    level: 'NATIONAL',
    tier: 3,
    description:
      'Research funding and mentorship program by MIT students for HS researchers.',
  },
  {
    name: 'Junior Science and Humanities Symposium',
    abbreviation: 'JSHS',
    nameZh: '青少年科学与人文研讨会',
    category: 'ENGINEERING_RESEARCH',
    level: 'NATIONAL',
    tier: 3,
    description: 'Department of Defense sponsored STEM research competition.',
  },
  {
    name: 'Conrad Challenge',
    abbreviation: 'Conrad',
    nameZh: '康拉德创新挑战赛',
    category: 'ENGINEERING_RESEARCH',
    level: 'INTERNATIONAL',
    tier: 3,
    description:
      'Innovation competition for students developing solutions to global challenges.',
  },
  {
    name: 'Envirothon',
    abbreviation: 'Envirothon',
    nameZh: '环境科学竞赛',
    category: 'ENGINEERING_RESEARCH',
    level: 'NATIONAL',
    tier: 2,
    description: 'Environmental science team competition.',
  },

  // ============================================
  // ECONOMICS & BUSINESS — Tier 4
  // ============================================
  {
    name: 'International Economics Olympiad',
    abbreviation: 'IEO',
    nameZh: '国际经济学奥林匹克',
    category: 'ECONOMICS_BUSINESS',
    level: 'INTERNATIONAL',
    tier: 4,
    description:
      'International economics competition for high school students.',
  },
  {
    name: 'National Economics Challenge',
    abbreviation: 'NEC',
    nameZh: '全美经济学挑战赛',
    category: 'ECONOMICS_BUSINESS',
    level: 'NATIONAL',
    tier: 3,
    description:
      'National economics competition organized by the Council for Economic Education.',
  },
  {
    name: 'DECA International Career Development Conference',
    abbreviation: 'DECA ICDC',
    nameZh: 'DECA国际商业竞赛',
    category: 'ECONOMICS_BUSINESS',
    level: 'INTERNATIONAL',
    tier: 3,
    description:
      'Business and entrepreneurship competition for high school students.',
    website: 'https://www.deca.org',
  },
  {
    name: 'Future Business Leaders of America',
    abbreviation: 'FBLA',
    nameZh: '未来商业领袖',
    category: 'ECONOMICS_BUSINESS',
    level: 'NATIONAL',
    tier: 2,
    description: 'National business leadership and competition organization.',
    website: 'https://www.fbla.org',
  },
  {
    name: 'KWHS Investment Competition',
    abbreviation: 'KWHS',
    nameZh: '沃顿商学院投资竞赛',
    category: 'ECONOMICS_BUSINESS',
    level: 'INTERNATIONAL',
    tier: 3,
    description: 'Wharton Global High School Investment Competition.',
  },
  {
    name: 'Diamond Challenge',
    abbreviation: 'Diamond Challenge',
    nameZh: '钻石创业挑战赛',
    category: 'ECONOMICS_BUSINESS',
    level: 'INTERNATIONAL',
    tier: 3,
    description:
      'University of Delaware entrepreneurship competition for high school students.',
  },
  {
    name: 'Stock Market Game',
    abbreviation: 'SMG',
    nameZh: '股票市场模拟竞赛',
    category: 'ECONOMICS_BUSINESS',
    level: 'NATIONAL',
    tier: 1,
    description: 'Simulated stock market competition for students.',
  },

  // ============================================
  // DEBATE & SPEECH — Tier 4
  // ============================================
  {
    name: 'Tournament of Champions (Debate)',
    abbreviation: 'TOC',
    nameZh: '全美辩论冠军赛',
    category: 'DEBATE_SPEECH',
    level: 'NATIONAL',
    tier: 4,
    description: 'The most prestigious national high school debate tournament.',
  },
  {
    name: 'National Speech and Debate Association Nationals',
    abbreviation: 'NSDA Nationals',
    nameZh: 'NSDA全美演讲与辩论全国赛',
    category: 'DEBATE_SPEECH',
    level: 'NATIONAL',
    tier: 4,
    description:
      'Largest academic competition in the nation with speech and debate events.',
    website: 'https://www.speechanddebate.org',
  },
  {
    name: 'World Schools Debating Championships',
    abbreviation: 'WSDC',
    nameZh: '世界学校辩论锦标赛',
    category: 'DEBATE_SPEECH',
    level: 'INTERNATIONAL',
    tier: 4,
    description: 'International debating competition between national teams.',
  },
  // DEBATE & SPEECH — Tier 3
  {
    name: 'NSDA District Qualifier',
    abbreviation: 'NSDA District',
    nameZh: 'NSDA地区赛',
    category: 'DEBATE_SPEECH',
    level: 'REGIONAL',
    tier: 2,
    description: 'District qualifying tournament for NSDA Nationals.',
  },
  {
    name: 'Model United Nations',
    abbreviation: 'MUN',
    nameZh: '模拟联合国',
    category: 'DEBATE_SPEECH',
    level: 'INTERNATIONAL',
    tier: 2,
    description:
      'Simulation of UN proceedings fostering diplomacy and debate skills.',
  },
  {
    name: 'Harvard Model Congress',
    abbreviation: 'HMC',
    nameZh: '哈佛模拟国会',
    category: 'DEBATE_SPEECH',
    level: 'NATIONAL',
    tier: 3,
    description: 'Prestigious model congress simulation at Harvard University.',
  },

  // ============================================
  // WRITING & ESSAY — Tier 4
  // ============================================
  {
    name: 'Scholastic Art & Writing Awards',
    abbreviation: 'Scholastic Awards',
    nameZh: 'Scholastic艺术与写作奖',
    category: 'WRITING_ESSAY',
    level: 'NATIONAL',
    tier: 4,
    description:
      "The nation's longest-running and most prestigious recognition program for creative writing.",
    website: 'https://www.artandwriting.org',
  },
  {
    name: 'Concord Review',
    abbreviation: 'Concord Review',
    nameZh: '协和评论',
    category: 'WRITING_ESSAY',
    level: 'INTERNATIONAL',
    tier: 4,
    description:
      'The only academic journal in the world to publish the academic history essays of high school students.',
  },
  // WRITING & ESSAY — Tier 3
  {
    name: 'John Locke Essay Competition',
    abbreviation: 'John Locke',
    nameZh: '约翰·洛克论文竞赛',
    category: 'WRITING_ESSAY',
    level: 'INTERNATIONAL',
    tier: 3,
    description:
      'International essay competition encouraging independent thinking.',
    website: 'https://www.johnlockeinstitute.com',
  },
  {
    name: 'New York Times Student Editorial Contest',
    abbreviation: 'NYT Editorial',
    nameZh: '纽约时报学生社论竞赛',
    category: 'WRITING_ESSAY',
    level: 'NATIONAL',
    tier: 2,
    description: 'Student opinion writing competition by The New York Times.',
  },
  {
    name: 'Princeton Ten-Minute Play Contest',
    abbreviation: 'Princeton Play',
    nameZh: '普林斯顿十分钟戏剧赛',
    category: 'WRITING_ESSAY',
    level: 'NATIONAL',
    tier: 3,
    description: 'Playwriting contest for high school juniors and seniors.',
  },
  {
    name: 'National Spelling Bee',
    abbreviation: 'Spelling Bee',
    nameZh: '全美拼字大赛',
    category: 'WRITING_ESSAY',
    level: 'NATIONAL',
    tier: 3,
    description: 'Annual national spelling competition.',
  },
  {
    name: 'National History Day',
    abbreviation: 'NHD',
    nameZh: '全美历史日',
    category: 'WRITING_ESSAY',
    level: 'NATIONAL',
    tier: 2,
    description: 'National history research and presentation competition.',
  },

  // ============================================
  // GENERAL ACADEMIC — Tier 4
  // ============================================
  {
    name: 'Academic Decathlon',
    abbreviation: 'AcaDeca',
    nameZh: '学术十项全能',
    category: 'GENERAL_ACADEMIC',
    level: 'NATIONAL',
    tier: 3,
    description:
      'National ten-event academic competition testing multiple subjects.',
    website: 'https://www.usad.org',
  },
  {
    name: 'National Academic Quiz Tournaments',
    abbreviation: 'NAQT',
    nameZh: '全美学术知识竞赛',
    category: 'GENERAL_ACADEMIC',
    level: 'NATIONAL',
    tier: 2,
    description: 'Quiz bowl competition testing breadth of academic knowledge.',
  },
  {
    name: 'Knowledge Bowl',
    abbreviation: 'Knowledge Bowl',
    nameZh: '知识碗',
    category: 'GENERAL_ACADEMIC',
    level: 'STATE',
    tier: 1,
    description: 'State-level academic quiz competition.',
  },
  {
    name: 'National Geographic GeoBee',
    abbreviation: 'GeoBee',
    nameZh: '国家地理知识竞赛',
    category: 'GENERAL_ACADEMIC',
    level: 'NATIONAL',
    tier: 2,
    description: 'National geography competition for students in grades 4-8.',
  },
  {
    name: 'National Science Bowl',
    abbreviation: 'NSB',
    nameZh: '全美科学碗',
    category: 'GENERAL_ACADEMIC',
    level: 'NATIONAL',
    tier: 3,
    description: 'Department of Energy sponsored STEM quiz competition.',
  },
  {
    name: 'Quiz Bowl (PACE NSC)',
    abbreviation: 'PACE NSC',
    nameZh: 'PACE全国学术锦标赛',
    category: 'GENERAL_ACADEMIC',
    level: 'NATIONAL',
    tier: 3,
    description: 'National scholastic championship quiz bowl tournament.',
  },

  // ============================================
  // ARTS & MUSIC — Tier 4
  // ============================================
  {
    name: 'YoungArts Foundation',
    abbreviation: 'YoungArts',
    nameZh: 'YoungArts艺术基金会',
    category: 'ARTS_MUSIC',
    level: 'NATIONAL',
    tier: 4,
    description:
      'National foundation identifying and supporting exceptional young artists.',
    website: 'https://www.youngarts.org',
  },
  {
    name: 'US Presidential Scholars in the Arts',
    abbreviation: 'Presidential Scholar Arts',
    nameZh: '美国总统艺术学者',
    category: 'ARTS_MUSIC',
    level: 'NATIONAL',
    tier: 5,
    description:
      'One of the highest honors for high school students in the arts.',
  },
  // ARTS & MUSIC — Tier 3
  {
    name: 'All-National Honor Ensembles',
    abbreviation: 'NAfME All-National',
    nameZh: '全美荣誉乐团',
    category: 'ARTS_MUSIC',
    level: 'NATIONAL',
    tier: 3,
    description:
      'National honor music ensemble selected by the National Association for Music Education.',
  },
  {
    name: 'International Chopin Piano Competition (Junior)',
    abbreviation: 'Chopin Junior',
    nameZh: '国际肖邦钢琴比赛（青少年组）',
    category: 'ARTS_MUSIC',
    level: 'INTERNATIONAL',
    tier: 4,
    description: 'Junior division of the prestigious Chopin piano competition.',
  },
  {
    name: 'Scholastic Art Awards',
    abbreviation: 'Scholastic Art',
    nameZh: 'Scholastic艺术奖',
    category: 'ARTS_MUSIC',
    level: 'NATIONAL',
    tier: 4,
    description: 'National recognition program for student visual art.',
  },
  {
    name: 'All-State Orchestra/Band',
    abbreviation: 'All-State Music',
    nameZh: '州级全明星乐团',
    category: 'ARTS_MUSIC',
    level: 'STATE',
    tier: 2,
    description: 'State-level honor ensemble selection.',
  },

  // ============================================
  // OTHER — Various tiers
  // ============================================
  {
    name: 'US Presidential Scholars Program',
    abbreviation: 'Presidential Scholar',
    nameZh: '美国总统学者奖',
    category: 'OTHER',
    level: 'NATIONAL',
    tier: 5,
    description:
      'One of the highest honors bestowed upon graduating high school seniors.',
  },
  {
    name: 'National Merit Scholarship Program',
    abbreviation: 'NMSQT',
    nameZh: '国家优秀学生奖学金',
    category: 'OTHER',
    level: 'NATIONAL',
    tier: 3,
    description: 'National academic competition based on PSAT/NMSQT scores.',
  },
  {
    name: 'AP Scholar Awards',
    abbreviation: 'AP Scholar',
    nameZh: 'AP学者奖',
    category: 'OTHER',
    level: 'NATIONAL',
    tier: 2,
    description:
      'College Board recognition for exceptional performance on AP exams.',
  },
  {
    name: 'National Honor Society',
    abbreviation: 'NHS',
    nameZh: '全美荣誉学生会',
    category: 'OTHER',
    level: 'NATIONAL',
    tier: 1,
    description:
      'National organization recognizing outstanding high school students.',
  },
  {
    name: 'Eagle Scout',
    abbreviation: 'Eagle Scout',
    nameZh: '鹰级童军',
    category: 'OTHER',
    level: 'NATIONAL',
    tier: 3,
    description: 'Highest achievement in the Boy Scouts of America.',
  },
  {
    name: 'Gold Award (Girl Scouts)',
    abbreviation: 'Gold Award',
    nameZh: '金奖（女童军）',
    category: 'OTHER',
    level: 'NATIONAL',
    tier: 3,
    description: 'Highest achievement in Girl Scouts.',
  },
  {
    name: 'International Linguistics Olympiad',
    abbreviation: 'IOL',
    nameZh: '国际语言学奥林匹克',
    category: 'OTHER',
    level: 'INTERNATIONAL',
    tier: 4,
    description:
      'International linguistics competition for high school students.',
  },
  {
    name: 'National Latin Exam',
    abbreviation: 'NLE',
    nameZh: '全美拉丁语考试',
    category: 'OTHER',
    level: 'NATIONAL',
    tier: 1,
    description: 'Annual Latin language exam taken by over 150,000 students.',
  },
  {
    name: 'International Philosophy Olympiad',
    abbreviation: 'IPO',
    nameZh: '国际哲学奥林匹克',
    category: 'OTHER',
    level: 'INTERNATIONAL',
    tier: 4,
    description: 'International philosophy essay competition.',
  },

  // ============================================
  // CHINESE / INTERNATIONAL ADDITIONS
  // ============================================
  {
    name: 'Yau Science Award',
    abbreviation: 'Yau Science',
    nameZh: '丘成桐科学奖',
    category: 'ENGINEERING_RESEARCH',
    level: 'INTERNATIONAL',
    tier: 4,
    description:
      'Prestigious international science research competition founded by Shing-Tung Yau.',
  },
  {
    name: 'Chinese Mathematical Olympiad',
    abbreviation: 'CMO',
    nameZh: '中国数学奥林匹克',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 4,
    description: 'National mathematics olympiad in China, selecting IMO team.',
  },
  {
    name: 'Chinese Physics Olympiad',
    abbreviation: 'CPhO',
    nameZh: '全国中学生物理竞赛',
    category: 'PHYSICS',
    level: 'NATIONAL',
    tier: 4,
    description: 'National physics olympiad in China, selecting IPhO team.',
  },
  {
    name: 'Chinese Chemistry Olympiad',
    abbreviation: 'CChO',
    nameZh: '中国化学奥林匹克',
    category: 'CHEMISTRY',
    level: 'NATIONAL',
    tier: 4,
    description: 'National chemistry olympiad in China, selecting IChO team.',
  },
  {
    name: 'National Olympiad in Informatics',
    abbreviation: 'NOI',
    nameZh: '全国青少年信息学奥林匹克',
    category: 'COMPUTER_SCIENCE',
    level: 'NATIONAL',
    tier: 4,
    description: 'National informatics olympiad in China, selecting IOI team.',
  },
  {
    name: 'China Thinks Big',
    abbreviation: 'CTB',
    nameZh: 'China Thinks Big 创新研究挑战赛',
    category: 'GENERAL_ACADEMIC',
    level: 'NATIONAL',
    tier: 2,
    description:
      'Interdisciplinary research and innovation challenge for Chinese high school students.',
  },
  {
    name: 'National Economics Challenge China',
    abbreviation: 'NEC China',
    nameZh: '全美经济学挑战中国赛',
    category: 'ECONOMICS_BUSINESS',
    level: 'NATIONAL',
    tier: 2,
    description:
      'China regional competition of the National Economics Challenge.',
  },
  {
    name: 'NSDA China',
    abbreviation: 'NSDA China',
    nameZh: 'NSDA中国演讲与辩论',
    category: 'DEBATE_SPEECH',
    level: 'NATIONAL',
    tier: 3,
    description:
      'China branch of the National Speech and Debate Association, speech and debate competitions.',
  },
  {
    name: 'Business Professionals of America',
    abbreviation: 'BPA',
    nameZh: '美国商业专业协会竞赛',
    category: 'ECONOMICS_BUSINESS',
    level: 'NATIONAL',
    tier: 2,
    description:
      'Career and technical student organization with business competitions.',
  },
  {
    name: 'HOSA China',
    abbreviation: 'HOSA China',
    nameZh: 'HOSA中国健康科学竞赛',
    category: 'OTHER',
    level: 'NATIONAL',
    tier: 2,
    description:
      'China chapter of HOSA-Future Health Professionals, health science competitions.',
  },
  {
    name: 'British Biology Olympiad',
    abbreviation: 'BBO',
    nameZh: '英国生物奥林匹克',
    category: 'BIOLOGY',
    level: 'INTERNATIONAL',
    tier: 3,
    description:
      'UK-based biology olympiad open to international participants.',
  },
  {
    name: 'Physics Bowl China',
    abbreviation: 'Physics Bowl China',
    nameZh: '物理碗中国赛',
    category: 'PHYSICS',
    level: 'NATIONAL',
    tier: 2,
    description: 'China regional Physics Bowl competition organized by AAPT.',
  },
  {
    name: 'UK Mathematics Trust',
    abbreviation: 'UKMT',
    nameZh: '英国数学信托基金会竞赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 2,
    description:
      'UK-based mathematics competition organization with multiple contests.',
  },
  {
    name: 'Euclid Mathematics Contest',
    abbreviation: 'Euclid',
    nameZh: '欧几里得数学竞赛',
    category: 'MATH',
    level: 'NATIONAL',
    tier: 2,
    description:
      'Prestigious mathematics contest by the University of Waterloo, popular for Canadian university admissions.',
  },
  {
    name: 'New Concept Essay Competition',
    abbreviation: '新概念作文',
    nameZh: '全国新概念作文大赛',
    category: 'WRITING_ESSAY',
    level: 'NATIONAL',
    tier: 2,
    description:
      'Influential Chinese creative writing competition for middle and high school students.',
  },
];

async function main() {
  console.log('🏆 Seeding competition database...\n');

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const comp of competitions) {
    try {
      await prisma.competition.upsert({
        where: { abbreviation: comp.abbreviation },
        create: {
          name: comp.name,
          abbreviation: comp.abbreviation,
          nameZh: comp.nameZh,
          category: comp.category,
          level: comp.level,
          tier: comp.tier,
          description: comp.description,
          website: comp.website || null,
        },
        update: {
          name: comp.name,
          nameZh: comp.nameZh,
          category: comp.category,
          level: comp.level,
          tier: comp.tier,
          description: comp.description,
          website: comp.website || null,
        },
      });

      const existing = await prisma.competition.findUnique({
        where: { abbreviation: comp.abbreviation },
      });
      if (existing) {
        updated++;
      } else {
        created++;
      }
    } catch (err: any) {
      console.error(`❌ Failed: ${comp.abbreviation} - ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Done: ${competitions.length} competitions processed`);
  console.log(`   Created/Updated: ${created + updated}, Errors: ${errors}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
