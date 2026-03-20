import { apiClient } from '../client';

export const hallService = {
  getRankings: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/hall/rankings', { params }),
  getReviews: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/hall/reviews', { params }),
  createReview: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post('/hall/reviews', data),
  getLists: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/hall/lists', { params }),
  getVerified: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/hall/verified', { params }),
  getSwipeCard: () => apiClient.get('/hall/swipe'),
  submitSwipe: (caseId: string, prediction: string) =>
    apiClient.post('/hall/swipe', { caseId, prediction }),
};
