/**
 * Scoring Types
 */

export interface ProfileMetrics {
  gpa?: number;
  gpaScale?: number;
  gpaSystem?: string;
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
    tier?: number;
    yearsActive?: number;
  }>;
  /** High school tier (1-5) from HighSchool model */
  highSchoolTier?: number;
  /** High school type (HighSchoolType enum value) */
  highSchoolType?: string;
  /** AO recognition score (1-5) from HighSchool evaluation */
  highSchoolRecognition?: number;
  /** Academic rigor score (1-5) from HighSchool evaluation */
  highSchoolAcademicRigor?: number;
  /** Placement record score (1-5) — historical college placement to top US universities */
  highSchoolPlacementRecord?: number;
  /** Student quality score (1-5) — competitiveness of student body */
  highSchoolStudentQuality?: number;
  /** Resources score (1-5) — counseling, alumni network, AO relationships */
  highSchoolResources?: number;
  /** Grade inflation indicator */
  highSchoolGradeInflation?: string;
  /** Target major category for spike alignment detection */
  targetMajorCategory?: string;
}

/** 历史录取数据分布（用于数据驱动评分） */
export interface HistoricalDistribution {
  sampleCount: number;
  satValues: number[]; // 已排序的 SAT 中位数数组
  gpaValues: number[]; // 已排序的 GPA 中位数数组
  toeflValues: number[]; // 已排序的 TOEFL 中位数数组
}

export interface SchoolMetrics {
  /** 0–100 percentage (e.g. 4.0 means 4%). Internally divided by 100 in scoring. */
  acceptanceRate?: number;
  satAvg?: number;
  sat25?: number;
  sat75?: number;
  actAvg?: number;
  act25?: number;
  act75?: number;
  usNewsRank?: number;
  /** 4年毕业率 (0-100), College Scorecard */
  graduationRate?: number;
}

export interface ScoreBreakdown {
  academic: number;
  activity: number;
  award: number;
  overall: number;
}

/**
 * Options passed to selectivity / probability functions to customize for
 * international students and regional competition dynamics.
 */
export interface SelectivityOptions {
  useIntlRate?: boolean;
  intlAcceptanceRate?: number;
  /** ISO-3166-1 alpha-2 applicant region code, e.g. 'CN', 'KR', 'IN' */
  applicantRegion?: string;
  /** Override multiplier from DB/config — applied to the raw selectivity index */
  regionCompetitivenessMultiplier?: number;
  /** Education system code, e.g. 'IB', 'AP', 'A_LEVEL', 'GAOKAO' */
  educationSystem?: string;
}

export interface RankingScore {
  userId: string;
  score: number;
  breakdown: ScoreBreakdown;
}
