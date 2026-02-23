'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, STALE_TIME } from '@/lib/api';
import type { PredictionResponse } from '@/components/features/prediction/types';

// ============================================
// Query Keys
// ============================================
export const predictionKeys = {
  all: ['prediction'] as const,
  school: (id: string) => [...predictionKeys.all, 'school', id] as const,
  dashboard: () => [...predictionKeys.all, 'dashboard'] as const,
  history: () => [...predictionKeys.all, 'history'] as const,
};

// ============================================
// Types
// ============================================
export interface SchoolPredictionData {
  current: {
    probability: number;
    probabilityLow?: number;
    probabilityHigh?: number;
    tier?: string;
    confidence?: string;
    factors?: any[];
    source?: string;
    modelVersion?: string;
    updatedAt: string;
  } | null;
  history: Array<{
    probability: number;
    tier?: string;
    confidence?: string;
    source?: string;
    modelVersion?: string;
    createdAt: string;
  }>;
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    acceptanceRate?: number;
  } | null;
}

export interface PredictionDashboardData {
  totalSchools: number;
  tierDistribution: { reach: number; match: number; safety: number };
  avgProbability: number;
  confidenceBreakdown: { low: number; medium: number; high: number };
  predictions: Array<{
    schoolId: string;
    school: { id: string; name: string; nameZh?: string; usNewsRank?: number };
    probability: number;
    tier?: string;
    confidence?: string;
    source?: string;
    modelVersion?: string;
    updatedAt: string;
  }>;
}

// ============================================
// Hooks
// ============================================

/** 获取单校预测详情 + 历史趋势 */
export function useSchoolPrediction(schoolId: string, enabled = true) {
  return useQuery<SchoolPredictionData>({
    queryKey: predictionKeys.school(schoolId),
    queryFn: () => apiClient.get(`/predictions/school/${schoolId}`),
    staleTime: STALE_TIME.MODERATE,
    enabled: enabled && !!schoolId,
  });
}

/** 获取预测仪表盘聚合数据 */
export function usePredictionDashboard() {
  return useQuery<PredictionDashboardData>({
    queryKey: predictionKeys.dashboard(),
    queryFn: () => apiClient.get('/predictions/dashboard'),
    staleTime: STALE_TIME.MODERATE,
  });
}

/** 运行预测 */
export function useRunPrediction() {
  const queryClient = useQueryClient();
  return useMutation<PredictionResponse, Error, { schoolIds: string[]; forceRefresh?: boolean }>({
    mutationFn: (dto) => apiClient.post<PredictionResponse>('/predictions', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: predictionKeys.all });
    },
  });
}

/** 报告实际录取结果 */
export function useReportResult() {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean; message: string },
    Error,
    { schoolId: string; result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' }
  >({
    mutationFn: ({ schoolId, result }) =>
      apiClient.patch(`/predictions/${schoolId}/result`, { result }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: predictionKeys.all });
    },
  });
}

/** 获取预测历史 */
export function usePredictionHistory(enabled = true) {
  return useQuery({
    queryKey: predictionKeys.history(),
    queryFn: () => apiClient.get('/predictions/history'),
    staleTime: STALE_TIME.MODERATE,
    enabled,
  });
}
