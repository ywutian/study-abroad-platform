/**
 * 统一评分工具 (Unified Scoring Utility)
 *
 * 全局唯一的 Profile 评分系统。所有模块（Prediction、Hall、SchoolList、Profile）
 * 必须使用此文件中的函数进行评分，禁止在其他地方创建新的评分逻辑。
 *
 * 评分结构：
 *   - Academic Score (0-100): GPA + SAT/ACT (可选学校相对调整)
 *   - Activity Score (0-100): 活动数量和质量
 *   - Award Score (0-100): 奖项等级和数量
 *   - Overall Score: academic * 0.5 + activity * 0.3 + award * 0.2
 */

// ============================================
// Configurable Constants
// ============================================

/** 综合分数权重 */
export const SCORING_WEIGHTS = {
  academic: 0.5,
  activity: 0.3,
  award: 0.2,
} as const;

/** 学术分数配置 */
export const ACADEMIC_CONFIG = {
  baseScore: 50,
  gpaMaxBonus: 40,
  gpaBaseline: 20, // 3.0 GPA 对应的 gpaScore
  satMaxBonus: 15,
  actMaxBonus: 15,
  toeflMaxBonus: 5,
  toeflBaseline: 100,
} as const;

/** 竞赛层级分值映射 (与 Competition.tier 对应) */
export const TIER_POINTS: Record<number, number> = {
  5: 25, // IMO, IPhO, ISEF, Regeneron STS
  4: 15, // USAMO, USABO, NSDA Nationals, YoungArts
  3: 8, // AIME, PhysicsBowl, Science Olympiad, NEC
  2: 4, // AMC 12, FBLA, USACO Silver, VEX
  1: 2, // AMC 8, NHS, National Latin Exam
};

/** 无竞赛关联时按 AwardLevel 的默认分值 (与 COMPETITION_DATABASE.md 第 6 节一致) */
export const LEVEL_POINTS: Record<string, number> = {
  INTERNATIONAL: 20,
  NATIONAL: 15,
  STATE: 8,
  REGIONAL: 5,
  SCHOOL: 2,
};

/** 领导力角色关键词（不区分大小写匹配） */
export const LEADERSHIP_KEYWORDS = [
  'president',
  'founder',
  'captain',
  'director',
  'head',
  'chair',
  'editor-in-chief',
  'lead',
  'co-founder',
  '社长',
  '主席',
  '队长',
  '创始人',
  '负责人',
] as const;

// ============================================
// Types
// ============================================

export interface ProfileMetrics {
  gpa?: number;
  gpaScale?: number;
  satScore?: number;
  actScore?: number;
  toeflScore?: number;
  activityCount: number;
  awardCount: number;
  nationalAwardCount: number;
  internationalAwardCount: number;
  /** 每个奖项的分值（由 competition.tier 或 level 映射得出） */
  awardTierScores?: number[];
  /** 活动详情（用于质量评分，为空时退化到 activityCount 计数） */
  activityDetails?: Array<{
    category: string;
    role: string;
    totalHours: number;
  }>;
}

/** 历史录取数据分布（用于数据驱动评分） */
export interface HistoricalDistribution {
  sampleCount: number;
  satValues: number[]; // 已排序的 SAT 中位数数组
  gpaValues: number[]; // 已排序的 GPA 中位数数组
  toeflValues: number[]; // 已排序的 TOEFL 中位数数组
}

export interface SchoolMetrics {
  acceptanceRate?: number;
  satAvg?: number;
  sat25?: number;
  sat75?: number;
  actAvg?: number;
  act25?: number;
  act75?: number;
  usNewsRank?: number;
}

export interface ScoreBreakdown {
  academic: number;
  activity: number;
  award: number;
  overall: number;
}

export interface RankingScore {
  userId: string;
  score: number;
  breakdown: ScoreBreakdown;
}

// ============================================
// Statistical Utilities
// ============================================

/**
 * 标准正态分布 CDF（Abramowitz & Stegun 近似）
 * 精度 < 1e-5，无外部依赖
 *
 * @param z 标准化分数
 * @returns 累积概率 (0-1)
 */
