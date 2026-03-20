import { apiClient } from '../client';

export const rankingService = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/rankings', { params }),
  getById: (id: string) => apiClient.get(`/rankings/${id}`),
  create: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post('/rankings', data),
  update: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`/rankings/${id}`, data),
  delete: (id: string) => apiClient.delete(`/rankings/${id}`),
};
