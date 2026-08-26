'use client';

/**
 * Recommendation 模块 API Hooks
 *
 * 将所有智能选校页面的 React Query 调用集中管理，
 * 统一 query key factory，方便复用和缓存失效。
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  API_ROUTES,
  recommendationRoutes,
  schoolListRoutes,
  type RecommendationResult,
  type RecommendationPreflight,
  type RecommendationOutcomeMetrics,
} from '@study-abroad/shared';
import { apiClient, STALE_TIME } from '@/lib/api';
import { AI_TIMEOUTS } from '@/lib/constants';
import { qk } from '@/lib/query';

// ============================================
// Query Keys — 统一管理，防止拼写错误
// ============================================
export const recommendationKeys = {
  all: ['recommendation'] as const,
  history: () => [...recommendationKeys.all, 'history'] as const,
  detail: (id: string) => [...recommendationKeys.all, 'detail', id] as const,
  preflight: () => [...recommendationKeys.all, 'preflight'] as const,
  metrics: (id?: string) => [...recommendationKeys.all, 'metrics', id ?? 'aggregate'] as const,
};

// ============================================
// Request DTO
// ============================================
export interface GenerateRecommendationDto {
  preferredRegions?: string[];
  preferredMajors?: string[];
  budget?: string;
  schoolCount?: number;
  additionalPreferences?: string;
  campusPreferences?: Array<'safety' | 'life' | 'food'>;
}

// ============================================
// Hooks
// ============================================

/** 预检查：档案完整度与生成资格（积分系统已下线） */
export function useRecommendationPreflight() {
  return useQuery<RecommendationPreflight>({
    queryKey: recommendationKeys.preflight(),
    queryFn: () => apiClient.get(recommendationRoutes.preflight()),
    staleTime: STALE_TIME.MODERATE,
  });
}

/** 生成 AI 选校建议 */
export function useGenerateRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: GenerateRecommendationDto) =>
      apiClient.post<RecommendationResult>(recommendationRoutes.generate(), dto, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: recommendationKeys.history(),
      });
      queryClient.invalidateQueries({
        queryKey: recommendationKeys.preflight(),
      });
    },
  });
}

/** 获取推荐历史 */
export function useRecommendationHistory(enabled: boolean) {
  return useQuery<RecommendationResult[]>({
    queryKey: recommendationKeys.history(),
    queryFn: () => apiClient.get(recommendationRoutes.history()),
    enabled,
    staleTime: STALE_TIME.MODERATE,
  });
}

/** 可归因推荐效果；低于服务端最小样本时只展示计数。 */
export function useRecommendationMetrics(id?: string, enabled = true) {
  return useQuery<RecommendationOutcomeMetrics>({
    queryKey: recommendationKeys.metrics(id),
    queryFn: () =>
      apiClient.get(id ? recommendationRoutes.detailMetrics(id) : recommendationRoutes.metrics()),
    enabled,
    staleTime: STALE_TIME.MODERATE,
  });
}

/** 用户明确进入申请流程后记录，不从“加入清单”推断。 */
export function useRecordRecommendationApplied() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, schoolId }: { id: string; schoolId: string }) =>
      apiClient.post<{ recorded: true }>(recommendationRoutes.applied(id, schoolId)),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: recommendationKeys.metrics(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: recommendationKeys.metrics(),
      });
    },
  });
}

/** 删除推荐记录 */
export function useDeleteRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${API_ROUTES.RECOMMENDATIONS}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: recommendationKeys.history(),
      });
    },
  });
}

/** 加入选校清单 */
export function useAddToSchoolList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      schoolId: string;
      tier: string;
      round?: string;
      isAIRecommended?: boolean;
      recommendationId?: string;
    }) =>
      apiClient.post(schoolListRoutes.list(), {
        ...dto,
        isAIRecommended: dto.isAIRecommended ?? true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.schoolList.all });
      queryClient.invalidateQueries({ queryKey: ['school-list'] });
    },
  });
}
