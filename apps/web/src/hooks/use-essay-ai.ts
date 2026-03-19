import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { AI_TIMEOUTS } from '@/lib/constants';
import type {
  EssayReview,
  PolishResult,
  RewriteResult,
  ContinueResult,
  OpeningResult,
} from '@/types/essay';

export const essayAiKeys = {
  all: ['essay-ai'] as const,
  history: (essayId: string) => [...essayAiKeys.all, 'history', essayId] as const,
};

export function useEssayReview(onSuccess?: (data: EssayReview) => void) {
  return useMutation({
    mutationFn: (data: { essayId: string; schoolName?: string; major?: string }) =>
      apiClient.post<EssayReview>('/essay-ai/review', data, { timeout: AI_TIMEOUTS.AI_REQUEST }),
    onSuccess,
  });
}

export function useEssayPolish(onSuccess?: (data: PolishResult) => void) {
  return useMutation({
    mutationFn: (data: {
      essayId: string;
      content?: string;
      style?: 'formal' | 'vivid' | 'concise';
    }) =>
      apiClient.post<PolishResult>('/essay-ai/polish', data, { timeout: AI_TIMEOUTS.AI_REQUEST }),
    onSuccess,
  });
}

export function useEssayRewrite(onSuccess?: (data: RewriteResult) => void) {
  return useMutation({
    mutationFn: (data: { paragraph: string; instruction?: string }) =>
      apiClient.post<RewriteResult>('/essay-ai/rewrite-paragraph', data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
      }),
    onSuccess,
  });
}

export function useEssayContinue(onSuccess?: (data: ContinueResult) => void) {
  return useMutation({
    mutationFn: (data: { content: string; prompt?: string; direction?: string }) =>
      apiClient.post<ContinueResult>('/essay-ai/continue-writing', data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
      }),
    onSuccess,
  });
}

export function useEssayOpening(onSuccess?: (data: OpeningResult) => void) {
  return useMutation({
    mutationFn: (data: { prompt: string; background?: string }) =>
      apiClient.post<OpeningResult>('/essay-ai/generate-opening', data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
      }),
    onSuccess,
  });
}
