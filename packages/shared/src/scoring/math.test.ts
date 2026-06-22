import { describe, expect, it } from 'vitest';

import {
  calculatePercentile,
  empiricalPercentile,
  normalCDF,
  normalizeBySystem,
  normalizeGpa,
  parseRange,
} from './math';

describe('normalCDF', () => {
  it('is 0.5 at the mean', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 5);
  });

  it('is symmetric about 0', () => {
    expect(normalCDF(-1) + normalCDF(1)).toBeCloseTo(1, 4);
  });

  it('is monotonic increasing and bounded in [0,1]', () => {
    expect(normalCDF(-2)).toBeLessThan(normalCDF(0));
    expect(normalCDF(0)).toBeLessThan(normalCDF(2));
    expect(normalCDF(-10)).toBeGreaterThanOrEqual(0);
    expect(normalCDF(10)).toBeLessThanOrEqual(1);
  });

  it('matches the 1-sigma reference value (~0.8413)', () => {
    expect(normalCDF(1)).toBeCloseTo(0.8413, 3);
  });
});

describe('calculatePercentile', () => {
  // Returns a 0..1 fraction via a normal model (sigma from the IQR), NOT a 0..100 percentile.
  it('returns ~0.5 at the midpoint of p25..p75', () => {
    expect(calculatePercentile(1400, 1300, 1500)).toBeCloseTo(0.5, 5);
  });

  it('falls back to 0.5 for a degenerate range (p75 <= p25)', () => {
    expect(calculatePercentile(1400, 1500, 1500)).toBe(0.5);
  });

  it('is monotonic in the score and bounded in [0,1]', () => {
    expect(calculatePercentile(1300, 1300, 1500)).toBeLessThan(
      calculatePercentile(1500, 1300, 1500)
    );
    expect(calculatePercentile(800, 1300, 1500)).toBeGreaterThanOrEqual(0);
    expect(calculatePercentile(1600, 1300, 1500)).toBeLessThanOrEqual(1);
  });
});

describe('empiricalPercentile', () => {
  const sorted = [10, 20, 30, 40, 50];

  it('returns the index fraction (0..1) for an interior value', () => {
    expect(empiricalPercentile(30, sorted)).toBeCloseTo(0.4, 5);
  });

  it('clamps to 0 / 1 at or beyond the extremes', () => {
    expect(empiricalPercentile(5, sorted)).toBe(0);
    expect(empiricalPercentile(50, sorted)).toBe(1);
  });

  it('returns 0.5 for an empty distribution', () => {
    expect(empiricalPercentile(42, [])).toBe(0.5);
  });

  it('ranks a larger value higher than a smaller one', () => {
    expect(empiricalPercentile(45, sorted)).toBeGreaterThan(empiricalPercentile(15, sorted));
  });
});

describe('parseRange', () => {
  it('returns the midpoint of a hyphenated range (with or without spaces)', () => {
    expect(parseRange('1300-1500')).toBe(1400);
    expect(parseRange('1300 - 1500')).toBe(1400);
    expect(parseRange('3.5-4.0')).toBeCloseTo(3.75, 5);
  });

  it('returns null for a single number or unparseable input', () => {
    expect(parseRange('1500')).toBeNull();
    expect(parseRange('not-a-range')).toBeNull();
  });
});

describe('normalizeBySystem', () => {
  it('passes 4.0-unweighted through unchanged', () => {
    expect(normalizeBySystem(3.8, 'SCALE_4_UW')).toBeCloseTo(3.8, 5);
  });

  it('rescales weighted/5-scales to /4 and clamps at 4', () => {
    expect(normalizeBySystem(5.0, 'SCALE_4_W')).toBe(4); // min((5/5)*4, 4)
    expect(normalizeBySystem(4.0, 'SCALE_5')).toBeCloseTo(3.2, 5);
  });

  it('maps PCT_100 piecewise (95+ -> 4.0)', () => {
    expect(normalizeBySystem(95, 'PCT_100')).toBe(4.0);
    expect(normalizeBySystem(90, 'PCT_100')).toBeCloseTo(3.7, 5);
    expect(normalizeBySystem(60, 'PCT_100')).toBe(2.0);
  });

  it('maps IB_45 piecewise (42+ -> 4.0)', () => {
    expect(normalizeBySystem(45, 'IB_45')).toBe(4.0);
    expect(normalizeBySystem(24, 'IB_45')).toBeCloseTo(2.5, 5);
  });

  it('interpolates A_LEVEL endpoints and midpoints', () => {
    expect(normalizeBySystem(6, 'A_LEVEL')).toBe(4.0);
    expect(normalizeBySystem(1, 'A_LEVEL')).toBeCloseTo(1.3, 5);
    expect(normalizeBySystem(3.5, 'A_LEVEL')).toBeCloseTo(3.0, 5); // between [3,2.7] and [4,3.3]
  });

  it('clamps every result into [0,4] and passes unknown systems through', () => {
    expect(normalizeBySystem(10, 'SCALE_4_UW')).toBe(4);
    expect(normalizeBySystem(-1, 'SCALE_4_UW')).toBe(0);
    expect(normalizeBySystem(3.5, 'MYSTERY_SYSTEM')).toBeCloseTo(3.5, 5);
  });
});

describe('normalizeGpa', () => {
  it('delegates to normalizeBySystem when a gpaSystem is given', () => {
    expect(normalizeGpa(90, 4, 'PCT_100')).toBeCloseTo(3.7, 5);
  });

  it('rescales by numeric scale when no system is given', () => {
    expect(normalizeGpa(3.8, 4)).toBeCloseTo(3.8, 5);
    expect(normalizeGpa(5, 5)).toBeCloseTo(4, 5);
    expect(normalizeGpa(100, 100)).toBeCloseTo(4, 5);
    expect(normalizeGpa(3.0, 7)).toBeCloseTo(3.0, 5); // unknown scale -> passthrough
  });

  it('is monotonic in the raw GPA on a fixed scale', () => {
    expect(normalizeGpa(3.0, 4)).toBeLessThan(normalizeGpa(3.9, 4));
  });
});
