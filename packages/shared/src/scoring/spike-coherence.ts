/**
 * Spike Coherence Analysis (v5)
 *
 * Quantifies whether a student's activity profile shows focused depth ("spike")
 * or scattered breadth ("well-rounded"). Top universities generally prefer
 * spikes — deep achievement in a specific domain.
 *
 * Reference: CollegeVine 4-tier system geometric morphological analysis.
 */

import { ACTIVITY_TIER_POINTS, MAJOR_ACTIVITY_MAP } from './constants';

interface ActivityForCoherence {
  category?: string;
  tier?: number;
}

/**
 * Compute a non-linear spike coherence multiplier based on activity clustering.
 *
 * @param activities - Array of activities with category and optional tier
 * @param targetMajor - Target major category (e.g., 'STEM', 'BUSINESS')
 * @returns Coherence multiplier (0.9 to ~1.32)
 *   - focusRatio > 0.6 → spike bonus (up to 1.2x)
 *   - focusRatio < 0.3 → scattered penalty (down to 0.9x)
 *   - Major-aligned spike → extra +10%
 */
export function computeSpikeCoherence(
  activities: ActivityForCoherence[],
  targetMajor?: string
): number {
  if (!activities.length) return 1.0;

  // 1. Group by category and compute tier-weighted strength per cluster
  const clusters = new Map<string, number>();
  for (const a of activities) {
    const cat = a.category ?? 'OTHER';
    const pts = ACTIVITY_TIER_POINTS[a.tier ?? 4] ?? 2;
    clusters.set(cat, (clusters.get(cat) ?? 0) + pts);
  }

  // 2. Find strongest cluster
  let strongestCat = '';
  let strongestStrength = 0;
  let totalStrength = 0;
  for (const [cat, strength] of clusters) {
    totalStrength += strength;
    if (strength > strongestStrength) {
      strongestStrength = strength;
      strongestCat = cat;
    }
  }

  if (totalStrength === 0) return 1.0;

  // 3. Focus ratio = strongest cluster / total
  const focusRatio = strongestStrength / totalStrength;

  // 4. Non-linear multiplier
  let multiplier: number;
  if (focusRatio > 0.6) {
    // Spike: reward focus (max ~1.2x)
    multiplier = 1.0 + (focusRatio - 0.6) * 0.5;
  } else if (focusRatio < 0.3) {
    // Scattered: mild penalty (min ~0.9x)
    multiplier = 0.9 + focusRatio * 0.33;
  } else {
    // Middle ground: neutral
    multiplier = 1.0;
  }

  // 5. Major alignment bonus
  if (targetMajor) {
    const alignedCategories = MAJOR_ACTIVITY_MAP[targetMajor];
    if (alignedCategories?.includes(strongestCat)) {
      multiplier *= 1.1; // +10% for spike aligned with target major
    }
  }

  return multiplier;
}
