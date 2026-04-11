import { predictionRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const predictionService = {
  predict: (schoolIds: string[]) =>
    apiClient.post(predictionRoutes.predict(), { schoolIds }, { timeout: 60000 }),
  getHistory: () => apiClient.get(predictionRoutes.history()),
  reportResult: (schoolId: string, result: string) =>
    apiClient.patch(predictionRoutes.result(schoolId), { result }),
};
