import { describe, expect, it } from 'vitest';

import { computeHsQualityScore, HS_QUALITY_THRESHOLDS, type HsQualityInput } from './hs-quality';

/** A fully-populated school: every point bucket awarded → score 100, grade A. */
const FULL_SCHOOL: HsQualityInput = {
  name: 'Phillips Exeter Academy',
  country: 'US',
  state: 'NH',
  city: 'Exeter',
  type: 'private',
  nameZh: '菲利普斯埃克塞特学院',
  website: 'https://exeter.edu',
  recognition: 95,
  academicRigor: 98,
  placementRecord: 92,
  studentQuality: 90,
  resources: 99,
  gradeInflation: 'low',
  tier: 1,
  evaluatedBy: 'admin',
  avgSatScore: 1500,
  avgIbScore: 40,
};

describe('computeHsQualityScore — reference values', () => {
  it('awards a perfect 100 / grade A for a fully-populated school', () => {
    const result = computeHsQualityScore(FULL_SCHOOL);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.missingCritical).toEqual([]);
    expect(result.missingOptional).toEqual([]);
  });

  it('returns score 0 / grade D / all-missing for an empty input', () => {
    const result = computeHsQualityScore({});
    expect(result.score).toBe(0);
    expect(result.grade).toBe('D');
    // All 5 evaluation dimensions reported missing, in declaration order.
    expect(result.missingCritical).toEqual([
      'recognition',
      'academicRigor',
      'placementRecord',
      'studentQuality',
      'resources',
    ]);
    // All 5 optional buckets reported missing, in the function's emission order.
    expect(result.missingOptional).toEqual([
      'gradeInflation',
      'website',
      'nameZh',
      'avgSatScore/avgIbScore',
      'evaluatedBy',
    ]);
  });

  it('scores core identity only (name+country+type+state) at 25 → grade D', () => {
    const result = computeHsQualityScore({
      name: 'Some HS',
      country: 'US',
      type: 'public',
      state: 'CA',
    });
    // 10 + 5 + 5 + 5 = 25
    expect(result.score).toBe(25);
    expect(result.grade).toBe('D');
    // No evaluation dimensions present → all 5 still critical-missing.
    expect(result.missingCritical).toHaveLength(5);
  });

  it('scores all 5 evaluation dimensions alone at 50 → grade C', () => {
    const result = computeHsQualityScore({
      recognition: 80,
      academicRigor: 80,
      placementRecord: 80,
      studentQuality: 80,
      resources: 80,
    });
    expect(result.score).toBe(50);
    expect(result.grade).toBe('C');
    expect(result.missingCritical).toEqual([]);
  });
});

describe('computeHsQualityScore — grade thresholds', () => {
  it('grades exactly at the A boundary (80 → A)', () => {
    // Identity 25 + 5 evaluation dims 50 + tier 5 = 80
    const result = computeHsQualityScore({
      name: 'X',
      country: 'US',
      type: 'private',
      city: 'Y',
      recognition: 1,
      academicRigor: 1,
      placementRecord: 1,
      studentQuality: 1,
      resources: 1,
      tier: 2,
    });
    expect(result.score).toBe(80);
    expect(result.grade).toBe('A');
  });

  it('grades exactly at the B boundary (60 → B) and just below (59 → C)', () => {
    // Identity 25 + 5 evaluation dims 50 = 75 is too high; build 60 precisely:
    // name 10 + country 5 + type 5 = 20 identity, + 4 eval dims (40) = 60
    const atSixty = computeHsQualityScore({
      name: 'X',
      country: 'US',
      type: 'private',
      recognition: 1,
      academicRigor: 1,
      placementRecord: 1,
      studentQuality: 1,
    });
    expect(atSixty.score).toBe(60);
    expect(atSixty.grade).toBe('B');

    // Drop the type (5 pts) → 55, still grade C (>= 40).
    const belowSixty = computeHsQualityScore({
      name: 'X',
      country: 'US',
      recognition: 1,
      academicRigor: 1,
      placementRecord: 1,
      studentQuality: 1,
    });
    expect(belowSixty.score).toBe(55);
    expect(belowSixty.grade).toBe('C');
  });

  it('grades exactly at the C boundary (40 → C) and just below (39 → D)', () => {
    // 4 evaluation dims = 40
    const atForty = computeHsQualityScore({
      recognition: 1,
      academicRigor: 1,
      placementRecord: 1,
      studentQuality: 1,
    });
    expect(atForty.score).toBe(40);
    expect(atForty.grade).toBe('C');

    // 3 eval dims (30) + website (3) + nameZh (3) + gradeInflation (5) = 41? trim to 39:
    // 3 eval dims (30) + website 3 + nameZh 3 = 36 → too low; use 3 dims + tier 5 + website 3 = 38
    const belowForty = computeHsQualityScore({
      recognition: 1,
      academicRigor: 1,
      placementRecord: 1,
      tier: 1,
      website: 'https://x.com',
    });
    expect(belowForty.score).toBe(38);
    expect(belowForty.grade).toBe('D');
  });

  it('thresholds map to the exported HS_QUALITY_THRESHOLDS constants', () => {
    expect(HS_QUALITY_THRESHOLDS.FULL).toBe(80);
    expect(HS_QUALITY_THRESHOLDS.PARTIAL).toBe(60);
    expect(HS_QUALITY_THRESHOLDS.MINIMAL).toBe(40);
  });
});

