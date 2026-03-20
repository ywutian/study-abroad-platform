import { apiClient } from '../client';

export const subscriptionService = {
  getCurrent: () => apiClient.get('/subscription'),
  getPlans: () => apiClient.get('/subscription/plans'),
  subscribe: (planId: string) => apiClient.post('/subscription', { planId }),
  cancel: () => apiClient.delete('/subscription'),
  getInvoices: () => apiClient.get('/subscription/invoices'),
};
