import { API_ROUTES, hallRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const hallService = {
  getRankings: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(`${API_ROUTES.HALLS}/rankings`, { params }),
  getReviews: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(hallRoutes.reviews(), { params }),
  createReview: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(hallRoutes.reviews(), data),
  getLists: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(hallRoutes.lists(), { params }),
  getVerified: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(hallRoutes.verified(), { params }),
  getSwipeCard: () => apiClient.get(hallRoutes.swipe()),
  submitSwipe: (caseId: string, prediction: string) =>
    apiClient.post(hallRoutes.swipe(), { caseId, prediction }),
};
