/**
 * 综合种子数据脚本 - 覆盖所有功能模块
 * 创建真实风格的测试数据，用于功能展示和测试
 *
 * 运行: pnpm --filter api ts-node prisma/seed-all-features.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// Helper Functions
// ============================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ============================================
// Section 1: Users with Complete Profiles
// ============================================

interface StudentProfile {
  email: string;
  role: 'USER' | 'VERIFIED' | 'ADMIN';
  profile: {
    realName: string;
    gpa: number;
    gpaScale: number;
    currentSchool: string;
    currentSchoolType: string;
    grade: string;
    targetMajor: string;
    budgetTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNLIMITED';
    visibility: 'PRIVATE' | 'ANONYMOUS' | 'VERIFIED_ONLY';
    regionPref: string[];
    applicationRound: string;
    birthday: Date;
    graduationDate: Date;
    onboardingCompleted: boolean;
  };
  testScores: Array<{
    type: 'SAT' | 'ACT' | 'TOEFL' | 'IELTS' | 'AP' | 'IB';
    score: number;
    subScores?: Record<string, number | string>;
    testDate: Date;
  }>;
  activities: Array<{
    name: string;
    category: string;
    role: string;
    organization?: string;
    description: string;
    hoursPerWeek: number;
    weeksPerYear: number;
    isOngoing: boolean;
  }>;
  awards: Array<{
    name: string;
    level: string;
    year: number;
    description?: string;
  }>;
  education: Array<{
    schoolName: string;
    schoolType: string;
    startDate: Date;
    endDate?: Date;
    gpa?: number;
    gpaScale?: number;
  }>;
  essays: Array<{
    title: string;
    prompt?: string;
    content: string;
    wordCount: number;
  }>;
}

const studentProfiles: StudentProfile[] = [
  {
    email: 'alice.zhang@demo.studyabroad.com',
    role: 'VERIFIED',
    profile: {
      realName: 'Alice Zhang',
      gpa: 3.95,
      gpaScale: 4.0,
      currentSchool: '北京人大附中',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'SENIOR',
      targetMajor: 'Computer Science',
      budgetTier: 'HIGH',
      visibility: 'ANONYMOUS',
      regionPref: ['Northeast', 'West Coast'],
      applicationRound: 'EA',
      birthday: new Date('2007-03-15'),
      graduationDate: new Date('2026-06-15'),
      onboardingCompleted: true,
    },
    testScores: [
      {
        type: 'SAT',
        score: 1560,
        subScores: { math: 800, reading: 760 },
        testDate: new Date('2025-06-01'),
      },
      {
        type: 'TOEFL',
        score: 115,
        subScores: { reading: 30, listening: 29, speaking: 27, writing: 29 },
        testDate: new Date('2025-05-15'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Calculus BC' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Computer Science A' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Physics C: Mechanics' },
        testDate: new Date('2025-05-10'),
      },
    ],
    activities: [
      {
        name: 'AI for Education Research Project',
        category: 'RESEARCH',
        role: 'Lead Researcher',
        organization: '清华大学计算机系',
        description:
          'Led a research project on using machine learning to personalize education content. Published a paper at AAAI workshop.',
        hoursPerWeek: 15,
        weeksPerYear: 40,
        isOngoing: false,
      },
      {
        name: 'School Programming Club',
        category: 'ACADEMIC',
        role: 'President & Founder',
        organization: '人大附中',
        description:
          "Founded the school's first programming club. Organized weekly coding workshops for 80+ students, hackathons, and guest lectures from tech industry professionals.",
        hoursPerWeek: 10,
        weeksPerYear: 36,
        isOngoing: true,
      },
      {
        name: 'Rural Education Volunteer',
        category: 'COMMUNITY_SERVICE',
        role: 'Program Director',
        organization: 'Teach For Rural China',
        description:
          'Developed and delivered computer science curriculum for rural middle school students. Trained 12 volunteer teachers.',
        hoursPerWeek: 8,
        weeksPerYear: 30,
        isOngoing: true,
      },
      {
        name: 'Competitive Programming',
        category: 'ACADEMIC',
        role: 'Team Captain',
        organization: 'RDFZ Competitive Programming Team',
        description:
          'Led the school competitive programming team. Trained team members in algorithms and data structures. Team placed top 10 nationally.',
        hoursPerWeek: 12,
        weeksPerYear: 40,
        isOngoing: true,
      },
    ],
    awards: [
      {
        name: 'USACO Platinum Division',
        level: 'NATIONAL',
        year: 2025,
        description: 'Achieved Platinum level in USA Computing Olympiad',
      },
      {
        name: 'NOIP First Prize',
        level: 'NATIONAL',
        year: 2024,
        description:
          'National Olympiad in Informatics in Provinces - First Prize',
      },
      { name: 'AMC 12 Score 140+', level: 'NATIONAL', year: 2025 },
      {
        name: 'Intel ISEF Finalist',
        level: 'INTERNATIONAL',
        year: 2025,
        description: 'AI for Education project selected as finalist',
      },
    ],
    education: [
      {
        schoolName: '北京人大附中 (RDFZ)',
        schoolType: 'HIGH_SCHOOL',
        startDate: new Date('2022-09-01'),
        gpa: 3.95,
        gpaScale: 4.0,
      },
    ],
    essays: [
      {
        title: 'Common App Essay - The Algorithm of Kindness',
        prompt:
          'Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it.',
        content: `When I was twelve, my grandmother called me "the girl who talks to machines." She wasn't wrong—I had just spent three hours debugging a Python script instead of eating dinner. But what she didn't understand was that I wasn't just talking to machines; I was teaching them to listen.

The turning point came during a summer volunteering trip to Guizhou province. I was supposed to teach basic math to middle schoolers, but I noticed something: the same lesson that took 30 minutes for some students took two hours for others. Not because anyone was less capable, but because everyone learns differently. That night, I stayed up coding a simple adaptive quiz program on my laptop.

The program was primitive—just branching logic and a scoring system—but when Li Wei, a quiet boy who usually stared at his desk during class, got his first perfect score through the adaptive system, something clicked. Not in the code, but in me. I realized that technology isn't just about solving problems; it's about seeing people.

This experience led me to my research project at Tsinghua's CS department, where I developed a machine learning model that personalizes educational content based on learning patterns. The model isn't perfect—no algorithm can capture the full complexity of human learning. But every time I refine it, I think about Li Wei, and all the students who deserve to be seen.

My grandmother now calls me "the girl who teaches machines to be kind." I think she's getting closer.`,
        wordCount: 264,
      },
      {
        title: 'Why MIT - Supplemental Essay',
        prompt:
          'Describe the world you come from and how you, as a product of it, might add to the diversity of the MIT community.',
        content: `I come from a world where ancient philosophy meets artificial intelligence. Growing up in Beijing, I sat at dinner tables where my grandfather quoted Confucius about education while I explained neural networks on my laptop. This intersection—between 5,000 years of wisdom about how people learn and cutting-edge technology that can scale that learning—defines my perspective.

At MIT, I want to bring this perspective to the Computer Science and Artificial Intelligence Laboratory (CSAIL). Professor Regina Barzilay's work on AI applications fascinates me because it embodies what I believe: that the most powerful technology serves the most human needs. I want to contribute to research that makes AI not just smarter, but more equitable.

Beyond the lab, I'd bring my experience running coding workshops for underserved communities to MIT's EECS community. I believe that the best engineers are also the best teachers—and at MIT, I hope to both learn and teach.`,
        wordCount: 168,
      },
    ],
  },
  {
    email: 'brian.wang@demo.studyabroad.com',
    role: 'VERIFIED',
    profile: {
      realName: 'Brian Wang',
      gpa: 3.88,
      gpaScale: 4.0,
      currentSchool: 'Phillips Academy Andover',
      currentSchoolType: 'PRIVATE_US',
      grade: 'SENIOR',
      targetMajor: 'Economics',
      budgetTier: 'UNLIMITED',
      visibility: 'VERIFIED_ONLY',
      regionPref: ['Northeast'],
      applicationRound: 'ED',
      birthday: new Date('2007-08-22'),
      graduationDate: new Date('2026-06-01'),
      onboardingCompleted: true,
    },
    testScores: [
      {
        type: 'SAT',
        score: 1540,
        subScores: { math: 780, reading: 760 },
        testDate: new Date('2025-03-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Macroeconomics' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Microeconomics' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Statistics' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 4,
        subScores: { subject: 'US History' },
        testDate: new Date('2025-05-10'),
      },
    ],
    activities: [
      {
        name: 'Student Investment Fund',
        category: 'LEADERSHIP',
        role: 'Portfolio Manager',
        organization: 'Phillips Academy',
        description:
          'Managed a $50,000 real student investment fund. Achieved 18% annual return through value investing strategy. Led weekly market analysis presentations.',
        hoursPerWeek: 10,
        weeksPerYear: 36,
        isOngoing: true,
      },
      {
        name: 'Economics Research Assistant',
        category: 'RESEARCH',
        role: 'Research Assistant',
        organization: 'Harvard Kennedy School',
        description:
          'Assisted Professor in research on wealth inequality in East Asia. Conducted data analysis using R and Stata. Co-authored a working paper.',
        hoursPerWeek: 12,
        weeksPerYear: 10,
        isOngoing: false,
      },
      {
        name: 'Debate Team',
        category: 'ACADEMIC',
        role: 'Captain',
        organization: 'Phillips Academy Debate Society',
        description:
          'Led the debate team to 3rd place at national tournament. Organized inter-school debate competitions.',
        hoursPerWeek: 8,
        weeksPerYear: 36,
        isOngoing: true,
      },
      {
        name: 'Financial Literacy Program',
        category: 'COMMUNITY_SERVICE',
        role: 'Founder',
        description:
          'Created a financial literacy program for local public school students. Taught basic budgeting, saving, and investing concepts to 200+ students.',
        hoursPerWeek: 5,
        weeksPerYear: 30,
        isOngoing: true,
      },
    ],
    awards: [
      {
        name: 'National Economics Challenge - Gold',
        level: 'NATIONAL',
        year: 2025,
      },
      {
        name: 'NSDA National Tournament - Quarterfinalist',
        level: 'NATIONAL',
        year: 2025,
      },
      { name: 'National Merit Scholar', level: 'NATIONAL', year: 2025 },
      { name: 'Yale Book Award', level: 'SCHOOL', year: 2024 },
    ],
    education: [
      {
        schoolName: 'Phillips Academy Andover',
        schoolType: 'HIGH_SCHOOL',
        startDate: new Date('2022-09-01'),
        gpa: 3.88,
        gpaScale: 4.0,
      },
    ],
    essays: [
      {
        title: 'Common App Essay - The Invisible Hand of My Kitchen',
        prompt:
          'Reflect on something that someone has done for you that has made you happy or thankful in a surprising way.',
        content: `Every Sunday, my mother makes dumplings. Not because anyone asks her to, but because, as she says, "a family that folds dumplings together stays together." For years, I took this ritual for granted—until an economics class changed my perspective.

We were studying Adam Smith's theory of the invisible hand, and something clicked: my mother's dumpling Sundays were a perfect micro-economy. She allocated resources (flour, filling, time), organized labor (my father rolls, I fold, my sister crimps), and created surplus value (leftovers for Monday lunch). But unlike Smith's self-interested actors, my mother's economy ran on something different: love.

This realization sparked my interest in behavioral economics—the study of why people don't always act in their rational self-interest. I began reading Kahneman and Thaler, fascinated by how emotions, traditions, and social bonds shape economic decisions. My research at Harvard Kennedy School deepened this fascination: I discovered that in East Asian economies, family-based economic units consistently outperform individual-optimizing models.

Economics, I've learned, isn't just about markets and money. It's about understanding why my mother makes dumplings every Sunday, and why that matters for how we build a better world.`,
        wordCount: 207,
      },
    ],
  },
  {
    email: 'chloe.li@demo.studyabroad.com',
    role: 'USER',
    profile: {
      realName: 'Chloe Li',
      gpa: 3.78,
      gpaScale: 4.0,
      currentSchool: '上海世界外国语中学',
      currentSchoolType: 'INTERNATIONAL',
      grade: 'JUNIOR',
      targetMajor: 'Biology / Pre-Med',
      budgetTier: 'MEDIUM',
      visibility: 'ANONYMOUS',
      regionPref: ['Northeast', 'Southeast'],
      applicationRound: 'RD',
      birthday: new Date('2008-01-10'),
      graduationDate: new Date('2027-06-15'),
      onboardingCompleted: true,
    },
    testScores: [
      {
        type: 'SAT',
        score: 1490,
        subScores: { math: 770, reading: 720 },
        testDate: new Date('2025-10-05'),
      },
      {
        type: 'TOEFL',
        score: 108,
        subScores: { reading: 28, listening: 28, speaking: 24, writing: 28 },
        testDate: new Date('2025-09-15'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Biology' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 4,
        subScores: { subject: 'Chemistry' },
        testDate: new Date('2025-05-10'),
      },
    ],
    activities: [
      {
        name: 'Cancer Research Internship',
        category: 'RESEARCH',
        role: 'Research Intern',
        organization: '上海交通大学医学院',
        description:
          'Studied the role of microRNA in breast cancer metastasis under Dr. Chen. Learned cell culture, PCR, and Western blot techniques.',
        hoursPerWeek: 20,
        weeksPerYear: 8,
        isOngoing: false,
      },
      {
        name: 'Hospital Volunteer',
        category: 'COMMUNITY_SERVICE',
        role: 'Patient Care Volunteer',
        organization: '上海华山医院',
        description:
          'Volunteered in the pediatric ward, organizing activities and providing emotional support to young patients.',
        hoursPerWeek: 6,
        weeksPerYear: 40,
        isOngoing: true,
      },
      {
        name: 'Biology Olympiad',
        category: 'ACADEMIC',
        role: 'Team Member',
        organization: 'School Biology Olympiad Team',
        description:
          'Prepared for and competed in USABO. Studied advanced molecular biology, genetics, and ecology.',
        hoursPerWeek: 8,
        weeksPerYear: 30,
        isOngoing: true,
      },
    ],
    awards: [
      { name: 'USABO Semifinalist', level: 'NATIONAL', year: 2025 },
      { name: 'iGEM Gold Medal', level: 'INTERNATIONAL', year: 2024 },
      { name: 'Brain Bee Regional Champion', level: 'REGIONAL', year: 2024 },
    ],
    education: [
      {
        schoolName: '上海世界外国语中学 (WFLA)',
        schoolType: 'HIGH_SCHOOL',
        startDate: new Date('2023-09-01'),
        gpa: 3.78,
        gpaScale: 4.0,
      },
    ],
    essays: [
      {
        title: 'Personal Statement Draft - Through the Microscope',
        prompt:
          'The lessons we take from obstacles we encounter can be fundamental to later success.',
        content: `The first time I looked through a microscope in Dr. Chen's lab, I saw chaos. Cells multiplied without order, their boundaries blurred, their purpose unclear. I was looking at cancer—and I was terrified.

I had always been the science girl who loved neat answers: balanced equations, Punnett squares, the elegant simplicity of DNA's double helix. But cancer doesn't follow rules. It corrupts the very mechanisms that sustain life. That summer at Shanghai Jiao Tong University's medical school, I learned that the most important scientific questions are the ones that resist easy answers.

My project focused on microRNA-21's role in breast cancer metastasis. Weeks of failed PCR experiments taught me patience. A contaminated cell culture taught me humility. But the moment I finally visualized the expression patterns we predicted—that taught me hope. In the chaos of cancer cells, I found order. Not perfect order, but the kind that comes from asking better questions.

This experience transformed my understanding of medicine. Health isn't the absence of disorder—it's the resilience to face it. And that's what I want to spend my life studying.`,
        wordCount: 195,
      },
    ],
  },
  {
    email: 'david.chen@demo.studyabroad.com',
    role: 'VERIFIED',
    profile: {
      realName: 'David Chen',
      gpa: 3.92,
      gpaScale: 4.0,
      currentSchool: 'Thomas Jefferson High School for Science and Technology',
      currentSchoolType: 'PUBLIC_US',
      grade: 'SENIOR',
      targetMajor: 'Electrical Engineering',
      budgetTier: 'HIGH',
      visibility: 'VERIFIED_ONLY',
      regionPref: ['West Coast', 'Northeast'],
      applicationRound: 'EA',
      birthday: new Date('2007-11-05'),
      graduationDate: new Date('2026-06-01'),
      onboardingCompleted: true,
    },
    testScores: [
      {
        type: 'SAT',
        score: 1580,
        subScores: { math: 800, reading: 780 },
        testDate: new Date('2025-08-25'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Physics C: E&M' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Physics C: Mechanics' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Calculus BC' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Computer Science A' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Chemistry' },
        testDate: new Date('2025-05-10'),
      },
    ],
    activities: [
      {
        name: 'Robotics Team - FIRST Robotics Competition',
        category: 'ACADEMIC',
        role: 'Lead Engineer & Team Captain',
        organization: 'TJ FIRST Robotics Team #1418',
        description:
          'Led a team of 30 in designing and building competition robots. Managed $15,000 budget. Robot won regional engineering excellence award.',
        hoursPerWeek: 20,
        weeksPerYear: 30,
        isOngoing: true,
      },
      {
        name: 'Solar Car Project',
        category: 'RESEARCH',
        role: 'Chief Engineer',
        organization: 'TJ Solar Car Team',
        description:
          'Designed the electrical system for a solar-powered vehicle. Managed power distribution, battery management, and motor control systems.',
        hoursPerWeek: 12,
        weeksPerYear: 40,
        isOngoing: true,
      },
      {
        name: 'Varsity Cross Country',
        category: 'ATHLETICS',
        role: 'Runner',
        organization: 'TJ Cross Country Team',
        description:
          'Competed at varsity level. Personal best 5K: 17:30. Qualified for state championship.',
        hoursPerWeek: 10,
        weeksPerYear: 20,
        isOngoing: true,
      },
    ],
    awards: [
      {
        name: 'FIRST Robotics - Engineering Excellence Award',
        level: 'REGIONAL',
        year: 2025,
      },
      {
        name: 'Science Olympiad - 1st Place Circuit Lab',
        level: 'STATE',
        year: 2025,
      },
      { name: 'AIME Qualifier', level: 'NATIONAL', year: 2025 },
      { name: 'AP Scholar with Distinction', level: 'NATIONAL', year: 2025 },
    ],
    education: [
      {
        schoolName: 'Thomas Jefferson High School for Science and Technology',
        schoolType: 'HIGH_SCHOOL',
        startDate: new Date('2022-09-01'),
        gpa: 3.92,
        gpaScale: 4.0,
      },
    ],
    essays: [
      {
        title: 'Stanford Short Essay - What matters to you?',
        prompt: 'What matters to you, and why?',
        content: `Bridges matter to me. Not the Golden Gate or Brooklyn kind—though those are impressive—but the invisible bridges between disciplines.

In robotics, I learned that the best robots aren't built by the best programmers or the best mechanical engineers alone. They're built by teams that bridge specialties. When our robot's arm kept failing, it wasn't a programming fix or a mechanical fix—it was understanding how software and hardware needed to communicate differently.

This insight extends beyond robotics. The world's hardest problems—climate change, healthcare access, education equity—sit at the intersection of multiple disciplines. Engineering alone can't solve them. Neither can policy, economics, or design. But bridges between them can.

That's why I want to study Electrical Engineering with a focus on sustainable energy systems. I want to build the literal bridges that connect renewable energy to communities, and the figurative bridges that connect engineers to the people they serve.`,
        wordCount: 169,
      },
    ],
  },
  {
    email: 'emily.liu@demo.studyabroad.com',
    role: 'USER',
    profile: {
      realName: 'Emily Liu',
      gpa: 3.7,
      gpaScale: 4.0,
      currentSchool: '深圳中学',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'JUNIOR',
      targetMajor: 'Psychology',
      budgetTier: 'MEDIUM',
      visibility: 'ANONYMOUS',
      regionPref: ['West Coast', 'Midwest'],
      applicationRound: 'RD',
      birthday: new Date('2008-05-20'),
      graduationDate: new Date('2027-06-15'),
      onboardingCompleted: true,
    },
    testScores: [
      {
        type: 'SAT',
        score: 1450,
        subScores: { math: 720, reading: 730 },
        testDate: new Date('2025-12-01'),
      },
      {
        type: 'TOEFL',
        score: 105,
        subScores: { reading: 27, listening: 28, speaking: 23, writing: 27 },
        testDate: new Date('2025-11-15'),
      },
    ],
    activities: [
      {
        name: 'Peer Counseling Program',
        category: 'COMMUNITY_SERVICE',
        role: 'Lead Counselor',
        organization: '深圳中学',
        description:
          'Founded a peer counseling program providing mental health support to fellow students. Trained 15 peer counselors.',
        hoursPerWeek: 8,
        weeksPerYear: 36,
        isOngoing: true,
      },
      {
        name: 'Psychology Blog',
        category: 'ACADEMIC',
        role: 'Writer & Editor',
        description:
          'Created a bilingual blog exploring psychology concepts through everyday life. 10,000+ monthly readers.',
        hoursPerWeek: 6,
        weeksPerYear: 50,
        isOngoing: true,
      },
      {
        name: 'Drama Club',
        category: 'ARTS',
        role: 'Director',
        organization: '深圳中学戏剧社',
        description:
          'Directed two original plays exploring mental health themes. Performances reached 500+ audience members.',
        hoursPerWeek: 8,
        weeksPerYear: 30,
        isOngoing: true,
      },
    ],
    awards: [
      {
        name: 'John Locke Essay Competition - Commendation',
        level: 'INTERNATIONAL',
        year: 2025,
      },
      {
        name: 'Psychology Essay Contest - 1st Place',
        level: 'REGIONAL',
        year: 2024,
      },
    ],
    education: [
      {
        schoolName: '深圳中学 (Shenzhen High School)',
        schoolType: 'HIGH_SCHOOL',
        startDate: new Date('2023-09-01'),
        gpa: 3.7,
        gpaScale: 4.0,
      },
    ],
    essays: [],
  },
  {
    email: 'frank.zhao@demo.studyabroad.com',
    role: 'VERIFIED',
    profile: {
      realName: 'Frank Zhao',
      gpa: 3.99,
      gpaScale: 4.0,
      currentSchool: 'The Lawrenceville School',
      currentSchoolType: 'PRIVATE_US',
      grade: 'SENIOR',
      targetMajor: 'Mathematics',
      budgetTier: 'UNLIMITED',
      visibility: 'VERIFIED_ONLY',
      regionPref: ['Northeast'],
      applicationRound: 'ED',
      birthday: new Date('2007-04-12'),
      graduationDate: new Date('2026-06-01'),
      onboardingCompleted: true,
    },
    testScores: [
      {
        type: 'SAT',
        score: 1590,
        subScores: { math: 800, reading: 790 },
        testDate: new Date('2025-03-01'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Calculus BC' },
        testDate: new Date('2024-05-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Statistics' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Physics C: Mechanics' },
        testDate: new Date('2025-05-10'),
      },
    ],
    activities: [
      {
        name: 'Math Olympiad Training',
        category: 'ACADEMIC',
        role: 'Member',
        organization: 'USAMO Training Program',
        description:
          'Selected for the national math olympiad training program. Studied advanced topics in number theory, combinatorics, and geometry.',
        hoursPerWeek: 15,
        weeksPerYear: 40,
        isOngoing: true,
      },
      {
        name: 'Math Tutoring Center',
        category: 'COMMUNITY_SERVICE',
        role: 'Founder & Head Tutor',
        organization: 'Lawrenceville Math Help',
        description:
          'Founded a free tutoring center for local public school students struggling with math. Served 100+ students.',
        hoursPerWeek: 6,
        weeksPerYear: 36,
        isOngoing: true,
      },
    ],
    awards: [
      {
        name: 'USAMO Qualifier',
        level: 'NATIONAL',
        year: 2025,
        description: 'Top 250 in the nation',
      },
      {
        name: 'MATHCOUNTS National Competition - 3rd Place',
        level: 'NATIONAL',
        year: 2022,
      },
      { name: 'AMC 12 Perfect Score', level: 'NATIONAL', year: 2025 },
      { name: 'AIME Score 13', level: 'NATIONAL', year: 2025 },
      {
        name: 'HMMT (Harvard-MIT Math Tournament) - Individual Top 20',
        level: 'NATIONAL',
        year: 2025,
      },
    ],
    education: [
      {
        schoolName: 'The Lawrenceville School',
        schoolType: 'HIGH_SCHOOL',
        startDate: new Date('2022-09-01'),
        gpa: 3.99,
        gpaScale: 4.0,
      },
    ],
    essays: [
      {
        title: 'Princeton Supplemental - What brings you joy?',
        prompt:
          'Princeton has a longstanding commitment to service and civic engagement. Tell us how your story intersects with these ideals.',
        content: `Joy, for me, lives in the moment a proof clicks—when disparate ideas suddenly align into an elegant chain of logic. But the deepest joy comes from watching someone else experience that same click.

Every Tuesday afternoon, I sit in a community center in Trenton, across from a student named Marcus who used to say he "hated math." We started with multiplication tables. Last month, he solved his first algebra problem independently. The look on his face—surprise, then pride, then hunger for the next challenge—was more beautiful than any theorem I've encountered.

Mathematics has taught me that the shortest distance between two points is a straight line. But teaching has taught me that sometimes the most meaningful path is the one that takes detours—through confusion, frustration, and eventually, understanding.

At Princeton, I want to continue this journey through the Math department's undergraduate research program and by expanding my tutoring work in the Trenton community. Because math isn't just about solving problems—it's about connecting people to the joy of thinking clearly.`,
        wordCount: 185,
      },
    ],
  },
  {
    email: 'grace.wu@demo.studyabroad.com',
    role: 'USER',
    profile: {
      realName: 'Grace Wu',
      gpa: 3.82,
      gpaScale: 4.0,
      currentSchool: '成都七中国际部',
      currentSchoolType: 'INTERNATIONAL',
      grade: 'SENIOR',
      targetMajor: 'Environmental Science',
      budgetTier: 'MEDIUM',
      visibility: 'ANONYMOUS',
      regionPref: ['West Coast', 'Northeast'],
      applicationRound: 'EA',
      birthday: new Date('2007-07-08'),
      graduationDate: new Date('2026-06-15'),
      onboardingCompleted: true,
    },
    testScores: [
      {
        type: 'ACT',
        score: 34,
        subScores: { english: 35, math: 34, reading: 33, science: 34 },
        testDate: new Date('2025-09-10'),
      },
      {
        type: 'TOEFL',
        score: 110,
        subScores: { reading: 29, listening: 28, speaking: 25, writing: 28 },
        testDate: new Date('2025-08-20'),
      },
      {
        type: 'AP',
        score: 5,
        subScores: { subject: 'Environmental Science' },
        testDate: new Date('2025-05-10'),
      },
      {
        type: 'AP',
        score: 4,
        subScores: { subject: 'Biology' },
        testDate: new Date('2025-05-10'),
      },
    ],
    activities: [
      {
        name: 'River Conservation Project',
        category: 'COMMUNITY_SERVICE',
        role: 'Project Leader',
        organization: 'Green Chengdu Initiative',
        description:
          'Led a team of 20 volunteers in a year-long project to monitor and improve water quality in the Jin River. Collected samples, analyzed data, and presented findings to local government.',
        hoursPerWeek: 10,
        weeksPerYear: 48,
        isOngoing: true,
      },
      {
        name: 'Environmental Documentary',
        category: 'ARTS',
        role: 'Director & Filmmaker',
        description:
          'Produced a 30-minute documentary about air pollution in Sichuan province. Screened at 3 film festivals and won audience choice award.',
        hoursPerWeek: 15,
        weeksPerYear: 20,
        isOngoing: false,
      },
      {
        name: 'School Sustainability Committee',
        category: 'LEADERSHIP',
        role: 'Chair',
        organization: '成都七中',
        description:
          "Led initiatives to reduce school's carbon footprint by 15%. Implemented recycling program, solar panel proposal, and meatless Monday campaign.",
        hoursPerWeek: 5,
        weeksPerYear: 40,
        isOngoing: true,
      },
    ],
    awards: [
      {
        name: 'Envirothon National Competition - 2nd Place',
        level: 'NATIONAL',
        year: 2025,
      },
      { name: 'Youth Environmental Film Award', level: 'REGIONAL', year: 2024 },
      {
        name: 'Sichuan Province Science Innovation Award',
        level: 'STATE',
        year: 2024,
      },
    ],
    education: [
      {
        schoolName: '成都七中国际部 (Chengdu No.7 High School)',
        schoolType: 'HIGH_SCHOOL',
        startDate: new Date('2022-09-01'),
        gpa: 3.82,
        gpaScale: 4.0,
      },
    ],
    essays: [],
  },
  {
    email: 'henry.sun@demo.studyabroad.com',
    role: 'USER',
    profile: {
      realName: 'Henry Sun',
      gpa: 3.65,
      gpaScale: 4.0,
      currentSchool: '南京外国语学校',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'JUNIOR',
      targetMajor: 'Business / Finance',
      budgetTier: 'HIGH',
      visibility: 'PRIVATE',
      regionPref: ['Northeast', 'Southeast'],
      applicationRound: 'ED',
      birthday: new Date('2008-09-18'),
      graduationDate: new Date('2027-06-15'),
      onboardingCompleted: false,
    },
    testScores: [
      {
        type: 'SAT',
        score: 1480,
        subScores: { math: 760, reading: 720 },
        testDate: new Date('2026-01-15'),
      },
      {
        type: 'TOEFL',
        score: 103,
        subScores: { reading: 26, listening: 27, speaking: 23, writing: 27 },
        testDate: new Date('2025-12-10'),
      },
    ],
    activities: [
      {
        name: 'Student Startup - Campus Marketplace App',
        category: 'LEADERSHIP',
        role: 'CEO & Co-Founder',
        description:
          'Co-founded a mobile app for campus second-hand marketplace. Grew to 3,000+ active users across 5 schools. Generated revenue through premium listings.',
        hoursPerWeek: 15,
        weeksPerYear: 50,
        isOngoing: true,
      },
      {
        name: 'Model United Nations',
        category: 'ACADEMIC',
        role: 'Secretary General',
        organization: '南外MUN',
        description:
          "Organized the school's annual MUN conference with 500+ delegates from 30 schools. Managed a team of 25 organizers.",
        hoursPerWeek: 8,
        weeksPerYear: 36,
        isOngoing: true,
      },
    ],
    awards: [
      {
        name: 'Diamond Challenge Business Plan - Finalist',
        level: 'INTERNATIONAL',
        year: 2025,
      },
      { name: 'Best Delegate - Beijing HMUN', level: 'REGIONAL', year: 2024 },
    ],
    education: [
      {
        schoolName: '南京外国语学校 (Nanjing Foreign Language School)',
        schoolType: 'HIGH_SCHOOL',
        startDate: new Date('2023-09-01'),
        gpa: 3.65,
        gpaScale: 4.0,
      },
    ],
    essays: [],
  },
];

// ============================================
// Section 2: Admission Cases
// ============================================

interface CaseData {
  schoolName: string;
  year: number;
  round: string;
  result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
  major: string;
  gpaRange: string;
  satRange: string;
  toeflRange?: string;
  tags: string[];
  visibility: 'PRIVATE' | 'ANONYMOUS' | 'VERIFIED_ONLY';
  essayType?: 'COMMON_APP' | 'SUPPLEMENTAL' | 'WHY_SCHOOL' | 'UC' | 'OTHER';
  essayPrompt?: string;
  essayContent?: string;
}

const admissionCases: CaseData[] = [
  {
    schoolName: 'Massachusetts Institute of Technology',
    year: 2025,
    round: 'EA',
    result: 'ADMITTED',
    major: 'Computer Science',
    gpaRange: '3.9-4.0',
    satRange: '1550-1600',
    toeflRange: '112-120',
    tags: ['research', 'olympiad', 'strong_stem'],
    visibility: 'ANONYMOUS',
    essayType: 'SUPPLEMENTAL',
    essayPrompt:
      'Tell us about something you do simply for the pleasure of it.',
    essayContent: `I collect error messages. Not physically—digitally, in a spreadsheet with columns for the message, the context, and my emotional state when I encountered it. "Segmentation fault (core dumped)" elicits a visceral groan. "TypeError: 'NoneType' object is not iterable" brings a wry smile—we've met before.

This started as a debugging habit but became something more: a chronicle of every problem I've failed to solve on the first try. Each error message is a breadcrumb marking where I went wrong, and reviewing them reveals patterns in my thinking—assumptions I make, edges I miss, the gap between what I intended and what I actually wrote.

My friends think this is obsessive. Maybe it is. But there's a strange joy in cataloguing failure. Each error message is evidence that I tried something, and in the aggregate, they tell a story of growth. My error messages from two years ago are basic—syntax errors, misplaced brackets. Now they're more interesting: race conditions, memory leaks, algorithmic edge cases. I'm failing at harder problems, and that feels like progress.`,
  },
  {
    schoolName: 'Harvard University',
    year: 2025,
    round: 'RD',
    result: 'REJECTED',
    major: 'Economics',
    gpaRange: '3.8-3.9',
    satRange: '1530-1560',
    tags: ['business', 'debate', 'leadership'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'Stanford University',
    year: 2025,
    round: 'REA',
    result: 'ADMITTED',
    major: 'Electrical Engineering',
    gpaRange: '3.9-4.0',
    satRange: '1570-1600',
    tags: ['robotics', 'research', 'athlete'],
    visibility: 'VERIFIED_ONLY',
    essayType: 'SUPPLEMENTAL',
    essayPrompt:
      'What is the most significant challenge that society faces today?',
    essayContent: `The most significant challenge isn't a single problem—it's our inability to see problems as interconnected. We treat climate change as an environmental issue, poverty as an economic issue, and mental health as a medical issue. But they're all threads in the same fabric.

During my work with the solar car team, I learned this firsthand. Building a solar vehicle isn't just an engineering challenge—it's about materials science, thermodynamics, economics (can we actually manufacture this?), and policy (what regulations affect solar vehicle testing?). The best engineers I've worked with are the ones who see these connections.

I believe the biggest challenge facing society is fragmented thinking. And the solution starts with education that values breadth alongside depth—which is exactly what Stanford's interdisciplinary approach offers.`,
  },
  {
    schoolName: 'Princeton University',
    year: 2025,
    round: 'REA',
    result: 'ADMITTED',
    major: 'Mathematics',
    gpaRange: '3.95-4.0',
    satRange: '1580-1600',
    tags: ['math_olympiad', 'tutoring', 'strong_stem'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'Yale University',
    year: 2025,
    round: 'REA',
    result: 'ADMITTED',
    major: 'Political Science',
    gpaRange: '3.85-3.95',
    satRange: '1520-1560',
    tags: ['debate', 'mun', 'writing'],
    visibility: 'ANONYMOUS',
    essayType: 'WHY_SCHOOL',
    essayPrompt: 'Why does Yale appeal to you?',
    essayContent: `Yale appeals to me because of its residential college system—the idea that intellectual community isn't just what happens in classrooms, but in late-night conversations, dining hall debates, and the spontaneous connections that arise when diverse thinkers share a home.

At Yale, I'm drawn to the Ethics, Politics, and Economics major, which mirrors my belief that these fields shouldn't be studied in isolation. Professor Shapiro's work on democratic theory directly connects to my Model UN experience and my interest in understanding how institutions shape collective decision-making.

But beyond academics, I want Yale for its commitment to public service. Through the Yale Law School's policy clinic and organizations like the Roosevelt Institute, I see opportunities to bridge my academic interests with real-world impact.`,
  },
  {
    schoolName: 'University of Pennsylvania',
    year: 2025,
    round: 'ED',
    result: 'ADMITTED',
    major: 'Finance (Wharton)',
    gpaRange: '3.8-3.9',
    satRange: '1540-1570',
    tags: ['business', 'startup', 'leadership'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'Duke University',
    year: 2025,
    round: 'ED',
    result: 'ADMITTED',
    major: 'Biology',
    gpaRange: '3.75-3.85',
    satRange: '1480-1520',
    toeflRange: '108-115',
    tags: ['research', 'pre_med', 'community_service'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'Columbia University',
    year: 2025,
    round: 'ED',
    result: 'DEFERRED',
    major: 'Computer Science',
    gpaRange: '3.85-3.95',
    satRange: '1530-1560',
    tags: ['research', 'startup'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'University of California, Berkeley',
    year: 2025,
    round: 'RD',
    result: 'ADMITTED',
    major: 'Environmental Science',
    gpaRange: '3.8-3.9',
    satRange: '1450-1500',
    toeflRange: '108-115',
    tags: ['environmental', 'research', 'film'],
    visibility: 'ANONYMOUS',
    essayType: 'UC',
    essayPrompt:
      'Describe an example of your leadership experience in which you have positively influenced others.',
    essayContent: `When I proposed "Meatless Monday" to our school cafeteria, the response was immediate—and negative. "You want to take away our meat?" a classmate protested. I realized that environmental advocacy without empathy is just lecturing.

Instead of pushing harder, I listened. Through conversations with students and cafeteria staff, I learned that food is cultural, emotional, personal. My classmate wasn't anti-environment; she was defending her lunch.

So I changed approach. Instead of "Meatless Monday," we created "Global Flavors Monday"—featuring delicious plant-based dishes from around the world. The framing shifted from sacrifice to adventure. Within a month, 60% of students voluntarily chose the plant-based option.

This taught me that leadership isn't about having the right answer. It's about creating the conditions where people want to participate in the solution.`,
  },
  {
    schoolName: 'University of California, Los Angeles',
    year: 2025,
    round: 'RD',
    result: 'ADMITTED',
    major: 'Psychology',
    gpaRange: '3.65-3.75',
    satRange: '1440-1470',
    toeflRange: '103-108',
    tags: ['counseling', 'drama', 'community_service'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'Carnegie Mellon University',
    year: 2025,
    round: 'ED',
    result: 'ADMITTED',
    major: 'Computer Science',
    gpaRange: '3.9-4.0',
    satRange: '1560-1600',
    tags: ['competitive_programming', 'research', 'strong_stem'],
    visibility: 'VERIFIED_ONLY',
  },
  {
    schoolName: 'Northwestern University',
    year: 2025,
    round: 'ED',
    result: 'ADMITTED',
    major: 'Economics',
    gpaRange: '3.85-3.95',
    satRange: '1520-1550',
    tags: ['investment', 'debate', 'leadership'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'Rice University',
    year: 2025,
    round: 'ED',
    result: 'ADMITTED',
    major: 'Bioengineering',
    gpaRange: '3.8-3.9',
    satRange: '1500-1540',
    tags: ['research', 'stem', 'community_service'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'New York University',
    year: 2025,
    round: 'ED',
    result: 'ADMITTED',
    major: 'Business (Stern)',
    gpaRange: '3.6-3.7',
    satRange: '1470-1500',
    toeflRange: '100-108',
    tags: ['business', 'startup', 'mun'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'University of Michigan, Ann Arbor',
    year: 2025,
    round: 'EA',
    result: 'ADMITTED',
    major: 'Computer Science',
    gpaRange: '3.85-3.95',
    satRange: '1520-1560',
    tags: ['research', 'robotics'],
    visibility: 'ANONYMOUS',
  },
  // More diverse results - rejections, deferrals, waitlists
  {
    schoolName: 'Stanford University',
    year: 2025,
    round: 'RD',
    result: 'REJECTED',
    major: 'Computer Science',
    gpaRange: '3.85-3.95',
    satRange: '1520-1560',
    toeflRange: '110-115',
    tags: ['research', 'competitive_programming'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'Princeton University',
    year: 2025,
    round: 'REA',
    result: 'DEFERRED',
    major: 'Economics',
    gpaRange: '3.8-3.9',
    satRange: '1530-1560',
    tags: ['business', 'debate'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'Yale University',
    year: 2025,
    round: 'RD',
    result: 'WAITLISTED',
    major: 'Environmental Science',
    gpaRange: '3.8-3.9',
    satRange: '1450-1500',
    toeflRange: '108-112',
    tags: ['environmental', 'research', 'community_service'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'Brown University',
    year: 2025,
    round: 'ED',
    result: 'REJECTED',
    major: 'Psychology',
    gpaRange: '3.65-3.75',
    satRange: '1440-1470',
    toeflRange: '103-108',
    tags: ['counseling', 'drama'],
    visibility: 'ANONYMOUS',
  },
  {
    schoolName: 'Cornell University',
    year: 2025,
    round: 'ED',
    result: 'DEFERRED',
    major: 'Business',
    gpaRange: '3.6-3.7',
    satRange: '1470-1500',
    toeflRange: '100-105',
    tags: ['startup', 'mun', 'leadership'],
    visibility: 'ANONYMOUS',
  },
];

// ============================================
// Section 3: Global Events (2025-2026)
// ============================================

const globalEvents = [
  // SAT Tests
  {
    title: 'SAT Test Date',
    titleZh: 'SAT 考试',
    category: 'TEST',
    eventDate: '2026-03-14',
    registrationDeadline: '2026-02-14',
    resultDate: '2026-03-28',
    year: 2026,
  },
  {
    title: 'SAT Test Date',
    titleZh: 'SAT 考试',
    category: 'TEST',
    eventDate: '2026-05-02',
    registrationDeadline: '2026-04-03',
    resultDate: '2026-05-16',
    year: 2026,
  },
  {
    title: 'SAT Test Date',
    titleZh: 'SAT 考试',
    category: 'TEST',
    eventDate: '2026-06-06',
    registrationDeadline: '2026-05-08',
    resultDate: '2026-06-20',
    year: 2026,
  },
  // ACT Tests
  {
    title: 'ACT Test Date',
    titleZh: 'ACT 考试',
    category: 'TEST',
    eventDate: '2026-02-07',
    registrationDeadline: '2026-01-10',
    resultDate: '2026-02-21',
    year: 2026,
  },
  {
    title: 'ACT Test Date',
    titleZh: 'ACT 考试',
    category: 'TEST',
    eventDate: '2026-04-04',
    registrationDeadline: '2026-03-06',
    resultDate: '2026-04-18',
    year: 2026,
  },
  // TOEFL
  {
    title: 'TOEFL iBT Test',
    titleZh: 'TOEFL 考试（多场）',
    category: 'TEST',
    eventDate: '2026-03-07',
    registrationDeadline: '2026-02-21',
    resultDate: '2026-03-17',
    year: 2026,
  },
  {
    title: 'TOEFL iBT Test',
    titleZh: 'TOEFL 考试（多场）',
    category: 'TEST',
    eventDate: '2026-04-18',
    registrationDeadline: '2026-04-03',
    resultDate: '2026-04-28',
    year: 2026,
  },
  // Competitions
  {
    title: 'AMC 10/12 A',
    titleZh: 'AMC 10/12 A 卷',
    category: 'COMPETITION',
    eventDate: '2025-11-06',
    registrationDeadline: '2025-10-15',
    year: 2025,
  },
  {
    title: 'AMC 10/12 B',
    titleZh: 'AMC 10/12 B 卷',
    category: 'COMPETITION',
    eventDate: '2025-11-12',
    registrationDeadline: '2025-10-15',
    year: 2025,
  },
  {
    title: 'AIME I',
    titleZh: 'AIME I 美国数学邀请赛',
    category: 'COMPETITION',
    eventDate: '2026-02-04',
    year: 2026,
  },
  {
    title: 'USABO Open Exam',
    titleZh: 'USABO 美国生物奥赛公开赛',
    category: 'COMPETITION',
    eventDate: '2026-02-08',
    registrationDeadline: '2026-01-20',
    year: 2026,
  },
  {
    title: 'USACO February Contest',
    titleZh: 'USACO 2月月赛',
    category: 'COMPETITION',
    eventDate: '2026-02-20',
    year: 2026,
  },
  {
    title: 'Science Olympiad Invitational',
    titleZh: '科学奥林匹克邀请赛',
    category: 'COMPETITION',
    eventDate: '2026-03-15',
    year: 2026,
  },
  // Summer Programs
  {
    title: 'RSI (Research Science Institute) Application',
    titleZh: 'RSI 暑期科研项目申请',
    category: 'SUMMER_PROGRAM',
    eventDate: '2026-06-20',
    registrationDeadline: '2026-01-15',
    year: 2026,
  },
  {
    title: 'PROMYS Application Deadline',
    titleZh: 'PROMYS 数学暑期项目申请',
    category: 'SUMMER_PROGRAM',
    eventDate: '2026-07-01',
    registrationDeadline: '2026-03-15',
    year: 2026,
  },
  {
    title: 'Stanford Summer Session',
    titleZh: '斯坦福暑期课程',
    category: 'SUMMER_PROGRAM',
    eventDate: '2026-06-22',
    registrationDeadline: '2026-04-01',
    year: 2026,
  },
  // Financial Aid
  {
    title: 'FAFSA Opens for 2026-2027',
    titleZh: 'FAFSA 2026-2027 学年开放',
    category: 'FINANCIAL_AID',
    eventDate: '2025-10-01',
    year: 2025,
  },
  {
    title: 'CSS Profile Opens',
    titleZh: 'CSS Profile 开放',
    category: 'FINANCIAL_AID',
    eventDate: '2025-10-01',
    year: 2025,
  },
  // Application Deadlines
  {
    title: 'Common App Opens',
    titleZh: 'Common App 开放',
    category: 'APPLICATION',
    eventDate: '2025-08-01',
    year: 2025,
  },
  {
    title: 'UC Application Opens',
    titleZh: 'UC 申请开放',
    category: 'APPLICATION',
    eventDate: '2025-10-01',
    year: 2025,
  },
  {
    title: 'UC Application Deadline',
    titleZh: 'UC 申请截止',
    category: 'APPLICATION',
    eventDate: '2025-11-30',
    year: 2025,
  },
  {
    title: 'Common App ED/EA Deadline (Most Schools)',
    titleZh: '大部分学校 ED/EA 截止',
    category: 'APPLICATION',
    eventDate: '2025-11-01',
    year: 2025,
  },
  {
    title: 'Regular Decision Deadline (Most Schools)',
    titleZh: '大部分学校 RD 截止',
    category: 'APPLICATION',
    eventDate: '2026-01-01',
    year: 2026,
  },
  {
    title: 'Ivy Day - Regular Decision Results',
    titleZh: '藤校放榜日',
    category: 'APPLICATION',
    eventDate: '2026-03-28',
    year: 2026,
  },
  {
    title: 'National Decision Day',
    titleZh: '全国决定日',
    category: 'APPLICATION',
    eventDate: '2026-05-01',
    year: 2026,
  },
];

// ============================================
// Section 4: School Deadlines
// ============================================

const schoolDeadlines = [
  {
    schoolName: 'Massachusetts Institute of Technology',
    year: 2026,
    round: 'EA',
    deadline: '2025-11-01',
    decisionDate: '2025-12-14',
    fee: 75,
    interviewRequired: true,
  },
  {
    schoolName: 'Massachusetts Institute of Technology',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-05',
    decisionDate: '2026-03-14',
    fee: 75,
    interviewRequired: true,
  },
  {
    schoolName: 'Harvard University',
    year: 2026,
    round: 'REA',
    deadline: '2025-11-01',
    decisionDate: '2025-12-12',
    fee: 85,
    interviewRequired: true,
  },
  {
    schoolName: 'Harvard University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-01',
    decisionDate: '2026-03-28',
    fee: 85,
    interviewRequired: true,
  },
  {
    schoolName: 'Stanford University',
    year: 2026,
    round: 'REA',
    deadline: '2025-11-01',
    decisionDate: '2025-12-13',
    fee: 90,
    interviewRequired: false,
  },
  {
    schoolName: 'Stanford University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-05',
    decisionDate: '2026-04-01',
    fee: 90,
    interviewRequired: false,
  },
  {
    schoolName: 'Princeton University',
    year: 2026,
    round: 'REA',
    deadline: '2025-11-01',
    decisionDate: '2025-12-12',
    fee: 70,
    interviewRequired: true,
  },
  {
    schoolName: 'Princeton University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-01',
    decisionDate: '2026-03-28',
    fee: 70,
    interviewRequired: true,
  },
  {
    schoolName: 'Yale University',
    year: 2026,
    round: 'REA',
    deadline: '2025-11-01',
    decisionDate: '2025-12-15',
    fee: 80,
    interviewRequired: true,
  },
  {
    schoolName: 'Yale University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-02',
    decisionDate: '2026-03-28',
    fee: 80,
    interviewRequired: true,
  },
  {
    schoolName: 'Columbia University',
    year: 2026,
    round: 'ED',
    deadline: '2025-11-01',
    decisionDate: '2025-12-15',
    fee: 85,
    interviewRequired: false,
  },
  {
    schoolName: 'Columbia University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-01',
    decisionDate: '2026-03-28',
    fee: 85,
    interviewRequired: false,
  },
  {
    schoolName: 'University of Pennsylvania',
    year: 2026,
    round: 'ED',
    deadline: '2025-11-01',
    decisionDate: '2025-12-13',
    fee: 75,
    interviewRequired: true,
  },
  {
    schoolName: 'University of Pennsylvania',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-05',
    decisionDate: '2026-03-28',
    fee: 75,
    interviewRequired: true,
  },
  {
    schoolName: 'Duke University',
    year: 2026,
    round: 'ED',
    deadline: '2025-11-01',
    decisionDate: '2025-12-15',
    fee: 85,
    interviewRequired: true,
  },
  {
    schoolName: 'Duke University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-04',
    decisionDate: '2026-03-28',
    fee: 85,
    interviewRequired: true,
  },
  {
    schoolName: 'Cornell University',
    year: 2026,
    round: 'ED',
    deadline: '2025-11-01',
    decisionDate: '2025-12-12',
    fee: 80,
    interviewRequired: false,
  },
  {
    schoolName: 'Cornell University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-02',
    decisionDate: '2026-03-28',
    fee: 80,
    interviewRequired: false,
  },
  {
    schoolName: 'Rice University',
    year: 2026,
    round: 'ED',
    deadline: '2025-11-01',
    decisionDate: '2025-12-14',
    fee: 75,
    interviewRequired: true,
  },
  {
    schoolName: 'Rice University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-04',
    decisionDate: '2026-03-28',
    fee: 75,
    interviewRequired: true,
  },
  {
    schoolName: 'Carnegie Mellon University',
    year: 2026,
    round: 'ED',
    deadline: '2025-11-01',
    decisionDate: '2025-12-15',
    fee: 75,
    interviewRequired: false,
  },
  {
    schoolName: 'Carnegie Mellon University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-03',
    decisionDate: '2026-03-28',
    fee: 75,
    interviewRequired: false,
  },
  {
    schoolName: 'Northwestern University',
    year: 2026,
    round: 'ED',
    deadline: '2025-11-01',
    decisionDate: '2025-12-15',
    fee: 75,
    interviewRequired: false,
  },
  {
    schoolName: 'Northwestern University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-03',
    decisionDate: '2026-03-28',
    fee: 75,
    interviewRequired: false,
  },
  {
    schoolName: 'New York University',
    year: 2026,
    round: 'ED1',
    deadline: '2025-11-01',
    decisionDate: '2025-12-15',
    fee: 80,
    interviewRequired: false,
  },
  {
    schoolName: 'New York University',
    year: 2026,
    round: 'ED2',
    deadline: '2026-01-01',
    decisionDate: '2026-02-15',
    fee: 80,
    interviewRequired: false,
  },
  {
    schoolName: 'New York University',
    year: 2026,
    round: 'RD',
    deadline: '2026-01-05',
    decisionDate: '2026-04-01',
    fee: 80,
    interviewRequired: false,
  },
  {
    schoolName: 'University of California, Berkeley',
    year: 2026,
    round: 'RD',
    deadline: '2025-11-30',
    decisionDate: '2026-03-25',
    fee: 80,
    interviewRequired: false,
  },
  {
    schoolName: 'University of California, Los Angeles',
    year: 2026,
    round: 'RD',
    deadline: '2025-11-30',
    decisionDate: '2026-03-20',
    fee: 80,
    interviewRequired: false,
  },
  {
    schoolName: 'University of Michigan, Ann Arbor',
    year: 2026,
    round: 'EA',
    deadline: '2025-11-01',
    decisionDate: '2026-01-31',
    fee: 75,
    interviewRequired: false,
  },
  {
    schoolName: 'University of Michigan, Ann Arbor',
    year: 2026,
    round: 'RD',
    deadline: '2026-02-01',
    decisionDate: '2026-04-01',
    fee: 75,
    interviewRequired: false,
  },
];

// ============================================
// Section 5: Essay Examples for Gallery
// ============================================

const essayExamples = [
  {
    type: 'COMMON_APP' as const,
    prompt:
      'Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.',
    content: `The kitchen smelled of star anise and failure. My first attempt at making my grandmother's braised pork belly was an unmitigated disaster—burnt on the outside, raw in the center, swimming in a sauce that tasted like soy-flavored regret.

"Try again," my grandmother said, not unkindly. "The meat remembers the fire."

I didn't understand what she meant then. I was thirteen, impatient, and convinced that cooking was just following recipes. But my grandmother never used recipes. She cooked by feel—a pinch of this, a splash of that, adjusting constantly to the particular qualities of that day's ingredients.

Over three years of Sunday cooking sessions, I learned that the best dishes, like the best solutions to any problem, emerge from a dialogue between intention and reality. You start with a plan, but you must be willing to adapt.

This lesson has shaped how I approach everything. In my coding projects, I've learned that the elegant algorithm on paper often needs to be completely rethought when it encounters real-world data. In my volunteer tutoring, I've discovered that the perfect lesson plan must bend to the unique needs of each student.

My grandmother passed away last year, but her kitchen philosophy lives on in everything I do: pay attention, be patient, and remember that the best things take time.`,
    wordCount: 220,
    year: 2025,
    tags: ['culture', 'family', 'personal_growth'],
    promptNumber: 1,
  },
  {
    type: 'COMMON_APP' as const,
    prompt:
      'The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?',
    content: `"Your project has been rejected." Five words that ended months of work on my social enterprise and taught me more than any acceptance ever could.

I had spent six months building a platform to connect elderly residents in my community with volunteer helpers. The idea was simple: an app where seniors could request help with groceries, technology, or just conversation. I coded the backend, designed the interface, recruited 50 volunteers, and pitched it to the local government for funding.

They said no. Not because the idea was bad, but because I had built what I thought the community needed instead of asking what they actually needed. The elderly residents didn't want an app—many didn't have smartphones. They wanted a phone hotline. The solution was simpler, cheaper, and more accessible.

This failure taught me the most important lesson of my life: empathy precedes innovation. I scrapped the app, built a simple phone system, and within a month, we were serving 80 elderly residents. The volunteers I'd recruited reported higher satisfaction, and the program was eventually adopted by the city council.

I still have the rejected proposal framed on my desk. It reminds me that my first instinct—to solve problems with technology—is only as good as my understanding of the people I'm trying to help.`,
    wordCount: 215,
    year: 2025,
    tags: ['failure', 'social_impact', 'lesson_learned'],
    promptNumber: 2,
  },
  {
    type: 'SUPPLEMENTAL' as const,
    prompt:
      'At MIT, we bring people together to better the lives of others. Describe one way in which you have contributed to your community.',
    content: `In my school's cramped computer lab, a line of students waited for one of three working monitors. I didn't see a resource problem—I saw an opportunity.

I proposed "Code Without Screens": a programming curriculum that teaches computational thinking using paper, physical objects, and group activities before students ever touch a keyboard. Using sorting algorithms with playing cards, binary counting with light switches, and conditional logic with choose-your-own-adventure stories, I designed twelve lessons that required zero technology.

The program now reaches 200 students across three schools, including a rural middle school where my team travels monthly. What started as a workaround for limited resources became something more meaningful: proof that computer science is fundamentally about thinking, not typing.`,
    wordCount: 130,
    year: 2025,
    tags: ['community', 'cs_education', 'innovation'],
  },
  {
    type: 'WHY_SCHOOL' as const,
    prompt:
      'Please briefly elaborate on one of your extracurricular activities or work experiences. (Stanford)',
    content: `When our FIRST Robotics robot's arm mechanism failed three days before competition, my instinct was to rebuild it from scratch. My teammate suggested a simpler fix: replacing the geared motor with a pneumatic cylinder. It was unglamorous—pneumatics are old technology—but it worked perfectly.

This moment crystallized what I love about engineering. The best solution isn't always the most complex one. Our robot won the Engineering Excellence Award that year, and the judges specifically praised the "elegant simplicity" of our arm design.

Since then, I've applied this principle to every engineering challenge: before adding complexity, exhaust simplicity. In our solar car project, this meant choosing a single-motor direct drive over a dual-motor system. Less to go wrong, less to maintain, more reliable.

I want to bring this philosophy to Stanford's d.school, where I'd learn to apply design thinking not just to mechanical systems, but to the human systems—education, healthcare, sustainability—that need elegant solutions the most.`,
    wordCount: 165,
    year: 2025,
    tags: ['engineering', 'simplicity', 'stanford'],
  },
  {
    type: 'UC' as const,
    prompt:
      'Describe how you have taken advantage of a significant educational opportunity or worked to overcome an educational barrier you have faced.',
    content: `When my family moved from China to California before my freshman year, I couldn't understand a single word in my first English class. The teacher spoke quickly, the textbook might as well have been hieroglyphics, and I felt invisible.

My counselor suggested I take ESL classes, but I chose a different path. I signed up for the school newspaper. Not as a writer—I could barely compose a sentence—but as a photographer. Through my lens, I could tell stories without words.

Slowly, I began learning English through journalism. Interviewing sources forced me to listen carefully. Writing captions taught me concise expression. Editing articles with native speakers showed me the rhythm of English.

By sophomore year, I was writing features. By junior year, I was editor-in-chief. The newspaper became my bridge between two worlds—the Chinese-speaking world of my family and the English-speaking world of my school. And in learning to navigate both, I discovered that the most powerful communication isn't about language at all. It's about genuine curiosity about other people's stories.

Now I use this perspective to mentor newly arrived immigrant students at our school, sharing not language lessons but something more valuable: the confidence that their voice matters, even when the words don't come easily.`,
    wordCount: 210,
    year: 2025,
    tags: ['immigrant', 'overcoming_barriers', 'journalism', 'uc'],
    promptNumber: 2,
  },
];

// ============================================
// Main Seed Function
// ============================================

async function main() {
  console.log('====================================================');
  console.log(' Comprehensive Feature Seed Data');
  console.log('====================================================\n');

  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('Demo123!', 10);

  // ------------------------------------------
  // 1. Create Users with Complete Profiles
  // ------------------------------------------
  console.log('1. Creating users with complete profiles...\n');

  const createdUsers: { id: string; email: string; profileId: string }[] = [];

  for (const student of studentProfiles) {
    let user = await prisma.user.findUnique({
      where: { email: student.email },
      include: { profile: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: student.email,
          passwordHash,
          role: student.role,
          emailVerified: true,
          locale: 'zh',
          profile: {
            create: {
              realName: student.profile.realName,
              gpa: student.profile.gpa,
              gpaScale: student.profile.gpaScale,
              currentSchool: student.profile.currentSchool,
              currentSchoolType: student.profile.currentSchoolType,
              grade: student.profile.grade,
              targetMajor: student.profile.targetMajor,
              budgetTier: student.profile.budgetTier,
              visibility: student.profile.visibility,
              regionPref: student.profile.regionPref,
              applicationRound: student.profile.applicationRound,
              birthday: student.profile.birthday,
              graduationDate: student.profile.graduationDate,
              onboardingCompleted: student.profile.onboardingCompleted,
            },
          },
        },
        include: { profile: true },
      });
      console.log(
        `  + Created user: ${student.email} (${student.profile.realName})`,
      );
    } else {
      console.log(`  = User exists: ${student.email}`);
    }

    const profileId = user.profile?.id;
    if (!profileId) continue;

    createdUsers.push({ id: user.id, email: student.email, profileId });

    // Test Scores
    const existingScores = await prisma.testScore.count({
      where: { profileId },
    });
    if (existingScores === 0 && student.testScores.length > 0) {
      for (const score of student.testScores) {
        await prisma.testScore.create({
          data: {
            profileId,
            type: score.type,
            score: score.score,
            subScores: score.subScores || undefined,
            testDate: score.testDate,
          },
        });
      }
      console.log(`    + ${student.testScores.length} test scores`);
    }

    // Activities
    const existingActivities = await prisma.activity.count({
      where: { profileId },
    });
    if (existingActivities === 0 && student.activities.length > 0) {
      for (let i = 0; i < student.activities.length; i++) {
        const act = student.activities[i];
        await prisma.activity.create({
          data: {
            profileId,
            name: act.name,
            category: act.category as any,
            role: act.role,
            organization: act.organization,
            description: act.description,
            hoursPerWeek: act.hoursPerWeek,
            weeksPerYear: act.weeksPerYear,
            isOngoing: act.isOngoing,
            order: i,
            startDate: new Date(`202${randomInt(2, 3)}-09-01`),
          },
        });
      }
      console.log(`    + ${student.activities.length} activities`);
    }

    // Awards
    const existingAwards = await prisma.award.count({ where: { profileId } });
    if (existingAwards === 0 && student.awards.length > 0) {
      for (let i = 0; i < student.awards.length; i++) {
        const award = student.awards[i];
        await prisma.award.create({
          data: {
            profileId,
            name: award.name,
            level: award.level as any,
            year: award.year,
            description: award.description,
            order: i,
          },
        });
      }
      console.log(`    + ${student.awards.length} awards`);
    }

    // Education
    const existingEducation = await prisma.education.count({
      where: { profileId },
    });
    if (existingEducation === 0 && student.education.length > 0) {
      for (const edu of student.education) {
        await prisma.education.create({
          data: {
            profileId,
            schoolName: edu.schoolName,
            schoolType: edu.schoolType,
            startDate: edu.startDate,
            endDate: edu.endDate,
            gpa: edu.gpa,
            gpaScale: edu.gpaScale,
          },
        });
      }
      console.log(`    + ${student.education.length} education records`);
    }

    // Essays
    const existingEssays = await prisma.essay.count({ where: { profileId } });
    if (existingEssays === 0 && student.essays.length > 0) {
      for (const essay of student.essays) {
        await prisma.essay.create({
          data: {
            profileId,
            title: essay.title,
            prompt: essay.prompt,
            content: essay.content,
            wordCount: essay.wordCount,
          },
        });
      }
      console.log(`    + ${student.essays.length} essays`);
    }
  }

  // Also get the demo user
  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
    include: { profile: true },
  });
  if (demoUser && demoUser.profile) {
    createdUsers.push({
      id: demoUser.id,
      email: demoUser.email,
      profileId: demoUser.profile.id,
    });
  }

  console.log(`\n  Total users: ${createdUsers.length}\n`);

  // ------------------------------------------
  // 2. Admission Cases
  // ------------------------------------------
  console.log('2. Creating admission cases...\n');

  const allSchools = await prisma.school.findMany();
  const schoolMap = new Map(allSchools.map((s) => [s.name, s]));
  let casesCreated = 0;

  for (const caseData of admissionCases) {
    const school = schoolMap.get(caseData.schoolName);
    if (!school) {
      console.log(`  ! School not found: ${caseData.schoolName}`);
      continue;
    }

    // Assign to a random user
    const user = createdUsers[casesCreated % createdUsers.length];

    const existing = await prisma.admissionCase.findFirst({
      where: { userId: user.id, schoolId: school.id, year: caseData.year },
    });

    if (!existing) {
      await prisma.admissionCase.create({
        data: {
          userId: user.id,
          schoolId: school.id,
          year: caseData.year,
          round: caseData.round,
          result: caseData.result,
          major: caseData.major,
          gpaRange: caseData.gpaRange,
          satRange: caseData.satRange,
          toeflRange: caseData.toeflRange,
          tags: caseData.tags,
          visibility: caseData.visibility,
          isVerified: caseData.visibility === 'VERIFIED_ONLY',
          essayType: caseData.essayType as any,
          essayPrompt: caseData.essayPrompt,
          essayContent: caseData.essayContent,
        },
      });
      casesCreated++;
      console.log(
        `  + ${caseData.schoolName} (${caseData.result}) - ${caseData.major}`,
      );
    }
  }
  console.log(`\n  Cases created: ${casesCreated}\n`);

  // ------------------------------------------
  // 3. Essay Examples for Gallery
  // ------------------------------------------
  console.log('3. Creating essay examples for gallery...\n');

  let essaysCreated = 0;
  for (const essay of essayExamples) {
    const randomSchool =
      allSchools[randomInt(0, Math.min(19, allSchools.length - 1))];

    const existing = await prisma.essayExample.findFirst({
      where: { prompt: essay.prompt, content: essay.content },
    });

    if (!existing) {
      await prisma.essayExample.create({
        data: {
          schoolId: randomSchool?.id,
          type: essay.type,
          prompt: essay.prompt,
          content: essay.content,
          wordCount: essay.wordCount,
          year: essay.year,
          promptNumber: essay.promptNumber,
          viewCount: randomInt(50, 5000),
          likeCount: randomInt(10, 500),
          rating: randomFloat(3.5, 5.0, 1),
          ratingCount: randomInt(5, 100),
          isVerified: true,
          isPublic: true,
          tags: essay.tags,
        },
      });
      essaysCreated++;
    }
  }
  console.log(`  Essay examples created: ${essaysCreated}\n`);

  // ------------------------------------------
  // 4. Social Features (Follow, Block)
  // ------------------------------------------
  console.log('4. Creating social connections...\n');

  let followsCreated = 0;
  for (let i = 0; i < createdUsers.length; i++) {
    for (let j = i + 1; j < createdUsers.length; j++) {
      if (Math.random() > 0.4) {
        // 60% chance of follow
        const existing = await prisma.follow.findFirst({
          where: {
            followerId: createdUsers[i].id,
            followingId: createdUsers[j].id,
          },
        });
        if (!existing) {
          await prisma.follow.create({
            data: {
              followerId: createdUsers[i].id,
              followingId: createdUsers[j].id,
            },
          });
          followsCreated++;
        }
        // Some follow back
        if (Math.random() > 0.5) {
          const existingBack = await prisma.follow.findFirst({
            where: {
              followerId: createdUsers[j].id,
              followingId: createdUsers[i].id,
            },
          });
          if (!existingBack) {
            await prisma.follow.create({
              data: {
                followerId: createdUsers[j].id,
                followingId: createdUsers[i].id,
              },
            });
            followsCreated++;
          }
        }
      }
    }
  }
  console.log(`  Follows created: ${followsCreated}\n`);

  // ------------------------------------------
  // 5. Chat Conversations
  // ------------------------------------------
  console.log('5. Creating chat conversations...\n');

  const chatPairs = [
    {
      users: [0, 1],
      messages: [
        {
          sender: 0,
          content: '你好！我看到你也在申请 Top 20，想交流一下申请经验？',
        },
        { sender: 1, content: '当然可以！你准备申哪些学校？' },
        {
          sender: 0,
          content: '我 target 是 MIT 和 Stanford，主要方向是 CS。你呢？',
        },
        {
          sender: 1,
          content: '我准备 ED Penn Wharton，方向是 Finance。你文书写完了吗？',
        },
        {
          sender: 0,
          content: '主文书写了初稿，还在改。Why School 的还没开始...',
        },
        { sender: 1, content: '加油！我觉得你的 CS 背景很强，MIT 应该有戏的' },
      ],
    },
    {
      users: [2, 3],
      messages: [
        {
          sender: 2,
          content:
            '学长好！你是 TJ 的？我想了解一下你们学校的 FIRST Robotics 队',
        },
        {
          sender: 3,
          content:
            '是的！我们队今年拿了 Regional 的 Engineering Excellence Award',
        },
        {
          sender: 2,
          content:
            '太厉害了！我也在做生物相关的研究，想了解一下你们是怎么平衡学业和活动的？',
        },
        {
          sender: 3,
          content:
            '说实话挺累的，但时间管理很重要。我可以分享一下我的 schedule',
        },
      ],
    },
    {
      users: [0, 4],
      messages: [
        { sender: 4, content: '看到你在论坛分享的文书经验，很有帮助！' },
        { sender: 0, content: '谢谢！有什么问题可以随时问我' },
        {
          sender: 4,
          content: '我想问一下心理学方向的文书应该怎么写？有点没有方向',
        },
        {
          sender: 0,
          content:
            '建议从个人经历出发，展示你为什么对心理学感兴趣。可以结合你做的 Peer Counseling 项目来写',
        },
      ],
    },
  ];

  let conversationsCreated = 0;
  for (const chatPair of chatPairs) {
    if (
      chatPair.users[0] >= createdUsers.length ||
      chatPair.users[1] >= createdUsers.length
    )
      continue;

    const user1 = createdUsers[chatPair.users[0]];
    const user2 = createdUsers[chatPair.users[1]];

    // Check if conversation exists
    const existingConvo = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: user1.id } } },
          { participants: { some: { userId: user2.id } } },
        ],
      },
    });

    if (!existingConvo) {
      const convo = await prisma.conversation.create({
        data: {
          participants: {
            create: [{ userId: user1.id }, { userId: user2.id }],
          },
        },
      });

      for (const msg of chatPair.messages) {
        const senderId = msg.sender === chatPair.users[0] ? user1.id : user2.id;
        await prisma.message.create({
          data: {
            conversationId: convo.id,
            senderId,
            content: msg.content,
          },
        });
      }
      conversationsCreated++;
    }
  }
  console.log(`  Conversations created: ${conversationsCreated}\n`);

  // ------------------------------------------
  // 6. Reviews & Peer Reviews
  // ------------------------------------------
  console.log('6. Creating reviews and peer reviews...\n');

  let reviewsCreated = 0;
  for (let i = 0; i < Math.min(createdUsers.length - 1, 5); i++) {
    const reviewer = createdUsers[i];
    const reviewee = createdUsers[i + 1];

    const existing = await prisma.review.findFirst({
      where: { reviewerId: reviewer.id, profileUserId: reviewee.id },
    });

    if (!existing) {
      await prisma.review.create({
        data: {
          reviewerId: reviewer.id,
          profileUserId: reviewee.id,
          academicScore: randomInt(6, 10),
          testScore: randomInt(5, 10),
          activityScore: randomInt(6, 10),
          awardScore: randomInt(5, 10),
          overallScore: randomInt(6, 10),
          comment: randomPick([
            '背景很强！活动列表很有亮点，建议文书再打磨一下。',
            '整体很均衡，标化和活动都不错。建议多展示个人特色。',
            '学术背景出色，建议在文书中更多展现软实力。',
            '活动非常有深度，可以看出是真的热爱。建议标化再冲一下。',
            '非常全面的 profile，竞争力很强。推荐 EA 申请。',
          ]),
          academicComment: randomPick([
            'GPA 非常扎实',
            '学术背景一般，需要提升',
            null,
          ]),
          activityComment: randomPick([
            '活动深度不错',
            '活动广度可以但缺乏深度',
            null,
          ]),
          tags: randomPick([
            ['well-rounded'],
            ['strong-stem', 'high-gpa'],
            ['leadership'],
            [],
          ]),
          status: 'PUBLISHED',
        },
      });
      reviewsCreated++;
    }
  }

  // Peer Reviews
  let peerReviewsCreated = 0;
  for (let i = 0; i < Math.min(createdUsers.length - 1, 4); i++) {
    const reviewer = createdUsers[i];
    const reviewee = createdUsers[i + 1];

    const existing = await prisma.peerReview.findFirst({
      where: { reviewerId: reviewer.id, revieweeId: reviewee.id },
    });

    if (!existing) {
      await prisma.peerReview.create({
        data: {
          reviewerId: reviewer.id,
          revieweeId: reviewee.id,
          profileScore: randomInt(3, 5),
          helpfulScore: randomInt(3, 5),
          responseScore: randomInt(3, 5),
          overallScore: randomInt(3, 5),
          comment: randomPick([
            '非常耐心地回答了我的问题，信息很有帮助！',
            '分享的申请经验很真实，给了我很多启发。',
            '回复很及时，建议很实际。',
            '聊天很愉快，学到了很多关于选校的知识。',
          ]),
          status: 'COMPLETED',
          expiresAt: daysFromNow(7),
          completedAt: new Date(),
          reverseProfileScore: randomInt(3, 5),
          reverseHelpfulScore: randomInt(3, 5),
          reverseResponseScore: randomInt(3, 5),
          reverseOverallScore: randomInt(3, 5),
          reverseComment: '互相学习，一起加油！',
        },
      });
      peerReviewsCreated++;
    }
  }
  console.log(
    `  Reviews: ${reviewsCreated}, Peer reviews: ${peerReviewsCreated}\n`,
  );

  // ------------------------------------------
  // 7. School Lists (选校清单)
  // ------------------------------------------
  console.log('7. Creating school lists...\n');

  const schoolListConfigs = [
    {
      userIdx: 0,
      schools: [
        {
          name: 'Massachusetts Institute of Technology',
          tier: 'REACH',
          round: 'EA',
        },
        { name: 'Stanford University', tier: 'REACH', round: 'RD' },
        { name: 'Carnegie Mellon University', tier: 'TARGET', round: 'ED' },
        {
          name: 'University of Michigan, Ann Arbor',
          tier: 'TARGET',
          round: 'EA',
        },
        {
          name: 'University of Illinois Urbana-Champaign',
          tier: 'SAFETY',
          round: 'EA',
        },
        { name: 'Purdue University', tier: 'SAFETY', round: 'EA' },
      ],
    },
    {
      userIdx: 1,
      schools: [
        { name: 'University of Pennsylvania', tier: 'REACH', round: 'ED' },
        { name: 'Northwestern University', tier: 'REACH', round: 'RD' },
        { name: 'Duke University', tier: 'TARGET', round: 'RD' },
        { name: 'Rice University', tier: 'TARGET', round: 'RD' },
        { name: 'Emory University', tier: 'SAFETY', round: 'RD' },
      ],
    },
    {
      userIdx: 2,
      schools: [
        { name: 'Duke University', tier: 'REACH', round: 'ED' },
        { name: 'Johns Hopkins University', tier: 'REACH', round: 'RD' },
        { name: 'Rice University', tier: 'TARGET', round: 'RD' },
        { name: 'Emory University', tier: 'TARGET', round: 'RD' },
        { name: 'Boston University', tier: 'SAFETY', round: 'RD' },
      ],
    },
    {
      userIdx: 6,
      schools: [
        {
          name: 'University of California, Berkeley',
          tier: 'REACH',
          round: 'RD',
        },
        {
          name: 'University of California, Los Angeles',
          tier: 'REACH',
          round: 'RD',
        },
        {
          name: 'University of California, San Diego',
          tier: 'TARGET',
          round: 'RD',
        },
        {
          name: 'University of California, Davis',
          tier: 'TARGET',
          round: 'RD',
        },
        {
          name: 'University of California, Santa Barbara',
          tier: 'SAFETY',
          round: 'RD',
        },
      ],
    },
  ];

  let schoolListsCreated = 0;
  for (const config of schoolListConfigs) {
    if (config.userIdx >= createdUsers.length) continue;
    const user = createdUsers[config.userIdx];

    for (const item of config.schools) {
      const school = schoolMap.get(item.name);
      if (!school) continue;

      const existing = await prisma.schoolListItem.findFirst({
        where: { userId: user.id, schoolId: school.id },
      });

      if (!existing) {
        await prisma.schoolListItem.create({
          data: {
            userId: user.id,
            schoolId: school.id,
            tier: item.tier as any,
            round: item.round,
            notes: `${item.tier === 'REACH' ? '冲刺' : item.tier === 'TARGET' ? '匹配' : '保底'}校 - ${item.round}`,
          },
        });
        schoolListsCreated++;
      }
    }
  }
  console.log(`  School list items created: ${schoolListsCreated}\n`);

  // ------------------------------------------
  // 8. Custom Rankings
  // ------------------------------------------
  console.log('8. Creating custom rankings...\n');

  const customRankings = [
    {
      userIdx: 0,
      name: 'CS 专业最佳学校',
      weights: {
        usNewsRank: 20,
        acceptanceRate: 10,
        tuition: 15,
        avgSalary: 55,
      },
      isPublic: true,
    },
    {
      userIdx: 1,
      name: '性价比最高的 Top 30',
      weights: {
        usNewsRank: 30,
        tuition: 40,
        avgSalary: 30,
        acceptanceRate: 0,
      },
      isPublic: true,
    },
    {
      userIdx: 2,
      name: 'Pre-Med 最佳选择',
      weights: {
        usNewsRank: 25,
        acceptanceRate: 15,
        tuition: 20,
        avgSalary: 40,
      },
      isPublic: false,
    },
    {
      userIdx: 3,
      name: '工程强校排名',
      weights: {
        usNewsRank: 20,
        acceptanceRate: 5,
        tuition: 25,
        avgSalary: 50,
      },
      isPublic: true,
    },
  ];

  let rankingsCreated = 0;
  for (const ranking of customRankings) {
    if (ranking.userIdx >= createdUsers.length) continue;
    const user = createdUsers[ranking.userIdx];

    const existing = await prisma.customRanking.findFirst({
      where: { userId: user.id, name: ranking.name },
    });

    if (!existing) {
      await prisma.customRanking.create({
        data: {
          userId: user.id,
          name: ranking.name,
          weights: ranking.weights,
          isPublic: ranking.isPublic,
        },
      });
      rankingsCreated++;
    }
  }
  console.log(`  Custom rankings created: ${rankingsCreated}\n`);

  // ------------------------------------------
  // 9. User Lists (Hall of Fame)
  // ------------------------------------------
  console.log('9. Creating user lists...\n');

  const userLists = [
    {
      userIdx: 0,
      title: '2026 Fall CS 申请者必看学校 Top 10',
      description: '根据就业数据、学术声誉和录取难度综合排名的 CS 强校清单',
      category: 'school_ranking',
      items: [
        { rank: 1, name: 'MIT', reason: 'CS 综合实力第一，就业无敌' },
        { rank: 2, name: 'Stanford', reason: '硅谷核心，创业氛围浓厚' },
        { rank: 3, name: 'CMU', reason: 'SCS 独立学院，CS 专注度最高' },
        { rank: 4, name: 'UC Berkeley', reason: '公立 Top 1，EECS 超强' },
        { rank: 5, name: 'Caltech', reason: '小而精，研究实力顶级' },
        { rank: 6, name: 'Georgia Tech', reason: '性价比之王，Co-op 项目强' },
        { rank: 7, name: 'UIUC', reason: 'CS 传统强校，研究资源丰富' },
        { rank: 8, name: 'Cornell', reason: '藤校中 CS 最强之一' },
        { rank: 9, name: 'UW', reason: '西雅图位置优势，Amazon/Microsoft' },
        { rank: 10, name: 'Princeton', reason: '理论 CS 超强，本科教育好' },
      ],
      isPublic: true,
    },
    {
      userIdx: 1,
      title: '最适合国际生的美国大学',
      description: '综合考虑 Financial Aid、国际生比例、支持服务等因素',
      category: 'school_ranking',
      items: [
        { rank: 1, name: 'MIT', reason: 'Need-blind for internationals' },
        { rank: 2, name: 'Harvard', reason: 'Need-blind, 资源丰富' },
        { rank: 3, name: 'Yale', reason: 'Need-blind, 文化包容' },
        { rank: 4, name: 'Princeton', reason: 'Need-blind, 本科教育好' },
        { rank: 5, name: 'Amherst', reason: 'Need-blind LAC' },
      ],
      isPublic: true,
    },
    {
      userIdx: 3,
      title: '申请季必备工具推荐',
      description: '整理了我在申请过程中用到的所有好用工具',
      category: 'tools',
      items: [
        { rank: 1, name: 'Notion', reason: '申请进度管理和文书整理' },
        { rank: 2, name: 'Grammarly', reason: '文书语法检查' },
        { rank: 3, name: 'College Scorecard', reason: '学校数据对比' },
        { rank: 4, name: 'Rate My Professor', reason: '了解教授评价' },
        { rank: 5, name: 'Khan Academy', reason: 'SAT/AP 备考' },
      ],
      isPublic: true,
    },
  ];

  let listsCreated = 0;
  for (const list of userLists) {
    if (list.userIdx >= createdUsers.length) continue;
    const user = createdUsers[list.userIdx];

    const existing = await prisma.userList.findFirst({
      where: { userId: user.id, title: list.title },
    });

    if (!existing) {
      await prisma.userList.create({
        data: {
          userId: user.id,
          title: list.title,
          description: list.description,
          category: list.category,
          items: list.items,
          isPublic: list.isPublic,
        },
      });
      listsCreated++;
    }
  }

  // Add some votes
  const allLists = await prisma.userList.findMany({ take: 10 });
  let votesCreated = 0;
  for (const list of allLists) {
    for (const user of createdUsers) {
      if (user.id === list.userId) continue;
      if (Math.random() > 0.5) {
        const existing = await prisma.userListVote.findFirst({
          where: { listId: list.id, userId: user.id },
        });
        if (!existing) {
          await prisma.userListVote.create({
            data: {
              listId: list.id,
              userId: user.id,
              value: Math.random() > 0.2 ? 1 : -1,
            },
          });
          votesCreated++;
        }
      }
    }
  }
  console.log(`  Lists: ${listsCreated}, Votes: ${votesCreated}\n`);

  // ------------------------------------------
  // 10. Global Events
  // ------------------------------------------
  console.log('10. Creating global events...\n');

  let eventsCreated = 0;
  for (const event of globalEvents) {
    const existing = await prisma.globalEvent.findFirst({
      where: {
        title: event.title,
        eventDate: new Date(event.eventDate),
        year: event.year,
      },
    });

    if (!existing) {
      await prisma.globalEvent.create({
        data: {
          title: event.title,
          titleZh: event.titleZh,
          category: event.category as any,
          eventDate: new Date(event.eventDate),
          registrationDeadline: event.registrationDeadline
            ? new Date(event.registrationDeadline)
            : undefined,
          resultDate: event.resultDate ? new Date(event.resultDate) : undefined,
          year: event.year,
          isRecurring: true,
          isActive: true,
        },
      });
      eventsCreated++;
    }
  }
  console.log(`  Global events created: ${eventsCreated}\n`);

  // ------------------------------------------
  // 11. School Deadlines
  // ------------------------------------------
  console.log('11. Creating school deadlines...\n');

  let deadlinesCreated = 0;
  for (const deadline of schoolDeadlines) {
    const school = schoolMap.get(deadline.schoolName);
    if (!school) continue;

    const existing = await prisma.schoolDeadline.findFirst({
      where: {
        schoolId: school.id,
        year: deadline.year,
        round: deadline.round,
      },
    });

    if (!existing) {
      await prisma.schoolDeadline.create({
        data: {
          schoolId: school.id,
          year: deadline.year,
          round: deadline.round,
          applicationDeadline: new Date(deadline.deadline),
          decisionDate: deadline.decisionDate
            ? new Date(deadline.decisionDate)
            : undefined,
          applicationFee: deadline.fee,
          interviewRequired: deadline.interviewRequired,
          source: 'MANUAL',
        },
      });
      deadlinesCreated++;
    }
  }
  console.log(`  School deadlines created: ${deadlinesCreated}\n`);

  // ------------------------------------------
  // 12. Application Timelines
  // ------------------------------------------
  console.log('12. Creating application timelines...\n');

  const timelineConfigs = [
    {
      userIdx: 0,
      schoolName: 'Massachusetts Institute of Technology',
      round: 'EA',
      status: 'IN_PROGRESS',
      progress: 65,
      tasks: [
        {
          title: '完成 Common App 主文书',
          type: 'ESSAY',
          completed: true,
          completedAt: new Date('2025-10-15'),
        },
        {
          title: '完成 MIT 补充文书 (5篇)',
          type: 'ESSAY',
          completed: false,
          dueDate: new Date('2025-10-25'),
        },
        {
          title: '请求推荐信 - 数学老师',
          type: 'RECOMMENDATION',
          completed: true,
          completedAt: new Date('2025-09-01'),
        },
        {
          title: '请求推荐信 - CS 老师',
          type: 'RECOMMENDATION',
          completed: true,
          completedAt: new Date('2025-09-01'),
        },
        {
          title: 'MIT 面试',
          type: 'INTERVIEW',
          completed: false,
          dueDate: new Date('2025-11-15'),
        },
        {
          title: '提交申请',
          type: 'OTHER',
          completed: false,
          dueDate: new Date('2025-11-01'),
        },
      ],
    },
    {
      userIdx: 0,
      schoolName: 'Carnegie Mellon University',
      round: 'ED',
      status: 'IN_PROGRESS',
      progress: 40,
      tasks: [
        {
          title: '完成 CMU SCS 补充文书',
          type: 'ESSAY',
          completed: false,
          dueDate: new Date('2025-10-20'),
        },
        {
          title: '填写活动列表',
          type: 'DOCUMENT',
          completed: true,
          completedAt: new Date('2025-10-01'),
        },
        {
          title: '提交成绩单',
          type: 'DOCUMENT',
          completed: true,
          completedAt: new Date('2025-09-15'),
        },
        {
          title: '提交申请',
          type: 'OTHER',
          completed: false,
          dueDate: new Date('2025-11-01'),
        },
      ],
    },
    {
      userIdx: 1,
      schoolName: 'University of Pennsylvania',
      round: 'ED',
      status: 'IN_PROGRESS',
      progress: 75,
      tasks: [
        {
          title: '完成 Wharton Why Essay',
          type: 'ESSAY',
          completed: true,
          completedAt: new Date('2025-10-10'),
        },
        {
          title: '完成 Penn 补充文书',
          type: 'ESSAY',
          completed: true,
          completedAt: new Date('2025-10-12'),
        },
        {
          title: '面试准备',
          type: 'INTERVIEW',
          completed: false,
          dueDate: new Date('2025-11-10'),
        },
        {
          title: '提交 CSS Profile',
          type: 'DOCUMENT',
          completed: false,
          dueDate: new Date('2025-11-01'),
        },
        {
          title: '提交申请',
          type: 'OTHER',
          completed: false,
          dueDate: new Date('2025-11-01'),
        },
      ],
    },
    {
      userIdx: 2,
      schoolName: 'Duke University',
      round: 'ED',
      status: 'NOT_STARTED',
      progress: 10,
      tasks: [
        {
          title: '研究 Duke 的课程和项目',
          type: 'OTHER',
          completed: true,
          completedAt: new Date('2025-09-20'),
        },
        {
          title: '完成 Why Duke 文书',
          type: 'ESSAY',
          completed: false,
          dueDate: new Date('2025-10-25'),
        },
        {
          title: '联系推荐人',
          type: 'RECOMMENDATION',
          completed: false,
          dueDate: new Date('2025-10-01'),
        },
        {
          title: '提交申请',
          type: 'OTHER',
          completed: false,
          dueDate: new Date('2025-11-01'),
        },
      ],
    },
  ];

  let timelinesCreated = 0;
  for (const config of timelineConfigs) {
    if (config.userIdx >= createdUsers.length) continue;
    const user = createdUsers[config.userIdx];
    const school = schoolMap.get(config.schoolName);
    if (!school) continue;

    const existing = await prisma.applicationTimeline.findFirst({
      where: { userId: user.id, schoolId: school.id, round: config.round },
    });

    if (!existing) {
      const deadline = await prisma.schoolDeadline.findFirst({
        where: { schoolId: school.id, round: config.round },
      });

      const timeline = await prisma.applicationTimeline.create({
        data: {
          userId: user.id,
          schoolId: school.id,
          schoolName: school.name,
          round: config.round,
          deadline: deadline?.applicationDeadline || new Date('2025-11-01'),
          status: config.status as any,
          progress: config.progress,
          priority: config.progress > 50 ? 1 : 0,
        },
      });

      for (let i = 0; i < config.tasks.length; i++) {
        const task = config.tasks[i];
        await prisma.applicationTask.create({
          data: {
            timelineId: timeline.id,
            title: task.title,
            type: task.type as any,
            completed: task.completed,
            completedAt: task.completedAt,
            dueDate: task.dueDate,
            sortOrder: i,
          },
        });
      }
      timelinesCreated++;
    }
  }
  console.log(`  Application timelines created: ${timelinesCreated}\n`);

  // ------------------------------------------
  // 13. Personal Events
  // ------------------------------------------
  console.log('13. Creating personal events...\n');

  const personalEventConfigs = [
    {
      userIdx: 0,
      events: [
        {
          title: 'SAT 考试冲刺',
          category: 'TEST',
          deadline: new Date('2026-03-14'),
          eventDate: new Date('2026-03-14'),
          status: 'IN_PROGRESS',
          progress: 60,
          priority: 2,
          tasks: [
            { title: '完成 5 套真题', completed: true },
            { title: '错题分析和整理', completed: true },
            { title: '模考 3 次', completed: false },
            { title: '考前复习', completed: false },
          ],
        },
        {
          title: 'USACO 月赛准备',
          category: 'COMPETITION',
          deadline: new Date('2026-02-20'),
          eventDate: new Date('2026-02-20'),
          status: 'IN_PROGRESS',
          progress: 40,
          priority: 1,
          tasks: [
            { title: '练习动态规划题目 30 道', completed: true },
            { title: '学习图论高级算法', completed: false },
            { title: '完成 3 套历年真题', completed: false },
          ],
        },
      ],
    },
    {
      userIdx: 2,
      events: [
        {
          title: 'USABO 公开赛备考',
          category: 'COMPETITION',
          deadline: new Date('2026-02-08'),
          eventDate: new Date('2026-02-08'),
          status: 'IN_PROGRESS',
          progress: 50,
          priority: 2,
          tasks: [
            { title: '复习分子生物学', completed: true },
            { title: '复习遗传学', completed: true },
            { title: '复习生态学', completed: false },
            { title: '做 3 套模拟题', completed: false },
          ],
        },
        {
          title: 'TOEFL 口语提高',
          category: 'TEST',
          deadline: new Date('2026-04-18'),
          status: 'NOT_STARTED',
          progress: 0,
          priority: 1,
          tasks: [
            { title: '每天跟读练习 30 分钟', completed: false },
            { title: '找外教练口语 10 次', completed: false },
            { title: '完成 TPO 口语部分', completed: false },
          ],
        },
      ],
    },
    {
      userIdx: 6,
      events: [
        {
          title: 'Stanford 暑期课程申请',
          category: 'SUMMER_PROGRAM',
          deadline: new Date('2026-04-01'),
          status: 'NOT_STARTED',
          progress: 0,
          priority: 1,
          tasks: [
            { title: '研究课程选项', completed: false },
            { title: '准备申请材料', completed: false },
            { title: '写 Statement of Purpose', completed: false },
          ],
        },
      ],
    },
  ];

  let personalEventsCreated = 0;
  for (const config of personalEventConfigs) {
    if (config.userIdx >= createdUsers.length) continue;
    const user = createdUsers[config.userIdx];

    for (const eventData of config.events) {
      const existing = await prisma.personalEvent.findFirst({
        where: { userId: user.id, title: eventData.title },
      });

      if (!existing) {
        const event = await prisma.personalEvent.create({
          data: {
            userId: user.id,
            title: eventData.title,
            category: eventData.category as any,
            deadline: eventData.deadline,
            eventDate: eventData.eventDate,
            status: eventData.status as any,
            progress: eventData.progress,
            priority: eventData.priority,
          },
        });

        for (let i = 0; i < eventData.tasks.length; i++) {
          const task = eventData.tasks[i];
          await prisma.personalTask.create({
            data: {
              eventId: event.id,
              title: task.title,
              completed: task.completed,
              completedAt: task.completed ? new Date() : undefined,
              sortOrder: i,
            },
          });
        }
        personalEventsCreated++;
      }
    }
  }
  console.log(`  Personal events created: ${personalEventsCreated}\n`);

  // ------------------------------------------
  // 14. Swipe Game Stats
  // ------------------------------------------
  console.log('14. Creating swipe game data...\n');

  let swipeStatsCreated = 0;
  for (const user of createdUsers.slice(0, 6)) {
    const existing = await prisma.swipeStats.findFirst({
      where: { userId: user.id },
    });

    if (!existing) {
      const totalSwipes = randomInt(20, 200);
      const correctCount = Math.floor(totalSwipes * randomFloat(0.4, 0.85));
      const streak = randomInt(0, 15);
      const bestStreak = randomInt(streak, 25);

      await prisma.swipeStats.create({
        data: {
          userId: user.id,
          totalSwipes,
          correctCount,
          streak,
          bestStreak,
          badge:
            bestStreak >= 20 ? 'gold' : bestStreak >= 10 ? 'silver' : 'bronze',
        },
      });

      // Point history
      const actions = [
        'SWIPE_CORRECT',
        'DAILY_BONUS',
        'REVIEW_COMPLETE',
        'STREAK_BONUS',
      ];
      for (let i = 0; i < randomInt(5, 15); i++) {
        await prisma.pointHistory.create({
          data: {
            userId: user.id,
            action: randomPick(actions),
            points: randomInt(5, 50),
            createdAt: randomDate(new Date('2025-09-01'), new Date()),
          },
        });
      }

      // Update user points
      const totalPoints = await prisma.pointHistory.aggregate({
        where: { userId: user.id },
        _sum: { points: true },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { points: totalPoints._sum.points || 0 },
      });

      swipeStatsCreated++;
    }
  }
  console.log(`  Swipe stats created: ${swipeStatsCreated}\n`);

  // ------------------------------------------
  // 15. Prediction Results
  // ------------------------------------------
  console.log('15. Creating prediction results...\n');

  const predictionConfigs = [
    {
      userIdx: 0,
      schools: [
        {
          name: 'Massachusetts Institute of Technology',
          prob: 0.32,
          tier: 'reach',
          confidence: 'medium',
        },
        {
          name: 'Stanford University',
          prob: 0.25,
          tier: 'reach',
          confidence: 'medium',
        },
        {
          name: 'Carnegie Mellon University',
          prob: 0.55,
          tier: 'match',
          confidence: 'high',
        },
        {
          name: 'University of Michigan, Ann Arbor',
          prob: 0.72,
          tier: 'match',
          confidence: 'high',
        },
        {
          name: 'University of Illinois Urbana-Champaign',
          prob: 0.88,
          tier: 'safety',
          confidence: 'high',
        },
        {
          name: 'Purdue University',
          prob: 0.92,
          tier: 'safety',
          confidence: 'high',
        },
      ],
    },
    {
      userIdx: 1,
      schools: [
        {
          name: 'University of Pennsylvania',
          prob: 0.28,
          tier: 'reach',
          confidence: 'medium',
        },
        {
          name: 'Northwestern University',
          prob: 0.35,
          tier: 'reach',
          confidence: 'medium',
        },
        {
          name: 'Duke University',
          prob: 0.42,
          tier: 'match',
          confidence: 'medium',
        },
        {
          name: 'Rice University',
          prob: 0.55,
          tier: 'match',
          confidence: 'high',
        },
        {
          name: 'Emory University',
          prob: 0.7,
          tier: 'safety',
          confidence: 'high',
        },
      ],
    },
    {
      userIdx: 2,
      schools: [
        {
          name: 'Duke University',
          prob: 0.22,
          tier: 'reach',
          confidence: 'low',
        },
        {
          name: 'Johns Hopkins University',
          prob: 0.25,
          tier: 'reach',
          confidence: 'medium',
        },
        {
          name: 'Rice University',
          prob: 0.45,
          tier: 'match',
          confidence: 'medium',
        },
        {
          name: 'Emory University',
          prob: 0.58,
          tier: 'match',
          confidence: 'medium',
        },
        {
          name: 'Boston University',
          prob: 0.8,
          tier: 'safety',
          confidence: 'high',
        },
      ],
    },
  ];

  let predictionsCreated = 0;
  for (const config of predictionConfigs) {
    if (config.userIdx >= createdUsers.length) continue;
    const user = createdUsers[config.userIdx];

    for (const pred of config.schools) {
      const school = schoolMap.get(pred.name);
      if (!school) continue;

      const existing = await prisma.predictionResult.findFirst({
        where: { profileId: user.profileId, schoolId: school.id },
      });

      if (!existing) {
        const probLow = Math.max(0, pred.prob - randomFloat(0.05, 0.12));
        const probHigh = Math.min(1, pred.prob + randomFloat(0.05, 0.12));

        await prisma.predictionResult.create({
          data: {
            profileId: user.profileId,
            schoolId: school.id,
            probability: pred.prob,
            probabilityLow: probLow,
            probabilityHigh: probHigh,
            tier: pred.tier,
            confidence: pred.confidence,
            modelVersion: 'v2',
            factors: [
              {
                name: 'GPA',
                impact: pred.prob > 0.5 ? 'positive' : 'neutral',
                detail: 'GPA 在录取范围内',
              },
              {
                name: 'SAT',
                impact: 'positive',
                detail: '标化成绩达到学校中位数以上',
              },
              {
                name: '课外活动',
                impact: pred.prob > 0.4 ? 'positive' : 'neutral',
                detail: '活动深度和领导力表现良好',
              },
              {
                name: '竞赛奖项',
                impact: 'positive',
                detail: '有国家级以上奖项',
              },
            ],
            engineScores: {
              stats: randomFloat(0.2, 0.5),
              ai: randomFloat(0.2, 0.4),
              historical: randomFloat(0.25, 0.45),
              weights: { stats: 0.4, ai: 0.3, historical: 0.3 },
            },
            suggestions: [
              '建议在文书中突出你的独特经历',
              '可以在 Why School 文书中提及具体的教授或项目',
              '保持或提高当前的 GPA',
            ],
          },
        });
        predictionsCreated++;
      }
    }
  }
  console.log(`  Predictions created: ${predictionsCreated}\n`);

  // ------------------------------------------
  // 16. Reports (Admin)
  // ------------------------------------------
  console.log('16. Creating sample reports...\n');

  let reportsCreated = 0;
  if (createdUsers.length >= 2) {
    const reportData = [
      {
        reporterIdx: 0,
        targetType: 'POST',
        reason: '内容不实',
        detail: '帖子中声称的录取结果可能是虚假的，请核实。',
      },
      {
        reporterIdx: 1,
        targetType: 'COMMENT',
        reason: '不当言论',
        detail: '评论中包含对其他申请者的人身攻击。',
      },
      {
        reporterIdx: 2,
        targetType: 'USER',
        reason: '垃圾信息',
        detail: '该用户在多个帖子下发布广告内容。',
      },
    ];

    for (const report of reportData) {
      if (report.reporterIdx >= createdUsers.length) continue;

      const existing = await prisma.report.count();
      if (existing < 5) {
        await prisma.report.create({
          data: {
            reporterId: createdUsers[report.reporterIdx].id,
            targetType: report.targetType as any,
            targetId:
              createdUsers[(report.reporterIdx + 1) % createdUsers.length].id,
            reason: report.reason,
            detail: report.detail,
            status: randomPick(['PENDING', 'REVIEWED', 'RESOLVED'] as const),
          },
        });
        reportsCreated++;
      }
    }
  }
  console.log(`  Reports created: ${reportsCreated}\n`);

  // ------------------------------------------
  // 17. School Metrics (Historical Data)
  // ------------------------------------------
  console.log('17. Creating school metrics...\n');

  let metricsCreated = 0;
  const topSchools = allSchools
    .filter((s) => s.usNewsRank && s.usNewsRank <= 30)
    .slice(0, 15);

  for (const school of topSchools) {
    for (const year of [2022, 2023, 2024, 2025]) {
      const metrics = [
        {
          key: 'acceptance_rate',
          value:
            (school.acceptanceRate ? Number(school.acceptanceRate) : 15) +
            randomFloat(-2, 2),
        },
        { key: 'avg_sat', value: 1400 + randomInt(0, 200) },
        { key: 'international_rate', value: randomFloat(10, 25) },
        { key: 'yield_rate', value: randomFloat(30, 80) },
      ];

      for (const metric of metrics) {
        const existing = await prisma.schoolMetric.findFirst({
          where: { schoolId: school.id, year, metricKey: metric.key },
        });

        if (!existing) {
          await prisma.schoolMetric.create({
            data: {
              schoolId: school.id,
              year,
              metricKey: metric.key,
              value: metric.value,
            },
          });
          metricsCreated++;
        }
      }
    }
  }
  console.log(`  School metrics created: ${metricsCreated}\n`);

  // ------------------------------------------
  // Summary
  // ------------------------------------------
  console.log('====================================================');
  console.log(' Seed Complete!');
  console.log('====================================================');
  console.log(`
  Users (with profiles): ${createdUsers.length}
  Admission Cases: ${casesCreated}
  Essay Examples: ${essaysCreated}
  Social Follows: ${followsCreated}
  Chat Conversations: ${conversationsCreated}
  Reviews: ${reviewsCreated}, Peer Reviews: ${peerReviewsCreated}
  School List Items: ${schoolListsCreated}
  Custom Rankings: ${rankingsCreated}
  User Lists: ${listsCreated}
  Global Events: ${eventsCreated}
  School Deadlines: ${deadlinesCreated}
  Application Timelines: ${timelinesCreated}
  Personal Events: ${personalEventsCreated}
  Swipe Stats: ${swipeStatsCreated}
  Predictions: ${predictionsCreated}
  Reports: ${reportsCreated}
  School Metrics: ${metricsCreated}

  Demo accounts:
  - demo@example.com / Demo123!
  - admin@example.com / Admin123!
  - alice.zhang@demo.studyabroad.com / Demo123!
  - brian.wang@demo.studyabroad.com / Demo123!
  - chloe.li@demo.studyabroad.com / Demo123!
  - david.chen@demo.studyabroad.com / Demo123!
  - emily.liu@demo.studyabroad.com / Demo123!
  - frank.zhao@demo.studyabroad.com / Demo123!
  - grace.wu@demo.studyabroad.com / Demo123!
  - henry.sun@demo.studyabroad.com / Demo123!
  `);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
