import { describe, expect, it } from 'vitest';

import { evaluateHsConfidence, type HsConfidenceResult } from './hs-confidence';

/**
 * Build a HS-profile slice. By default every field is undefined (= missing);
 * pass overrides to populate dimensions / tier.
 */
type HsProfile = Parameters<typeof evaluateHsConfidence>[0];

function profile(overrides: Partial<HsProfile> = {}): HsProfile {
  return {
    highSchoolTier: undefined,
    highSchoolRecognition: undefined,
    highSchoolAcademicRigor: undefined,
    highSchoolPlacementRecord: undefined,
    highSchoolStudentQuality: undefined,
    highSchoolResources: undefined,
    ...overrides,
  };
}

const ALL_FIVE: Partial<HsProfile> = {
  highSchoolRecognition: 5,
  highSchoolAcademicRigor: 4,
  highSchoolPlacementRecord: 4,
  highSchoolStudentQuality: 3,
  highSchoolResources: 3,
};

describe('evaluateHsConfidence', () => {
  describe('result shape', () => {
    it('returns level, hsImpactScale, reason and dimensionsAvailable', () => {
      const r = evaluateHsConfidence(profile(ALL_FIVE));
      const keys = Object.keys(r).sort();
      expect(keys).toEqual(['dimensionsAvailable', 'hsImpactScale', 'level', 'reason'].sort());
    });
  });

  describe('none — no HS data at all', () => {
    it('empty profile → none / scale 0 / no_hs_data', () => {
      const r = evaluateHsConfidence(profile());
      expect(r).toEqual<HsConfidenceResult>({
        level: 'none',
        hsImpactScale: 0,
        reason: 'no_hs_data',
        dimensionsAvailable: 0,
      });
    });

    it('treats undefined and null dimensions identically as missing', () => {
      const undef = evaluateHsConfidence(profile());
      const nulled = evaluateHsConfidence(
        profile({
          highSchoolTier: null as unknown as number,
          highSchoolRecognition: null as unknown as number,
          highSchoolAcademicRigor: null as unknown as number,
          highSchoolPlacementRecord: null as unknown as number,
          highSchoolStudentQuality: null as unknown as number,
          highSchoolResources: null as unknown as number,
        })
      );
      expect(nulled).toEqual(undef);
      expect(nulled.level).toBe('none');
    });
  });

  describe('high — full or near-full evaluation (>=4 dimensions)', () => {
    it('all 5 dimensions → high / scale 1.0 / full_evaluation / 5 dims', () => {
      const r = evaluateHsConfidence(profile(ALL_FIVE));
      expect(r.level).toBe('high');
      expect(r.hsImpactScale).toBe(1.0);
      expect(r.reason).toBe('full_evaluation');
      expect(r.dimensionsAvailable).toBe(5);
    });

    it('exactly 4 dimensions still qualifies as high', () => {
      const r = evaluateHsConfidence(
        profile({
          highSchoolRecognition: 4,
          highSchoolAcademicRigor: 4,
          highSchoolPlacementRecord: 3,
          highSchoolStudentQuality: 3,
        })
      );
      expect(r.level).toBe('high');
      expect(r.dimensionsAvailable).toBe(4);
      expect(r.hsImpactScale).toBe(1.0);
    });
  });

  describe('medium — partial evaluation (2-3 dimensions)', () => {
    it('exactly 2 dimensions → medium / scale 0.7 / partial_evaluation', () => {
      const r = evaluateHsConfidence(
        profile({ highSchoolRecognition: 4, highSchoolAcademicRigor: 3 })
      );
      expect(r.level).toBe('medium');
      expect(r.hsImpactScale).toBe(0.7);
      expect(r.reason).toBe('partial_evaluation');
      expect(r.dimensionsAvailable).toBe(2);
    });

    it('3 dimensions is still medium (not yet high)', () => {
      const r = evaluateHsConfidence(
        profile({
          highSchoolRecognition: 4,
          highSchoolAcademicRigor: 3,
          highSchoolPlacementRecord: 3,
        })
      );
      expect(r.level).toBe('medium');
      expect(r.dimensionsAvailable).toBe(3);
    });

    it('a present tier does not change the medium decision (tier is not a dimension)', () => {
      const withTier = evaluateHsConfidence(
        profile({
          highSchoolTier: 5,
          highSchoolRecognition: 4,
          highSchoolAcademicRigor: 3,
        })
      );
      expect(withTier.level).toBe('medium');
      expect(withTier.dimensionsAvailable).toBe(2);
    });
  });

  describe('low — tier present but <2 dimensions', () => {
    it('tier only, zero dimensions → low / scale 0.4 / tier_only', () => {
      const r = evaluateHsConfidence(profile({ highSchoolTier: 3 }));
      expect(r.level).toBe('low');
      expect(r.hsImpactScale).toBe(0.4);
      expect(r.reason).toBe('tier_only');
      expect(r.dimensionsAvailable).toBe(0);
    });

    it('tier + exactly 1 dimension → still tier_only (0.4), counting the dim', () => {
      const r = evaluateHsConfidence(profile({ highSchoolTier: 3, highSchoolRecognition: 5 }));
      expect(r.level).toBe('low');
      expect(r.hsImpactScale).toBe(0.4);
      expect(r.reason).toBe('tier_only');
      expect(r.dimensionsAvailable).toBe(1);
    });
  });

  describe('low — single dimension, no tier', () => {
    it('1 dimension and no tier → low / scale 0.3 / single_dimension', () => {
      const r = evaluateHsConfidence(profile({ highSchoolPlacementRecord: 4 }));
      expect(r.level).toBe('low');
      expect(r.hsImpactScale).toBe(0.3);
      expect(r.reason).toBe('single_dimension');
      expect(r.dimensionsAvailable).toBe(1);
    });

    it('the single non-tier dimension scale (0.3) is lower than the tier-only scale (0.4)', () => {
      const noTier = evaluateHsConfidence(profile({ highSchoolResources: 2 }));
      const tierOnly = evaluateHsConfidence(profile({ highSchoolTier: 2 }));
      expect(noTier.hsImpactScale).toBeLessThan(tierOnly.hsImpactScale);
    });
  });

  describe('dimension counting', () => {
    it('counts each of the 5 evaluation fields, ignoring highSchoolTier', () => {
      // tier set but counted dims = the 3 evaluation fields below
      const r = evaluateHsConfidence(
        profile({
          highSchoolTier: 4,
          highSchoolRecognition: 3,
          highSchoolPlacementRecord: 3,
          highSchoolResources: 3,
        })
      );
      expect(r.dimensionsAvailable).toBe(3);
    });

    it('counts a 0-valued dimension as present (uses != null, not truthiness)', () => {
      const r = evaluateHsConfidence(
        profile({ highSchoolRecognition: 0, highSchoolAcademicRigor: 0 })
      );
      // two present dims → medium, proving 0 is "present" not "missing"
      expect(r.dimensionsAvailable).toBe(2);
      expect(r.level).toBe('medium');
    });
  });

  describe('invariant — scale rises monotonically with data quality', () => {
    it('none < single-dim < tier-only < medium < high', () => {
      const none = evaluateHsConfidence(profile()).hsImpactScale;
      const single = evaluateHsConfidence(profile({ highSchoolRecognition: 4 })).hsImpactScale;
      const tierOnly = evaluateHsConfidence(profile({ highSchoolTier: 3 })).hsImpactScale;
      const medium = evaluateHsConfidence(
        profile({ highSchoolRecognition: 4, highSchoolAcademicRigor: 4 })
      ).hsImpactScale;
      const high = evaluateHsConfidence(profile(ALL_FIVE)).hsImpactScale;

      expect(none).toBeLessThan(single);
      expect(single).toBeLessThan(tierOnly);
      expect(tierOnly).toBeLessThan(medium);
      expect(medium).toBeLessThan(high);
    });

    it('every scale stays within the documented [0, 1] range', () => {
      const cases = [
        profile(),
        profile({ highSchoolRecognition: 4 }),
        profile({ highSchoolTier: 3 }),
        profile({ highSchoolRecognition: 4, highSchoolAcademicRigor: 4 }),
        profile(ALL_FIVE),
      ];
      for (const p of cases) {
        const s = evaluateHsConfidence(p).hsImpactScale;
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    });
  });
});
