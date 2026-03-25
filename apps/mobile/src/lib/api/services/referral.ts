import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '../client';

export const referralService = {
  getCode: () => apiClient.get(`${API_ROUTES.USERS}/me/referral`),
  getStats: () => apiClient.get(`${API_ROUTES.USERS}/me/referral`),
  getHistory: () => apiClient.get(`${API_ROUTES.USERS}/me/referrals`),
};
