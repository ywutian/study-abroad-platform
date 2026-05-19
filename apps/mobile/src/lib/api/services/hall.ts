import { hallRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

// Hall §7 Decision B: `getReviews` / `createReview` were removed when the
// peer-review subsystem was retired.
export const hallService = {
  getVerified: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get(hallRoutes.verifiedRanking(), { params }),
  getOverview: () => apiClient.get(hallRoutes.meOverview()),
};
