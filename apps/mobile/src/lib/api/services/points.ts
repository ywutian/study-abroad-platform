import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '../client';

export const pointsService = {
  getBalance: () => apiClient.get(`${API_ROUTES.POINTS}/balance`),
  getHistory: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(`${API_ROUTES.POINTS}/history`, { params }),
  getBadges: () => apiClient.get(`${API_ROUTES.POINTS}/badges`),
  getLeaderboard: () => apiClient.get(`${API_ROUTES.POINTS}/leaderboard`),
};
