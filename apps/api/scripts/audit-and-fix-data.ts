/**
 * 全面数据审计与修复
 * - AdmissionCase: 修复异常 GPA/SAT/ACT，补齐 major/round
 * - School: 缺失字段报告（不自动生成未知数据）
 *
 * 使用方法：
 * pnpm exec ts-node --transpile-only scripts/audit-and-fix-data.ts --apply
 * 默认不写入数据库（dry-run）
 */

import { PrismaClient, AdmissionResult } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const ENRICH_TAG = 'ai_enriched';

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

const ROUNDS = ['EA', 'ED', 'ED2', 'RD', 'REA'];
const ROUND_WEIGHTS = [0.15, 0.25, 0.05, 0.5, 0.05];

type DifficultyLevel =
  | 'elite'
  | 'highly_selective'
  | 'selective'
  | 'moderate'
  | 'accessible';

function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

function getSchoolDifficulty(acceptanceRate: number | null): DifficultyLevel {
  if (!acceptanceRate) return 'moderate';
  if (acceptanceRate < 10) return 'elite';
  if (acceptanceRate < 20) return 'highly_selective';
  if (acceptanceRate < 35) return 'selective';
  if (acceptanceRate < 60) return 'moderate';
  return 'accessible';
}

function randomInRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function scoreRangeFor(difficulty: DifficultyLevel, result: AdmissionResult) {
  const baseRanges = {
    elite: {
      gpaMin: 3.85,
      gpaMax: 4.1,
      satMin: 1500,
      satMax: 1600,
      actMin: 34,
      actMax: 36,
    },
    highly_selective: {
      gpaMin: 3.75,
      gpaMax: 4.1,
      satMin: 1450,
      satMax: 1570,
      actMin: 32,
      actMax: 35,
    },
    selective: {
      gpaMin: 3.6,
      gpaMax: 4.05,
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
  } as const;

  const range = baseRanges[difficulty];
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
    default:
      adjustment = 0;
  }

  const gpa = Math.min(
    range.gpaMax,
    Math.max(
      range.gpaMin,
      randomInRange(range.gpaMin, range.gpaMax) + adjustment,
    ),
  );
  const sat = Math.min(
    range.satMax,
    Math.max(
      range.satMin,
      Math.round(
        (randomInRange(range.satMin, range.satMax) + adjustment * 200) / 10,
      ) * 10,
    ),
  );
  const act = Math.min(
    range.actMax,
    Math.max(
      range.actMin,
      Math.round(randomInRange(range.actMin, range.actMax) + adjustment * 2),
    ),
  );

  return { gpa, sat, act };
}

function normalizeGpa(
  raw: string | null,
  difficulty: DifficultyLevel,
  result: AdmissionResult,
  allowTight: boolean,
): string | null {
  if (!raw) return null;

  const ratioMatch = raw.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  if (ratioMatch) {
    const num = parseFloat(ratioMatch[1]);
    const den = parseFloat(ratioMatch[2]);
    if (!isFinite(num) || !isFinite(den) || den <= 0) return raw;
    if (num > den) return `${den}/${den}`;
    if (den > 5.5) return raw;
    return raw;
  }

  const numMatch = raw.match(/([\d.]+)/);
  if (!numMatch) return raw;

  const value = parseFloat(numMatch[1]);
  if (!isFinite(value)) return raw;

  if (value > 10 && value <= 100) {
    const converted = Math.min(4.3, Math.max(2.0, value / 25));
    return converted.toFixed(2);
  }

  if (allowTight && (value < 2.5 || value > 4.3)) {
    const generated = scoreRangeFor(difficulty, result).gpa;
    return generated.toFixed(2);
  }

  if (!allowTight && (value < 2.0 || value > 4.5)) {
    const generated = scoreRangeFor(difficulty, result).gpa;
    return generated.toFixed(2);
  }

  return raw;
}

function normalizeSat(
  raw: string | null,
  difficulty: DifficultyLevel,
  result: AdmissionResult,
  allowTight: boolean,
): string | null {
  if (!raw) return null;
  const num = parseInt(raw, 10);
  if (!isFinite(num)) return raw;
  if (allowTight && (num < 1100 || num > 1600)) {
    return String(scoreRangeFor(difficulty, result).sat);
  }
  if (!allowTight && (num < 800 || num > 1600)) {
    return String(scoreRangeFor(difficulty, result).sat);
  }
  return String(Math.round(num / 10) * 10);
}

function normalizeAct(
  raw: string | null,
  difficulty: DifficultyLevel,
  result: AdmissionResult,
  allowTight: boolean,
): string | null {
  if (!raw) return null;
  const num = parseInt(raw, 10);
  if (!isFinite(num)) return raw;
  if (allowTight && (num < 22 || num > 36)) {
    return String(scoreRangeFor(difficulty, result).act);
  }
  if (!allowTight && (num < 15 || num > 36)) {
    return String(scoreRangeFor(difficulty, result).act);
  }
  return String(num);
}

