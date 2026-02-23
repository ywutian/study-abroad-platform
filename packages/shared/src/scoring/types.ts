/**
 * Scoring Types
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
  /** 4年毕业率 (0-100), College Scorecard */
  graduationRate?: number;
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
