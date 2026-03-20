import { apiClient } from '../client';

export const caseService = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/cases', { params }),
  getById: (id: string) => apiClient.get(`/cases/${id}`),
  create: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post('/cases', data),
  update: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`/cases/${id}`, data),
  delete: (id: string) => apiClient.delete(`/cases/${id}`),
  report: (id: string, reason: string) => apiClient.post(`/cases/${id}/report`, { reason }),
};
