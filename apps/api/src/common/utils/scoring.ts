/**
 * 统一评分工具 (Unified Scoring Utility)
 *
 * 纯计算逻辑已移至 @study-abroad/shared/scoring。
 * 本文件保留 Prisma 数据提取函数并 re-export 共享函数。
 */

// Re-export all pure scoring functions, constants, and types from shared
export {
  // Constants
  SCORING_WEIGHTS,
  ACADEMIC_CONFIG,
  TIER_POINTS,
  LEVEL_POINTS,
  LEADERSHIP_KEYWORDS,
  // Types
  type ProfileMetrics,
  type HistoricalDistribution,
  type SchoolMetrics,
  type ScoreBreakdown,
  type RankingScore,
  // Math utilities
  normalCDF,
  calculatePercentile,
  empiricalPercentile,
  parseRange,
  normalizeGpa,
  // Scoring functions
  calculateAcademicScore,
  calculateActivityScore,
  calculateAwardScore,
  calculateOverallScore,
  calculateOverallScoreDetailed,
  type OverallScoreResult,
  calculateScoreBreakdown,
  calculateProbability,
  calculateTier,
  calculateConfidence,
  enforceMonotonicity,
  calculateSelectivityIndex,
  // English proficiency
  getBestEnglishProficiency,
  normalizeEnglishScore,
  isEnglishProficiencyTest,
  ENGLISH_PROFICIENCY_THRESHOLDS,
} from '@study-abroad/shared/scoring';

import { TIER_POINTS, LEVEL_POINTS } from '@study-abroad/shared/scoring';
import { getBestEnglishProficiency } from '@study-abroad/shared/scoring';
import type {
  ProfileMetrics,
  SchoolMetrics,
} from '@study-abroad/shared/scoring';

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

  // Unified English proficiency: pick the best of TOEFL/IELTS/Duolingo
  const bestEnglish = getBestEnglishProficiency(testScores);
  const englishProficiencyScore = bestEnglish?.normalized;

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
    englishProficiencyScore,
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
  graduationRate?: any;
}): SchoolMetrics {
  return {
    acceptanceRate:
      school.acceptanceRate != null ? Number(school.acceptanceRate) : undefined,
    usNewsRank: school.usNewsRank ?? undefined,
    satAvg: school.satAvg ?? undefined,
    sat25: school.sat25 ?? undefined,
    sat75: school.sat75 ?? undefined,
    actAvg: school.actAvg ?? undefined,
    act25: school.act25 ?? undefined,
    act75: school.act75 ?? undefined,
    graduationRate:
      school.graduationRate != null ? Number(school.graduationRate) : undefined,
  };
}
