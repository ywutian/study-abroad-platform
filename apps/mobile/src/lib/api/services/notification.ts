import { API_ROUTES, notificationRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const notificationService = {
  getAll: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(API_ROUTES.NOTIFICATIONS, { params }),
  markRead: (id: string) => apiClient.post(notificationRoutes.markRead(id)),
  markAllRead: () => apiClient.post(notificationRoutes.readAll()),
  delete: (id: string) => apiClient.delete(notificationRoutes.delete(id)),
  deleteAll: () => apiClient.delete(notificationRoutes.deleteAll()),
  getUnreadCount: () => apiClient.get(`${API_ROUTES.NOTIFICATIONS}/unread-count`),
  updatePushToken: (token: string, platform: string) =>
    apiClient.post(notificationRoutes.pushToken(), { token, platform }),
  updatePreferences: (prefs: Record<string, boolean>) =>
    apiClient.put(`${API_ROUTES.NOTIFICATIONS}/preferences`, prefs),
};
