/**
 * 排名对比测试数据种子脚本
 *
 * 创建 15 个多样化学生档案，每个学生有 4-8 个 SchoolListItem，
 * 保证热门学校有 8-12 个竞争者，用于测试排名对比功能。
 *
 * 运行: pnpm --filter api ts-node prisma/seed-ranking-test.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// 学生档案数据
// ============================================

interface RankingTestStudent {
  email: string;
  profile: {
    realName: string;
    gpa: number;
    gpaScale: number;
    currentSchool: string;
    currentSchoolType: string;
    grade: string;
    targetMajor: string;
    budgetTier: string;
    visibility: 'ANONYMOUS' | 'VERIFIED_ONLY';
  };
  testScores: Array<{ type: string; score: number; testDate: Date }>;
  activities: Array<{
    name: string;
    category: string;
    role: string;
    description: string;
    hoursPerWeek: number;
    weeksPerYear: number;
  }>;
  awards: Array<{ name: string; level: string; year: number }>;
  /** 学校名称列表（必须与 seed.ts 中的名称一致） */
  schoolList: Array<{ schoolName: string; tier: string; round: string }>;
}

const students: RankingTestStudent[] = [
  // ============ ELITE TIER (3) ============
  {
    email: 'rank-elite-01@test.studyabroad.com',
    profile: {
      realName: 'Sophia Huang',
      gpa: 3.97,
      gpaScale: 4.0,
      currentSchool: 'Choate Rosemary Hall',
      currentSchoolType: 'PRIVATE_US',
      grade: 'SENIOR',
      targetMajor: 'Computer Science',
      budgetTier: 'UNLIMITED',
      visibility: 'VERIFIED_ONLY',
    },
    testScores: [
      { type: 'SAT', score: 1580, testDate: new Date('2025-06-01') },
      { type: 'TOEFL', score: 118, testDate: new Date('2025-05-15') },
    ],
    activities: [
      {
        name: 'Machine Learning Research',
        category: 'RESEARCH',
        role: 'Lead Researcher',
        description: 'Published paper on NLP at ACL workshop',
        hoursPerWeek: 15,
        weeksPerYear: 40,
      },
      {
        name: 'Coding Club',
        category: 'ACADEMIC',
        role: 'President & Founder',
        description: 'Founded school coding club with 60+ members',
        hoursPerWeek: 8,
        weeksPerYear: 36,
      },
      {
        name: 'Math Tutoring Center',
        category: 'COMMUNITY_SERVICE',
        role: 'Head Tutor',
        description: 'Free math tutoring for underserved communities',
        hoursPerWeek: 5,
        weeksPerYear: 40,
      },
      {
        name: 'Varsity Tennis',
        category: 'ATHLETICS',
        role: 'Captain',
        description: 'Led team to state semifinals',
        hoursPerWeek: 10,
        weeksPerYear: 30,
      },
    ],
    awards: [
      { name: 'USACO Platinum', level: 'NATIONAL', year: 2025 },
      {
        name: 'AMC 12 Distinguished Honor Roll',
        level: 'NATIONAL',
        year: 2025,
      },
      {
        name: 'Science Olympiad Nationals - 2nd',
        level: 'NATIONAL',
        year: 2024,
      },
    ],
    schoolList: [
      {
        schoolName: 'Massachusetts Institute of Technology',
        tier: 'REACH',
        round: 'EA',
      },
      { schoolName: 'Stanford University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Princeton University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Carnegie Mellon University', tier: 'TARGET', round: 'RD' },
      { schoolName: 'Columbia University', tier: 'TARGET', round: 'ED' },
      {
        schoolName: 'University of California, Berkeley',
        tier: 'TARGET',
        round: 'RD',
      },
    ],
  },
  {
    email: 'rank-elite-02@test.studyabroad.com',
    profile: {
      realName: 'Kevin Liu',
      gpa: 3.95,
      gpaScale: 4.0,
      currentSchool: 'Stuyvesant High School',
      currentSchoolType: 'PUBLIC_US',
      grade: 'SENIOR',
      targetMajor: 'Mathematics',
      budgetTier: 'HIGH',
      visibility: 'ANONYMOUS',
    },
    testScores: [
      { type: 'SAT', score: 1590, testDate: new Date('2025-03-15') },
    ],
    activities: [
      {
        name: 'Math Olympiad Training',
        category: 'ACADEMIC',
        role: 'Team Captain',
        description: 'Led school math team to ARML nationals',
        hoursPerWeek: 12,
        weeksPerYear: 40,
      },
      {
        name: 'Quantitative Finance Club',
        category: 'LEADERSHIP',
        role: 'Founder',
        description: 'Started quant club, built algorithmic trading simulator',
        hoursPerWeek: 8,
        weeksPerYear: 30,
      },
      {
        name: 'Peer Tutoring',
        category: 'COMMUNITY_SERVICE',
        role: 'Lead Tutor',
        description: 'Tutored 30+ students in calculus',
        hoursPerWeek: 6,
        weeksPerYear: 36,
      },
    ],
    awards: [
      { name: 'USAMO Qualifier', level: 'NATIONAL', year: 2025 },
      { name: 'AIME Score 12', level: 'NATIONAL', year: 2025 },
      { name: 'Putnam Top 200', level: 'NATIONAL', year: 2025 },
      { name: 'IMO Selection Camp', level: 'INTERNATIONAL', year: 2025 },
    ],
    schoolList: [
      { schoolName: 'Princeton University', tier: 'REACH', round: 'RD' },
      {
        schoolName: 'Massachusetts Institute of Technology',
        tier: 'REACH',
        round: 'EA',
      },
      { schoolName: 'Harvard University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Stanford University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Duke University', tier: 'TARGET', round: 'RD' },
      { schoolName: 'University of Chicago', tier: 'TARGET', round: 'EA' },
      { schoolName: 'Columbia University', tier: 'TARGET', round: 'RD' },
    ],
  },
  {
    email: 'rank-elite-03@test.studyabroad.com',
    profile: {
      realName: 'Isabella Chen',
      gpa: 3.93,
      gpaScale: 4.0,
      currentSchool: '北京十一学校',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'SENIOR',
      targetMajor: 'Biomedical Engineering',
      budgetTier: 'HIGH',
      visibility: 'ANONYMOUS',
    },
    testScores: [
      { type: 'SAT', score: 1560, testDate: new Date('2025-08-10') },
      { type: 'TOEFL', score: 116, testDate: new Date('2025-07-20') },
    ],
    activities: [
      {
        name: 'Biomedical Research Intern',
        category: 'RESEARCH',
        role: 'Research Intern',
        description:
          'Published co-author paper on CRISPR applications at university lab',
        hoursPerWeek: 20,
        weeksPerYear: 12,
      },
      {
        name: 'Science Olympiad',
        category: 'ACADEMIC',
        role: 'Team Captain',
        description: 'Led team to national competition, won anatomy event',
        hoursPerWeek: 10,
        weeksPerYear: 30,
      },
      {
        name: 'Red Cross Youth Chapter',
        category: 'COMMUNITY_SERVICE',
        role: 'Chapter President',
        description: 'Organized blood drives and health awareness campaigns',
        hoursPerWeek: 6,
        weeksPerYear: 40,
      },
      {
        name: 'Piano Performance',
        category: 'ARTS',
        role: 'Performer',
        description: 'ABRSM Grade 8 Distinction, performed at Carnegie Hall',
        hoursPerWeek: 8,
        weeksPerYear: 50,
      },
    ],
    awards: [
      { name: 'ISEF Finalist', level: 'INTERNATIONAL', year: 2025 },
      { name: 'USABO Semifinalist', level: 'NATIONAL', year: 2025 },
      { name: 'Brain Bee National Champion', level: 'NATIONAL', year: 2024 },
    ],
    schoolList: [
      { schoolName: 'Harvard University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Stanford University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Duke University', tier: 'REACH', round: 'ED' },
      { schoolName: 'Johns Hopkins University', tier: 'TARGET', round: 'ED' },
      { schoolName: 'University of Pennsylvania', tier: 'REACH', round: 'RD' },
      { schoolName: 'Columbia University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Rice University', tier: 'TARGET', round: 'RD' },
    ],
  },

  // ============ STRONG TIER (5) ============
  {
    email: 'rank-strong-01@test.studyabroad.com',
    profile: {
      realName: 'Ryan Zhang',
      gpa: 3.85,
      gpaScale: 4.0,
      currentSchool: '上海交通大学附属中学',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'SENIOR',
      targetMajor: 'Electrical Engineering',
      budgetTier: 'HIGH',
      visibility: 'ANONYMOUS',
    },
    testScores: [
      { type: 'SAT', score: 1520, testDate: new Date('2025-10-05') },
      { type: 'TOEFL', score: 112, testDate: new Date('2025-09-20') },
    ],
    activities: [
      {
        name: 'Robotics Club',
        category: 'ACADEMIC',
        role: 'Lead Engineer',
        description: 'Designed robot for FRC competition, won regional award',
        hoursPerWeek: 15,
        weeksPerYear: 30,
      },
      {
        name: 'Electronics Workshop',
        category: 'COMMUNITY_SERVICE',
        role: 'Instructor',
        description: 'Taught electronics to middle school students',
        hoursPerWeek: 4,
        weeksPerYear: 36,
      },
      {
        name: 'Drone Racing Team',
        category: 'ACADEMIC',
        role: 'Member',
        description: 'Built and raced custom FPV drones',
        hoursPerWeek: 6,
        weeksPerYear: 40,
      },
    ],
    awards: [
      { name: 'FRC Regional Engineering Award', level: 'REGIONAL', year: 2025 },
      { name: 'Physics Cup National Bronze', level: 'NATIONAL', year: 2024 },
    ],
    schoolList: [
      {
        schoolName: 'Massachusetts Institute of Technology',
        tier: 'REACH',
        round: 'EA',
      },
      { schoolName: 'Stanford University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Carnegie Mellon University', tier: 'TARGET', round: 'ED' },
      {
        schoolName: 'Georgia Institute of Technology',
        tier: 'TARGET',
        round: 'EA',
      },
      {
        schoolName: 'University of California, Berkeley',
        tier: 'TARGET',
        round: 'RD',
      },
      { schoolName: 'Purdue University', tier: 'SAFETY', round: 'EA' },
    ],
  },
  {
    email: 'rank-strong-02@test.studyabroad.com',
    profile: {
      realName: 'Mia Wang',
      gpa: 3.78,
      gpaScale: 4.0,
      currentSchool: 'Deerfield Academy',
      currentSchoolType: 'PRIVATE_US',
      grade: 'SENIOR',
      targetMajor: 'Economics',
      budgetTier: 'UNLIMITED',
      visibility: 'VERIFIED_ONLY',
    },
    testScores: [
      { type: 'SAT', score: 1500, testDate: new Date('2025-05-20') },
    ],
    activities: [
      {
        name: 'Investment Club',
        category: 'LEADERSHIP',
        role: 'President',
        description: 'Managed $30k portfolio, organized finance speaker series',
        hoursPerWeek: 8,
        weeksPerYear: 36,
      },
      {
        name: 'Model UN',
        category: 'ACADEMIC',
        role: 'Secretary General',
        description: 'Organized school conference with 300+ delegates',
        hoursPerWeek: 10,
        weeksPerYear: 30,
      },
      {
        name: 'Food Bank Volunteer',
        category: 'COMMUNITY_SERVICE',
        role: 'Coordinator',
        description: 'Coordinated weekly food distribution for 200+ families',
        hoursPerWeek: 5,
        weeksPerYear: 48,
      },
      {
        name: 'Varsity Soccer',
        category: 'ATHLETICS',
        role: 'Player',
        description: 'Starter on varsity team for 3 years',
        hoursPerWeek: 12,
        weeksPerYear: 20,
      },
    ],
    awards: [
      {
        name: 'National Economics Challenge Silver',
        level: 'NATIONAL',
        year: 2025,
      },
      { name: 'Best Delegate - HMUN', level: 'REGIONAL', year: 2024 },
      { name: 'National Merit Semifinalist', level: 'NATIONAL', year: 2025 },
    ],
    schoolList: [
      { schoolName: 'University of Pennsylvania', tier: 'REACH', round: 'ED' },
      { schoolName: 'Columbia University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Duke University', tier: 'TARGET', round: 'RD' },
      { schoolName: 'Northwestern University', tier: 'TARGET', round: 'ED' },
      { schoolName: 'New York University', tier: 'TARGET', round: 'RD' },
      { schoolName: 'Emory University', tier: 'SAFETY', round: 'RD' },
    ],
  },
  {
    email: 'rank-strong-03@test.studyabroad.com',
    profile: {
      realName: 'Jason Li',
      gpa: 3.82,
      gpaScale: 4.0,
      currentSchool: '深圳外国语学校',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'SENIOR',
      targetMajor: 'Computer Science',
      budgetTier: 'HIGH',
      visibility: 'ANONYMOUS',
    },
    testScores: [
      { type: 'SAT', score: 1540, testDate: new Date('2025-08-01') },
      { type: 'TOEFL', score: 113, testDate: new Date('2025-07-10') },
    ],
    activities: [
      {
        name: 'Open Source Contributor',
        category: 'ACADEMIC',
        role: 'Core Contributor',
        description: 'Contributed to popular React library, 500+ GitHub stars',
        hoursPerWeek: 10,
        weeksPerYear: 50,
      },
      {
        name: 'Tech Blog',
        category: 'ACADEMIC',
        role: 'Writer & Editor',
        description: 'Bilingual tech blog with 5000+ monthly readers',
        hoursPerWeek: 5,
        weeksPerYear: 50,
      },
      {
        name: 'Coding Bootcamp Mentor',
        category: 'COMMUNITY_SERVICE',
        role: 'Lead Mentor',
        description: 'Mentored 50+ students in web development',
        hoursPerWeek: 6,
        weeksPerYear: 30,
      },
    ],
    awards: [
      { name: 'USACO Gold', level: 'NATIONAL', year: 2025 },
      { name: 'Google Code Jam Qualifier', level: 'INTERNATIONAL', year: 2025 },
    ],
    schoolList: [
      { schoolName: 'Carnegie Mellon University', tier: 'REACH', round: 'ED' },
      {
        schoolName: 'Massachusetts Institute of Technology',
        tier: 'REACH',
        round: 'EA',
      },
      { schoolName: 'Stanford University', tier: 'REACH', round: 'RD' },
      {
        schoolName: 'University of California, Berkeley',
        tier: 'TARGET',
        round: 'RD',
      },
      { schoolName: 'New York University', tier: 'TARGET', round: 'RD' },
      {
        schoolName: 'University of Illinois Urbana-Champaign',
        tier: 'SAFETY',
        round: 'EA',
      },
    ],
  },
  {
    email: 'rank-strong-04@test.studyabroad.com',
    profile: {
      realName: 'Olivia Xu',
      gpa: 3.88,
      gpaScale: 4.0,
      currentSchool: 'Milton Academy',
      currentSchoolType: 'PRIVATE_US',
      grade: 'SENIOR',
      targetMajor: 'Political Science',
      budgetTier: 'UNLIMITED',
      visibility: 'VERIFIED_ONLY',
    },
    testScores: [
      { type: 'SAT', score: 1490, testDate: new Date('2025-06-10') },
    ],
    activities: [
      {
        name: 'Student Government',
        category: 'LEADERSHIP',
        role: 'President',
        description: 'Led student government, passed 5 policy changes',
        hoursPerWeek: 10,
        weeksPerYear: 36,
      },
      {
        name: 'Debate Team',
        category: 'ACADEMIC',
        role: 'Captain',
        description: 'Won state debate championship, qualified for TOC',
        hoursPerWeek: 12,
        weeksPerYear: 30,
      },
      {
        name: 'Youth Civic Engagement',
        category: 'COMMUNITY_SERVICE',
        role: 'Founder',
        description: 'Voter registration drive, registered 500+ young voters',
        hoursPerWeek: 6,
        weeksPerYear: 20,
      },
      {
        name: 'School Newspaper',
        category: 'ARTS',
        role: 'Editor-in-Chief',
        description: 'Managed team of 20 writers, published weekly',
        hoursPerWeek: 8,
        weeksPerYear: 36,
      },
    ],
    awards: [
      { name: 'NSDA Nationals Quarterfinalist', level: 'NATIONAL', year: 2025 },
      { name: 'State Debate Champion', level: 'STATE', year: 2024 },
      {
        name: 'Princeton Prize in Race Relations',
        level: 'NATIONAL',
        year: 2025,
      },
    ],
    schoolList: [
      { schoolName: 'Harvard University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Princeton University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Yale University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Duke University', tier: 'TARGET', round: 'RD' },
      { schoolName: 'Georgetown University', tier: 'TARGET', round: 'EA' },
      { schoolName: 'New York University', tier: 'TARGET', round: 'RD' },
    ],
  },
  {
    email: 'rank-strong-05@test.studyabroad.com',
    profile: {
      realName: 'Nathan Zhao',
      gpa: 3.8,
      gpaScale: 4.0,
      currentSchool: '南京师范大学附属中学',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'SENIOR',
      targetMajor: 'Data Science',
      budgetTier: 'MEDIUM',
      visibility: 'ANONYMOUS',
    },
    testScores: [
      { type: 'SAT', score: 1510, testDate: new Date('2025-10-15') },
      { type: 'TOEFL', score: 110, testDate: new Date('2025-09-01') },
    ],
    activities: [
      {
        name: 'Data Analysis Project',
        category: 'RESEARCH',
        role: 'Lead Analyst',
        description: 'Analyzed urban traffic data for city government project',
        hoursPerWeek: 10,
        weeksPerYear: 20,
      },
      {
        name: 'Math Competition Team',
        category: 'ACADEMIC',
        role: 'Member',
        description: 'AMC/AIME competitor',
        hoursPerWeek: 8,
        weeksPerYear: 36,
      },
      {
        name: 'Tutoring Program',
        category: 'COMMUNITY_SERVICE',
        role: 'Volunteer',
        description: 'Tutored rural students online during COVID',
        hoursPerWeek: 4,
        weeksPerYear: 40,
      },
    ],
    awards: [
      { name: 'AIME Qualifier', level: 'NATIONAL', year: 2025 },
      {
        name: 'MCM/ICM Meritorious Winner',
        level: 'INTERNATIONAL',
        year: 2025,
      },
    ],
    schoolList: [
      { schoolName: 'Carnegie Mellon University', tier: 'REACH', round: 'ED' },
      { schoolName: 'Columbia University', tier: 'REACH', round: 'RD' },
      { schoolName: 'University of Pennsylvania', tier: 'REACH', round: 'RD' },
      { schoolName: 'New York University', tier: 'TARGET', round: 'RD' },
      {
        schoolName: 'University of California, Berkeley',
        tier: 'TARGET',
        round: 'RD',
      },
      {
        schoolName: 'University of Michigan, Ann Arbor',
        tier: 'SAFETY',
        round: 'EA',
      },
    ],
  },

  // ============ MODERATE TIER (4) ============
  {
    email: 'rank-moderate-01@test.studyabroad.com',
    profile: {
      realName: 'Amy Luo',
      gpa: 3.65,
      gpaScale: 4.0,
      currentSchool: '成都外国语学校',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'SENIOR',
      targetMajor: 'Psychology',
      budgetTier: 'MEDIUM',
      visibility: 'ANONYMOUS',
    },
    testScores: [
      { type: 'SAT', score: 1450, testDate: new Date('2025-12-01') },
      { type: 'TOEFL', score: 106, testDate: new Date('2025-11-10') },
    ],
    activities: [
      {
        name: 'Psychology Research',
        category: 'RESEARCH',
        role: 'Research Assistant',
        description: 'Assisted professor in cognitive psychology study',
        hoursPerWeek: 8,
        weeksPerYear: 15,
      },
      {
        name: 'Peer Counseling',
        category: 'COMMUNITY_SERVICE',
        role: 'Counselor',
        description: 'Provided peer counseling for students',
        hoursPerWeek: 4,
        weeksPerYear: 36,
      },
    ],
    awards: [
      {
        name: 'Provincial Science Competition 2nd Place',
        level: 'STATE',
        year: 2024,
      },
    ],
    schoolList: [
      { schoolName: 'New York University', tier: 'REACH', round: 'RD' },
      {
        schoolName: 'University of California, Berkeley',
        tier: 'REACH',
        round: 'RD',
      },
      {
        schoolName: 'University of California, Los Angeles',
        tier: 'TARGET',
        round: 'RD',
      },
      { schoolName: 'Boston University', tier: 'TARGET', round: 'RD' },
      {
        schoolName: 'University of California, San Diego',
        tier: 'SAFETY',
        round: 'RD',
      },
    ],
  },
  {
    email: 'rank-moderate-02@test.studyabroad.com',
    profile: {
      realName: 'Leo Sun',
      gpa: 3.58,
      gpaScale: 4.0,
      currentSchool: 'The Hotchkiss School',
      currentSchoolType: 'PRIVATE_US',
      grade: 'SENIOR',
      targetMajor: 'Business',
      budgetTier: 'HIGH',
      visibility: 'VERIFIED_ONLY',
    },
    testScores: [
      { type: 'SAT', score: 1470, testDate: new Date('2025-08-20') },
    ],
    activities: [
      {
        name: 'Entrepreneurship Club',
        category: 'LEADERSHIP',
        role: 'President',
        description: 'Led school business pitch competitions',
        hoursPerWeek: 6,
        weeksPerYear: 30,
      },
      {
        name: 'Varsity Lacrosse',
        category: 'ATHLETICS',
        role: 'Player',
        description: 'Varsity player for 2 years',
        hoursPerWeek: 12,
        weeksPerYear: 16,
      },
      {
        name: 'Part-time Startup',
        category: 'LEADERSHIP',
        role: 'Co-Founder',
        description: 'E-commerce side project generating small revenue',
        hoursPerWeek: 5,
        weeksPerYear: 50,
      },
    ],
    awards: [
      { name: 'DECA State Finalist', level: 'STATE', year: 2025 },
      {
        name: 'School Business Plan Competition Winner',
        level: 'SCHOOL',
        year: 2024,
      },
    ],
    schoolList: [
      { schoolName: 'University of Pennsylvania', tier: 'REACH', round: 'ED' },
      { schoolName: 'Columbia University', tier: 'REACH', round: 'RD' },
      { schoolName: 'New York University', tier: 'TARGET', round: 'ED' },
      { schoolName: 'Duke University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Emory University', tier: 'TARGET', round: 'RD' },
      { schoolName: 'Boston College', tier: 'SAFETY', round: 'EA' },
    ],
  },
  {
    email: 'rank-moderate-03@test.studyabroad.com',
    profile: {
      realName: 'Jessica Qian',
      gpa: 3.6,
      gpaScale: 4.0,
      currentSchool: '广州外国语学校',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'SENIOR',
      targetMajor: 'Environmental Science',
      budgetTier: 'MEDIUM',
      visibility: 'ANONYMOUS',
    },
    testScores: [
      { type: 'SAT', score: 1420, testDate: new Date('2025-10-20') },
      { type: 'TOEFL', score: 105, testDate: new Date('2025-09-15') },
    ],
    activities: [
      {
        name: 'Environmental Club',
        category: 'COMMUNITY_SERVICE',
        role: 'Chair',
        description: 'Led school sustainability initiatives',
        hoursPerWeek: 6,
        weeksPerYear: 36,
      },
      {
        name: 'Photography',
        category: 'ARTS',
        role: 'Photographer',
        description: 'Nature photography exhibited at local gallery',
        hoursPerWeek: 4,
        weeksPerYear: 50,
      },
    ],
    awards: [
      { name: 'Youth Environmental Award', level: 'REGIONAL', year: 2024 },
    ],
    schoolList: [
      {
        schoolName: 'University of California, Berkeley',
        tier: 'REACH',
        round: 'RD',
      },
      { schoolName: 'Stanford University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Duke University', tier: 'REACH', round: 'RD' },
      {
        schoolName: 'University of California, Los Angeles',
        tier: 'TARGET',
        round: 'RD',
      },
      {
        schoolName: 'University of California, San Diego',
        tier: 'TARGET',
        round: 'RD',
      },
    ],
  },
  {
    email: 'rank-moderate-04@test.studyabroad.com',
    profile: {
      realName: 'Derek Tan',
      gpa: 3.55,
      gpaScale: 4.0,
      currentSchool: '杭州学军中学',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'SENIOR',
      targetMajor: 'Mechanical Engineering',
      budgetTier: 'MEDIUM',
      visibility: 'ANONYMOUS',
    },
    testScores: [
      { type: 'SAT', score: 1460, testDate: new Date('2025-11-05') },
      { type: 'TOEFL', score: 108, testDate: new Date('2025-10-01') },
    ],
    activities: [
      {
        name: 'VEX Robotics',
        category: 'ACADEMIC',
        role: 'Builder',
        description: 'Built competition robots for VEX Worlds qualifier',
        hoursPerWeek: 10,
        weeksPerYear: 25,
      },
      {
        name: 'Maker Space',
        category: 'ACADEMIC',
        role: 'Member',
        description: 'Built 3D printers and CNC machines',
        hoursPerWeek: 6,
        weeksPerYear: 40,
      },
    ],
    awards: [
      { name: 'VEX Robotics Regional Champion', level: 'REGIONAL', year: 2025 },
      { name: 'Physics Olympiad Provincial 3rd', level: 'STATE', year: 2024 },
    ],
    schoolList: [
      {
        schoolName: 'Massachusetts Institute of Technology',
        tier: 'REACH',
        round: 'EA',
      },
      { schoolName: 'Carnegie Mellon University', tier: 'REACH', round: 'RD' },
      {
        schoolName: 'Georgia Institute of Technology',
        tier: 'TARGET',
        round: 'EA',
      },
      {
        schoolName: 'University of Michigan, Ann Arbor',
        tier: 'TARGET',
        round: 'EA',
      },
      { schoolName: 'Purdue University', tier: 'SAFETY', round: 'EA' },
    ],
  },

  // ============ DEVELOPING TIER (3) ============
  {
    email: 'rank-dev-01@test.studyabroad.com',
    profile: {
      realName: 'Lily Jiang',
      gpa: 3.45,
      gpaScale: 4.0,
      currentSchool: '武汉外国语学校',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'SENIOR',
      targetMajor: 'Communications',
      budgetTier: 'MEDIUM',
      visibility: 'ANONYMOUS',
    },
    testScores: [
      { type: 'SAT', score: 1380, testDate: new Date('2025-12-15') },
      { type: 'TOEFL', score: 100, testDate: new Date('2025-11-20') },
    ],
    activities: [
      {
        name: 'School Radio Station',
        category: 'ARTS',
        role: 'Host',
        description: 'Weekly bilingual radio show',
        hoursPerWeek: 4,
        weeksPerYear: 36,
      },
      {
        name: 'Volunteer Teacher',
        category: 'COMMUNITY_SERVICE',
        role: 'Volunteer',
        description: 'Taught English to migrant worker children',
        hoursPerWeek: 3,
        weeksPerYear: 30,
      },
    ],
    awards: [
      { name: 'Speech Contest Provincial Winner', level: 'STATE', year: 2024 },
    ],
    schoolList: [
      { schoolName: 'New York University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Boston University', tier: 'TARGET', round: 'RD' },
      {
        schoolName: 'University of California, San Diego',
        tier: 'TARGET',
        round: 'RD',
      },
      { schoolName: 'Purdue University', tier: 'SAFETY', round: 'EA' },
    ],
  },
  {
    email: 'rank-dev-02@test.studyabroad.com',
    profile: {
      realName: 'Tony Ma',
      gpa: 3.35,
      gpaScale: 4.0,
      currentSchool: '苏州中学国际部',
      currentSchoolType: 'INTERNATIONAL',
      grade: 'SENIOR',
      targetMajor: 'Computer Science',
      budgetTier: 'HIGH',
      visibility: 'VERIFIED_ONLY',
    },
    testScores: [
      { type: 'SAT', score: 1350, testDate: new Date('2025-10-25') },
      { type: 'TOEFL', score: 98, testDate: new Date('2025-09-30') },
    ],
    activities: [
      {
        name: 'Game Development',
        category: 'ACADEMIC',
        role: 'Developer',
        description: 'Built indie game with 1000+ downloads',
        hoursPerWeek: 8,
        weeksPerYear: 50,
      },
      {
        name: 'Basketball Team',
        category: 'ATHLETICS',
        role: 'Player',
        description: 'JV basketball player',
        hoursPerWeek: 6,
        weeksPerYear: 20,
      },
    ],
    awards: [
      { name: 'School Science Fair 1st Place', level: 'SCHOOL', year: 2024 },
    ],
    schoolList: [
      { schoolName: 'Carnegie Mellon University', tier: 'REACH', round: 'RD' },
      {
        schoolName: 'University of California, Berkeley',
        tier: 'REACH',
        round: 'RD',
      },
      { schoolName: 'New York University', tier: 'TARGET', round: 'RD' },
      {
        schoolName: 'University of Illinois Urbana-Champaign',
        tier: 'TARGET',
        round: 'EA',
      },
      { schoolName: 'Purdue University', tier: 'SAFETY', round: 'EA' },
    ],
  },
  {
    email: 'rank-dev-03@test.studyabroad.com',
    profile: {
      realName: 'Cindy He',
      gpa: 3.4,
      gpaScale: 4.0,
      currentSchool: '重庆南开中学',
      currentSchoolType: 'PUBLIC_CN',
      grade: 'SENIOR',
      targetMajor: 'Art History',
      budgetTier: 'LOW',
      visibility: 'ANONYMOUS',
    },
    testScores: [
      { type: 'SAT', score: 1300, testDate: new Date('2025-11-15') },
      { type: 'TOEFL', score: 95, testDate: new Date('2025-10-20') },
    ],
    activities: [
      {
        name: 'Art Club',
        category: 'ARTS',
        role: 'President',
        description: 'Led school art club, organized exhibitions',
        hoursPerWeek: 6,
        weeksPerYear: 36,
      },
      {
        name: 'Museum Docent',
        category: 'COMMUNITY_SERVICE',
        role: 'Volunteer Docent',
        description: 'Weekend docent at local art museum',
        hoursPerWeek: 4,
        weeksPerYear: 40,
      },
    ],
    awards: [
      { name: 'Youth Art Exhibition Award', level: 'REGIONAL', year: 2024 },
    ],
    schoolList: [
      { schoolName: 'New York University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Columbia University', tier: 'REACH', round: 'RD' },
      { schoolName: 'Boston University', tier: 'TARGET', round: 'RD' },
      {
        schoolName: 'University of California, Los Angeles',
        tier: 'TARGET',
        round: 'RD',
      },
    ],
  },
];

