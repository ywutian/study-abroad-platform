import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '../client';

export const recommendationService = {
  getRecommendations: () => apiClient.get(API_ROUTES.RECOMMENDATIONS, { timeout: 60000 }),
  refresh: () => apiClient.post(`${API_ROUTES.RECOMMENDATIONS}/refresh`, {}, { timeout: 60000 }),
};