describe('computeHsQualityScore — invariants & edge cases', () => {
  it('is monotonic: adding any field never lowers the score', () => {
    const base = computeHsQualityScore({ name: 'X' });
    const withCountry = computeHsQualityScore({ name: 'X', country: 'US' });
    const withCountryAndDim = computeHsQualityScore({
      name: 'X',
      country: 'US',
      recognition: 50,
    });
    expect(withCountry.score).toBeGreaterThanOrEqual(base.score);
    expect(withCountryAndDim.score).toBeGreaterThanOrEqual(withCountry.score);
  });

  it('always returns a score within [0, 100] and a valid grade letter', () => {
    for (const input of [{}, FULL_SCHOOL, { name: 'X' }, { recognition: 1 }]) {
      const r = computeHsQualityScore(input);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D']).toContain(r.grade);
    }
  });

  it('treats a 0 evaluation-dimension value as PRESENT (uses != null, not truthiness)', () => {
    // recognition: 0 is a legitimate "lowest" rating, not "missing".
    const result = computeHsQualityScore({ recognition: 0 });
    expect(result.score).toBe(10);
    expect(result.missingCritical).not.toContain('recognition');
  });

  it('treats tier 0 and avgSatScore 0 as PRESENT (uses != null)', () => {
    const tierZero = computeHsQualityScore({ tier: 0 });
    expect(tierZero.score).toBe(5);
    const satZero = computeHsQualityScore({ avgSatScore: 0 });
    expect(satZero.score).toBe(4);
    expect(satZero.missingOptional).not.toContain('avgSatScore/avgIbScore');
  });

  it('treats empty-string identity/supplementary fields as MISSING (truthiness gate)', () => {
    const result = computeHsQualityScore({
      name: '',
      country: '',
      type: '',
      gradeInflation: '',
      website: '',
      nameZh: '',
      evaluatedBy: '',
    });
    expect(result.score).toBe(0);
    expect(result.grade).toBe('D');
    expect(result.missingOptional).toContain('website');
    expect(result.missingOptional).toContain('nameZh');
  });

  it('treats null and undefined evaluation dimensions identically as missing', () => {
    const withNull = computeHsQualityScore({ recognition: null });
    const withUndefined = computeHsQualityScore({ recognition: undefined });
    expect(withNull).toEqual(withUndefined);
    expect(withNull.missingCritical).toContain('recognition');
  });

  it('awards the state-OR-city identity point for either field alone', () => {
    const stateOnly = computeHsQualityScore({ state: 'CA' });
    const cityOnly = computeHsQualityScore({ city: 'LA' });
    const both = computeHsQualityScore({ state: 'CA', city: 'LA' });
    expect(stateOnly.score).toBe(5);
    expect(cityOnly.score).toBe(5);
    // Both present still only awards the single 5-pt bucket (not 10).
    expect(both.score).toBe(5);
  });

  it('awards the avgSat-OR-avgIb supplementary point for either test field', () => {
    const satOnly = computeHsQualityScore({ avgSatScore: 1400 });
    const ibOnly = computeHsQualityScore({ avgIbScore: 38 });
    const both = computeHsQualityScore({ avgSatScore: 1400, avgIbScore: 38 });
    expect(satOnly.score).toBe(4);
    expect(ibOnly.score).toBe(4);
    // Both present still only the single 4-pt bucket.
    expect(both.score).toBe(4);
  });

  it('omits a field from missingCritical exactly when that dimension is present', () => {
    const result = computeHsQualityScore({
      recognition: 70,
      placementRecord: 80,
    });
    expect(result.missingCritical).toEqual(['academicRigor', 'studentQuality', 'resources']);
  });
});
