/**
 * 分数计算工具 (Score Calculator)
 *
 * [兼容层] 此文件从统一评分工具重新导出，保持向后兼容。
 * 所有新代码应直接引用 '@/common/utils/scoring'。
 *
 * @deprecated 直接使用 '../../common/utils/scoring' 代替
 */

export {
  type ProfileMetrics,
  type SchoolMetrics,
  type HistoricalDistribution,
  normalizeGpa,
  normalCDF,
  calculatePercentile,
  empiricalPercentile,
  parseRange,
  calculateAcademicScore,
  calculateActivityScore,
  calculateAwardScore,
  calculateOverallScore,
  calculateProbability,
  calculateTier,
  calculateConfidence,
  SCORING_WEIGHTS,
  ACADEMIC_CONFIG,
  TIER_POINTS,
  LEVEL_POINTS,
  LEADERSHIP_KEYWORDS,
} from '../../../common/utils/scoring';
