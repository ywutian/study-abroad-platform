'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminRoutes, predictionRoutes } from '@study-abroad/shared';
import { apiClient, STALE_TIME } from '@/lib/api';
import { predictionKeys } from './use-prediction';

export type PredictionFeedbackSentiment = 'POSITIVE' | 'UNSURE' | 'NEGATIVE';
export type PredictionFeedbackCategory =
  'TOO_HIGH' | 'TOO_LOW' | 'FACTORS_WRONG' | 'NEVER_MOVES' | 'OTHER';

export interface SubmitPredictionFeedbackInput {
  predictionResultId: string;
  sentiment: PredictionFeedbackSentiment;
  category?: PredictionFeedbackCategory;
  notes?: string;
}

export interface PredictionFeedbackItem {
  id: string;
  predictionResultId: string;
  userId: string;
  userEmail?: string;
  sentiment: PredictionFeedbackSentiment;
  category?: PredictionFeedbackCategory | null;
  notes?: string | null;
  engineSnapshot?: string | null;
  probabilitySnapshot?: number | null;
  createdAt: string;
  updatedAt: string;
  school: {
    id: string;
    name: string;
    nameZh?: string | null;
  } | null;
  prediction: {
    probability: number;
    factors: unknown;
    servedTrace: unknown;
    updatedAt: string;
  };
}

export interface PredictionFeedbackListResponse {
  items: PredictionFeedbackItem[];
  total: number;
  nextCursor: string | null;
}

export const predictionFeedbackKeys = {
  all: ['prediction-feedback'] as const,
  adminList: (filters: Record<string, unknown>) =>
    [...predictionFeedbackKeys.all, 'admin-list', filters] as const,
};

export function useSubmitPredictionFeedback() {
  const queryClient = useQueryClient();
  return useMutation<PredictionFeedbackItem, Error, SubmitPredictionFeedbackInput>({
    mutationFn: ({ predictionResultId, ...body }) =>
      apiClient.post<PredictionFeedbackItem>(predictionRoutes.feedback(predictionResultId), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: predictionFeedbackKeys.all });
      queryClient.invalidateQueries({ queryKey: predictionKeys.all });
    },
  });
}

export function useAdminPredictionFeedback(filters: {
  sentiment?: PredictionFeedbackSentiment | 'ALL';
  category?: PredictionFeedbackCategory | 'ALL';
  engineSnapshot?: string;
  schoolId?: string;
  daysAgo?: number;
  cursor?: string | null;
  take?: number;
}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => {
      if (value == null || value === '') return false;
      if (value === 'ALL') return false;
      return true;
    })
  ) as Record<string, string | number | boolean | undefined>;
  return useQuery<PredictionFeedbackListResponse>({
    queryKey: predictionFeedbackKeys.adminList(params),
    queryFn: () =>
      apiClient.get<PredictionFeedbackListResponse>(adminRoutes.adminPredictionFeedback(), {
        params,
      }),
    staleTime: STALE_TIME.MODERATE,
  });
}
