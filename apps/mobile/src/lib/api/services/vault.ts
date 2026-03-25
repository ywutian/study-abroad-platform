import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '../client';

export const vaultService = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(API_ROUTES.VAULTS, { params }),
  getById: (id: string) => apiClient.get(`${API_ROUTES.VAULTS}/${id}`),
  create: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(API_ROUTES.VAULTS, data),
  update: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`${API_ROUTES.VAULTS}/${id}`, data),
  delete: (id: string) => apiClient.delete(`${API_ROUTES.VAULTS}/${id}`),
  getStats: () => apiClient.get(`${API_ROUTES.VAULTS}/stats`),
};
