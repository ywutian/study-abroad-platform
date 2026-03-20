import { apiClient } from '../client';

export const chatService = {
  getConversations: () => apiClient.get('/chat/conversations'),
  getMessages: (
    conversationId: string,
    params?: Record<string, string | number | boolean | undefined>
  ) => apiClient.get(`/chat/conversations/${conversationId}/messages`, { params }),
  createConversation: (userId: string) =>
    apiClient.post('/chat/conversations', { participantId: userId }),
  pinConversation: (id: string) => apiClient.post(`/chat/conversations/${id}/pin`),
  unpinConversation: (id: string) => apiClient.delete(`/chat/conversations/${id}/pin`),
  blockUser: (userId: string) => apiClient.post(`/chat/block/${userId}`),
  reportMessage: (messageId: string, reason: string) =>
    apiClient.post(`/chat/messages/${messageId}/report`, { reason }),
};
