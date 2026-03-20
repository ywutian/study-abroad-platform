import { apiClient } from '../client';

export const teamService = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get('/teams', { params }),
  getById: (id: string) => apiClient.get(`/teams/${id}`),
  create: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post('/teams', data),
  join: (id: string) => apiClient.post(`/teams/${id}/join`),
  leave: (id: string) => apiClient.post(`/teams/${id}/leave`),
  getMyTeams: () => apiClient.get('/teams/my'),
};
