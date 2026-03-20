import { apiClient } from '../client';

export const predictionService = {
  predict: (schoolIds: string[]) =>
    apiClient.post('/prediction', { schoolIds }, { timeout: 60000 }),
  getHistory: () => apiClient.get('/prediction/history'),
  reportResult: (predictionId: string, result: string) =>
    apiClient.post(`/prediction/${predictionId}/report`, { result }),
};
