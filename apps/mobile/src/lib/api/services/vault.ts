import { apiClient } from '../client';

export const vaultService = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/vault', { params }),
  getById: (id: string) => apiClient.get(`/vault/${id}`),
  create: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post('/vault', data),
  update: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`/vault/${id}`, data),
  delete: (id: string) => apiClient.delete(`/vault/${id}`),
  getStats: () => apiClient.get('/vault/stats'),
};
