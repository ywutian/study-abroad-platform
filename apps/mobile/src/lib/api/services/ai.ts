import { apiClient } from '../client';

export const aiService = {
  chat: (messages: unknown[], agentType?: string) =>
    apiClient.post('/ai-agent/chat', { messages, agentType }, { timeout: 60000 }),
  feedback: (messageId: string, rating: 'positive' | 'negative') =>
    apiClient.post('/ai-agent/feedback', { messageId, rating }),
  profileAnalysis: () => apiClient.get('/ai/profile/analysis', { timeout: 60000 }),
  resumeReview: (resumeId: string) =>
    apiClient.post(`/ai/resume/${resumeId}/review`, {}, { timeout: 60000 }),
  resumeOptimize: (resumeId: string, sectionId: string) =>
    apiClient.post(`/ai/resume/${resumeId}/optimize`, { sectionId }, { timeout: 60000 }),
};
