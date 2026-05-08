import type { ApplicationAnalysisExperimentVersionRecord } from '@study-abroad/shared';

export const EVIDENCE_DIMENSIONS = ['TESTING', 'INTL_AID', 'ROUND', 'OTHER'] as const;
export const EXPERIMENT_CAPABILITIES = ['RECOURSE', 'UNCERTAINTY', 'FAIRNESS'] as const;
export const EVIDENCE_REVIEW_STATUSES = [
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
] as const;

export function humanizeEnum(value?: string | null) {
  if (!value) return 'Unknown';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function formatMetric(value: unknown) {
  if (typeof value === 'number') return value.toFixed(3);
  if (typeof value === 'boolean') return value ? 'Pass' : 'Fail';
  return '—';
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function getRolloutSnapshot(experiment: ApplicationAnalysisExperimentVersionRecord) {
  const rolloutConfig = asRecord(experiment.rolloutConfig);
  const monitoringConfig = asRecord(experiment.monitoringConfig);
  const percentages = Array.isArray(rolloutConfig.rolloutPercentages)
    ? rolloutConfig.rolloutPercentages.join(', ')
    : Array.isArray(rolloutConfig.stages)
      ? rolloutConfig.stages.join(', ')
      : '5, 25, 100';
  return {
    percentages,
    currentPercentage:
      typeof rolloutConfig.currentPercentage === 'number' ? rolloutConfig.currentPercentage : null,
    nextEligiblePromotionAt:
      typeof rolloutConfig.nextEligiblePromotionAt === 'string'
        ? rolloutConfig.nextEligiblePromotionAt
        : null,
    minStageHours:
      typeof rolloutConfig.minStageHours === 'number' ? rolloutConfig.minStageHours : 24,
    autoPromote:
      typeof rolloutConfig.autoPromoteStages === 'boolean' ? rolloutConfig.autoPromoteStages : true,
    autoRetire:
      typeof rolloutConfig.autoRetireOnFailure === 'boolean'
        ? rolloutConfig.autoRetireOnFailure
        : true,
    automationPaused:
      typeof rolloutConfig.automationPaused === 'boolean' ? rolloutConfig.automationPaused : false,
    lastSweepAt:
      typeof monitoringConfig.latestSweepAt === 'string' ? monitoringConfig.latestSweepAt : null,
  };
}
