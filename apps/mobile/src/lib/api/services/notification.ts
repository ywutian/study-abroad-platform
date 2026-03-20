import { apiClient } from '../client';

export const notificationService = {
  getAll: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/notifications', { params }),
  markRead: (id: string) => apiClient.put(`/notifications/${id}/read`),
  markAllRead: () => apiClient.put('/notifications/read-all'),
  getUnreadCount: () => apiClient.get('/notifications/unread-count'),
  updatePushToken: (token: string, platform: string) =>
    apiClient.post('/notifications/push-token', { token, platform }),
  updatePreferences: (prefs: Record<string, boolean>) =>
    apiClient.put('/notifications/preferences', prefs),
};
