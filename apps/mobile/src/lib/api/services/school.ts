import { apiClient } from '../client';

export const schoolService = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/schools', { params }),
  getById: (id: string) => apiClient.get(`/schools/${id}`),
  search: (query: string) => apiClient.get('/schools/search', { params: { q: query } }),
};
