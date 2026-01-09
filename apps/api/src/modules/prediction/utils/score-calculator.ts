/**
 * 分数计算工具
 * 用于基础分数计算和 tier 分类
 */

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
}

export interface SchoolMetrics {
  acceptanceRate?: number;
  satAvg?: number;
  actAvg?: number;
  usNewsRank?: number;
}

/**
 * 归一化 GPA 到 4.0 制
 */
export function normalizeGpa(gpa: number, scale: number): number {
  if (scale === 4.0) return gpa;
  if (scale === 5.0) return (gpa / 5.0) * 4.0;
  if (scale === 100) return (gpa / 100) * 4.0;
  return gpa;
}

/**
 * 计算学术分数 (0-100)
 */
export function calculateAcademicScore(profile: ProfileMetrics, school: SchoolMetrics): number {
  let score = 50; // 基础分

  // GPA 分数 (最高 40 分)
  if (profile.gpa) {
    const normalizedGpa = normalizeGpa(profile.gpa, profile.gpaScale || 4.0);
    const gpaScore = (normalizedGpa / 4.0) * 40;
    score += gpaScore - 20; // 以 3.0 GPA 为基准
  }

  // SAT 分数 (最高 30 分)
  if (profile.satScore && school.satAvg) {
    const satDiff = profile.satScore - school.satAvg;
    // 每 50 分差距 = 5 分
    score += Math.max(-15, Math.min(15, satDiff / 50 * 5));
  } else if (profile.satScore) {
    // 无学校数据时，以 1400 为基准
    const satDiff = profile.satScore - 1400;
    score += Math.max(-15, Math.min(15, satDiff / 50 * 5));
  }

  // ACT 分数 (最高 30 分)
  if (profile.actScore && !profile.satScore) {
    const actNorm = profile.actScore / 36 * 1600; // 转换为 SAT 等效
    const schoolNorm = school.actAvg ? school.actAvg / 36 * 1600 : 1400;
    const actDiff = actNorm - schoolNorm;
    score += Math.max(-15, Math.min(15, actDiff / 50 * 5));
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 计算活动分数 (0-100)
 */
export function calculateActivityScore(profile: ProfileMetrics): number {
  let score = 30; // 基础分

  // 活动数量 (每个活动 +5 分，上限 50 分)
  score += Math.min(50, profile.activityCount * 5);

  // 领导力加分 (根据角色，这里简化处理)
  // 实际应该根据活动的 role 字段判断

  return Math.max(0, Math.min(100, score));
}

/**
 * 计算奖项分数 (0-100)
 */
export function calculateAwardScore(profile: ProfileMetrics): number {
  let score = 20; // 基础分

  // 国际级奖项 (+20 分/个，上限 40 分)
  score += Math.min(40, profile.internationalAwardCount * 20);

  // 国家级奖项 (+15 分/个，上限 30 分)
  score += Math.min(30, profile.nationalAwardCount * 15);

  // 其他奖项 (+5 分/个，上限 20 分)
  const otherAwards = profile.awardCount - profile.nationalAwardCount - profile.internationalAwardCount;
  score += Math.min(20, otherAwards * 5);

  return Math.max(0, Math.min(100, score));
}

/**
 * 计算综合分数
 */
export function calculateOverallScore(profile: ProfileMetrics, school: SchoolMetrics): number {
  const academicScore = calculateAcademicScore(profile, school);
  const activityScore = calculateActivityScore(profile);
  const awardScore = calculateAwardScore(profile);

  // 权重：学术 50%，活动 30%，奖项 20%
  return academicScore * 0.5 + activityScore * 0.3 + awardScore * 0.2;
}

/**
 * 根据分数和学校录取率计算录取概率
 */
export function calculateProbability(overallScore: number, school: SchoolMetrics): number {
  // 基础概率（基于学校录取率）
  const baseRate = school.acceptanceRate ? school.acceptanceRate / 100 : 0.3;

  // 根据综合分数调整
  // 分数 50 = 基础概率
  // 分数每 +10 = 概率 * 1.2
  // 分数每 -10 = 概率 * 0.8
  const scoreDiff = (overallScore - 50) / 10;
  const multiplier = Math.pow(1.2, scoreDiff);

  const probability = baseRate * multiplier;

  // 限制在 0.05 - 0.95 之间
  return Math.max(0.05, Math.min(0.95, probability));
}

/**
 * 计算 Tier 分类
 */
export function calculateTier(probability: number, school: SchoolMetrics): 'reach' | 'match' | 'safety' {
  // 考虑学校录取率
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
export function calculateConfidence(profile: ProfileMetrics, school: SchoolMetrics): 'low' | 'medium' | 'high' {
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



