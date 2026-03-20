import { apiClient } from '../client';

export const assessmentService = {
  getTypes: () => apiClient.get('/assessment/types'),
  start: (type: string) => apiClient.post('/assessment/start', { type }),
  submit: (id: string, answers: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(`/assessment/${id}/submit`, { answers }, { timeout: 60000 }),
  getResults: () => apiClient.get('/assessment/results'),
  getResultById: (id: string) => apiClient.get(`/assessment/${id}`),
};
