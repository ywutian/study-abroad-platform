import { API_ROUTES, teamRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const teamService = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(API_ROUTES.TEAMS, { params }),
  getById: (id: string) => apiClient.get(teamRoutes.byId(id)),
  create: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(API_ROUTES.TEAMS, data),
  join: (id: string) => apiClient.post(teamRoutes.join(id)),
  leave: (id: string) => apiClient.post(teamRoutes.leave(id)),
  getMyTeams: () => apiClient.get(`${API_ROUTES.TEAMS}/my`),
};
