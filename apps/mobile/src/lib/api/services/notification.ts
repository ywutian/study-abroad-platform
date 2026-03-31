import { API_ROUTES, notificationRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const notificationService = {
  getAll: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(API_ROUTES.NOTIFICATIONS, { params }),
  markRead: (id: string) => apiClient.put(notificationRoutes.markRead(id)),
  markAllRead: () => apiClient.put(notificationRoutes.readAll()),
  getUnreadCount: () => apiClient.get(`${API_ROUTES.NOTIFICATIONS}/unread-count`),
  updatePushToken: (token: string, platform: string) =>
    apiClient.post(`${API_ROUTES.NOTIFICATIONS}/push-token`, { token, platform }),
  updatePreferences: (prefs: Record<string, boolean>) =>
    apiClient.put(`${API_ROUTES.NOTIFICATIONS}/preferences`, prefs),
};
