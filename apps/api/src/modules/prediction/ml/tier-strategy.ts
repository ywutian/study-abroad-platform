/**
 * ML Tier Strategy
 *
 * Determines which model tier is appropriate based on available training data.
 * Each tier automatically activates when sufficient data accumulates.
 */

import type { LRConfig, FeatureVector } from '@study-abroad/shared/scoring';

// ============================================
// Tier Configuration
// ============================================

export interface TierConfig {
  tier: 0 | 1 | 2 | 3 | 4;
  description: string;
  minSamples: number;
  minMinorityRatio: number;
  featureSet: 'none' | 'heuristic_only' | 'basic_20' | 'full_44';
  featureNames: (keyof FeatureVector)[] | null;
  modelType: 'none' | 'platt' | 'logistic_regression' | 'gbdt';
  bandModels: boolean;
  lrConfig: Partial<LRConfig>;
}

const TIER_CONFIGS: Record<number, TierConfig> = {
  0: {
    tier: 0,
    description: 'Heuristic only (no data)',
    minSamples: 0,
    minMinorityRatio: 0,
    featureSet: 'none',
    featureNames: null,
    modelType: 'none',
    bandModels: false,
    lrConfig: {},
  },
  1: {
    tier: 1,
    description: 'Platt calibration on existing sigmoid',
    minSamples: 50,
    minMinorityRatio: 0,
    featureSet: 'heuristic_only',
    featureNames: ['heuristicProb'],
    modelType: 'platt',
    bandModels: false,
    lrConfig: { l2Lambda: 0.01, maxIterations: 500, earlyStopPatience: 20 },
  },
  2: {
    tier: 2,
    description: 'Basic logistic regression (20 features)',
    minSamples: 200,
    minMinorityRatio: 0.1,
    featureSet: 'basic_20',
    featureNames: null, // Will use FEATURE_NAMES_BASIC from features.ts
    modelType: 'logistic_regression',
    bandModels: false,
    lrConfig: {
      learningRate: 0.01,
      l2Lambda: 0.1,
      maxIterations: 1000,
      batchSize: 32,
      earlyStopPatience: 10,
    },
  },
  3: {
    tier: 3,
    description: 'Full logistic regression (44 features) + per-band models',
    minSamples: 1000,
    minMinorityRatio: 0.1,
    featureSet: 'full_44',
    featureNames: null, // Will use FEATURE_NAMES_FULL from features.ts
    modelType: 'logistic_regression',
    bandModels: true,
    lrConfig: {
      learningRate: 0.005,
      l2Lambda: 0.05,
      maxIterations: 1000,
      batchSize: 64,
      earlyStopPatience: 20,
    },
  },
  4: {
    tier: 4,
    description: 'Gradient Boosted Trees (Python sidecar)',
    minSamples: 5000,
    minMinorityRatio: 0.1,
    featureSet: 'full_44',
    featureNames: null,
    modelType: 'gbdt',
    bandModels: true,
    lrConfig: {},
  },
};

// ============================================
// Tier Determination
// ============================================

/**
 * Determine the appropriate model tier based on available data.
 */
export function determineTier(
  sampleCount: number,
  minorityRatio?: number,
): TierConfig {
  // Check from highest tier down
  for (const t of [4, 3, 2, 1]) {
    const config = TIER_CONFIGS[t];
    if (sampleCount >= config.minSamples) {
      // Check minority ratio if required
      if (
        config.minMinorityRatio > 0 &&
        minorityRatio != null &&
        minorityRatio < config.minMinorityRatio
      ) {
        continue;
      }
      return config;
    }
  }

  return TIER_CONFIGS[0];
}

/**
 * Get the next tier threshold (how many more samples needed).
 */
export function getNextTierThreshold(currentTier: number): {
  nextTier: number;
  samplesNeeded: number;
} | null {
  const next = currentTier + 1;
  if (next > 4) return null;
  return {
    nextTier: next,
    samplesNeeded: TIER_CONFIGS[next].minSamples,
  };
}

// ============================================
// Selectivity Bands
// ============================================

export const SELECTIVITY_BANDS = [
  { name: '0.0-0.3', min: 0, max: 0.3, label: 'Low selectivity (safety)' },
  { name: '0.3-0.6', min: 0.3, max: 0.6, label: 'Medium selectivity' },
  { name: '0.6-0.8', min: 0.6, max: 0.8, label: 'High selectivity' },
  {
    name: '0.8-1.0',
    min: 0.8,
    max: 1.0,
    label: 'Ultra-selective (top schools)',
  },
] as const;

/** Minimum samples per band to train a band-specific model (else fallback to global) */
export const MIN_BAND_SAMPLES = 100;

/**
 * Get the selectivity band name for a given selectivity index.
 */
export function getSelectivityBand(selectivity: number): string {
  for (const band of SELECTIVITY_BANDS) {
    if (selectivity >= band.min && selectivity < band.max) return band.name;
  }
  return '0.8-1.0'; // max band for selectivity === 1.0
}

/**
 * Split data into selectivity bands.
 */
export function splitByBand(selectivities: number[]): Map<string, number[]> {
  const bands = new Map<string, number[]>();
  for (const band of SELECTIVITY_BANDS) {
    bands.set(band.name, []);
  }

  for (let i = 0; i < selectivities.length; i++) {
    const bandName = getSelectivityBand(selectivities[i]);
    bands.get(bandName)!.push(i);
  }

  return bands;
}

export { TIER_CONFIGS };