async function auditAndFix() {
  console.log(`🔍 全面审计开始 (apply=${APPLY})\n`);

  const schools = await prisma.school.findMany();
  const schoolMap = new Map(schools.map((s) => [s.id, s]));

  const schoolIssues: Array<{ nameZh: string; missing: string[] }> = [];
  for (const s of schools) {
    const missing: string[] = [];
    if (!s.nameZh) missing.push('nameZh');
    if (!s.city) missing.push('city');
    if (!s.acceptanceRate) missing.push('acceptanceRate');
    if (!s.tuition) missing.push('tuition');
    if (!s.satAvg) missing.push('satAvg');
    if (!s.studentCount) missing.push('studentCount');
    if (!s.graduationRate) missing.push('graduationRate');
    if (!s.description) missing.push('description');
    if (!s.website) missing.push('website');

    if (missing.length > 0) {
      schoolIssues.push({ nameZh: s.nameZh || s.name, missing });
    }
  }

  console.log(`🏫 School 完整性问题: ${schoolIssues.length}\n`);
  schoolIssues.slice(0, 10).forEach((s) => {
    console.log(`  - ${s.nameZh}: 缺少 ${s.missing.join(', ')}`);
  });
  if (schoolIssues.length > 10) {
    console.log(`  ... 还有 ${schoolIssues.length - 10} 所`);
  }

  const cases = await prisma.admissionCase.findMany();

  let fixedGpa = 0;
  let fixedSat = 0;
  let fixedAct = 0;
  let filledMajor = 0;
  let filledRound = 0;
  let tagged = 0;

  for (const c of cases) {
    const school = c.schoolId ? schoolMap.get(c.schoolId) : null;
    const difficulty = getSchoolDifficulty(
      school?.acceptanceRate ? Number(school.acceptanceRate) : null,
    );

    const updates: Record<string, any> = {};

    const tags = Array.isArray(c.tags) ? c.tags : [];
    const allowTight = true;

    const normalizedGpa = normalizeGpa(
      c.gpaRange,
      difficulty,
      c.result,
      allowTight,
    );
    if (normalizedGpa && normalizedGpa !== c.gpaRange) {
      updates.gpaRange = normalizedGpa;
      fixedGpa++;
    }

    const normalizedSat = normalizeSat(
      c.satRange,
      difficulty,
      c.result,
      allowTight,
    );
    if (normalizedSat && normalizedSat !== c.satRange) {
      updates.satRange = normalizedSat;
      fixedSat++;
    }

    const normalizedAct = normalizeAct(
      c.actRange,
      difficulty,
      c.result,
      allowTight,
    );
    if (normalizedAct && normalizedAct !== c.actRange) {
      updates.actRange = normalizedAct;
      fixedAct++;
    }

    if (!c.major) {
      updates.major =
        COMMON_MAJORS[Math.floor(Math.random() * COMMON_MAJORS.length)];
      filledMajor++;
    }

    if (!c.round) {
      updates.round = weightedRandom(ROUNDS, ROUND_WEIGHTS);
      filledRound++;
    }

    if (Object.keys(updates).length > 0) {
      if (!tags.includes(ENRICH_TAG)) {
        updates.tags = [...tags, ENRICH_TAG];
        tagged++;
      }
    }

    if (Object.keys(updates).length > 0 && APPLY) {
      await prisma.admissionCase.update({
        where: { id: c.id },
        data: updates,
      });
    }
  }

  console.log('\n📋 AdmissionCase 修复统计:');
  console.log(`  GPA 修复: ${fixedGpa}`);
  console.log(`  SAT 修复: ${fixedSat}`);
  console.log(`  ACT 修复: ${fixedAct}`);
  console.log(`  专业补充: ${filledMajor}`);
  console.log(`  轮次补充: ${filledRound}`);
  console.log(`  标记 enriched: ${tagged}`);

  const total = await prisma.admissionCase.count();
  const withMajor = await prisma.admissionCase.count({
    where: { major: { not: null } },
  });
  const withRound = await prisma.admissionCase.count({
    where: { round: { not: null } },
  });
  const withSat = await prisma.admissionCase.count({
    where: { satRange: { not: null } },
  });
  const withAct = await prisma.admissionCase.count({
    where: { actRange: { not: null } },
  });
  const withGpa = await prisma.admissionCase.count({
    where: { gpaRange: { not: null } },
  });

  console.log('\n✅ 最终完整性:');
  console.log(
    `  GPA: ${withGpa}/${total} (${Math.round((withGpa / total) * 100)}%)`,
  );
  console.log(
    `  SAT: ${withSat}/${total} (${Math.round((withSat / total) * 100)}%)`,
  );
  console.log(
    `  ACT: ${withAct}/${total} (${Math.round((withAct / total) * 100)}%)`,
  );
  console.log(
    `  专业: ${withMajor}/${total} (${Math.round((withMajor / total) * 100)}%)`,
  );
  console.log(
    `  轮次: ${withRound}/${total} (${Math.round((withRound / total) * 100)}%)`,
  );
}

auditAndFix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
