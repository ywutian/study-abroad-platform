import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '../client';

export const verificationService = {
  getStatus: () => apiClient.get(`${API_ROUTES.VERIFICATIONS}/status`),
  submit: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(`${API_ROUTES.VERIFICATIONS}/submit`, data),
  getHistory: () => apiClient.get(`${API_ROUTES.VERIFICATIONS}/history`),
};
