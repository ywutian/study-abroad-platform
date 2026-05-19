'use client';

/**
 * Hall 模块 API Hooks
 *
 * 将所有 Hall 页面的 React Query 调用集中到一个 hook 文件中，
 * 方便复用、测试和维护。各 Tab 组件直接调用这里的 hook。
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hallRoutes, pointsRedemptionRoutes, API_ROUTES } from '@study-abroad/shared';
import type {
  HallOverviewPayload,
  ChallengeAttemptResult,
  RedemptionType,
  RedemptionResult,
  RedemptionCatalogItem,
  ChinaAdmitTrendResponse,
  DifficultySignalEntry,
} from '@study-abroad/shared';
import { apiClient } from '@/lib/api';
import type {
  SwipeBatchResponse,
  SwipeStats,
  SwipeResult,
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
  targetRanking: () => [...hallKeys.all, 'targetRanking'] as const,
  ranking: (schoolIds: string[]) => [...hallKeys.all, 'ranking', ...schoolIds] as const,
  publicLists: () => [...hallKeys.all, 'publicLists'] as const,
  // Hall refactor Stage 1-7 — new query keys
  overview: () => [...hallKeys.all, 'overview'] as const,
  redemptionCatalog: () => [...hallKeys.all, 'redemptionCatalog'] as const,
  redemptionHistory: () => [...hallKeys.all, 'redemptionHistory'] as const,
  // Hall refactor Stage 3 — Verified China Admit Dashboard
  chinaAdmitTrend: (schoolIds: string[], years: number) =>
    [...hallKeys.all, 'chinaAdmitTrend', years, ...schoolIds] as const,
  difficultySignal: (schoolIds: string[]) =>
    [...hallKeys.all, 'difficultySignal', ...schoolIds] as const,
};

// ============================================
// Tinder Mode Hooks
// ============================================

/** 批量获取待滑动案例 */
export function useSwipeCases(enabled: boolean) {
  return useQuery({
    queryKey: hallKeys.swipeCases(),
    queryFn: () => apiClient.get<SwipeBatchResponse>(`${hallRoutes.swipe()}/batch?count=10`),
    enabled,
  });
}

/** 获取用户滑动统计 */
export function useSwipeStats(enabled: boolean) {
  return useQuery({
    queryKey: hallKeys.swipeStats(),
    queryFn: () => apiClient.get<SwipeStats>(`${hallRoutes.swipe()}/stats`),
    enabled,
  });
}

/** 提交滑动预测 */
export function useSwipeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { caseId: string; prediction: 'admit' | 'reject' | 'waitlist' }) =>
      apiClient.post<SwipeResult>(`${hallRoutes.swipe()}/predict`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hallKeys.swipeStats() });
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
        `${API_ROUTES.HALLS}/target-ranking`
      ),
    enabled,
  });
}

/** 手动选择学校排名 */
export function useSchoolRanking(schoolIds: string[]) {
  return useQuery({
    queryKey: hallKeys.ranking(schoolIds),
    queryFn: () =>
      apiClient.post<{ rankings: RankingResult[] }>(`${API_ROUTES.HALLS}/ranking`, { schoolIds }),
    enabled: false, // 手动触发
  });
}

/** AI 排名分析 */
export function useAiAnalysis() {
  return useMutation({
    mutationFn: (schoolId: string) =>
      apiClient.post<AiAnalysisResult>(`${API_ROUTES.HALLS}/ranking-analysis`, { schoolId }),
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

/** Per-step swipe direction recorded by the Tinder review wizard. */
export type ReviewSwipeDirection = 'left' | 'right' | 'up';

/** Swipe metadata persisted alongside a SWIPE-method review. */
export interface ReviewSwipeData {
  directionsPerStep: Partial<
    Record<'academic' | 'test' | 'activity' | 'award', ReviewSwipeDirection>
  >;
  confidencePerStep?: Partial<Record<'academic' | 'test' | 'activity' | 'award', number>>;
}

export interface SubmitReviewInput {
  profileUserId: string;
  comment?: string;
  academicComment?: string;
  testComment?: string;
  activityComment?: string;
  awardComment?: string;
  tags?: string[];
  status?: 'DRAFT' | 'PUBLISHED';
  quickTags?: string[];
  // Plan C / C2: numeric 1-10 scoring removed — peer review is qualitative-only.
  // The backend `CreateReviewDto` score fields are now optional (defaulted to a
  // neutral value server-side); the frontend simply stops sending them.
}

/** 提交评审 */
export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubmitReviewInput) => apiClient.post(hallRoutes.reviews(), data),
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
    queryFn: () => apiClient.get(`${hallRoutes.reviews()}/${profileUserId}`),
    enabled: !!profileUserId && enabled,
  });
}

/** 获取某用户的评审统计 */
export function useReviewStats(profileUserId: string, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.reviewStats(profileUserId),
    queryFn: () => apiClient.get(`${hallRoutes.reviews()}/${profileUserId}/stats`),
    enabled: !!profileUserId && enabled,
  });
}

/** 评审互动反应 */
export function useReactToReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { reviewId: string; type: 'helpful' | 'insightful' }) =>
      apiClient.post(hallRoutes.reviewReact(data.reviewId), { type: data.type }),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => apiClient.get<{ items: any[] }>(hallRoutes.lists()),
    enabled,
  });
}

