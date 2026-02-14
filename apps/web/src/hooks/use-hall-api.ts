'use client';

/**
 * Hall 模块 API Hooks
 *
 * 将所有 Hall 页面的 React Query 调用集中到一个 hook 文件中，
 * 方便复用、测试和维护。各 Tab 组件直接调用这里的 hook。
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type {
  SwipeCaseData,
  SwipeBatchResponse,
  SwipeStats,
  SwipeResult,
  LeaderboardResponse,
  RankingResult,
  AiAnalysisResult,
} from '@/types/hall';

// ============================================
// Query Keys — 统一管理，防止拼写错误
// ============================================
export const hallKeys = {
  all: ['hall'] as const,
  swipeCases: () => [...hallKeys.all, 'swipeCases'] as const,
  swipeStats: () => [...hallKeys.all, 'swipeStats'] as const,
  leaderboard: () => [...hallKeys.all, 'leaderboard'] as const,
  targetRanking: () => [...hallKeys.all, 'targetRanking'] as const,
  ranking: (schoolIds: string[]) => [...hallKeys.all, 'ranking', ...schoolIds] as const,
  publicLists: () => [...hallKeys.all, 'publicLists'] as const,
};

// ============================================
// Tinder Mode Hooks
// ============================================

/** 批量获取待滑动案例 */
export function useSwipeCases(enabled: boolean) {
  return useQuery({
    queryKey: hallKeys.swipeCases(),
    queryFn: () => apiClient.get<SwipeBatchResponse>('/halls/swipe/batch?count=10'),
    enabled,
  });
}

/** 获取用户滑动统计 */
export function useSwipeStats(enabled: boolean) {
  return useQuery({
    queryKey: hallKeys.swipeStats(),
    queryFn: () => apiClient.get<SwipeStats>('/halls/swipe/stats'),
    enabled,
  });
}

/** 获取排行榜 */
export function useLeaderboard(enabled: boolean) {
  return useQuery({
    queryKey: hallKeys.leaderboard(),
    queryFn: () => apiClient.get<LeaderboardResponse>('/halls/swipe/leaderboard?limit=20'),
    enabled,
  });
}

/** 提交滑动预测 */
export function useSwipeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { caseId: string; prediction: 'admit' | 'reject' | 'waitlist' }) =>
      apiClient.post<SwipeResult>('/halls/swipe/predict', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hallKeys.swipeStats() });
      queryClient.invalidateQueries({ queryKey: hallKeys.leaderboard() });
    },
  });
}

// ============================================
// Ranking Mode Hooks
// ============================================

/** 获取目标学校排名（自动加载） */
export function useTargetRanking(enabled: boolean) {
  return useQuery({
    queryKey: hallKeys.targetRanking(),
    queryFn: () =>
      apiClient.get<{ rankings: RankingResult[]; totalTargetSchools: number }>(
        '/halls/target-ranking'
      ),
    enabled,
  });
}

/** 手动选择学校排名 */
export function useSchoolRanking(schoolIds: string[]) {
  return useQuery({
    queryKey: hallKeys.ranking(schoolIds),
    queryFn: () => apiClient.post<{ rankings: RankingResult[] }>('/halls/ranking', { schoolIds }),
    enabled: false, // 手动触发
  });
}

/** AI 排名分析 */
export function useAiAnalysis() {
  return useMutation({
    mutationFn: (schoolId: string) =>
      apiClient.post<AiAnalysisResult>('/halls/ranking-analysis', { schoolId }),
  });
}

// ============================================
// Review Mode Hooks
// ============================================

export const reviewKeys = {
  reviews: (profileUserId: string) => [...hallKeys.all, 'reviews', profileUserId] as const,
  reviewStats: (profileUserId: string) => [...hallKeys.all, 'reviewStats', profileUserId] as const,
  myReviews: () => [...hallKeys.all, 'myReviews'] as const,
};

/** 提交评审 */
export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      profileUserId: string;
      academicScore: number;
      testScore: number;
      activityScore: number;
      awardScore: number;
      overallScore: number;
      comment?: string;
      academicComment?: string;
      testComment?: string;
      activityComment?: string;
      awardComment?: string;
      tags?: string[];
      status?: 'DRAFT' | 'PUBLISHED';
    }) => apiClient.post('/halls/reviews', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hallKeys.publicLists() });
      queryClient.invalidateQueries({ queryKey: reviewKeys.reviews(variables.profileUserId) });
      queryClient.invalidateQueries({ queryKey: reviewKeys.reviewStats(variables.profileUserId) });
      queryClient.invalidateQueries({ queryKey: reviewKeys.myReviews() });
    },
  });
}

/** 获取某用户的评审列表 */
export function useReviews(profileUserId: string, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.reviews(profileUserId),
    queryFn: () => apiClient.get(`/halls/reviews/${profileUserId}`),
    enabled: !!profileUserId && enabled,
  });
}

/** 获取某用户的评审统计 */
export function useReviewStats(profileUserId: string, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.reviewStats(profileUserId),
    queryFn: () => apiClient.get(`/halls/reviews/${profileUserId}/stats`),
    enabled: !!profileUserId && enabled,
  });
}

/** 评审互动反应 */
export function useReactToReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { reviewId: string; type: 'helpful' | 'insightful' }) =>
      apiClient.post(`/halls/reviews/${data.reviewId}/react`, { type: data.type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hallKeys.all });
    },
  });
}

// ============================================
// Lists Mode Hooks
// ============================================

/** 获取公开榜单列表 */
export function usePublicLists(enabled: boolean) {
  return useQuery({
    queryKey: hallKeys.publicLists(),
    queryFn: () => apiClient.get<{ items: any[] }>('/halls/lists'),
    enabled,
  });
}
