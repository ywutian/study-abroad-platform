/**
 * Unified Tier Computation
 *
 * Single source of truth for computing high school tier from evaluation
 * dimensions. Supports partial dimension inputs — when not all 5 dimensions
 * are available, the weights are renormalized over the present dimensions.
 *
 * Replaces 5 duplicate implementations:
 *   - packages/shared/src/scoring/score.ts  (computeTierFromDimensions)
 *   - apps/api/src/modules/school/high-school.service.ts  (computeTier)
 *   - apps/web/.../school-edit-dialog.tsx  (inline computation)
 *   - apps/api/scripts/ai-evaluate-high-schools.ts  (inline)
 *   - apps/api/scripts/import-high-schools.ts  (inline)
 */

/** Canonical dimension weights (sum = 1.0) */
export const TIER_WEIGHTS = {
  recognition: 0.3,
  academicRigor: 0.25,
  placementRecord: 0.25,
  studentQuality: 0.1,
  resources: 0.1,
} as const;

export type TierDimensionKey = keyof typeof TIER_WEIGHTS;

/** All 5 dimension keys in canonical order */
export const TIER_DIMENSION_KEYS: readonly TierDimensionKey[] = [
  'recognition',
  'academicRigor',
  'placementRecord',
  'studentQuality',
  'resources',
] as const;

export interface TierDimensions {
  recognition?: number | null;
  academicRigor?: number | null;
  placementRecord?: number | null;
  studentQuality?: number | null;
  resources?: number | null;
}

/**
 * Compute tier from available evaluation dimensions (1-5).
 *
 * Unlike the legacy `computeTierFromDimensions()` which requires all 5 values,
 * this function accepts partial inputs and renormalizes weights over present
 * dimensions so that partial evaluations still produce a meaningful tier.
 *
 * @param dims  Partial dimension values (1-5 scale). `null`/`undefined` = missing.
 * @returns     Tier (1-5), rounded. `null` if zero dimensions are available.
 *
 * @example
 * // Full evaluation
 * computeTierFromPartial({ recognition: 5, academicRigor: 4, placementRecord: 4, studentQuality: 3, resources: 3 })
 * // → 4
 *
 * // Partial evaluation (only 2 dimensions)
 * computeTierFromPartial({ recognition: 4, academicRigor: 3 })
 * // → 4  (renormalized: rec 0.30/0.55 ≈ 0.545, rigor 0.25/0.55 ≈ 0.455)
 */
export function computeTierFromPartial(dims: TierDimensions): number | null {
  const entries: Array<[TierDimensionKey, number]> = [];

  for (const key of TIER_DIMENSION_KEYS) {
    const val = dims[key];
    if (val != null) {
      entries.push([key, Math.max(1, Math.min(5, val))]);
    }
  }

  if (entries.length === 0) return null;

  // Renormalize weights over present dimensions
  const totalWeight = entries.reduce((s, [k]) => s + TIER_WEIGHTS[k], 0);
  const raw = entries.reduce((s, [k, v]) => s + (v * TIER_WEIGHTS[k]) / totalWeight, 0);

  return Math.round(Math.max(1, Math.min(5, raw)));
}

/**
 * Count how many of the 5 standard dimensions are present.
 */
export function countAvailableDimensions(dims: TierDimensions): number {
  return TIER_DIMENSION_KEYS.filter((k) => dims[k] != null).length;
}
