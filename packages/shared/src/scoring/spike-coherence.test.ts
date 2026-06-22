import { describe, expect, it } from 'vitest';

import { computeSpikeCoherence } from './spike-coherence';

// Contract derived by reading spike-coherence.ts + constants.ts:
//   ACTIVITY_TIER_POINTS: {1:12, 2:8, 3:5, 4:2}; any other/missing tier -> 2 pts (via `?? 2`).
//   focusRatio = strongest cluster strength / total strength.
//   focusRatio > 0.6  -> 1.0 + (focusRatio - 0.6) * 0.5   (max 1.2 at focusRatio = 1)
//   focusRatio < 0.3  -> 0.9 + focusRatio * 0.33
//   0.3 <= focusRatio <= 0.6 -> 1.0 (neutral)
//   Major alignment: strongest category in MAJOR_ACTIVITY_MAP[targetMajor] -> *= 1.1
//   MAJOR_ACTIVITY_MAP.STEM = ['ACADEMIC', 'RESEARCH', 'INTERNSHIP'].

describe('computeSpikeCoherence', () => {
  describe('degenerate / empty inputs', () => {
    it('returns the neutral 1.0 for an empty activity list', () => {
      expect(computeSpikeCoherence([])).toBe(1.0);
    });

    it('returns 1.0 for an empty list even when a target major is supplied', () => {
      expect(computeSpikeCoherence([], 'STEM')).toBe(1.0);
    });
  });

  describe('focus ratio -> spike branch (focusRatio > 0.6)', () => {
    it('gives the maximum 1.2x for a single perfectly-focused activity', () => {
      // one cluster -> focusRatio = 1.0 -> 1.0 + (1 - 0.6)*0.5 = 1.2
      expect(computeSpikeCoherence([{ category: 'RESEARCH', tier: 1 }])).toBeCloseTo(1.2, 10);
    });

    it('reaches 1.2x regardless of tier when there is only one category', () => {
      // single category -> focusRatio always 1.0, independent of points magnitude
      expect(
        computeSpikeCoherence([
          { category: 'ARTS', tier: 4 },
          { category: 'ARTS', tier: 4 },
        ])
      ).toBeCloseTo(1.2, 10);
    });

    it('matches the reference value for a dominant-but-not-sole cluster', () => {
      // RESEARCH: tier1(12) + tier1(12) = 24; OTHER: tier4(2) -> total 26
      // focusRatio = 24/26 = 0.923... -> 1.0 + (0.92307... - 0.6)*0.5 = 1.16153...
      const v = computeSpikeCoherence([
        { category: 'RESEARCH', tier: 1 },
        { category: 'RESEARCH', tier: 1 },
        { category: 'SPORTS', tier: 4 },
      ]);
      expect(v).toBeCloseTo(1.0 + (24 / 26 - 0.6) * 0.5, 10);
    });
  });

  describe('focus ratio -> scattered branch (focusRatio < 0.3)', () => {
    it('matches the reference value for four equal scattered clusters', () => {
      // 4 distinct categories, each tier4 (2 pts) -> each cluster 2, total 8
      // focusRatio = 2/8 = 0.25 -> 0.9 + 0.25*0.33 = 0.9825
      const v = computeSpikeCoherence([
        { category: 'A', tier: 4 },
        { category: 'B', tier: 4 },
        { category: 'C', tier: 4 },
        { category: 'D', tier: 4 },
      ]);
      expect(v).toBeCloseTo(0.9825, 10);
    });

    it('produces a penalty strictly below 1.0 for a scattered profile', () => {
      const v = computeSpikeCoherence([
        { category: 'A', tier: 4 },
        { category: 'B', tier: 4 },
        { category: 'C', tier: 4 },
        { category: 'D', tier: 4 },
        { category: 'E', tier: 4 },
      ]);
      // focusRatio = 1/5 = 0.2 -> 0.9 + 0.2*0.33 = 0.966
      expect(v).toBeLessThan(1.0);
      expect(v).toBeCloseTo(0.966, 10);
    });
  });

  describe('focus ratio -> neutral middle ground (0.3 <= focusRatio <= 0.6)', () => {
    it('returns exactly 1.0 for two equally-strong clusters (focusRatio = 0.5)', () => {
      const v = computeSpikeCoherence([
        { category: 'A', tier: 2 },
        { category: 'B', tier: 2 },
      ]);
      expect(v).toBe(1.0);
    });

    it('returns 1.0 for three equal clusters (focusRatio = 1/3, inside the neutral band)', () => {
      // 3 equal clusters of 5 (tier3) -> focusRatio = 5/15 = 0.333 -> neutral -> 1.0
      const v = computeSpikeCoherence([
        { category: 'A', tier: 3 },
        { category: 'B', tier: 3 },
        { category: 'C', tier: 3 },
      ]);
      expect(v).toBe(1.0);
    });
  });

  describe('tier handling and defaults', () => {
    it('treats a missing tier as tier 4 (2 points) when computing strength', () => {
      // No tier on either -> both 2 pts -> focusRatio 0.5 -> neutral 1.0
      expect(computeSpikeCoherence([{ category: 'A' }, { category: 'B' }])).toBe(1.0);
    });

    it('falls back to 2 points for an unknown tier number (e.g. tier 5)', () => {
      // tier 5 is NOT in ACTIVITY_TIER_POINTS -> `?? 2`. Single category -> focusRatio 1.0 -> 1.2
      expect(computeSpikeCoherence([{ category: 'A', tier: 5 }])).toBeCloseTo(1.2, 10);
    });

    it('treats missing category as the "OTHER" bucket', () => {
      // both default to OTHER -> single cluster -> focusRatio 1.0 -> spike 1.2
      expect(computeSpikeCoherence([{ tier: 1 }, { tier: 1 }])).toBeCloseTo(1.2, 10);
    });
  });

  describe('major alignment bonus', () => {
    it('applies a +10% multiplier when the strongest cluster aligns with the target major', () => {
      // STEM aligns RESEARCH; single RESEARCH spike -> 1.2 * 1.1 = 1.32
      const v = computeSpikeCoherence([{ category: 'RESEARCH', tier: 1 }], 'STEM');
      expect(v).toBeCloseTo(1.32, 10);
    });

    it('does NOT apply the bonus when the strongest cluster is not aligned', () => {
      // SPORTS is not in STEM's aligned categories -> no bonus -> stays 1.2
      const v = computeSpikeCoherence([{ category: 'SPORTS', tier: 1 }], 'STEM');
      expect(v).toBeCloseTo(1.2, 10);
    });

    it('does NOT apply the bonus for an unknown target major', () => {
      const v = computeSpikeCoherence([{ category: 'RESEARCH', tier: 1 }], 'UNKNOWN_MAJOR');
      expect(v).toBeCloseTo(1.2, 10);
    });

    it('stacks the alignment bonus on top of a scattered penalty', () => {
      // ACADEMIC dominant but scattered: ACADEMIC=2, B=2, C=2, D=2 -> 0.25 -> 0.9825 base
      // but ACADEMIC IS strongest only if it ties... build ACADEMIC strictly strongest yet < 0.3:
      // ACADEMIC = tier3 (5); B,C,D,E,F = tier4(2)*? need total so 5/total < 0.3 -> total > 16.67
      // add B..K (six tier4 = 12) -> total 17, focusRatio = 5/17 = 0.294 < 0.3
      const v = computeSpikeCoherence(
        [
          { category: 'ACADEMIC', tier: 3 }, // 5
          { category: 'B', tier: 4 }, // 2
          { category: 'C', tier: 4 }, // 2
          { category: 'D', tier: 4 }, // 2
          { category: 'E', tier: 4 }, // 2
          { category: 'F', tier: 4 }, // 2
          { category: 'G', tier: 4 }, // 2
        ],
        'STEM'
      );
      const total = 5 + 2 * 6; // 17
      const focusRatio = 5 / total; // ~0.294
      const base = 0.9 + focusRatio * 0.33;
      expect(focusRatio).toBeLessThan(0.3);
      expect(v).toBeCloseTo(base * 1.1, 10);
    });
  });

  describe('bounds and invariants', () => {
    it('never produces a multiplier above the documented ceiling (~1.32)', () => {
      // Max base spike 1.2 * max alignment 1.1 = 1.32
      const v = computeSpikeCoherence([{ category: 'RESEARCH', tier: 1 }], 'STEM');
      expect(v).toBeLessThanOrEqual(1.32 + 1e-9);
    });

    it('keeps a scattered penalty within the documented [0.9, 1.0) floor region', () => {
      const v = computeSpikeCoherence([
        { category: 'A', tier: 4 },
        { category: 'B', tier: 4 },
        { category: 'C', tier: 4 },
        { category: 'D', tier: 4 },
      ]);
      expect(v).toBeGreaterThanOrEqual(0.9);
      expect(v).toBeLessThan(1.0);
    });

    it('is monotonic: a more focused profile scores >= a more scattered one', () => {
      const focused = computeSpikeCoherence([
        { category: 'A', tier: 1 },
        { category: 'A', tier: 1 },
        { category: 'B', tier: 4 },
      ]);
      const scattered = computeSpikeCoherence([
        { category: 'A', tier: 4 },
        { category: 'B', tier: 4 },
        { category: 'C', tier: 4 },
        { category: 'D', tier: 4 },
      ]);
      expect(focused).toBeGreaterThan(scattered);
    });
  });
});
