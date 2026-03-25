import { API_ROUTES, chatRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const chatService = {
  getConversations: () => apiClient.get(chatRoutes.conversations()),
  getMessages: (
    conversationId: string,
    params?: Record<string, string | number | boolean | undefined>
  ) => apiClient.get(`${API_ROUTES.CHATS}/conversations/${conversationId}/messages`, { params }),
  createConversation: (userId: string) =>
    apiClient.post(chatRoutes.conversations(), { participantId: userId }),
  pinConversation: (id: string) => apiClient.post(`${API_ROUTES.CHATS}/conversations/${id}/pin`),
  unpinConversation: (id: string) =>
    apiClient.delete(`${API_ROUTES.CHATS}/conversations/${id}/pin`),
  blockUser: (userId: string) => apiClient.post(chatRoutes.block(userId)),
  reportMessage: (messageId: string, reason: string) =>
    apiClient.post(`${API_ROUTES.CHATS}/messages/${messageId}/report`, { reason }),
};
