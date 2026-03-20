import { apiClient } from '../client';

export const profileService = {
  getMyProfile: () => apiClient.get('/profiles/me'),
  updateProfile: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put('/profiles/me', data),
  getCompleteness: () => apiClient.get('/profiles/me/completeness'),
  getEssays: () => apiClient.get('/profiles/me/essays'),
  createEssay: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post('/profiles/me/essays', data),
  updateEssay: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`/profiles/me/essays/${id}`, data),
  deleteEssay: (id: string) => apiClient.delete(`/profiles/me/essays/${id}`),
  getAnalysis: () => apiClient.get('/profiles/me/analysis'),
};
