import { profileRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const profileService = {
  getMyProfile: () => apiClient.get(profileRoutes.me()),
  updateProfile: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(profileRoutes.me(), data),
  getCompleteness: () => apiClient.get(`${profileRoutes.me()}/completeness`),
  getEssays: () => apiClient.get(`${profileRoutes.me()}/essays`),
  createEssay: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(`${profileRoutes.me()}/essays`, data),
  updateEssay: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`${profileRoutes.me()}/essays/${id}`, data),
  deleteEssay: (id: string) => apiClient.delete(`${profileRoutes.me()}/essays/${id}`),
  getAnalysis: () => apiClient.get(profileRoutes.aiAnalysis()),
};
