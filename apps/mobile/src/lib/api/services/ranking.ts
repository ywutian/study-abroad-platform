import { API_ROUTES, rankingRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const rankingService = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(rankingRoutes.list(), { params }),
  getById: (id: string) => apiClient.get(`${API_ROUTES.RANKINGS}/${id}`),
  create: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(API_ROUTES.RANKINGS, data),
  update: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`${API_ROUTES.RANKINGS}/${id}`, data),
  delete: (id: string) => apiClient.delete(`${API_ROUTES.RANKINGS}/${id}`),
};
