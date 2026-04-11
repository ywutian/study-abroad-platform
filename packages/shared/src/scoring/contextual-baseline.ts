import { ROUND_MULTIPLIERS } from './constants';

export interface ContextualBaselineSchoolMeta {
  acceptanceRate?: number | null;
  intlAcceptanceRate?: number | null;
}

export interface ContextualAcceptanceRate {
  rate: number;
  rawRate: number;
  baseType: 'overall' | 'international';
  roundContext: string;
  roundAdjusted: boolean;
}

export interface ContextualBaseline {
  rate: number;
  rawRate: number;
  baseType: 'overall' | 'international';
  roundContext: string;
  roundAdjusted: boolean;
  deltaPoints: number;
}

export function formatPercentValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

export function resolveContextualAcceptanceRate(params: {
  schoolMeta?: ContextualBaselineSchoolMeta | null;
  isInternational: boolean;
  roundContext?: string | null;
}): ContextualAcceptanceRate | null {
  const { schoolMeta, isInternational, roundContext } = params;

  const baselineSource =
    isInternational && schoolMeta?.intlAcceptanceRate != null
      ? {
          rawRate: schoolMeta.intlAcceptanceRate,
          baseType: 'international' as const,
        }
      : schoolMeta?.acceptanceRate != null
        ? {
            rawRate: schoolMeta.acceptanceRate,
            baseType: 'overall' as const,
          }
        : null;

  if (!baselineSource) {
    return null;
  }

  const normalizedRound = (roundContext ?? 'RD').toUpperCase();
  const roundMultiplier = ROUND_MULTIPLIERS[normalizedRound] ?? 1;
  const roundAdjusted = roundMultiplier !== 1;
  const rate = Math.min(
    95,
    Math.max(0, Math.round(baselineSource.rawRate * roundMultiplier * 10) / 10)
  );

  return {
    rate,
    rawRate: baselineSource.rawRate,
    baseType: baselineSource.baseType,
    roundContext: normalizedRound,
    roundAdjusted,
  };
}

export function resolveContextualBaseline(params: {
  schoolMeta?: ContextualBaselineSchoolMeta | null;
  isInternational: boolean;
  roundContext?: string | null;
  probability: number;
}): ContextualBaseline | null {
  const { probability } = params;
  const contextualRate = resolveContextualAcceptanceRate(params);
  if (!contextualRate) {
    return null;
  }

  const deltaPoints = Math.round((probability * 100 - contextualRate.rate) * 10) / 10;

  return {
    ...contextualRate,
    deltaPoints,
  };
}
