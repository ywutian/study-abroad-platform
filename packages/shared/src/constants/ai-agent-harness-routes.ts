import { API_ROUTES } from './api-routes';

const base = `${API_ROUTES.ADMIN}/ai-agent`;

export const adminAiAgentHarnessRoutes = {
  evidence: () => `${base}/harness/evidence`,
  alerts: () => `${base}/harness/alerts`,
  alertStatus: () => `${base}/harness/alerts/status`,
  acknowledgeAlert: (alertId: string) =>
    `${base}/harness/alerts/${encodeURIComponent(alertId)}/acknowledge`,
  alertDelivery: (alertId: string) =>
    `${base}/harness/alerts/${encodeURIComponent(alertId)}/delivery`,
  skills: () => `${base}/skills`,
  runEvolution: () => `${base}/skills/evolution/run`,
  rollbackSkill: () => `${base}/skills/rollback`,
} as const;
