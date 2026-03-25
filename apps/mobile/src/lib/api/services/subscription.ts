import { subscriptionRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const subscriptionService = {
  getCurrent: () => apiClient.get(subscriptionRoutes.current()),
  getPlans: () => apiClient.get(subscriptionRoutes.plans()),
  subscribe: (planId: string) => apiClient.post(subscriptionRoutes.subscribe(), { planId }),
  cancel: () => apiClient.delete(subscriptionRoutes.cancel()),
  getInvoices: () => apiClient.get(subscriptionRoutes.invoices()),
};
