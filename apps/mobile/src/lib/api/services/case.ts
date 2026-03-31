import { API_ROUTES, caseRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const caseService = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(API_ROUTES.CASES, { params }),
  getById: (id: string) => apiClient.get(caseRoutes.byId(id)),
  create: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(API_ROUTES.CASES, data),
  update: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(caseRoutes.byId(id), data),
  delete: (id: string) => apiClient.delete(caseRoutes.byId(id)),
  report: (id: string, reason: string) =>
    apiClient.post(`${caseRoutes.byId(id)}/report`, { reason }),
};
