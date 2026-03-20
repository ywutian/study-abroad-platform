import { apiClient } from '../client';

export const recommendationService = {
  getRecommendations: () => apiClient.get('/recommendation', { timeout: 60000 }),
  refresh: () => apiClient.post('/recommendation/refresh', {}, { timeout: 60000 }),
};
