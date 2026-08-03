import { Prisma } from '@prisma/client';
import {
  APPLICATION_ANALYSIS_DEFAULT_THRESHOLDS,
  APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION,
  APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS,
  APPLICATION_ANALYSIS_EXPERIMENT_DEFAULT_THRESHOLDS,
  APPLICATION_ANALYSIS_EXPERIMENT_LIVE_THRESHOLDS,
  APPLICATION_ANALYSIS_EXPERIMENT_ROLLOUT_STAGES,
} from './application-analysis-workflow.constants';

/** Moved here with the helpers that key off them; the service re-imports both. */
export type ExperimentCapability = 'RECOURSE' | 'UNCERTAINTY' | 'FAIRNESS';
export type SweepMode = 'HOURLY_ROLLOUT' | 'NIGHTLY_SHADOW' | 'MANUAL_FULL';

/**
 * Pure helpers lifted out of ApplicationAnalysisWorkflowService.
 *
 * Every function here was a method that never touched `this` — normalisers,
 * JSON coercers and key builders. They were extracted because the service had
 * grown to 4,004 lines and the file-size ratchet (b73bd27a) only moves down
 * when code is actually broken up; this is the first time it has.
 *
 * Nothing else changed: same bodies, same signatures, called as free functions
 * instead of `this.x()`. Keep it that way — the moment one of these needs
 * `this.prisma`, it belongs back in the service, not given a constructor.
 */

export function normalizeDate(value?: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

export function normalizeThresholds(raw?: Record<string, unknown> | null) {
  return {
    ...APPLICATION_ANALYSIS_DEFAULT_THRESHOLDS,
    ...(raw ?? {}),
  };
}

export function appendNote(
  current: string | null | undefined,
  next: string,
): string {
  return current ? `${current}\n\n${next}` : next;
}

export function normalizeExperimentThresholds(
  capability: ExperimentCapability,
  raw?: Record<string, unknown> | null,
) {
  return {
    ...APPLICATION_ANALYSIS_EXPERIMENT_DEFAULT_THRESHOLDS[capability],
    ...(raw ?? {}),
  };
}

export function normalizeExperimentRolloutConfig(
  capability: ExperimentCapability,
  raw?: Record<string, unknown> | null,
) {
  const stages = APPLICATION_ANALYSIS_EXPERIMENT_ROLLOUT_STAGES[capability];
  const configuredStages = Array.isArray(raw?.rolloutPercentages)
    ? (raw?.rolloutPercentages as unknown[])
        .map((value) =>
          typeof value === 'number' && Number.isFinite(value)
            ? Math.max(1, Math.min(100, Math.round(value)))
            : null,
        )
        .filter((value): value is number => value != null)
    : Array.isArray(raw?.stages)
      ? (raw?.stages as unknown[])
          .map((value) =>
            typeof value === 'number' && Number.isFinite(value)
              ? Math.max(1, Math.min(100, Math.round(value)))
              : null,
          )
          .filter((value): value is number => value != null)
      : [];
  const normalizedStages =
    configuredStages.length > 0 ? [...new Set(configuredStages)] : [...stages];
  const currentPercentage = Math.max(
    0,
    Math.min(
      100,
      Number(
        raw?.currentPercentage ??
          raw?.canaryPercentage ??
          (raw?.currentStagePercentage as number | undefined) ??
          0,
      ) || 0,
    ),
  );
  const inferredStageIndex =
    typeof raw?.stageIndex === 'number'
      ? Math.max(-1, Math.min(normalizedStages.length - 1, raw.stageIndex))
      : currentPercentage > 0
        ? Math.max(0, normalizedStages.indexOf(currentPercentage))
        : -1;
  return {
    autoPromoteToCanary: true,
    autoPromoteStages: true,
    autoPromoteToActive: true,
    autoRetireOnFailure: true,
    automationPaused: false,
    stages: normalizedStages,
    rolloutPercentages: normalizedStages,
    currentPercentage,
    stageIndex: inferredStageIndex,
    minStageHours: APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.minStageHours,
    lastSweepAt: null,
    lastPromotedAt: null,
    nextEligiblePromotionAt: null,
    ...(raw ?? {}),
  };
}

export function normalizeExperimentMonitoringConfig(
  raw?: Record<string, unknown> | null,
) {
  return {
    ...APPLICATION_ANALYSIS_EXPERIMENT_LIVE_THRESHOLDS,
    ...(raw ?? {}),
    latestSweepMode:
      typeof raw?.latestSweepMode === 'string' ? raw.latestSweepMode : null,
    latestSweepAt:
      typeof raw?.latestSweepAt === 'string' ? raw.latestSweepAt : null,
    latestSweepRunId:
      typeof raw?.latestSweepRunId === 'string' ? raw.latestSweepRunId : null,
    latestLiveSignals:
      raw?.latestLiveSignals && typeof raw.latestLiveSignals === 'object'
        ? raw.latestLiveSignals
        : {},
    latestIncidentId:
      typeof raw?.latestIncidentId === 'string' ? raw.latestIncidentId : null,
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export function dedupeStrings(
  values: Array<string | null | undefined>,
): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value?.trim())),
    ),
  ];
}

export function capabilityFlagKey(capability: ExperimentCapability) {
  switch (capability) {
    case 'RECOURSE':
      return APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS.recourse;
    case 'UNCERTAINTY':
      return APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS.conformal;
    case 'FAIRNESS':
      return APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS.fairness;
  }
}

export function getSweepLockKey(mode: SweepMode) {
  return `lock:application-analysis-experiments:${mode.toLowerCase()}`;
}
