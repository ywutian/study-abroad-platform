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
import { evaluateHsConfidence, type HsConfidenceResult } from './hs-confidence';
import { computeTierFromPartial } from './tier';

// ============================================
// Log-odds utilities (v5 ML-Primary)
// ============================================

/** Convert probability to log-odds. Clamps input to avoid ±Infinity. */
export function logit(p: number): number {
  const safe = Math.max(0.001, Math.min(0.999, p));
  return Math.log(safe / (1 - safe));
}

/** Convert log-odds to probability. */
export function invLogit(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Adjust a probability by a log-odds shift. Mathematically correct for
 * odds-ratio modifiers (ED boost, legacy, need-aware penalty, etc.).
 * Unlike `p * multiplier`, this never exceeds [0, 1].
 */
export function adjustInLogOdds(p: number, logOddsShift: number): number {
  return invLogit(logit(p) + logOddsShift);
}

/**
 * Major-specific base rate multiplier (v5).
 * Competitive majors (CS@CMU, Engineering@MIT) have much lower effective
 * acceptance rates than the school-wide average.
 *
 * Source: CAPS framework (Zeng & Shen 2025), CDS Section C analysis.
 */
const MAJOR_RATE_MULTIPLIER: Record<number, number> = {
  5: 0.3, // Hyper-competitive (CS@CMU, CS@GT) — effective rate ~30% of overall
  4: 0.5, // High competition (Engineering@MIT)
  3: 1.0, // Neutral
  2: 1.3, // Low competition
  1: 1.5, // Very low competition
};

export function getMajorSelectivityMultiplier(competitiveness: number): number {
  return MAJOR_RATE_MULTIPLIER[competitiveness] ?? 1.0;
}

// ============================================
// Component Scores (0-100 each)
// ============================================

/**
 * Calculate GPA percentile from CDS Section C9/C11 distribution data.
 *
 * The CDS uses these standard GPA bands (values = % of enrolled freshmen):
 *   "4.00", "3.75-3.99", "3.50-3.74", "3.25-3.49",
 *   "3.00-3.24", "2.50-2.99", "2.00-2.49", "1.00-1.99", "<1.00"
 *
 * Returns the cumulative percentile (0-1) of the student's adjusted GPA
 * among the enrolled class, interpolating within bands.
 * Returns null if the distribution is empty or unusable.
 */
function calculateGpaPercentileFromCds(
  adjustedGpa4: number, // 0-1 scale (student's quality-adjusted GPA / 4.0)
  gpaDistribution: Record<string, number>
): number | null {
  // CDS bands in ascending GPA order, with threshold = lower bound / 4.0
  const bands: Array<{ key: string; altKey?: string; lo: number; hi: number }> = [
    { key: '<1.00', lo: 0.0, hi: 0.25 },
    { key: '1.00-1.99', lo: 0.25, hi: 0.5 },
    { key: '2.00-2.49', lo: 0.5, hi: 0.625 },
    { key: '2.50-2.99', lo: 0.625, hi: 0.75 },
    { key: '3.00-3.24', lo: 0.75, hi: 0.8125 },
    { key: '3.25-3.49', lo: 0.8125, hi: 0.875 },
    { key: '3.50-3.74', lo: 0.875, hi: 0.9375 },
    { key: '3.75-3.99', altKey: '3.75-4.00', lo: 0.9375, hi: 1.0 },
    { key: '4.00', lo: 1.0, hi: 1.0 },
  ];

  // Collect raw values; handle both decimal (0-1) and percentage (0-100) inputs
  const rawValues = bands.map((b) => {
    const v = gpaDistribution[b.key] ?? (b.altKey ? gpaDistribution[b.altKey] : undefined) ?? 0;
    return Math.max(0, v);
  });
  const total = rawValues.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;

  // Cumulative distribution: percentile = fraction of students AT or BELOW this band
  let cumulativeBelow = 0;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    const pct = rawValues[i] / total;
    const effectiveHi = i + 1 < bands.length ? bands[i + 1].lo : 1.001;

    if (adjustedGpa4 < effectiveHi) {
      // Student falls in this band — interpolate linearly within the band
      const bandWidth = effectiveHi - b.lo;
      const posInBand = bandWidth > 0.0001 ? Math.max(0, adjustedGpa4 - b.lo) / bandWidth : 0.5;
      return Math.max(0, Math.min(1, cumulativeBelow + pct * posInBand));
    }
    cumulativeBelow += pct;
  }
  return 1.0;
}

