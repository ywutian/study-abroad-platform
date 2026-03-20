import { apiClient } from '../client';

export const essayService = {
  getPrompts: (schoolId?: string) =>
    apiClient.get('/essays/prompts', { params: schoolId ? { schoolId } : undefined }),
  aiReview: (essayId: string) =>
    apiClient.post(`/essays/${essayId}/ai-review`, {}, { timeout: 60000 }),
  aiPolish: (essayId: string) =>
    apiClient.post(`/essays/${essayId}/ai-polish`, {}, { timeout: 60000 }),
  aiBrainstorm: (topic: string) =>
    apiClient.post('/essays/ai-brainstorm', { topic }, { timeout: 60000 }),
  aiContinue: (essayId: string) =>
    apiClient.post(`/essays/${essayId}/ai-continue`, {}, { timeout: 60000 }),
  aiOpening: (essayId: string) =>
    apiClient.post(`/essays/${essayId}/ai-opening`, {}, { timeout: 60000 }),
  aiRewrite: (essayId: string, instructions: string) =>
    apiClient.post(`/essays/${essayId}/ai-rewrite`, { instructions }, { timeout: 60000 }),
  getGallery: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/essays/gallery', { params }),
};
