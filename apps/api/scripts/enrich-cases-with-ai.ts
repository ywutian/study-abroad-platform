/**
 * 使用 AI 逻辑补充案例数据
 *
 * 策略：
 * 1. 根据学校难度和录取结果，推断合理的成绩范围
 * 2. 基于统计数据生成符合分布的补充数据
 * 3. 补充专业、申请轮次等缺失字段
 */

import { PrismaClient, AdmissionResult } from '@prisma/client';

const prisma = new PrismaClient();

// 学校难度等级（基于录取率）
type DifficultyLevel =
  | 'elite'
  | 'highly_selective'
  | 'selective'
  | 'moderate'
  | 'accessible';

function getSchoolDifficulty(acceptanceRate: number | null): DifficultyLevel {
  if (!acceptanceRate) return 'moderate';
  if (acceptanceRate < 10) return 'elite';
  if (acceptanceRate < 20) return 'highly_selective';
  if (acceptanceRate < 35) return 'selective';
  if (acceptanceRate < 60) return 'moderate';
  return 'accessible';
}

// 根据学校难度和录取结果生成合理的成绩范围
function generateScores(
  difficulty: DifficultyLevel,
  result: AdmissionResult,
  existingGpa?: string | null,
  existingSat?: string | null,
  existingAct?: string | null,
) {
  // 基础成绩范围（根据学校难度）
  const baseRanges = {
    elite: {
      gpaMin: 3.85,
      gpaMax: 4.0,
      satMin: 1500,
      satMax: 1600,
      actMin: 34,
      actMax: 36,
    },
    highly_selective: {
      gpaMin: 3.75,
      gpaMax: 4.0,
      satMin: 1450,
      satMax: 1570,
      actMin: 32,
      actMax: 35,
    },
    selective: {
      gpaMin: 3.6,
      gpaMax: 4.0,
      satMin: 1350,
      satMax: 1500,
      actMin: 30,
      actMax: 34,
    },
    moderate: {
      gpaMin: 3.3,
      gpaMax: 3.9,
      satMin: 1200,
      satMax: 1400,
      actMin: 26,
      actMax: 31,
    },
    accessible: {
      gpaMin: 3.0,
      gpaMax: 3.7,
      satMin: 1100,
      satMax: 1300,
      actMin: 22,
      actMax: 28,
    },
  };

  const range = baseRanges[difficulty];

  // 根据录取结果调整（录取的成绩通常更高）
  let adjustment = 0;
  switch (result) {
    case 'ADMITTED':
      adjustment = 0.05;
      break;
    case 'WAITLISTED':
      adjustment = 0;
      break;
    case 'DEFERRED':
      adjustment = -0.02;
      break;
    case 'REJECTED':
      adjustment = -0.08;
      break;
  }

  // 生成随机但合理的成绩
  const randomInRange = (min: number, max: number, adj: number) => {
    const adjustedMin = Math.max(min * (1 + adj), min * 0.9);
    const adjustedMax = Math.min(max * (1 + adj), max);
    return adjustedMin + Math.random() * (adjustedMax - adjustedMin);
  };

  return {
    gpa:
      existingGpa ||
      randomInRange(range.gpaMin, range.gpaMax, adjustment).toFixed(2),
    sat:
      existingSat ||
      Math.round(
        randomInRange(range.satMin, range.satMax, adjustment * 10) / 10,
      ) * 10,
    act:
      existingAct ||
      Math.round(randomInRange(range.actMin, range.actMax, adjustment * 5)),
  };
}

// 常见专业列表（按热度）
const COMMON_MAJORS = [
  'Computer Science',
  'Business Administration',
  'Economics',
  'Biology',
  'Engineering',
  'Psychology',
  'Mathematics',
  'Political Science',
  'Chemistry',
  'Physics',
  'English',
  'History',
  'Neuroscience',
  'Data Science',
  'Finance',
  'Pre-Med',
  'Mechanical Engineering',
  'Electrical Engineering',
  'Biochemistry',
  'International Relations',
  'Communications',
  'Architecture',
  'Art',
  'Music',
  'Philosophy',
];

// 中文专业名称映射
const MAJOR_ZH: Record<string, string> = {
  'Computer Science': '计算机科学',
  'Business Administration': '工商管理',
  Economics: '经济学',
  Biology: '生物学',
  Engineering: '工程学',
  Psychology: '心理学',
  Mathematics: '数学',
  'Political Science': '政治学',
  Chemistry: '化学',
  Physics: '物理学',
  English: '英语',
  History: '历史学',
  Neuroscience: '神经科学',
  'Data Science': '数据科学',
  Finance: '金融学',
  'Pre-Med': '医学预科',
  'Mechanical Engineering': '机械工程',
  'Electrical Engineering': '电气工程',
  Biochemistry: '生物化学',
  'International Relations': '国际关系',
  Communications: '传播学',
  Architecture: '建筑学',
  Art: '艺术',
  Music: '音乐',
  Philosophy: '哲学',
};

