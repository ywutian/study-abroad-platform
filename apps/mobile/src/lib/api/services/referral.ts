import { apiClient } from '../client';

export const referralService = {
  getCode: () => apiClient.get('/referral/code'),
  getStats: () => apiClient.get('/referral/stats'),
  getHistory: () => apiClient.get('/referral/history'),
  applyCode: (code: string) => apiClient.post('/referral/apply', { code }),
};
