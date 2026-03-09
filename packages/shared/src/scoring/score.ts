/**
 * Scoring Functions
 *
 * Pure functions for calculating academic, activity, award, and overall scores.
 * All functions operate on plain data types — no Prisma or database dependencies.
 */

import {
  SCORING_WEIGHTS,
  ACADEMIC_CONFIG,
  LEADERSHIP_KEYWORDS,
  ACTIVITY_TIER_POINTS,
  MAJOR_ACTIVITY_MAP,
  REGION_COMPETITIVENESS,
} from './constants';
import type {
  ProfileMetrics,
  SchoolMetrics,
  ScoreBreakdown,
  HistoricalDistribution,
  SelectivityOptions,
} from './types';
import { calculatePercentile, empiricalPercentile, normalizeGpa } from './math';

// ============================================
// Component Scores (0-100 each)
// ============================================

/**
 * 计算学术分数 (0-100)
 *
 * 针对国际生申请美本校准:
 * - GPA: 归一化到4.0后映射到 0-36 分 (3.0 GPA = 基准 18 分)
 * - SAT/ACT: 四级 Fallback — 历史百分位 → 正态CDF → 差值法 → 默认基准, +/-18 分
 * - TOEFL: 门槛型 + 线性加分 — 低于90硬扣分, 以105为中位, +/-10 分
 */