export function normalCDF(z: number): number {
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741;
  const a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/**
 * 根据学校 25th/75th 百分位数据，计算学生分数在录取学生中的百分位
 * 假设分布近似正态，用 IQR 反推标准差
 *
 * 数学原理：
 *   正态分布中 25th = mu - 0.6745*sigma, 75th = mu + 0.6745*sigma
 *   IQR = p75 - p25 = 2 * 0.6745 * sigma → sigma = IQR / 1.349
 *
 * @param studentScore 学生分数
 * @param p25 学校录取学生 25th 百分位分数
 * @param p75 学校录取学生 75th 百分位分数
 * @returns 0-1 百分位（0.5 = 中位数）
 */
export function calculatePercentile(
  studentScore: number,
  p25: number,
  p75: number,
): number {
  if (p75 <= p25) return 0.5; // 数据异常保护
  const mu = (p25 + p75) / 2;
  const sigma = (p75 - p25) / (2 * 0.6745); // IQR → std dev
  const z = (studentScore - mu) / sigma;
  return normalCDF(z);
}

/**
 * 经验百分位：学生成绩在已排序数组中的百分位
 * 使用二分查找定位位置
 *
 * @param value 学生分数
 * @param sortedValues 已排序的分数数组（升序）
 * @returns 0-1 百分位
 */
export function empiricalPercentile(
  value: number,
  sortedValues: number[],
): number {
  if (sortedValues.length === 0) return 0.5;
  if (value <= sortedValues[0]) return 0;
  if (value >= sortedValues[sortedValues.length - 1]) return 1;

  // 二分查找
  let low = 0;
  let high = sortedValues.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sortedValues[mid] < value) low = mid + 1;
    else high = mid;
  }
  return low / sortedValues.length;
}

/**
 * 解析 "1500-1550" 格式的 range 字符串，返回中位数
 *
 * @param range 范围字符串，如 "1500-1550" 或 "3.7-3.9"
 * @returns 中位数，解析失败返回 null
 */
export function parseRange(range: string): number | null {
  const match = range.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return (parseFloat(match[1]) + parseFloat(match[2])) / 2;
}

// ============================================
// GPA Normalization
// ============================================

/**
 * 归一化 GPA 到 4.0 制
 * 支持 4.0, 5.0, 100 分制
 */
export function normalizeGpa(gpa: number, scale: number): number {
  if (scale === 4.0) return gpa;
  if (scale === 5.0) return (gpa / 5.0) * 4.0;
  if (scale === 100) return (gpa / 100) * 4.0;
  // Fallback: assume 4.0 scale
  return gpa;
}

// ============================================
// Component Scores (0-100 each)
// ============================================

/**
 * 计算学术分数 (0-100)
 *
 * - GPA: 归一化到4.0后映射到 0-40 分 (3.0 GPA = 基准)
 * - SAT/ACT: 三级 Fallback — 百分位 CDF → 差值法 → 默认基准
 * - TOEFL: 门槛型加分项 (+/- 5 分)
 *
 * @param profile 学生指标
 * @param school  学校指标（可选，提供时做学校相对调整）
 * @param historicalDistribution 历史数据分布（可选，Phase 4 数据驱动评分）
 */
