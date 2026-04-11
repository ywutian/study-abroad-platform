import { API_ROUTES, profileRoutes } from '@study-abroad/shared';
import type {
  AgentChatContext,
  AgentType,
  AIAnalysisResult,
  SubmitApplicationAnalysisFeedbackInput,
} from '@study-abroad/shared';
import { apiClient } from '../client';

export const aiService = {
  chat: (
    message: string,
    options?: {
      conversationId?: string | null;
      locale?: string;
      stream?: boolean;
      context?: AgentChatContext;
      agentHint?: AgentType;
    }
  ) =>
    apiClient.post(
      `${API_ROUTES.AI_AGENT}/chat`,
      {
        message,
        conversationId: options?.conversationId ?? null,
        locale: options?.locale,
        stream: options?.stream ?? false,
        context: options?.context,
        agentHint: options?.agentHint,
      },
      { timeout: 60000 }
    ),
  feedback: (messageId: string, rating: 'positive' | 'negative') =>
    apiClient.post(`${API_ROUTES.AI_AGENT}/feedback`, { messageId, rating }),
  profileAnalysis: () =>
    apiClient.get<AIAnalysisResult>(profileRoutes.aiAnalysis(), { timeout: 60000 }),
  profileAnalysisFeedback: (payload: SubmitApplicationAnalysisFeedbackInput) =>
    apiClient.post(profileRoutes.aiAnalysisFeedback(), payload, { timeout: 15000 }),
  resumeReview: (resumeId: string) =>
    apiClient.post(`${API_ROUTES.RESUMES}/${resumeId}/ai/review`, {}, { timeout: 60000 }),
  resumeOptimize: (resumeId: string, sectionId: string) =>
    apiClient.post(
      `${API_ROUTES.RESUMES}/${resumeId}/ai/optimize-bullets`,
      { sectionId },
      { timeout: 60000 }
    ),
};
