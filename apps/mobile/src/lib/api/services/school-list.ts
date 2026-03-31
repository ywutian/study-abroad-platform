import { API_ROUTES, schoolListRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const schoolListService = {
  getMyList: () => apiClient.get(API_ROUTES.SCHOOL_LISTS),
  addSchool: (schoolId: string, tier: string) =>
    apiClient.post(API_ROUTES.SCHOOL_LISTS, { schoolId, tier }),
  removeSchool: (id: string) => apiClient.delete(schoolListRoutes.byId(id)),
  updateTier: (id: string, tier: string) => apiClient.put(schoolListRoutes.byId(id), { tier }),
};