export function calculateAcademicScore(
  profile: ProfileMetrics,
  school: SchoolMetrics = {},
  historicalDistribution?: HistoricalDistribution,
): number {
  let score = ACADEMIC_CONFIG.baseScore;

  // GPA 分数 (最高 40 分)
  if (profile.gpa) {
    const normalizedGpa = normalizeGpa(profile.gpa, profile.gpaScale ?? 4.0);
    const gpaScore = (normalizedGpa / 4.0) * ACADEMIC_CONFIG.gpaMaxBonus;
    score += gpaScore - ACADEMIC_CONFIG.gpaBaseline; // 以 3.0 GPA 为基准
  }

  // SAT 分数 (+/- 15 分) — 四级 Fallback
  if (profile.satScore) {
    score += calculateTestScoreBonus(
      profile.satScore,
      { avg: school.satAvg, p25: school.sat25, p75: school.sat75 },
      historicalDistribution?.satValues,
      ACADEMIC_CONFIG.satMaxBonus,
    );
  }

  // ACT 分数 (仅在无 SAT 时使用) — 四级 Fallback
  if (profile.actScore && !profile.satScore) {
    if (school.act25 && school.act75 && school.act75 > school.act25) {
      // 百分位评分
      const percentile = calculatePercentile(
        profile.actScore,
        school.act25,
        school.act75,
      );
      score += (percentile - 0.5) * 2 * ACADEMIC_CONFIG.actMaxBonus;
    } else {
      // 差值法 (转换为 SAT 等效)
      const actNorm = (profile.actScore / 36) * 1600;
      const schoolNorm = school.actAvg ? (school.actAvg / 36) * 1600 : 1400;
      const actDiff = actNorm - schoolNorm;
      score += Math.max(
        -ACADEMIC_CONFIG.actMaxBonus,
        Math.min(ACADEMIC_CONFIG.actMaxBonus, (actDiff / 50) * 5),
      );
    }
  }

  // TOEFL 分数 (+/- 5 分) — 国际生门槛型加分项
  // 100 为竞争力基准，120 为满分; 100分=0加成，120分=+5分，80分=-5分
  if (profile.toeflScore) {
    const toeflBonus = Math.max(
      -ACADEMIC_CONFIG.toeflMaxBonus,
      Math.min(
        ACADEMIC_CONFIG.toeflMaxBonus,
        (profile.toeflScore - ACADEMIC_CONFIG.toeflBaseline) / 4,
      ),
    );
    score += toeflBonus;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 计算标化成绩加分（内部辅助函数）
 *
 * 四级 Fallback:
 *   1. 平台历史数据 ≥ 30 条 → 经验百分位
 *   2. 学校有 p25 + p75 → 正态 CDF 百分位
 *   3. 学校有 avg → 差值法
 *   4. 无数据 → 默认基准 1400
 */
function calculateTestScoreBonus(
  studentScore: number,
  school: { avg?: number; p25?: number; p75?: number },
  historicalValues?: number[],
  maxBonus: number = 15,
): number {
  // Level 1: 经验百分位（平台历史数据）
  if (historicalValues && historicalValues.length >= 30) {
    const percentile = empiricalPercentile(studentScore, historicalValues);
    return (percentile - 0.5) * 2 * maxBonus;
  }

  // Level 2: 正态 CDF 百分位
  if (school.p25 && school.p75 && school.p75 > school.p25) {
    const percentile = calculatePercentile(
      studentScore,
      school.p25,
      school.p75,
    );
    return (percentile - 0.5) * 2 * maxBonus;
  }

  // Level 3: 差值法
  const baseline = school.avg ?? 1400;
  const diff = studentScore - baseline;
  return Math.max(-maxBonus, Math.min(maxBonus, (diff / 50) * 5));
}

/**
 * 计算活动分数 (0-100)
 *
 * 双路径:
 *   - 有 activityDetails 时: 数量 + 领导力 + 深度参与 + 多样性
 *   - 无 activityDetails 时: 退化到 activityCount 计数（向后兼容）
 */
export function calculateActivityScore(profile: ProfileMetrics): number {
  // 新路径：有详细数据时使用质量评分
  if (profile.activityDetails && profile.activityDetails.length > 0) {
    const details = profile.activityDetails;
    let score = 20; // 基础分

    // 数量分 (max 30): 每个活动 +3 分
    score += Math.min(30, details.length * 3);

    // 领导力分 (max 15): 领导角色每个 +5 分
    const leadershipCount = details.filter((a) =>
      LEADERSHIP_KEYWORDS.some((kw) =>
        a.role.toLowerCase().includes(kw as string),
      ),
    ).length;
    score += Math.min(15, leadershipCount * 5);

    // 深度参与分 (max 15): totalHours > 200 的活动每个 +5 分
    const deepCount = details.filter((a) => a.totalHours > 200).length;
    score += Math.min(15, deepCount * 5);

    // 多样性分 (max 10): 覆盖 >= 3 个不同 category
    const uniqueCategories = new Set(details.map((a) => a.category)).size;
    if (uniqueCategories >= 5) score += 10;
    else if (uniqueCategories >= 3) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  // Fallback 路径：旧逻辑（向后兼容）
  let score = 30; // 基础分
  score += Math.min(50, profile.activityCount * 5);
  return Math.max(0, Math.min(100, score));
}

/**
 * 计算奖项分数 (0-100)
 *
 * 双路径:
 *   - 有 awardTierScores 时: 基于 Competition.tier 层级加权
 *   - 无 awardTierScores 时: 退化到按 AwardLevel 计数（向后兼容）
 */
export function calculateAwardScore(profile: ProfileMetrics): number {
  // 新路径：有 awardTierScores 时使用层级评分
  if (profile.awardTierScores && profile.awardTierScores.length > 0) {
    const totalPoints = profile.awardTierScores.reduce(
      (sum, pts) => sum + pts,
      0,
    );
    return Math.max(0, Math.min(100, totalPoints));
  }

  // Fallback 路径：旧逻辑（向后兼容，当 awards 未 include competition 时）
  let score = 20; // 基础分

  // 国际级奖项
  score += Math.min(40, profile.internationalAwardCount * 20);

  // 国家级奖项
  score += Math.min(30, profile.nationalAwardCount * 15);

  // 其他奖项
  const otherAwards =
    profile.awardCount -
    profile.nationalAwardCount -
    profile.internationalAwardCount;
  score += Math.min(20, Math.max(0, otherAwards) * 5);

  return Math.max(0, Math.min(100, score));
}

// ============================================
// Overall Score
// ============================================

/**
 * 计算综合分数 (0-100)
 *
 * 权重: 学术 50% + 活动 30% + 奖项 20%
 */
export function calculateOverallScore(
  profile: ProfileMetrics,
  school: SchoolMetrics = {},
  historicalDistribution?: HistoricalDistribution,
): number {
  const academic = calculateAcademicScore(
    profile,
    school,
    historicalDistribution,
  );
  const activity = calculateActivityScore(profile);
  const award = calculateAwardScore(profile);

  return (
    academic * SCORING_WEIGHTS.academic +
    activity * SCORING_WEIGHTS.activity +
    award * SCORING_WEIGHTS.award
  );
}

/**
 * 计算综合分数并返回完整分解
 */
export function calculateScoreBreakdown(
  profile: ProfileMetrics,
  school: SchoolMetrics = {},
  historicalDistribution?: HistoricalDistribution,
): ScoreBreakdown {
  const academic = calculateAcademicScore(
    profile,
    school,
    historicalDistribution,
  );
  const activity = calculateActivityScore(profile);
  const award = calculateAwardScore(profile);

  return {
    academic,
    activity,
    award,
    overall:
      academic * SCORING_WEIGHTS.academic +
      activity * SCORING_WEIGHTS.activity +
      award * SCORING_WEIGHTS.award,
  };
}

// ============================================
// Probability & Tier
// ============================================

/**
 * 根据分数和学校录取率计算录取概率
 *
 * - 50 分 = 基础概率（学校录取率或默认 30%）
 * - 每 +10 分 => 概率 × 1.2
 * - 每 -10 分 => 概率 × 0.83
 * - 范围限制: 0.05 ~ 0.95
 */
export function calculateProbability(
  overallScore: number,
  school: SchoolMetrics,
): number {
  const baseRate = school.acceptanceRate ? school.acceptanceRate / 100 : 0.3;
  const scoreDiff = (overallScore - 50) / 10;
  const multiplier = Math.pow(1.2, scoreDiff);
  const probability = baseRate * multiplier;
  return Math.max(0.05, Math.min(0.95, probability));
}

/**
 * 计算 Tier 分类 (reach / match / safety)
 */
export function calculateTier(
  probability: number,
  school: SchoolMetrics,
): 'reach' | 'match' | 'safety' {
  const acceptanceRate = school.acceptanceRate || 30;

  if (acceptanceRate < 15) {
    // 顶尖学校
    if (probability >= 0.25) return 'match';
    return 'reach';
  } else if (acceptanceRate < 30) {
    // 选择性学校
    if (probability >= 0.5) return 'safety';
    if (probability >= 0.25) return 'match';
    return 'reach';
  } else {
    // 一般选择性学校
    if (probability >= 0.6) return 'safety';
    if (probability >= 0.35) return 'match';
    return 'reach';
  }
}

/**
 * 计算置信度
 */
export function calculateConfidence(
  profile: ProfileMetrics,
  school: SchoolMetrics,
): 'low' | 'medium' | 'high' {
  let dataPoints = 0;

  if (profile.gpa) dataPoints++;
  if (profile.satScore || profile.actScore) dataPoints++;
  if (profile.activityCount > 0) dataPoints++;
  if (profile.awardCount > 0) dataPoints++;
  if (school.acceptanceRate) dataPoints++;
  if (school.satAvg || school.actAvg) dataPoints++;

  if (dataPoints >= 5) return 'high';
  if (dataPoints >= 3) return 'medium';
  return 'low';
}

// ============================================
// Helper: Extract ProfileMetrics from Prisma Data
// ============================================

/**
 * 从 Prisma Profile（含 include）中提取 ProfileMetrics
 *
 * @param profile Prisma Profile with testScores, activities, awards
 *   - awards 可选包含 competition 关系（用于层级评分）
 *   - activities 的 category/role/hoursPerWeek/weeksPerYear（用于质量评分）
 */
export function extractProfileMetrics(profile: {
  gpa?: any;
  gpaScale?: any;
  testScores?: Array<{ type: string; score: number }>;
  activities?: Array<{
    category?: string;
    role?: string;
    hoursPerWeek?: number | null;
    weeksPerYear?: number | null;
    [key: string]: any;
  }>;
  awards?: Array<{
    level?: string;
    competition?: { tier: number } | null;
    [key: string]: any;
  }>;
}): ProfileMetrics {
  const gpa = profile.gpa ? Number(profile.gpa) : undefined;
  const gpaScale = profile.gpaScale ? Number(profile.gpaScale) : undefined;

  const testScores = profile.testScores || [];
  const satScore = testScores.find((t) => t.type === 'SAT')?.score;
  const actScore = testScores.find((t) => t.type === 'ACT')?.score;
  const toeflScore = testScores.find((t) => t.type === 'TOEFL')?.score;

  const activities = profile.activities || [];
  const awards = profile.awards || [];

  const internationalAwardCount = awards.filter(
    (a) => a.level === 'INTERNATIONAL',
  ).length;
  const nationalAwardCount = awards.filter(
    (a) => a.level === 'NATIONAL',
  ).length;

  // 计算每个奖项的层级分值（竞赛层级 → TIER_POINTS，无竞赛 → LEVEL_POINTS）
  const awardTierScores = awards.map((a) => {
    if (a.competition?.tier) {
      return (
        TIER_POINTS[a.competition.tier] ?? LEVEL_POINTS[a.level ?? ''] ?? 3
      );
    }
    return LEVEL_POINTS[a.level ?? ''] ?? 3;
  });

  // 提取活动详情（用于质量评分）
  const activityDetails = activities
    .filter((a) => a.category && a.role)
    .map((a) => ({
      category: a.category!,
      role: a.role || '',
      totalHours: (a.hoursPerWeek || 0) * (a.weeksPerYear || 0),
    }));

  return {
    gpa,
    gpaScale,
    satScore,
    actScore,
    toeflScore,
    activityCount: activities.length,
    awardCount: awards.length,
    nationalAwardCount,
    internationalAwardCount,
    awardTierScores: awardTierScores.length > 0 ? awardTierScores : undefined,
    activityDetails: activityDetails.length > 0 ? activityDetails : undefined,
  };
}

/**
 * 从 Prisma School 中提取 SchoolMetrics
 *
 * 注意: satAvg/actAvg 等字段现在直接存储在 School 模型上（非 metadata），
 * 由 College Scorecard 同步服务和 seed 脚本写入。
 */
export function extractSchoolMetrics(school: {
  acceptanceRate?: any;
  usNewsRank?: number | null;
  satAvg?: number | null;
  sat25?: number | null;
  sat75?: number | null;
  actAvg?: number | null;
  act25?: number | null;
  act75?: number | null;
}): SchoolMetrics {
  return {
    acceptanceRate: school.acceptanceRate
      ? Number(school.acceptanceRate)
      : undefined,
    usNewsRank: school.usNewsRank ?? undefined,
    satAvg: school.satAvg ?? undefined,
    sat25: school.sat25 ?? undefined,
    sat75: school.sat75 ?? undefined,
    actAvg: school.actAvg ?? undefined,
    act25: school.act25 ?? undefined,
    act75: school.act75 ?? undefined,
  };
}
