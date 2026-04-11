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
} from '@study-abroad/shared';
import { apiClient, STALE_TIME } from '@/lib/api';
import { AI_TIMEOUTS } from '@/lib/constants';

// ============================================
// Query Keys — 统一管理，防止拼写错误
// ============================================
export const recommendationKeys = {
  all: ['recommendation'] as const,
  history: () => [...recommendationKeys.all, 'history'] as const,
  detail: (id: string) => [...recommendationKeys.all, 'detail', id] as const,
  preflight: () => [...recommendationKeys.all, 'preflight'] as const,
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
}

// ============================================
// Hooks
// ============================================

/** 预检查：档案完整度 + 积分余额 */
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
    }) =>
      apiClient.post(schoolListRoutes.list(), {
        ...dto,
        isAIRecommended: dto.isAIRecommended ?? true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
      queryClient.invalidateQueries({ queryKey: ['school-list'] });
    },
  });
}
