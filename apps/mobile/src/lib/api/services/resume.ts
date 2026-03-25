import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '../client';

export const resumeService = {
  list: () => apiClient.get(API_ROUTES.RESUMES),
  getById: (id: string) => apiClient.get(`${API_ROUTES.RESUMES}/${id}`),
  create: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(API_ROUTES.RESUMES, data),
  update: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`${API_ROUTES.RESUMES}/${id}`, data),
  delete: (id: string) => apiClient.delete(`${API_ROUTES.RESUMES}/${id}`),
  duplicate: (id: string) => apiClient.post(`${API_ROUTES.RESUMES}/${id}/duplicate`),
};
