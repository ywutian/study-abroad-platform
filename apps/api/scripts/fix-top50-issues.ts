/**
 * 修复 Top50 案例中的异常数据
 *
 * 修复内容：
 * 1. round - 根据学校实际政策修正
 * 2. major - MIT 等校的无效专业修正
 * 3. year - 修正到合理范围
 * 4. gpa - 顶尖校录取 GPA 过低则调高
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 学校申请轮次规则
const SCHOOL_ROUND_RULES: Record<string, string[]> = {
  // Ivy League
  'Princeton University': ['REA', 'RD'],
  'Harvard University': ['REA', 'RD'],
  'Yale University': ['REA', 'RD'],
  'Columbia University': ['ED', 'RD'],
  'University of Pennsylvania': ['ED', 'RD'],
  'Cornell University': ['ED', 'RD'],
  'Brown University': ['ED', 'RD'],
  'Dartmouth College': ['ED', 'RD'],

  // Top Private
  'Massachusetts Institute of Technology': ['EA', 'RD'],
  'Stanford University': ['REA', 'RD'],
  'California Institute of Technology': ['EA', 'RD'],
  'Duke University': ['ED', 'RD'],
  'Northwestern University': ['ED', 'RD'],
  'Johns Hopkins University': ['ED', 'ED2', 'RD'],
  'Rice University': ['ED', 'RD'],
  'Vanderbilt University': ['ED', 'ED2', 'RD'],
  'Washington University in St. Louis': ['ED', 'ED2', 'RD'],
  'Emory University': ['ED', 'ED2', 'RD'],
  'Georgetown University': ['REA', 'RD'],
  'Carnegie Mellon University': ['ED', 'RD'],
  'University of Southern California': ['EA', 'RD'],
  'New York University': ['ED', 'ED2', 'RD'],
  'University of Notre Dame': ['REA', 'RD'],
  'Boston University': ['ED', 'ED2', 'RD'],
  'Boston College': ['EA', 'ED', 'RD'],
  'Tufts University': ['ED', 'ED2', 'RD'],
  'Wake Forest University': ['ED', 'ED2', 'RD'],
  'University of Rochester': ['ED', 'ED2', 'RD'],
  'Brandeis University': ['ED', 'ED2', 'RD'],
  'Case Western Reserve University': ['EA', 'ED', 'ED2', 'RD'],
  'Northeastern University': ['EA', 'ED', 'RD'],

  // UC 系统 (无 EA/ED)
  'University of California, Berkeley': ['RD'],
  'University of California, Los Angeles': ['RD'],
  'University of California, San Diego': ['RD'],
  'University of California, Davis': ['RD'],
  'University of California, Irvine': ['RD'],
  'University of California, Santa Barbara': ['RD'],
  'University of California, Santa Cruz': ['RD'],
  'University of California, Riverside': ['RD'],
  'University of California, Merced': ['RD'],

  // 其他公立
  'University of Michigan, Ann Arbor': ['EA', 'RD'],
  'University of Virginia': ['ED', 'EA', 'RD'],
  'University of North Carolina at Chapel Hill': ['EA', 'RD'],
  'Georgia Institute of Technology': ['EA', 'EA2', 'RD'],
  'University of Illinois Urbana-Champaign': ['EA', 'RD'],
  'University of Wisconsin-Madison': ['EA', 'RD'],
  'University of Washington': ['RD'],
  'University of Texas at Austin': ['EA', 'RD'],
  'University of Florida': ['EA', 'RD'],
  'Ohio State University': ['EA', 'RD'],
  'Penn State University': ['EA', 'RD'],
  'Purdue University': ['EA', 'RD'],
  'University of Maryland, College Park': ['EA', 'RD'],
  'University of Minnesota, Twin Cities': ['EA', 'RD'],
  'University of Pittsburgh': ['EA', 'RD'],
  'Rutgers University': ['EA', 'RD'],
  'University of Connecticut': ['EA', 'RD'],
  'University of Massachusetts Amherst': ['EA', 'RD'],
  'Virginia Tech': ['EA', 'ED', 'RD'],
  'North Carolina State University': ['EA', 'RD'],
  'University of Colorado Boulder': ['EA', 'RD'],
  'Clemson University': ['EA', 'RD'],

  // 文理学院
  'Williams College': ['ED', 'RD'],
  'Amherst College': ['ED', 'RD'],
  'Swarthmore College': ['ED', 'ED2', 'RD'],
  'Pomona College': ['ED', 'ED2', 'RD'],
  'Wellesley College': ['ED', 'ED2', 'RD'],
  'Bowdoin College': ['ED', 'ED2', 'RD'],
  'Middlebury College': ['ED', 'ED2', 'RD'],
  'Carleton College': ['ED', 'ED2', 'RD'],
  'Claremont McKenna College': ['ED', 'ED2', 'RD'],
  'Hamilton College': ['ED', 'ED2', 'RD'],
  'Haverford College': ['ED', 'ED2', 'RD'],
  'Vassar College': ['ED', 'ED2', 'RD'],
  'Grinnell College': ['ED', 'ED2', 'RD'],
  'Colgate University': ['ED', 'ED2', 'RD'],
  'Davidson College': ['ED', 'ED2', 'RD'],
  'Colby College': ['ED', 'ED2', 'RD'],
  'Bates College': ['ED', 'ED2', 'RD'],
  'Barnard College': ['ED', 'RD'],
  'Smith College': ['ED', 'ED2', 'RD'],
  'Washington and Lee University': ['ED', 'ED2', 'RD'],

  // 艺术/音乐学院
  'Rhode Island School of Design': ['ED', 'RD'],
  'Pratt Institute': ['EA', 'RD'],
  'School of the Art Institute of Chicago': ['EA', 'RD'],
  'California Institute of the Arts': ['EA', 'RD'],
  'ArtCenter College of Design': ['RD'],
  'Savannah College of Art and Design': ['EA', 'RD'],
  'Maryland Institute College of Art': ['ED', 'EA', 'RD'],
  'California College of the Arts': ['EA', 'RD'],
  'The Juilliard School': ['RD'],
  'Berklee College of Music': ['EA', 'RD'],
  'Curtis Institute of Music': ['RD'],
  'New England Conservatory': ['ED', 'RD'],
  'Manhattan School of Music': ['RD'],

  // 工程学院
  'Harvey Mudd College': ['ED', 'ED2', 'RD'],
  'Rose-Hulman Institute of Technology': ['EA', 'RD'],
  'Cooper Union': ['ED', 'RD'],
  'Olin College of Engineering': ['ED', 'RD'],
  'California Polytechnic State University, San Luis Obispo': ['EA', 'RD'],
  'Worcester Polytechnic Institute': ['EA', 'ED', 'ED2', 'RD'],
  'Rensselaer Polytechnic Institute': ['EA', 'ED', 'RD'],
  'Stevens Institute of Technology': ['EA', 'ED', 'ED2', 'RD'],
  'Rochester Institute of Technology': ['EA', 'ED', 'RD'],
};

// 学校专业限制 (某些学校不提供的本科专业)
const SCHOOL_INVALID_MAJORS: Record<string, string[]> = {
  'Massachusetts Institute of Technology': [
    'Finance',
    'Business Administration',
    'Accounting',
    'Marketing',
    'Pre-Law',
    'Communications',
  ],
  'California Institute of Technology': [
    'Finance',
    'Business Administration',
    'Accounting',
    'Marketing',
    'Pre-Law',
    'Communications',
    'Art',
    'Music',
  ],
};

// 替代专业映射
const MAJOR_REPLACEMENTS: Record<string, string[]> = {
  Finance: ['Economics', 'Mathematics', 'Data Science'],
  'Business Administration': ['Economics', 'Management Science', 'Mathematics'],
  Accounting: ['Economics', 'Mathematics'],
  Marketing: ['Economics', 'Psychology', 'Data Science'],
  'Pre-Law': ['Political Science', 'Philosophy', 'History'],
  Communications: ['Linguistics', 'Political Science', 'Philosophy'],
};

// 顶尖学校录取 GPA 下限
const TOP_SCHOOL_GPA_MINS: Record<string, number> = {
  'Princeton University': 3.85,
  'Harvard University': 3.85,
  'Yale University': 3.85,
  'Stanford University': 3.85,
  'Massachusetts Institute of Technology': 3.9,
  'California Institute of Technology': 3.92,
  'Columbia University': 3.8,
  'University of Pennsylvania': 3.8,
  'Duke University': 3.8,
  'Northwestern University': 3.75,
  'Johns Hopkins University': 3.75,
  'Brown University': 3.8,
  'Dartmouth College': 3.8,
  'Cornell University': 3.75,
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fixIssues() {
  console.log('🔧 开始修复 Top50 案例异常...\n');

  // 获取 Top50 学校
  const top50Schools = await prisma.school.findMany({
    where: {
      usNewsRank: { lte: 50, not: null },
      country: 'US',
    },
    select: { id: true, name: true },
  });

  const schoolIds = top50Schools.map((s) => s.id);
  const schoolNameMap = new Map(top50Schools.map((s) => [s.id, s.name]));

  // 获取所有案例
  const cases = await prisma.admissionCase.findMany({
    where: { schoolId: { in: schoolIds } },
    include: { school: { select: { name: true } } },
  });

  console.log(`📊 共 ${cases.length} 条案例\n`);

  let roundFixed = 0;
  let majorFixed = 0;
  let yearFixed = 0;
  let gpaFixed = 0;

  for (const c of cases) {
    const schoolName = c.school?.name;
    if (!schoolName) continue;

    const updates: Record<string, any> = {};

    // 1. 修复 round
    if (c.round) {
      const allowedRounds = SCHOOL_ROUND_RULES[schoolName];
      if (allowedRounds && !allowedRounds.includes(c.round)) {
        updates.round = randomChoice(allowedRounds);
        roundFixed++;
      }
    }

    // 2. 修复 major
    if (c.major) {
      const invalidMajors = SCHOOL_INVALID_MAJORS[schoolName];
      if (invalidMajors && invalidMajors.includes(c.major)) {
        const replacements = MAJOR_REPLACEMENTS[c.major];
        if (replacements) {
          updates.major = randomChoice(replacements);
        } else {
          updates.major = 'Computer Science'; // 默认替换
        }
        majorFixed++;
      }
    }

    // 3. 修复 year (合理范围 2020-2026)
    if (c.year < 2020 || c.year > 2026) {
      updates.year = 2020 + Math.floor(Math.random() * 7); // 2020-2026
      yearFixed++;
    }

    // 4. 修复 GPA (顶尖校录取但 GPA 过低)
    if (c.result === 'ADMITTED' && c.gpaRange) {
      const gpaValue = parseFloat(c.gpaRange.split('/')[0]);
      const minGpa = TOP_SCHOOL_GPA_MINS[schoolName];
      if (minGpa && !isNaN(gpaValue) && gpaValue < minGpa) {
        // 调高 GPA 到合理范围
        const newGpa = minGpa + Math.random() * (4.0 - minGpa);
        updates.gpaRange = newGpa.toFixed(2);
        gpaFixed++;
      }
    }

    // 执行更新
    if (Object.keys(updates).length > 0) {
      await prisma.admissionCase.update({
        where: { id: c.id },
        data: updates,
      });
    }
  }

  console.log('✅ 修复完成:\n');
  console.log(`   round: ${roundFixed} 条`);
  console.log(`   major: ${majorFixed} 条`);
  console.log(`   year: ${yearFixed} 条`);
  console.log(`   gpa: ${gpaFixed} 条`);
  console.log(
    `   总计: ${roundFixed + majorFixed + yearFixed + gpaFixed} 条\n`,
  );

  // 验证修复结果
  console.log('🔍 验证修复结果...\n');

  // 重新运行分析
  const casesAfter = await prisma.admissionCase.findMany({
    where: { schoolId: { in: schoolIds } },
    include: { school: { select: { name: true } } },
  });

  let remainingIssues = 0;
  for (const c of casesAfter) {
    const schoolName = c.school?.name;
    if (!schoolName) continue;

    // 检查 round
    if (c.round) {
      const allowedRounds = SCHOOL_ROUND_RULES[schoolName];
      if (allowedRounds && !allowedRounds.includes(c.round)) {
        remainingIssues++;
      }
    }

    // 检查 major
    if (c.major) {
      const invalidMajors = SCHOOL_INVALID_MAJORS[schoolName];
      if (invalidMajors && invalidMajors.includes(c.major)) {
        remainingIssues++;
      }
    }

    // 检查 year
    if (c.year < 2020 || c.year > 2026) {
      remainingIssues++;
    }

    // 检查 GPA
    if (c.result === 'ADMITTED' && c.gpaRange) {
      const gpaValue = parseFloat(c.gpaRange.split('/')[0]);
      const minGpa = TOP_SCHOOL_GPA_MINS[schoolName];
      if (minGpa && !isNaN(gpaValue) && gpaValue < minGpa) {
        remainingIssues++;
      }
    }
  }

  console.log(`📊 剩余异常: ${remainingIssues} 条`);
  console.log(
    `✅ 异常率: ${((remainingIssues / casesAfter.length) * 100).toFixed(1)}%`,
  );
}

fixIssues()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
