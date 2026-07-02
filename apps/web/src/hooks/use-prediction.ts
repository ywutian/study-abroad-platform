'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { API_ROUTES, predictionRoutes } from '@study-abroad/shared';
import { apiClient, STALE_TIME } from '@/lib/api';
import { AI_TIMEOUTS } from '@/lib/constants';
import type {
  PredictionOutcomeLabel,
  PredictionPreviewRequest,
  PredictionPreviewResponse,
  PredictionResponse,
  PredictionResult,
  PredictionDashboardData,
  PredictionPublicExplanation,
  PredictionSourceSummary,
} from '@/components/features/prediction/types';

// Re-export the dashboard contract so `@/hooks/use-prediction` stays the import
// site for dashboard consumers (e.g. DashboardSummary) now that the shape is
// defined once in shared (single source of truth across api/web/mobile).
export type { PredictionDashboardData } from '@/components/features/prediction/types';

// ============================================
// Query Keys
// ============================================
export const predictionKeys = {
  all: ['prediction'] as const,
  school: (id: string) => [...predictionKeys.all, 'school', id] as const,
  dashboard: () => [...predictionKeys.all, 'dashboard'] as const,
  history: () => [...predictionKeys.all, 'history'] as const,
  preview: () => [...predictionKeys.all, 'preview'] as const,
};

// ============================================
// Types
// ============================================
export interface SchoolPredictionData {
  current: {
    probability: number | null;
    probabilityLow?: number;
    probabilityHigh?: number;
    tier?: string;
    confidence?: string;
    confidenceReason?: string | null;
    publicExplanation?: PredictionPublicExplanation;
    cohortKey?: string | null;
    roundContext?: string | null;
    sourceSummary?: PredictionSourceSummary[];
    uncertaintyReasons?: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    factors?: any[];
    source?: string;
    modelVersion?: string;
    latestOutcomeLabel?: PredictionOutcomeLabel;
    updatedAt: string;
  } | null;
  history: Array<{
    probability: number | null;
    tier?: string;
    confidence?: string;
    confidenceReason?: string | null;
    publicExplanation?: PredictionPublicExplanation;
    cohortKey?: string | null;
    roundContext?: string | null;
    sourceSummary?: PredictionSourceSummary[];
    uncertaintyReasons?: string[];
    source?: string;
    modelVersion?: string;
    latestOutcomeLabel?: PredictionOutcomeLabel;
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

export interface PredictionHistorySnapshot {
  id: string;
  probability: number | null;
  probabilityLow?: number;
  probabilityHigh?: number;
  tier?: string;
  confidence?: string;
  confidenceReason?: string | null;
  publicExplanation?: PredictionPublicExplanation;
  roundContext?: string | null;
  sourceSummary?: PredictionSourceSummary[];
  uncertaintyReasons?: string[];
  source?: string;
  modelVersion?: string;
  servedPolicyVersionId?: string;
  createdAt: string;
}

export interface PredictionHistoryItem {
  id: string;
  schoolId: string;
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    acceptanceRate?: number;
  } | null;
  probability: number | null;
  probabilityLow?: number;
  probabilityHigh?: number;
  previousProbability?: number | null;
  probabilityDelta?: number | null;
  trend: 'new' | 'up' | 'down' | 'stable';
  tier?: string;
  previousTier?: string;
  confidence?: string;
  confidenceReason?: string | null;
  roundContext?: string | null;
  source?: string;
  sourceSummary?: PredictionSourceSummary[];
  uncertaintyReasons?: string[];
  modelVersion?: string;
  servedPolicyVersionId?: string;
  snapshotCount: number;
  stale: boolean;
  latestOutcomeLabel?: PredictionOutcomeLabel;
  calibrationEligible?: boolean;
  recentSnapshots: PredictionHistorySnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface PredictionHistoryData {
  items: PredictionHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type AdmissionResultReport =
  'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' | 'WITHDRAWN';

// ============================================
// Hooks
// ============================================

/** 获取单校预测详情 + 历史趋势 */
export function useSchoolPrediction(schoolId: string, enabled = true) {
  return useQuery<SchoolPredictionData>({
    queryKey: predictionKeys.school(schoolId),
    queryFn: () => apiClient.get(`${API_ROUTES.PREDICTIONS}/school/${schoolId}`),
    staleTime: STALE_TIME.MODERATE,
    enabled: enabled && !!schoolId,
  });
}

/** 获取预测仪表盘聚合数据 */
export function usePredictionDashboard(enabled = true) {
  return useQuery<PredictionDashboardData>({
    queryKey: predictionKeys.dashboard(),
    queryFn: () => apiClient.get(`${API_ROUTES.PREDICTIONS}/dashboard`),
    staleTime: STALE_TIME.MODERATE,
    enabled,
  });
}

/** 运行预测 */
export function useRunPrediction() {
  const queryClient = useQueryClient();
  return useMutation<PredictionResponse, Error, { schoolIds: string[]; forceRefresh?: boolean }>({
    mutationFn: (dto) =>
      apiClient.post<PredictionResponse>(predictionRoutes.predict(), dto, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: predictionKeys.all });
    },
  });
}

/** Run a read-only what-if preview. Does not write prediction history. */
export function usePreviewPrediction() {
  return useMutation<PredictionPreviewResponse, Error, PredictionPreviewRequest>({
    mutationFn: (dto) =>
      apiClient.post<PredictionPreviewResponse>(predictionRoutes.preview(), dto, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
  });
}

/** 报告实际录取结果 */
export function useReportResult() {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean; message: string },
    Error,
    {
      schoolId: string;
      result: AdmissionResultReport;
      round?: string;
      isFinal?: boolean;
      notes?: string;
      evidenceUrl?: string;
    }
  >({
    mutationFn: ({ schoolId, ...payload }) =>
      apiClient.patch(`${API_ROUTES.PREDICTIONS}/${schoolId}/result`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: predictionKeys.all });
    },
  });
}

/** 获取预测历史（分页） */
export function usePredictionHistory(page = 1, pageSize = 20, enabled = true) {
  return useQuery<PredictionHistoryData>({
    queryKey: [...predictionKeys.history(), page, pageSize],
    queryFn: () =>
      apiClient.get(predictionRoutes.history(), {
        params: { page, pageSize },
      }),
    staleTime: STALE_TIME.MODERATE,
    placeholderData: keepPreviousData, // keep the table visible while paging
    enabled,
  });
}
