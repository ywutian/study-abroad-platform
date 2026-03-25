import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '../client';

export const essayService = {
  getPrompts: (schoolId?: string) =>
    apiClient.get(API_ROUTES.ESSAY_PROMPTS, { params: schoolId ? { schoolId } : undefined }),
  aiReview: (essayId: string) =>
    apiClient.post(`${API_ROUTES.ESSAY_AI}/review`, { essayId }, { timeout: 60000 }),
  aiPolish: (essayId: string) =>
    apiClient.post(`${API_ROUTES.ESSAY_AI}/polish`, { essayId }, { timeout: 60000 }),
  aiBrainstorm: (topic: string) =>
    apiClient.post(`${API_ROUTES.ESSAY_AI}/brainstorm`, { topic }, { timeout: 60000 }),
  aiContinue: (essayId: string, content?: string) =>
    apiClient.post(
      `${API_ROUTES.ESSAY_AI}/continue-writing`,
      { essayId, content },
      { timeout: 60000 }
    ),
  aiOpening: (essayId: string, prompt?: string, background?: string) =>
    apiClient.post(
      `${API_ROUTES.ESSAY_AI}/generate-opening`,
      { prompt, background },
      { timeout: 60000 }
    ),
  aiRewrite: (essayId: string, instructions: string) =>
    apiClient.post(
      `${API_ROUTES.ESSAY_AI}/rewrite-paragraph`,
      { paragraph: instructions },
      { timeout: 60000 }
    ),
  getGallery: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(`${API_ROUTES.ESSAY_AI}/gallery`, { params }),
};