export function calculateAcademicScore(
  profile: ProfileMetrics,
  school: SchoolMetrics = {},
  historicalDistribution?: HistoricalDistribution
): number {
  let score = ACADEMIC_CONFIG.baseScore;

  if (profile.gpa) {
    const normalizedGpa = normalizeGpa(profile.gpa, profile.gpaScale ?? 4.0);
    const gpaScore = (normalizedGpa / 4.0) * ACADEMIC_CONFIG.gpaMaxBonus;
    score += gpaScore - ACADEMIC_CONFIG.gpaBaseline;
  }

  if (profile.satScore) {
    score += calculateTestScoreBonus(
      profile.satScore,
      { avg: school.satAvg, p25: school.sat25, p75: school.sat75 },
      historicalDistribution?.satValues,
      ACADEMIC_CONFIG.satMaxBonus
    );
  }

  if (profile.actScore && !profile.satScore) {
    if (school.act25 && school.act75 && school.act75 > school.act25) {
      const percentile = calculatePercentile(profile.actScore, school.act25, school.act75);
      score += (percentile - 0.5) * 2 * ACADEMIC_CONFIG.actMaxBonus;
    } else {
      const actNorm = (profile.actScore / 36) * 1600;
      const schoolNorm = school.actAvg ? (school.actAvg / 36) * 1600 : 1400;
      const actDiff = actNorm - schoolNorm;
      score += Math.max(
        -ACADEMIC_CONFIG.actMaxBonus,
        Math.min(ACADEMIC_CONFIG.actMaxBonus, (actDiff / 50) * 5)
      );
    }
  }

  // TOEFL: threshold gatekeeper + linear bonus (critical for intl students)
  if (profile.toeflScore) {
    const hardPenalty =
      profile.toeflScore < ACADEMIC_CONFIG.toeflHardPenaltyThreshold
        ? ACADEMIC_CONFIG.toeflHardPenalty
        : 0;
    const toeflBonus = Math.max(
      -ACADEMIC_CONFIG.toeflMaxBonus,
      Math.min(
        ACADEMIC_CONFIG.toeflMaxBonus,
        (profile.toeflScore - ACADEMIC_CONFIG.toeflBaseline) / 3
      )
    );
    score += toeflBonus + hardPenalty;
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
  maxBonus: number = 15
): number {
  // Level 1: 经验百分位（平台历史数据）
  if (historicalValues && historicalValues.length >= 30) {
    const percentile = empiricalPercentile(studentScore, historicalValues);
    return (percentile - 0.5) * 2 * maxBonus;
  }

  // Level 2: 正态 CDF 百分位
  if (school.p25 && school.p75 && school.p75 > school.p25) {
    const percentile = calculatePercentile(studentScore, school.p25, school.p75);
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
 * Tier-aware scoring: Quality (35) + Depth (25) + Leadership (20) + Spike (15) + Breadth (5)
 * Falls back to count-based scoring when activityDetails is unavailable.
 */
export function calculateActivityScore(profile: ProfileMetrics): number {
  if (profile.activityDetails && profile.activityDetails.length > 0) {
    const details = profile.activityDetails;
    let score = 0;

    // 1. Tier-based quality (max 35) — top 3 activities by tier
    const tierScores = details
      .map((a) => ACTIVITY_TIER_POINTS[a.tier ?? 4] ?? 2)
      .sort((a, b) => b - a)
      .slice(0, 3);
    score += Math.min(
      35,
      tierScores.reduce((s, v) => s + v, 0)
    );

    // 2. Depth & commitment (max 25)
    const deepActivities = details.filter((a) => a.totalHours > 200 || (a.yearsActive ?? 0) >= 3);
    score += Math.min(25, deepActivities.length * 8);

    // 3. Leadership progression (max 20)
    const leaderCount = details.filter((a) =>
      LEADERSHIP_KEYWORDS.some((kw) => a.role.toLowerCase().includes(kw as string))
    ).length;
    score += Math.min(20, leaderCount * 7);

    // 4. Spike alignment with target major (max 15)
    if (profile.targetMajorCategory) {
      const alignedCategories = MAJOR_ACTIVITY_MAP[profile.targetMajorCategory];
      if (alignedCategories) {
        const alignedCount = details.filter((a) => alignedCategories.includes(a.category)).length;
        score += Math.min(15, alignedCount * 5);
      }
    }

    // 5. Graduated breadth bonus (max 10)
    const uniqueCats = new Set(details.map((a) => a.category)).size;
    if (uniqueCats >= 5) score += 10;
    else if (uniqueCats >= 4) score += 8;
    else if (uniqueCats >= 3) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  // Fallback: count-based (improved to differentiate 6-10 activities)
  let score = 25;
  score += Math.min(40, profile.activityCount * 5);
  if (profile.activityCount >= 8) score += 8;
  if (profile.activityCount >= 10) score += 7;
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
  if (profile.awardTierScores && profile.awardTierScores.length > 0) {
    const totalPoints = profile.awardTierScores.reduce((sum, pts) => sum + pts, 0);
    return Math.max(0, Math.min(100, totalPoints));
  }

  let score = 20;
  score += Math.min(40, profile.internationalAwardCount * 20);
  score += Math.min(30, profile.nationalAwardCount * 15);
  const otherAwards =
    profile.awardCount - profile.nationalAwardCount - profile.internationalAwardCount;
  score += Math.min(20, Math.max(0, otherAwards) * 5);

  return Math.max(0, Math.min(100, score));
}

// ============================================
// Overall Score
// ============================================

/**
 * 计算综合分数 (0-100)
 */
export function calculateOverallScore(
  profile: ProfileMetrics,
  school: SchoolMetrics = {},
  historicalDistribution?: HistoricalDistribution
): number {
  const academic = calculateAcademicScore(profile, school, historicalDistribution);
  const activity = calculateActivityScore(profile);
  const award = calculateAwardScore(profile);

  const rawScore =
    academic * SCORING_WEIGHTS.academic +
    activity * SCORING_WEIGHTS.activity +
    award * SCORING_WEIGHTS.award;

  const HS_TIER_MULTIPLIER: Record<number, number> = { 5: 1.08, 4: 1.04, 3: 1.0, 2: 0.98, 1: 0.96 };
  const hsTierBonus = profile.highSchoolTier
    ? (HS_TIER_MULTIPLIER[profile.highSchoolTier] ?? 1.0)
    : 1.0;

  return rawScore * hsTierBonus;
}

/**
 * 计算综合分数并返回完整分解
 */
export function calculateScoreBreakdown(
  profile: ProfileMetrics,
  school: SchoolMetrics = {},
  historicalDistribution?: HistoricalDistribution
): ScoreBreakdown {
  const academic = calculateAcademicScore(profile, school, historicalDistribution);
  const activity = calculateActivityScore(profile);
  const award = calculateAwardScore(profile);

  return {
    academic,
    activity,
    award,
    overall: calculateOverallScore(profile, school, historicalDistribution),
  };
}

// ============================================
// Selectivity Index
// ============================================

/**
 * 综合选拔性指数 (Composite Selectivity Index)
 *
 * 返回 0-1，越高越难录取。仅使用客观政府数据源 (College Scorecard)，
 * 不依赖 US News 排名等年度波动较大的主观排名。
 *
 * 三个信号加权（缺失时自动重新归一化剩余信号）:
 * - Acceptance rate (0.45): pow(1 - rate/100, 0.6) — 非线性拉伸低录取率区间
 * - SAT midpoint  (0.25): (satMid - 1000) / 600 — 线性归一化
 * - Graduation rate (0.15): gradRate / 100 — 线性归一化
 * - US News rank  (0.15): 1 - (rank-1)/300 — 排名越高选拔性越高
 */
export function calculateSelectivityIndex(
  school: SchoolMetrics,
  opts?: SelectivityOptions
): number {
  const signals: Array<{ value: number; weight: number }> = [];

  // Signal 1: Acceptance rate (blend intl + overall for international students)
  const effectiveRate =
    opts?.useIntlRate && opts.intlAcceptanceRate != null
      ? opts.intlAcceptanceRate * 0.5 + (school.acceptanceRate ?? opts.intlAcceptanceRate) * 0.5
      : school.acceptanceRate;
  if (effectiveRate != null && effectiveRate > 0) {
    const normalizedRate = effectiveRate < 1 ? effectiveRate * 100 : effectiveRate;
    const value = Math.pow(1 - normalizedRate / 100, 0.6);
    signals.push({ value: Math.max(0, Math.min(1, value)), weight: 0.45 });
  }

  // Signal 2: SAT midpoint
  const satMid =
    school.sat25 != null && school.sat75 != null
      ? (school.sat25 + school.sat75) / 2
      : (school.satAvg ?? null);
  if (satMid != null) {
    const value = (satMid - 1000) / 600;
    signals.push({ value: Math.max(0, Math.min(1, value)), weight: 0.25 });
  }

  // Signal 3: Graduation rate
  if (school.graduationRate != null && school.graduationRate > 0) {
    const value = school.graduationRate / 100;
    signals.push({ value: Math.max(0, Math.min(1, value)), weight: 0.15 });
  }

  // Signal 4: US News rank
  if (school.usNewsRank != null && school.usNewsRank > 0) {
    const value = Math.max(0, 1 - (school.usNewsRank - 1) / 300);
    signals.push({ value: Math.max(0, Math.min(1, value)), weight: 0.15 });
  }

  // No data available — neutral prior
  if (signals.length === 0) return 0.5;

  // Re-normalize weights when some signals are missing
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  let index = signals.reduce((sum, s) => sum + (s.value * s.weight) / totalWeight, 0);

  // Apply region competitiveness multiplier (increases selectivity for competitive regions)
  const regionMultiplier =
    opts?.regionCompetitivenessMultiplier ??
    (opts?.applicantRegion
      ? (REGION_COMPETITIVENESS[opts.applicantRegion] ?? REGION_COMPETITIVENESS.DEFAULT)
      : 1.0);
  index = Math.min(1, index * regionMultiplier);

  return index;
}

// ============================================
// Probability & Tier
// ============================================

/**
 * 根据综合分数和学校选拔性指数计算录取概率
 *
 * 使用 logistic sigmoid 模型:
 * - threshold = 30 + selectivity * 45 (适配国际生分数分布)
 * - k = 8 + (1 - selectivity) * 7  (更宽的 sigmoid 以提高区分度)
 * - P = sigmoid((overallScore - threshold) / k)
 *
 * 所有信号来自 College Scorecard 客观数据，不依赖 US News 排名。
 */
export function calculateProbability(
  overallScore: number,
  school: SchoolMetrics,
  selectivityOpts?: SelectivityOptions
): number {
  const selectivity = calculateSelectivityIndex(school, selectivityOpts);
  const threshold = 30 + selectivity * 45;
  const k = 8 + (1 - selectivity) * 7;
  const z = (overallScore - threshold) / k;
  const probability = 1 / (1 + Math.exp(-z));
  return Math.max(0.05, Math.min(0.95, probability));
}

/**
 * 计算 Tier 分类 (reach / match / safety)
 */
export function calculateTier(
  probability: number,
  school: SchoolMetrics
): 'reach' | 'match' | 'safety' {
  const acceptanceRate = school.acceptanceRate || 30;

  if (acceptanceRate < 15) {
    if (probability >= 0.25) return 'match';
    return 'reach';
  } else if (acceptanceRate < 30) {
    if (probability >= 0.5) return 'safety';
    if (probability >= 0.25) return 'match';
    return 'reach';
  } else {
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
  school: SchoolMetrics
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
// Monotonicity Enforcement (batch-level)
// ============================================

/**
 * 批量预测结果的单调性约束 (Pool Adjacent Violators)
 *
 * 保证: selectivity index 越高的学校 → probability 越低（对同一学生而言）
 * 例如: MIT (sel≈0.93) 的 probability 永远 ≤ BU (sel≈0.72) 的 probability
 *
 * 排序使用 Composite Selectivity Index (基于 College Scorecard 客观数据)，
 * 而非仅凭 acceptance rate — 可区分同录取率但实际难度不同的学校。
 *
 * 算法: Pool Adjacent Violators (PAV)
 * 1. 按 selectivity index 升序排列（最易 → 最难）
 * 2. 如果 p[i] < p[i+1]（更易的学校概率反而更低），合并为平均值
 * 3. 重复直到满足单调非递增约束（selectivity 越高概率越低）
 *
 * @param results - 预测结果数组（会被就地修改）
 * @param recalculateTier - 调整后是否重新计算 tier
 */
export function enforceMonotonicity<
  T extends {
    probability: number;
    probabilityLow?: number;
    probabilityHigh?: number;
    tier: 'reach' | 'match' | 'safety';
    schoolMeta?: {
      acceptanceRate?: number;
      usNewsRank?: number;
      graduationRate?: number;
      satAvg?: number;
      sat25?: number;
      sat75?: number;
    };
  },
>(results: T[], recalculateTier = true): void {
  // 筛选有足够数据计算 selectivity 的结果
  const withData = results.filter((r) => {
    const m = r.schoolMeta;
    return (
      m &&
      (m.acceptanceRate != null || m.satAvg != null || m.sat25 != null || m.graduationRate != null)
    );
  });
  if (withData.length < 2) return;

  // 按 selectivity index 升序排列 (最易的学校在前 → 概率应最高)
  withData.sort(
    (a, b) =>
      calculateSelectivityIndex(a.schoolMeta as SchoolMetrics) -
      calculateSelectivityIndex(b.schoolMeta as SchoolMetrics)
  );

  // PAV: enforce non-increasing probabilities as selectivity increases
  // (即 probs 应从高到低: 最易学校概率最高)
  const probs = withData.map((r) => r.probability);
  const weights = withData.map(() => 1);

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < probs.length - 1; i++) {
      if (probs[i] < probs[i + 1]) {
        // Violation: 更易学校概率反而更低 → merge pools
        const poolSum = probs[i] * weights[i] + probs[i + 1] * weights[i + 1];
        const poolWeight = weights[i] + weights[i + 1];
        const poolAvg = poolSum / poolWeight;
        probs[i] = poolAvg;
        probs[i + 1] = poolAvg;
        weights[i] = poolWeight;
        weights[i + 1] = poolWeight;
        changed = true;
      }
    }
  }

  // Post-PAV tie-breaking: nudge colliding adjacent schools apart
  // so schools with different selectivity never share the exact same probability
  const epsilon = 0.005;
  for (let i = 0; i < probs.length - 1; i++) {
    if (Math.abs(probs[i] - probs[i + 1]) < 0.001) {
      probs[i] = probs[i] + epsilon;
      probs[i + 1] = probs[i + 1] - epsilon;
    }
  }

  // Apply adjusted probabilities back + recalculate confidence intervals and tiers
  for (let i = 0; i < withData.length; i++) {
    const r = withData[i];
    const oldProb = r.probability;
    const newProb = Math.max(0.05, Math.min(0.95, probs[i]));

    if (Math.abs(oldProb - newProb) > 0.001) {
      r.probability = newProb;

      // Scale confidence interval proportionally
      if (r.probabilityLow != null && r.probabilityHigh != null) {
        const halfWidth = (r.probabilityHigh - r.probabilityLow) / 2;
        r.probabilityLow = Math.max(0.01, newProb - halfWidth);
        r.probabilityHigh = Math.min(0.99, newProb + halfWidth);
      }

      // Recalculate tier
      if (recalculateTier) {
        r.tier = calculateTier(newProb, {
          acceptanceRate: r.schoolMeta?.acceptanceRate,
        });
      }
    }
  }
}
