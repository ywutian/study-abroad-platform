import { apiClient } from '../client';

export const resumeService = {
  list: () => apiClient.get('/resume'),
  getById: (id: string) => apiClient.get(`/resume/${id}`),
  create: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post('/resume', data),
  update: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`/resume/${id}`, data),
  delete: (id: string) => apiClient.delete(`/resume/${id}`),
  duplicate: (id: string) => apiClient.post(`/resume/${id}/duplicate`),
};
