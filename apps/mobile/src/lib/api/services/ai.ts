import { API_ROUTES, profileRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const aiService = {
  chat: (messages: unknown[], agentType?: string) =>
    apiClient.post(`${API_ROUTES.AI_AGENT}/chat`, { messages, agentType }, { timeout: 60000 }),
  feedback: (messageId: string, rating: 'positive' | 'negative') =>
    apiClient.post(`${API_ROUTES.AI_AGENT}/feedback`, { messageId, rating }),
  profileAnalysis: () => apiClient.get(`${profileRoutes.me()}/analysis`, { timeout: 60000 }),
  resumeReview: (resumeId: string) =>
    apiClient.post(`${API_ROUTES.RESUMES}/${resumeId}/ai/review`, {}, { timeout: 60000 }),
  resumeOptimize: (resumeId: string, sectionId: string) =>
    apiClient.post(
      `${API_ROUTES.RESUMES}/${resumeId}/ai/optimize-bullets`,
      { sectionId },
      { timeout: 60000 }
    ),
};
