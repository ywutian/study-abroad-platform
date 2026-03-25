import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '../client';

export const peerReviewService = {
  getAvailable: () => apiClient.get(`${API_ROUTES.PEER_REVIEWS}/available`),
  getMyReviews: () => apiClient.get(`${API_ROUTES.PEER_REVIEWS}/my`),
  submit: (essayId: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(`${API_ROUTES.PEER_REVIEWS}/${essayId}`, data),
  getById: (id: string) => apiClient.get(`${API_ROUTES.PEER_REVIEWS}/${id}`),
};