/**
 * 计算学术分数 (0-100)
 *
 * 针对国际生申请美本校准:
 * - GPA: CDS 百分位（有数据时）或归一化 4.0 映射 — 最大 36 分
 * - SAT/ACT: 四级 Fallback — 历史百分位 → 正态CDF → 差值法 → 默认基准, +/-18 分
 * - TOEFL: 门槛型 + 线性加分 — 低于90硬扣分, 以105为中位, +/-10 分
 * - 课程加分: IB Diploma +3, A-Level +2, 8+ APs +2, 5-7 APs +1
 */
export function calculateAcademicScore(
  profile: ProfileMetrics,
  school: SchoolMetrics = {},
  historicalDistribution?: HistoricalDistribution
): number {
  let score = ACADEMIC_CONFIG.baseScore;

  // Detect test-blind schools — SAT/ACT scores are not applicable
  const isTestBlind = school.testingPolicy === 'BLIND';

  if (profile.gpa) {
    const normalizedGpa = normalizeGpa(profile.gpa, profile.gpaScale ?? 4.0, profile.gpaSystem);
    const normalizedGpa4 = normalizedGpa / 4.0;
    const { gpaAdjustment } = getGpaWeight(
      profile.highSchoolRecognition,
      profile.highSchoolAcademicRigor,
      profile.highSchoolGradeInflation
    );
    const adjustedGpa4 = Math.min(normalizedGpa4 * gpaAdjustment, 1.0);

    // CDS percentile path: if school published GPA distribution, use it to find
    // the student's percentile rank among admitted/enrolled students. This is
    // more accurate than a linear normalization against a 4.0 scale.
    let gpaScore: number;
    const gpaDist = school.gpaDistribution;
    if (gpaDist != null && Object.keys(gpaDist).length > 0) {
      const cdsPercentile = calculateGpaPercentileFromCds(adjustedGpa4, gpaDist);
      gpaScore =
        cdsPercentile !== null
          ? cdsPercentile * ACADEMIC_CONFIG.gpaMaxBonus
          : adjustedGpa4 * ACADEMIC_CONFIG.gpaMaxBonus;
    } else {
      gpaScore = adjustedGpa4 * ACADEMIC_CONFIG.gpaMaxBonus;
    }

    score += gpaScore - ACADEMIC_CONFIG.gpaBaseline;
  }

  if (!isTestBlind && profile.satScore) {
    score += calculateTestScoreBonus(
      profile.satScore,
      { avg: school.satAvg, p25: school.sat25, p75: school.sat75 },
      historicalDistribution?.satValues,
      ACADEMIC_CONFIG.satMaxBonus
    );
  }

  if (!isTestBlind && profile.actScore && !profile.satScore) {
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

  // English proficiency: unified TOEFL/IELTS/Duolingo scoring
  // Uses normalized englishProficiencyScore (0-1) when available, falls back to raw toeflScore
  if (profile.englishProficiencyScore != null) {
    const norm = profile.englishProficiencyScore;
    const hardPenalty =
      norm < ACADEMIC_CONFIG.toeflHardPenaltyThreshold / 120 ? ACADEMIC_CONFIG.toeflHardPenalty : 0;
    // Map normalized score to bonus: baseline (105/120 ≈ 0.875) is neutral
    const toeflEquiv = norm * 120;
    const bonus = Math.max(
      -ACADEMIC_CONFIG.toeflMaxBonus,
      Math.min(ACADEMIC_CONFIG.toeflMaxBonus, (toeflEquiv - ACADEMIC_CONFIG.toeflBaseline) / 3)
    );
    score += bonus + hardPenalty;
  } else if (profile.toeflScore) {
    // Legacy fallback: raw TOEFL score
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

  // Curriculum rigor bonus: IB Diploma and many APs signal academic challenge
  if (profile.educationSystem) {
    const sys = profile.educationSystem.toUpperCase();
    if (sys === 'IB' || sys === 'IB_DIPLOMA') {
      // IB Diploma requires demanding 6-course curriculum + EE + TOK — +3 points
      score += 3;
    } else if (sys === 'A_LEVEL' || sys === 'A_LEVELS') {
      // A-Levels are internationally recognized rigorous curriculum — +2 points
      score += 2;
    }
  }
  if (profile.apCount != null && profile.apCount >= 8) {
    // 8+ AP courses is strong signal of academic rigor — +2 points
    score += 2;
  } else if (profile.apCount != null && profile.apCount >= 5) {
    // 5-7 APs — modest rigor signal — +1 point
    score += 1;
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
// High School Evaluation Utilities
// ============================================

/**
 * Compute tier from the 5 standardized evaluation dimensions.
 *
 * @deprecated Use `computeTierFromPartial()` from `./tier` instead,
 * which supports partial dimension inputs.
 */
export function computeTierFromDimensions(
  recognition: number,
  academicRigor: number,
  placementRecord: number,
  studentQuality: number,
  resources: number
): number {
  // Delegate to the unified implementation
  return computeTierFromPartial({
    recognition,
    academicRigor,
    placementRecord,
    studentQuality,
    resources,
  })!;
}

/**
 * GPA trust weight based on high school recognition, academic rigor,
 * and grade inflation signal.
 *
 * Higher recognition → AOs trust the GPA more → GPA gets more weight.
 * Higher rigor → grade deflation likely → GPA value adjusted upward.
 * Explicit gradeInflation signal fine-tunes the rigor-based adjustment.
 */
export function getGpaWeight(
  recognition?: number,
  academicRigor?: number,
  gradeInflation?: string
): { gpaWeight: number; testWeight: number; gpaAdjustment: number } {
  // GPA weight: recognition drives trust in GPA
  // Without recognition, default 0.5 weight
  const gpaWeight = recognition ? 0.35 + recognition * 0.05 : 0.5;
  const testWeight = 1.0 - gpaWeight;

  // GPA value adjustment: rigor and gradeInflation are INDEPENDENT
  // Either can work alone — gradeInflation no longer requires recognition
  let gpaAdjustment = 1.0;

  // rigor 1→0.97, 3→1.03, 5→1.09  (grade-deflated schools get GPA bump)
  if (academicRigor) {
    gpaAdjustment = 0.94 + academicRigor * 0.03;
  }

  // gradeInflation fine-tunes: explicit signal adjusts rigor-inferred value
  // deflation → bump GPA value (+0.03), inflation → discount (-0.03)
  // Works even without recognition/rigor — an explicit inflation signal
  // is valuable data on its own
  if (gradeInflation === 'deflation') {
    gpaAdjustment += 0.03;
  } else if (gradeInflation === 'inflation') {
    gpaAdjustment -= 0.03;
  }

  return { gpaWeight, testWeight, gpaAdjustment };
}

/**
 * Context-aware HS impact multiplier.
 *
 * Key insight: HS background matters more for highly selective schools.
 * Harvard's AOs know Phillips Exeter; UT Austin's care less.
 *
 * @param tier - High school tier (1-5)
 * @param recognition - AO recognition score (1-5)
 * @param schoolSelectivity - Target school selectivity index (0-1)
 * @param placementRecord - College placement record score (1-5)
 * @param hsConfidenceScale - Confidence scaling factor (0-1) from evaluateHsConfidence.
 *                            Low-confidence HS data gets attenuated rather than dropped.
 */
export function calculateHsImpact(
  tier: number | undefined,
  recognition: number | undefined,
  schoolSelectivity: number,
  placementRecord?: number,
  hsConfidenceScale = 1.0
): number {
  if (!tier) return 1.0;

  // Scale effect by target school selectivity: [0.3, 1.0]
  const selectivityScale = 0.3 + schoolSelectivity * 0.7;

  // Base tier effect — continuous mapping so tier 3 has a small positive effect:
  //   tier 1→-0.06, 2→-0.03, 3→+0.003, 4→+0.033, 5→+0.063
  // This fixes the previous (tier-3)*0.03 = 0 for tier 3, which made
  // ~50% of schools' HS data irrelevant.
  const baseTierEffect = tier <= 2 ? (tier - 3) * 0.03 : (tier - 2.9) * 0.03;

  // Extra bump if AOs specifically recognize this school
  const recognitionBonus =
    recognition && recognition >= 4 ? (recognition - 3) * 0.01 * selectivityScale : 0;

  // Placement record bonus: strong feeder schools (4-5) get an edge at selective targets
  // placementRecord 5→+0.02, 4→+0.01, ≤3→0
  const placementBonus =
    placementRecord && placementRecord >= 4 ? (placementRecord - 3) * 0.01 * selectivityScale : 0;

  const rawImpact = baseTierEffect * selectivityScale + recognitionBonus + placementBonus;

  // Confidence scaling: low-confidence HS data gets attenuated
  return 1.0 + rawImpact * hsConfidenceScale;
}

// ============================================
// Overall Score
// ============================================

/**
 * 计算综合分数 (0-100)
 *
 * Integrates HS confidence scaling — low-confidence HS data is attenuated.
 * For the full breakdown including hsConfidence metadata, use
 * `calculateOverallScoreDetailed()`.
 */
export function calculateOverallScore(
  profile: ProfileMetrics,
  school: SchoolMetrics = {},
  historicalDistribution?: HistoricalDistribution
): number {
  return calculateOverallScoreDetailed(profile, school, historicalDistribution).score;
}

export interface OverallScoreResult {
  score: number;
  hsConfidence: HsConfidenceResult;
  hsImpact: number;
}

/**
 * 计算综合分数 with full breakdown including HS confidence.
 *
 * Use this when you need to propagate HS confidence to the user
 * (e.g. in the prediction pipeline or statistical engine).
 */
export function calculateOverallScoreDetailed(
  profile: ProfileMetrics,
  school: SchoolMetrics = {},
  historicalDistribution?: HistoricalDistribution
): OverallScoreResult {
  const academic = calculateAcademicScore(profile, school, historicalDistribution);
  const activity = calculateActivityScore(profile);
  const award = calculateAwardScore(profile);

  const rawScore =
    academic * SCORING_WEIGHTS.academic +
    activity * SCORING_WEIGHTS.activity +
    award * SCORING_WEIGHTS.award;

  const hsConf = evaluateHsConfidence(profile);
  const selectivity = calculateSelectivityIndex(school);
  const hsImpactValue = calculateHsImpact(
    profile.highSchoolTier,
    profile.highSchoolRecognition,
    selectivity,
    profile.highSchoolPlacementRecord,
    hsConf.hsImpactScale
  );

  return {
    score: rawScore * hsImpactValue,
    hsConfidence: hsConf,
    hsImpact: hsImpactValue,
  };
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
 * AR-anchored 公式: P = AR * exp(z * 0.6)
 *
 * 设计原则:
 * - 当 z=0（学生实力恰好在门槛）时，P ≈ AR，与真实录取率对齐
 * - exp(z * 0.6) 让强生拉高、弱生降低，但始终以 AR 为基础
 * - Harvard Strong (87分): ~10% | Harvard Mid (70分): ~3% | 与真实数据一致
 * - 动态 floor = AR * 2%，保留区分度而非全部截断到同一最低值
 */
export function calculateProbability(
  overallScore: number,
  school: SchoolMetrics,
  selectivityOpts?: SelectivityOptions
): number {
  // AR-anchored: P = AR * exp(z * 0.6)
  // A neutral student (z=0) gets probability ≈ AR — the school's real acceptance rate.
  // A strong student (z>0) gets boosted; a weak student (z<0) gets penalized.
  const arRaw = school.acceptanceRate ?? 30;
  const ar = arRaw > 1 ? arRaw / 100 : arRaw;

  const selectivity = calculateSelectivityIndex(school, selectivityOpts);
  const threshold = 30 + selectivity * 45;
  const k = 8 + (1 - selectivity) * 7;
  const z = (overallScore - threshold) / k;

  const probability = ar * Math.exp(z * 0.6);

  // Dynamic floor: AR * 2% preserves discrimination at elite schools
  const floor = ar * 0.02;
  return Math.max(floor, Math.min(0.97, probability));
}

/**
 * Tier classification thresholds (probability is 0–1).
 *
 * Single source of truth — the backend `calculateTier` and the frontend
 * `getProbabilityTier` MUST both reference these so the displayed tier never
 * disagrees across layers. `MATCH_MIN` is 0.10 (not 0.30): the counselor
 * engine clamps top-20 schools near ~10%, so a 0.30 boundary would force
 * every elite school into `reach` and collapse the `match` tier exactly where
 * applicants need the distinction. Probabilities are already AR-anchored, so a
 * 0.10 match floor is meaningful across all selectivity tiers.
 */
export const TIER_THRESHOLDS = {
  /** probability ≥ this → `match` (below → `reach`) */
  MATCH_MIN: 0.1,
  /** probability ≥ this → `safety` */
  SAFETY_MIN: 0.6,
} as const;

/**
 * 计算 Tier 分类 (reach / match / safety)
 */
export function calculateTier(
  probability: number,
  _school: SchoolMetrics
): 'reach' | 'match' | 'safety' {
  if (probability >= TIER_THRESHOLDS.SAFETY_MIN) return 'safety';
  if (probability >= TIER_THRESHOLDS.MATCH_MIN) return 'match';
  return 'reach';
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
    const newProb = Math.max(0.005, Math.min(0.97, probs[i]));

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
