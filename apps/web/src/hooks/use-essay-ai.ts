import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { essayAiRoutes } from '@study-abroad/shared';
import { AI_TIMEOUTS } from '@/lib/constants';
import type {
  EssayReview,
  PolishResult,
  RewriteResult,
  ContinueResult,
  OpeningResult,
  EssaySuggestEditsResult,
} from '@/types/essay';

export const essayAiKeys = {
  all: ['essay-ai'] as const,
  history: (essayId: string) => [...essayAiKeys.all, 'history', essayId] as const,
};

export function useEssayReview(onSuccess?: (data: EssayReview) => void) {
  return useMutation({
    // @cache-invalidation-allowed: AI generation hook — returns generated content to the caller's onSuccess; mutates no cached list/detail
    mutationFn: (data: { essayId: string; schoolName?: string; major?: string }) =>
      apiClient.post<EssayReview>(essayAiRoutes.review(), data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    onSuccess,
  });
}

export function useEssayPolish(onSuccess?: (data: PolishResult) => void) {
  return useMutation({
    // @cache-invalidation-allowed: AI generation hook — returns generated content to the caller's onSuccess; mutates no cached list/detail
    mutationFn: (data: {
      essayId: string;
      content?: string;
      style?: 'formal' | 'vivid' | 'concise';
    }) =>
      apiClient.post<PolishResult>(essayAiRoutes.polish(), data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    onSuccess,
  });
}

export function useEssaySuggestEdits(onSuccess?: (data: EssaySuggestEditsResult) => void) {
  return useMutation({
    // @cache-invalidation-allowed: AI generation hook — returns generated content to the caller's onSuccess (essay-workbench refetches suggestions/revisions there); mutates no cached list/detail here
    mutationFn: (data: {
      essayId: string;
      style?: 'formal' | 'vivid' | 'concise';
      focus?: string;
    }) =>
      apiClient.post<EssaySuggestEditsResult>(essayAiRoutes.suggestEdits(), data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    onSuccess,
  });
}

export function useEssayRewrite(onSuccess?: (data: RewriteResult) => void) {
  return useMutation({
    // @cache-invalidation-allowed: AI generation hook — returns generated content to the caller's onSuccess; mutates no cached list/detail
    mutationFn: (data: { paragraph: string; instruction?: string }) =>
      apiClient.post<RewriteResult>(essayAiRoutes.rewriteParagraph(), data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    onSuccess,
  });
}

export function useEssayContinue(onSuccess?: (data: ContinueResult) => void) {
  return useMutation({
    // @cache-invalidation-allowed: AI generation hook — returns generated content to the caller's onSuccess; mutates no cached list/detail
    mutationFn: (data: { content: string; prompt?: string; direction?: string }) =>
      apiClient.post<ContinueResult>(essayAiRoutes.continueWriting(), data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    onSuccess,
  });
}

export function useEssayOpening(onSuccess?: (data: OpeningResult) => void) {
  return useMutation({
    // @cache-invalidation-allowed: AI generation hook — returns generated content to the caller's onSuccess; mutates no cached list/detail
    mutationFn: (data: { prompt: string; background?: string }) =>
      apiClient.post<OpeningResult>(essayAiRoutes.generateOpening(), data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    onSuccess,
  });
}