// ============================================
// 主函数
// ============================================

async function main() {
  console.log('=== 排名对比测试数据种子脚本 ===\n');

  // 加载已有学校
  const allSchools = await prisma.school.findMany();
  const schoolMap = new Map(allSchools.map((s) => [s.name, s]));
  console.log(`已加载 ${allSchools.length} 所学校\n`);

  if (allSchools.length === 0) {
    console.error('数据库中没有学校数据，请先运行 seed.ts');
    process.exit(1);
  }

  let usersCreated = 0;
  let schoolListsCreated = 0;

  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('Test123!', 10);

  for (const student of students) {
    // 检查是否已存在
    const existing = await prisma.user.findUnique({
      where: { email: student.email },
    });

    if (existing) {
      console.log(`  [跳过] ${student.profile.realName} (${student.email})`);
      // 仍然尝试补充 SchoolListItem
      const userId = existing.id;
      for (const item of student.schoolList) {
        const school = schoolMap.get(item.schoolName);
        if (!school) continue;
        const existingItem = await prisma.schoolListItem.findUnique({
          where: { userId_schoolId: { userId, schoolId: school.id } },
        });
        if (!existingItem) {
          await prisma.schoolListItem.create({
            data: {
              userId,
              schoolId: school.id,
              tier: item.tier as any,
              round: item.round,
            },
          });
          schoolListsCreated++;
        }
      }
      continue;
    }

    // 创建用户 + 档案 + 成绩 + 活动 + 奖项
    const user = await prisma.user.create({
      data: {
        email: student.email,
        passwordHash,
        emailVerified: true,
        locale: 'zh',
        profile: {
          create: {
            realName: student.profile.realName,
            gpa: student.profile.gpa,
            gpaScale: student.profile.gpaScale,
            currentSchool: student.profile.currentSchool,
            currentSchoolType: student.profile.currentSchoolType as any,
            grade: student.profile.grade as any,
            targetMajor: student.profile.targetMajor,
            budgetTier: student.profile.budgetTier as any,
            visibility: student.profile.visibility as any,
            onboardingCompleted: true,
            testScores: {
              create: student.testScores.map((ts) => ({
                type: ts.type as any,
                score: ts.score,
                testDate: ts.testDate,
              })),
            },
            activities: {
              create: student.activities.map((a) => ({
                name: a.name,
                category: a.category as any,
                role: a.role,
                description: a.description,
                hoursPerWeek: a.hoursPerWeek,
                weeksPerYear: a.weeksPerYear,
                isOngoing: true,
              })),
            },
            awards: {
              create: student.awards.map((aw) => ({
                name: aw.name,
                level: aw.level as any,
                year: aw.year,
              })),
            },
          },
        },
      },
    });

    usersCreated++;
    console.log(
      `  [创建] ${student.profile.realName} (GPA ${student.profile.gpa}, SAT ${student.testScores.find((t) => t.type === 'SAT')?.score || 'N/A'})`,
    );

    // 创建 SchoolListItem
    for (const item of student.schoolList) {
      const school = schoolMap.get(item.schoolName);
      if (!school) {
        console.log(`    [警告] 未找到学校: ${item.schoolName}`);
        continue;
      }
      await prisma.schoolListItem.create({
        data: {
          userId: user.id,
          schoolId: school.id,
          tier: item.tier as any,
          round: item.round,
        },
      });
      schoolListsCreated++;
    }
  }

  // 打印学校竞争者统计
  console.log('\n=== 学校竞争者统计 ===\n');
  const targetSchoolNames = [
    'Massachusetts Institute of Technology',
    'Stanford University',
    'Harvard University',
    'Princeton University',
    'University of Pennsylvania',
    'Columbia University',
    'Duke University',
    'Carnegie Mellon University',
    'University of California, Berkeley',
    'New York University',
  ];

  for (const name of targetSchoolNames) {
    const school = schoolMap.get(name);
    if (!school) continue;
    const count = await prisma.schoolListItem.count({
      where: {
        schoolId: school.id,
        user: { profile: { visibility: { not: 'PRIVATE' } } },
      },
    });
    console.log(`  ${school.nameZh || name}: ${count} 名竞争者`);
  }

  console.log(`
=== 完成 ===
  新建用户: ${usersCreated}
  新建选校: ${schoolListsCreated}
`);
}

main()
  .catch((e) => {
    console.error('种子脚本失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
