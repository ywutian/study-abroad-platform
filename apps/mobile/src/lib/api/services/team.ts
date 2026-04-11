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
  getRecruitmentContexts: () => apiClient.get(teamRoutes.recruitmentContexts()),
  getMyRecruitments: () => apiClient.get(teamRoutes.myRecruitments()),
  getRecruitmentDeck: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(teamRoutes.recruitmentDeck(), { params }),
  createRecruitment: (data: Record<string, unknown>) =>
    apiClient.post(teamRoutes.recruitments(), data),
  updateRecruitment: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(teamRoutes.recruitmentById(id), data),
  updateRecruitmentMemberProfile: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(teamRoutes.recruitmentMemberProfile(id), data),
  publishRecruitment: (id: string) => apiClient.post(teamRoutes.recruitmentPublish(id)),
  closeRecruitment: (id: string) => apiClient.post(teamRoutes.recruitmentClose(id)),
  swipeRecruitment: (id: string, data: { targetCardId: string; action: 'LIKE' | 'PASS' }) =>
    apiClient.post(teamRoutes.recruitmentSwipe(id), data),
  getMatches: () => apiClient.get(teamRoutes.matches()),
  inviteMatchMembers: (id: string, data: Record<string, unknown>) =>
    apiClient.post(teamRoutes.matchInviteMembers(id), data),
};
