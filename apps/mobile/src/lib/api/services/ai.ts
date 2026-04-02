import { API_ROUTES, profileRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const aiService = {
  chat: (
    message: string,
    options?: {
      conversationId?: string | null;
      locale?: string;
      stream?: boolean;
    }
  ) =>
    apiClient.post(
      `${API_ROUTES.AI_AGENT}/chat`,
      {
        message,
        conversationId: options?.conversationId ?? null,
        locale: options?.locale,
        stream: options?.stream ?? false,
      },
      { timeout: 60000 }
    ),
  feedback: (messageId: string, rating: 'positive' | 'negative') =>
    apiClient.post(`${API_ROUTES.AI_AGENT}/feedback`, { messageId, rating }),
  profileAnalysis: () => apiClient.get(profileRoutes.aiAnalysis(), { timeout: 60000 }),
  resumeReview: (resumeId: string) =>
    apiClient.post(`${API_ROUTES.RESUMES}/${resumeId}/ai/review`, {}, { timeout: 60000 }),
  resumeOptimize: (resumeId: string, sectionId: string) =>
    apiClient.post(
      `${API_ROUTES.RESUMES}/${resumeId}/ai/optimize-bullets`,
      { sectionId },
      { timeout: 60000 }
    ),
};
