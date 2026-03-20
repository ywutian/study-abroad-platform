import { apiClient } from '../client';

export const pointsService = {
  getBalance: () => apiClient.get('/points/balance'),
  getHistory: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/points/history', { params }),
  getBadges: () => apiClient.get('/points/badges'),
  getLeaderboard: () => apiClient.get('/points/leaderboard'),
};