// ============================================
// Hall refactor Stage 1 — BFF Overview hook
// ============================================

/**
 * Aggregated /halls/me/overview — powers the HallHeroBar (points, swipe,
 * daily challenge, reviewer status, recent activity) in a single round trip.
 */
export function useHallOverview(enabled = true) {
  return useQuery({
    queryKey: hallKeys.overview(),
    queryFn: () => apiClient.get<HallOverviewPayload>(hallRoutes.meOverview()),
    enabled,
    staleTime: 30_000,
  });
}

// ============================================
// Hall refactor Stage 2 — Review report + qualification
//
// 2026-05 Hall Plan C (C2b): `useReviewAggregate` was removed — the numeric
// review-score aggregation endpoint it called was retired.
// ============================================

/** Report a review (sends to admin moderation queue via central Report table). */
export function useReportReview() {
  return useMutation({
    mutationFn: (data: { reviewId: string; reason: string; detail?: string }) =>
      apiClient.post(hallRoutes.reviewReport(data.reviewId), {
        reason: data.reason,
        detail: data.detail,
      }),
  });
}

/** L1→L2 reviewer qualification quiz. */
export function useReviewerQualificationQuiz(enabled = true) {
  return useQuery({
    queryKey: [...hallKeys.all, 'reviewerQuiz'] as const,
    queryFn: () => apiClient.get(hallRoutes.reviewerQualification()),
    enabled,
    staleTime: Infinity, // questions don't change per session
  });
}

export function useSubmitReviewerQualification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      answers: Array<{ questionId: string; answer: 'admit' | 'reject' | 'waitlist' }>;
    }) => apiClient.post(hallRoutes.reviewerQualification(), data),
    onSuccess: () => {
      // Promotion changes reviewerLevel — refresh overview to update the badge.
      queryClient.invalidateQueries({ queryKey: hallKeys.overview() });
    },
  });
}

// ============================================
// Hall refactor Stage 5 — AI Review Coach
// ============================================

/**
 * AI Review Coach: reflective insight on the reviewer's evaluation style.
 * Graceful: returns { insight: null, fallback: true } when LLM unavailable.
 */
export function useReviewCoachInsight() {
  return useMutation({
    mutationFn: (data?: { locale?: 'en' | 'zh' }) =>
      apiClient.post(hallRoutes.reviewerCoach(), data ?? {}),
  });
}

// ============================================
// Hall refactor Stage 1 — Challenge submission (persisted)
// ============================================

/** Submit a multi-school challenge guess set; persists to ChallengeAttempt. */
export function useSubmitChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guesses: Record<string, string>) =>
      apiClient.post<ChallengeAttemptResult>(hallRoutes.challengeSubmit(), {
        guesses,
      }),
    onSuccess: () => {
      // Daily challenge counts toward CHALLENGE_COMPLETE — refresh overview.
      queryClient.invalidateQueries({ queryKey: hallKeys.overview() });
      queryClient.invalidateQueries({ queryKey: hallKeys.swipeStats() });
    },
  });
}

// ============================================
// Hall refactor Stage 7 — Points redemption (cross-module spend)
// ============================================

export function useRedemptionCatalog(enabled = true) {
  return useQuery({
    queryKey: hallKeys.redemptionCatalog(),
    queryFn: () =>
      apiClient.get<RedemptionCatalogItem[]>(pointsRedemptionRoutes.redemptionsCatalog()),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useRedemptionHistory(enabled = true) {
  return useQuery({
    queryKey: hallKeys.redemptionHistory(),
    queryFn: () => apiClient.get(pointsRedemptionRoutes.redemptions() + '?limit=20'),
    enabled,
  });
}

export function useRedeem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: RedemptionType; metadata?: Record<string, unknown> }) =>
      apiClient.post<RedemptionResult>(pointsRedemptionRoutes.redemptions(), data),
    onSuccess: () => {
      // Balance changed; refresh overview + history.
      queryClient.invalidateQueries({ queryKey: hallKeys.overview() });
      queryClient.invalidateQueries({ queryKey: hallKeys.redemptionHistory() });
    },
  });
}

// ============================================
// Hall refactor Stage 3 — Verified China Admit Dashboard
// ============================================

/** Per-school China-mainland admit trend (default: top-30 schools, 4 years). */
export function useChinaAdmitTrend(schoolIds: string[] = [], years = 4) {
  const qs = new URLSearchParams();
  if (schoolIds.length) qs.set('schoolIds', schoolIds.join(','));
  qs.set('years', String(years));
  return useQuery({
    queryKey: hallKeys.chinaAdmitTrend(schoolIds, years),
    queryFn: () =>
      apiClient.get<ChinaAdmitTrendResponse>(
        `${hallRoutes.verifiedChinaAdmitTrend()}?${qs.toString()}`
      ),
    staleTime: 5 * 60_000,
  });
}

/** Year-over-year admission difficulty signal per school. */
export function useDifficultySignal(schoolIds: string[] = []) {
  const qs = new URLSearchParams();
  if (schoolIds.length) qs.set('schoolIds', schoolIds.join(','));
  return useQuery({
    queryKey: hallKeys.difficultySignal(schoolIds),
    queryFn: () =>
      apiClient.get<DifficultySignalEntry[]>(
        `${hallRoutes.verifiedDifficultySignal()}${qs.toString() ? `?${qs}` : ''}`
      ),
    staleTime: 5 * 60_000,
  });
}
