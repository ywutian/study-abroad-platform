import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '../client';

export const assessmentService = {
  getTypes: () => apiClient.get(`${API_ROUTES.ASSESSMENTS}/types`),
  start: (type: string) => apiClient.post(`${API_ROUTES.ASSESSMENTS}/start`, { type }),
  submit: (id: string, answers: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(`${API_ROUTES.ASSESSMENTS}/${id}/submit`, { answers }, { timeout: 60000 }),
  getResults: () => apiClient.get(`${API_ROUTES.ASSESSMENTS}/results`),
  getResultById: (id: string) => apiClient.get(`${API_ROUTES.ASSESSMENTS}/${id}`),
};
