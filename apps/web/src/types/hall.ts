// Hall 模块类型定义 — 与后端 DTO 对齐
// 集中管理所有 Hall 页面相关的接口和类型

import type { SwipeCaseData } from '@/components/features/hall/SwipeCard';
import type { SwipeBadge } from '@/components/features/hall/BadgeDisplay';

type BadgeType = SwipeBadge;

// ============================================
// Re-export component types
// ============================================
export type { SwipeCaseData, SwipeBadge, BadgeType };

// ============================================
// Public Profile (Review Mode)
// ============================================
export interface PublicProfile {
  id: string;
  userId: string;
  grade?: string;
  gpa?: number;
  gpaScale?: number;
  targetMajor?: string;
  visibility: string;
  testScores?: Array<{ type: string; score: number }>;
  activities?: Array<{ name: string; category: string; role: string; description?: string }>;
  awards?: Array<{ name: string; level: string; year?: number }>;
  _count?: {
    testScores: number;
    activities: number;
    awards: number;
  };
}

// ============================================
// School (Ranking Mode)
// ============================================
export interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

// ============================================
// Ranking
// ============================================
export interface PercentileBands {
  p25: number;
  p50: number;
  p75: number;
}

export interface RankingResult {
  schoolId: string;
  schoolName: string;
  totalApplicants: number;
  yourRank: number;
  yourScore: number;
  percentile: number;
  breakdown: {
    academic: number;
    activity: number;
    award: number;
    overall: number;
  };
  percentiles: {
    academic: number;
    activity: number;
    award: number;
  };
  /** 竞争者分数分布 */
  scoreDistribution: {
    overall: PercentileBands;
    academic: PercentileBands;
    activity: PercentileBands;
    award: PercentileBands;
  };
  /** 竞争者汇总统计 */
  competitorStats: {
    avgScore: number;
    medianScore: number;
    totalCount: number;
  };
  /** 竞争力定位 */
  competitivePosition: 'strong' | 'moderate' | 'challenging';
}

export interface AiAnalysisResult {
  analysis: string;
  strengths: string[];
  improvements: string[];
  competitivePosition: string;
}

// ============================================
// Swipe Stats & Leaderboard
// ============================================
export interface SwipeStats {
  totalSwipes: number;
  correctCount: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  badge: BadgeType;
  toNextBadge: number;
  dailyChallengeCount: number;
  dailyChallengeTarget: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName?: string;
  accuracy: number;
  totalSwipes: number;
  correctCount: number;
  badge: BadgeType;
  isCurrentUser: boolean;
}

// ============================================
// Swipe Result (Prediction feedback)
// ============================================
export interface SwipeResult {
  isCorrect: boolean;
  actualResult: string;
  pointsEarned: number;
  currentStreak: number;
}

// ============================================
// Swipe Batch Response
// ============================================
export interface SwipeBatchMeta {
  totalAvailable: number;
  totalSwiped: number;
  hasMore: boolean;
}

export interface SwipeBatchResponse {
  cases: SwipeCaseData[];
  meta: SwipeBatchMeta;
}

// ============================================
// Leaderboard Response
// ============================================
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  currentUserEntry?: LeaderboardEntry;
}

// ============================================
// Tab configuration type
// ============================================
export type HallTab = 'tinder' | 'review' | 'ranking' | 'lists';

export type ReviewModuleType = 'standardized' | 'honors' | 'activities';
