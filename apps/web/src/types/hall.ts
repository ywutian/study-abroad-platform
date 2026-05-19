// Hall 模块类型定义 — 与后端 DTO 对齐
// 集中管理所有 Hall 页面相关的接口和类型

import type { SwipeCaseData } from '@/components/features/hall/SwipeCard';
import type { SchoolRanking } from '@/lib/utils/ranking';

// ============================================
// Re-export component types
// ============================================
export type { SwipeCaseData };

// Hall §7 Decision B: `PublicProfile` (review-mode profile picker type) was
// removed when the peer-review subsystem was retired.

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
  rankings?: SchoolRanking[];
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
  // 2026-05 Hall Plan C (C1): `competitivePosition` removed — see
  // hall-ranking.service.ts. The ranking surface reports a relative
  // percentile only, not a strong/moderate/challenging tier verdict.
}

export interface AiAnalysisResult {
  analysis: string;
  strengths: string[];
  improvements: string[];
}

// ============================================
// Swipe Stats — private calibration accuracy
// 2026-05 Hall Plan C (C3): de-gamified. Only the private total/correct/
// accuracy counters remain — no streak, badge, daily challenge.
// ============================================
export interface SwipeStats {
  totalSwipes: number;
  correctCount: number;
  accuracy: number;
}

// ============================================
// Swipe Result (Prediction feedback)
// 2026-05 Hall Plan C (C3): de-gamified — no points, no streak.
// ============================================
export interface SwipeResult {
  isCorrect: boolean;
  actualResult: string;
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
// Tab configuration type
// Hall §7 Decision B: the `review` tab and `ReviewModuleType` were removed.
// ============================================
export type HallTab = 'tinder' | 'ranking' | 'lists' | 'challenge' | 'verified';
