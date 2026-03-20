import { apiClient } from '../client';

export const verificationService = {
  getStatus: () => apiClient.get('/verification/status'),
  submit: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post('/verification/submit', data),
  getHistory: () => apiClient.get('/verification/history'),
};
