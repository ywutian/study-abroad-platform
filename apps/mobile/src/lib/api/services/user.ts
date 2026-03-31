import { userRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const userService = {
  getMe: () => apiClient.get(userRoutes.me()),
  updateMe: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(userRoutes.me(), data),
  getDashboard: () => apiClient.get(`${userRoutes.me()}/dashboard`),
  deleteAccount: () => apiClient.delete(userRoutes.me()),
};
