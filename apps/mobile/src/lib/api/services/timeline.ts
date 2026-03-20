import { apiClient } from '../client';

export const timelineService = {
  getOverview: () => apiClient.get('/timelines/overview'),
  getSchoolTimelines: () => apiClient.get('/timelines/schools'),
  generateTimeline: (schoolId: string) =>
    apiClient.post('/timelines/generate', { schoolId }, { timeout: 60000 }),
  getPersonalEvents: () => apiClient.get('/timelines/personal'),
  createPersonalEvent: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post('/timelines/personal', data),
  updatePersonalEvent: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`/timelines/personal/${id}`, data),
  deletePersonalEvent: (id: string) => apiClient.delete(`/timelines/personal/${id}`),
  getGlobalEvents: () => apiClient.get('/timelines/global'),
  toggleTask: (taskId: string) => apiClient.post(`/timelines/tasks/${taskId}/toggle`),
};
