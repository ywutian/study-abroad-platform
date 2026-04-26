import type { DistillationTeacherSignal } from '../types';

export function clampProbability(value: number): number {
  return Math.max(0.01, Math.min(0.99, value));
}

export function toProbability(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const normalized = value > 1 ? value / 100 : value;
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  return clampProbability(normalized);
}

export function confidenceFromSampleCount(
  sampleCount: number | null | undefined,
  fallback: 'low' | 'medium' | 'high' = 'medium',
): 'low' | 'medium' | 'high' {
  if (sampleCount == null) return fallback;
  if (sampleCount >= 100) return 'high';
  if (sampleCount >= 30) return 'medium';
  return 'low';
}

export function inactiveSignal(
  key: DistillationTeacherSignal['key'],
  label: string,
  sourceType: DistillationTeacherSignal['sourceType'],
  missingReasons: string[],
): Omit<
  DistillationTeacherSignal,
  'configuredWeight' | 'effectiveBlendWeight'
> {
  return {
    key,
    label,
    sourceName: `distillation:${key}`,
    sourceType,
    probability: null,
    active: false,
    confidence: 'low',
    missingReasons,
  };
}

export function normalizeToken(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

export function resolveObservedProbability(row: {
  observedProbability?: { toNumber(): number } | number | null;
  rate?: { toNumber(): number } | number | null;
}): number | null {
  const raw = row.observedProbability ?? row.rate ?? null;
  if (raw == null) return null;
  const value = typeof raw === 'number' ? raw : raw.toNumber();
  return toProbability(value);
}
