import { API_ROUTES, timelineRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const timelineService = {
  getOverview: () => apiClient.get(`${API_ROUTES.TIMELINES}/overview`),
  getSchoolTimelines: () => apiClient.get(`${API_ROUTES.TIMELINES}/schools`),
  generateTimeline: (schoolId: string) =>
    apiClient.post(`${API_ROUTES.TIMELINES}/generate`, { schoolId }, { timeout: 60000 }),
  getPersonalEvents: () => apiClient.get(timelineRoutes.personal()),
  createPersonalEvent: (data: Record<string, string | number | boolean | undefined>) =>
    apiClient.post(timelineRoutes.personal(), data),
  updatePersonalEvent: (id: string, data: Record<string, string | number | boolean | undefined>) =>
    apiClient.put(`${timelineRoutes.personal()}/${id}`, data),
  deletePersonalEvent: (id: string) => apiClient.delete(`${timelineRoutes.personal()}/${id}`),
  getGlobalEvents: () => apiClient.get(timelineRoutes.global()),
  toggleTask: (taskId: string) => apiClient.post(timelineRoutes.taskToggle(taskId)),
};
