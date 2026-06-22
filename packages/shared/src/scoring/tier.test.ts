import { describe, expect, it } from 'vitest';

import {
  TIER_DIMENSION_KEYS,
  TIER_WEIGHTS,
  computeTierFromPartial,
  countAvailableDimensions,
  type TierDimensions,
} from './tier';

describe('TIER_WEIGHTS / TIER_DIMENSION_KEYS', () => {
  it('weights sum to 1.0', () => {
    const sum = Object.values(TIER_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('dimension keys exactly cover the weight keys', () => {
    expect([...TIER_DIMENSION_KEYS].sort()).toEqual(Object.keys(TIER_WEIGHTS).sort());
    expect(TIER_DIMENSION_KEYS).toHaveLength(5);
  });
});

describe('computeTierFromPartial — reference values derived from the weights', () => {
  it('matches the docstring full-evaluation example (raw 4.1 → 4)', () => {
    // 5*0.30 + 4*0.25 + 4*0.25 + 3*0.10 + 3*0.10 = 4.1 → round → 4
    expect(
      computeTierFromPartial({
        recognition: 5,
        academicRigor: 4,
        placementRecord: 4,
        studentQuality: 3,
        resources: 3,
      })
    ).toBe(4);
  });

  it('matches the docstring partial-evaluation example (2 dims → 4)', () => {
    // totalWeight 0.55; raw = (4*0.30 + 3*0.25)/0.55 = 1.95/0.55 ≈ 3.545 → round → 4
    expect(computeTierFromPartial({ recognition: 4, academicRigor: 3 })).toBe(4);
  });

  it('all dimensions equal collapses to that exact value (weighted mean of a constant)', () => {
    for (const v of [1, 2, 3, 4, 5]) {
      expect(
        computeTierFromPartial({
          recognition: v,
          academicRigor: v,
          placementRecord: v,
          studentQuality: v,
          resources: v,
        })
      ).toBe(v);
    }
  });

  it('a single present dimension equals that dimension value (weight renormalizes to 1)', () => {
    expect(computeTierFromPartial({ resources: 2 })).toBe(2);
    expect(computeTierFromPartial({ recognition: 5 })).toBe(5);
    expect(computeTierFromPartial({ studentQuality: 4 })).toBe(4);
  });

  it('rounds half-down toward the lower tier (raw ≈ 3.4545 → 3)', () => {
    // (3*0.30 + 4*0.25)/0.55 = 1.9/0.55 ≈ 3.4545 → round → 3
    expect(computeTierFromPartial({ recognition: 3, academicRigor: 4 })).toBe(3);
  });
});

describe('computeTierFromPartial — bounds & clamping invariants', () => {
  it('returns null when no dimensions are present', () => {
    expect(computeTierFromPartial({})).toBeNull();
    expect(computeTierFromPartial({ recognition: null, academicRigor: undefined })).toBeNull();
  });

  it('result is always within [1,5] for in-range inputs', () => {
    for (const v of [1, 2, 3, 4, 5]) {
      const t = computeTierFromPartial({ recognition: v });
      expect(t).toBeGreaterThanOrEqual(1);
      expect(t).toBeLessThanOrEqual(5);
    }
  });

  it('clamps an over-range value down to 5 before weighting', () => {
    // 10 is clamped to 5; single dim → raw 5 → 5
    expect(computeTierFromPartial({ recognition: 10 })).toBe(5);
  });

  it('clamps a below-range value (and 0) up to 1 before weighting', () => {
    // 0 is non-null so it is "present"; clamped via max(1, min(5, 0)) → 1
    expect(computeTierFromPartial({ recognition: 0 })).toBe(1);
    expect(computeTierFromPartial({ recognition: -7 })).toBe(1);
  });

  it('treats a 0 value as present, not missing', () => {
    // contrast with null/undefined which are skipped entirely
    expect(computeTierFromPartial({ recognition: 0 })).not.toBeNull();
  });
});

describe('computeTierFromPartial — monotonicity & weighting behavior', () => {
  it('is non-decreasing as one dimension increases (others fixed)', () => {
    const base: TierDimensions = {
      recognition: 1,
      academicRigor: 3,
      placementRecord: 3,
      studentQuality: 3,
      resources: 3,
    };
    const low = computeTierFromPartial({ ...base, recognition: 1 })!;
    const mid = computeTierFromPartial({ ...base, recognition: 3 })!;
    const high = computeTierFromPartial({ ...base, recognition: 5 })!;
    expect(low).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(high);
    expect(low).toBeLessThan(high);
  });

  it('recognition (weight 0.30) moves the tier more than resources (weight 0.10)', () => {
    // Start from an all-2 baseline (tier 2), bump one dim to 5, compare raw influence
    // by checking the heavier-weighted dim reaches a higher tier first.
    const rec = computeTierFromPartial({
      recognition: 5,
      academicRigor: 2,
      placementRecord: 2,
      studentQuality: 2,
      resources: 2,
    })!;
    const res = computeTierFromPartial({
      recognition: 2,
      academicRigor: 2,
      placementRecord: 2,
      studentQuality: 2,
      resources: 5,
    })!;
    // rec raw = 2 + (5-2)*0.30 = 2.9 → 3 ; res raw = 2 + (5-2)*0.10 = 2.3 → 2
    expect(rec).toBeGreaterThan(res);
    expect(rec).toBe(3);
    expect(res).toBe(2);
  });

  it('renormalization makes the same single value yield the same tier regardless of which dim', () => {
    expect(computeTierFromPartial({ recognition: 4 })).toBe(
      computeTierFromPartial({ resources: 4 })
    );
  });
});

describe('countAvailableDimensions', () => {
  it('counts only non-null/undefined dimensions', () => {
    expect(countAvailableDimensions({})).toBe(0);
    expect(countAvailableDimensions({ recognition: 3 })).toBe(1);
    expect(
      countAvailableDimensions({
        recognition: 3,
        academicRigor: null,
        placementRecord: undefined,
        studentQuality: 4,
      })
    ).toBe(2);
  });

  it('counts a 0 value as present', () => {
    expect(countAvailableDimensions({ recognition: 0 })).toBe(1);
  });

  it('counts all 5 when fully populated', () => {
    expect(
      countAvailableDimensions({
        recognition: 1,
        academicRigor: 2,
        placementRecord: 3,
        studentQuality: 4,
        resources: 5,
      })
    ).toBe(5);
  });

  it('agrees with computeTierFromPartial on the empty case (0 ↔ null)', () => {
    const empty: TierDimensions = {};
    expect(countAvailableDimensions(empty)).toBe(0);
    expect(computeTierFromPartial(empty)).toBeNull();
  });
});
