import { apiClient } from '../client';

export const schoolListService = {
  getMyList: () => apiClient.get('/school-lists'),
  addSchool: (schoolId: string, tier: string) =>
    apiClient.post('/school-lists', { schoolId, tier }),
  removeSchool: (id: string) => apiClient.delete(`/school-lists/${id}`),
  updateTier: (id: string, tier: string) => apiClient.put(`/school-lists/${id}`, { tier }),
};
