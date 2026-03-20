import { apiClient } from '../client';

export const userService = {
  getMe: () => apiClient.get('/users/me'),
  updateMe: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put('/users/me', data),
  getDashboard: () => apiClient.get('/users/me/dashboard'),
  deleteAccount: () => apiClient.delete('/users/me'),
};
