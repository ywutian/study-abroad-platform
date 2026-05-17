import { hallRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const hallService = {
  getReviews: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(hallRoutes.reviews(), { params }),
  createReview: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(hallRoutes.reviews(), data),
  getVerified: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(hallRoutes.verifiedRanking(), { params }),
  getOverview: () => apiClient.get(hallRoutes.meOverview()),
};
