/**
 * High School Confidence Evaluation
 *
 * Layer 2 of the closed-loop architecture: evaluates how much to trust the
 * HS impact on predictions based on available data quality.
 *
 * This runs at prediction time (consumption), not ingestion time.
 * The key output is `hsImpactScale` (0-1) which scales the HS multiplier
 * in `calculateHsImpact()` — low-confidence data gets attenuated rather
 * than silently dropped.
 */

import type { ProfileMetrics } from './types';
import { TIER_DIMENSION_KEYS, type TierDimensions } from './tier';

export type HsConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export interface HsConfidenceResult {
  /** Confidence level */
  level: HsConfidenceLevel;
  /** Scale factor for HS impact (0.0 = no impact, 1.0 = full impact) */
  hsImpactScale: number;
  /** Machine-readable reason code */
  reason: string;
  /** Number of evaluation dimensions available (0-5) */
  dimensionsAvailable: number;
}

/**
 * Evaluate confidence in HS data for prediction scaling.
 *
 * Decision table:
 *   ≥4 dimensions available → high (scale 1.0)
 *   ≥2 dimensions available → medium (scale 0.7)
 *   tier only (0 dims but tier present) → low (scale 0.4)
 *   nothing → none (scale 0.0)
 */
export function evaluateHsConfidence(
  profile: Pick<
    ProfileMetrics,
    | 'highSchoolTier'
    | 'highSchoolRecognition'
    | 'highSchoolAcademicRigor'
    | 'highSchoolPlacementRecord'
    | 'highSchoolStudentQuality'
    | 'highSchoolResources'
  >
): HsConfidenceResult {
  // Map ProfileMetrics fields to TierDimensions for counting
  const dims: TierDimensions = {
    recognition: profile.highSchoolRecognition,
    academicRigor: profile.highSchoolAcademicRigor,
    placementRecord: profile.highSchoolPlacementRecord,
    studentQuality: profile.highSchoolStudentQuality,
    resources: profile.highSchoolResources,
  };

  const dimensionsAvailable = TIER_DIMENSION_KEYS.filter((k) => dims[k] != null).length;

  // No HS data at all
  if (!profile.highSchoolTier && dimensionsAvailable === 0) {
    return {
      level: 'none',
      hsImpactScale: 0,
      reason: 'no_hs_data',
      dimensionsAvailable: 0,
    };
  }

  // Full or near-full evaluation
  if (dimensionsAvailable >= 4) {
    return {
      level: 'high',
      hsImpactScale: 1.0,
      reason: 'full_evaluation',
      dimensionsAvailable,
    };
  }

  // Partial evaluation
  if (dimensionsAvailable >= 2) {
    return {
      level: 'medium',
      hsImpactScale: 0.7,
      reason: 'partial_evaluation',
      dimensionsAvailable,
    };
  }

  // Has tier but minimal dimensions
  if (profile.highSchoolTier != null) {
    return {
      level: 'low',
      hsImpactScale: 0.4,
      reason: 'tier_only',
      dimensionsAvailable,
    };
  }

  // Has 1 dimension but no tier
  if (dimensionsAvailable === 1) {
    return {
      level: 'low',
      hsImpactScale: 0.3,
      reason: 'single_dimension',
      dimensionsAvailable,
    };
  }

  return {
    level: 'none',
    hsImpactScale: 0,
    reason: 'insufficient_data',
    dimensionsAvailable: 0,
  };
}
