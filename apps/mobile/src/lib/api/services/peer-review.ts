import { apiClient } from '../client';

export const peerReviewService = {
  getAvailable: () => apiClient.get('/peer-review/available'),
  getMyReviews: () => apiClient.get('/peer-review/my'),
  submit: (essayId: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(`/peer-review/${essayId}`, data),
  getById: (id: string) => apiClient.get(`/peer-review/${id}`),
};