// 申请轮次
const ROUNDS = ['EA', 'ED', 'ED2', 'RD', 'REA'];
const ROUND_WEIGHTS = [0.15, 0.25, 0.05, 0.5, 0.05]; // RD 最常见

function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

async function enrichCases() {
  console.log('🤖 开始使用 AI 逻辑补充案例数据...\n');

  // 获取所有需要补充的案例
  const cases = await prisma.admissionCase.findMany({
    include: {
      school: {
        select: { name: true, nameZh: true, acceptanceRate: true },
      },
    },
  });

  console.log(`📊 共 ${cases.length} 条案例待处理\n`);

  let updatedGpa = 0;
  let updatedSat = 0;
  let updatedAct = 0;
  let updatedMajor = 0;
  let updatedRound = 0;

  for (const caseItem of cases) {
    const difficulty = getSchoolDifficulty(
      caseItem.school?.acceptanceRate
        ? Number(caseItem.school.acceptanceRate)
        : null,
    );

    const updates: any = {};

    // 补充 GPA（如果缺失）
    if (!caseItem.gpaRange) {
      const scores = generateScores(difficulty, caseItem.result);
      updates.gpaRange = scores.gpa;
      updatedGpa++;
    }

    // 补充 SAT（如果缺失，50% 概率补充）
    if (!caseItem.satRange && Math.random() > 0.3) {
      const scores = generateScores(
        difficulty,
        caseItem.result,
        caseItem.gpaRange,
      );
      updates.satRange = String(scores.sat);
      updatedSat++;
    }

    // 补充 ACT（如果缺失且没有 SAT，30% 概率补充）
    if (
      !caseItem.actRange &&
      !caseItem.satRange &&
      !updates.satRange &&
      Math.random() > 0.5
    ) {
      const scores = generateScores(
        difficulty,
        caseItem.result,
        caseItem.gpaRange,
      );
      updates.actRange = String(scores.act);
      updatedAct++;
    }

    // 补充专业（如果缺失，80% 概率补充）
    if (!caseItem.major && Math.random() > 0.2) {
      const major =
        COMMON_MAJORS[Math.floor(Math.random() * COMMON_MAJORS.length)];
      updates.major = major;
      updatedMajor++;
    }

    // 补充申请轮次（如果缺失，70% 概率补充）
    if (!caseItem.round && Math.random() > 0.3) {
      updates.round = weightedRandom(ROUNDS, ROUND_WEIGHTS);
      updatedRound++;
    }

    // 更新数据库
    if (Object.keys(updates).length > 0) {
      await prisma.admissionCase.update({
        where: { id: caseItem.id },
        data: updates,
      });
    }
  }

  console.log('✅ 补充完成:\n');
  console.log(`   GPA: +${updatedGpa} 条`);
  console.log(`   SAT: +${updatedSat} 条`);
  console.log(`   ACT: +${updatedAct} 条`);
  console.log(`   专业: +${updatedMajor} 条`);
  console.log(`   轮次: +${updatedRound} 条`);

  // 验证结果
  console.log('\n📊 补充后数据完整性:');
  const afterCases = await prisma.admissionCase.findMany();
  const stats = {
    total: afterCases.length,
    hasGpa: afterCases.filter((c) => c.gpaRange).length,
    hasSat: afterCases.filter((c) => c.satRange).length,
    hasAct: afterCases.filter((c) => c.actRange).length,
    hasMajor: afterCases.filter((c) => c.major).length,
    hasRound: afterCases.filter((c) => c.round).length,
  };

  console.log(
    `   GPA: ${stats.hasGpa}/${stats.total} (${Math.round((stats.hasGpa / stats.total) * 100)}%)`,
  );
  console.log(
    `   SAT: ${stats.hasSat}/${stats.total} (${Math.round((stats.hasSat / stats.total) * 100)}%)`,
  );
  console.log(
    `   ACT: ${stats.hasAct}/${stats.total} (${Math.round((stats.hasAct / stats.total) * 100)}%)`,
  );
  console.log(
    `   专业: ${stats.hasMajor}/${stats.total} (${Math.round((stats.hasMajor / stats.total) * 100)}%)`,
  );
  console.log(
    `   轮次: ${stats.hasRound}/${stats.total} (${Math.round((stats.hasRound / stats.total) * 100)}%)`,
  );
}

enrichCases()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
