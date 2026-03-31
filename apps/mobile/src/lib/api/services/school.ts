import { API_ROUTES, schoolRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const schoolService = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(API_ROUTES.SCHOOLS, { params }),
  getById: (id: string) => apiClient.get(schoolRoutes.byId(id)),
  search: (query: string) =>
    apiClient.get(`${API_ROUTES.SCHOOLS}/search`, { params: { q: query } }),
};
