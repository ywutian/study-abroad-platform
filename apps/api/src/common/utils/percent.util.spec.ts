import { normalizePercentRate, clampPercentRate } from './percent.util';

describe('normalizePercentRate', () => {
  it('should convert decimal 0-1 to percentage', () => {
    expect(normalizePercentRate(0.04)).toBe(4);
    expect(normalizePercentRate(0.247)).toBe(24.7);
    expect(normalizePercentRate(0.5)).toBe(50);
    expect(normalizePercentRate(0.95)).toBe(95);
    expect(normalizePercentRate(1)).toBe(100);
  });

  it('should pass through already-percentage values (1-100)', () => {
    expect(normalizePercentRate(4)).toBe(4);
    expect(normalizePercentRate(24.7)).toBe(24.7);
    expect(normalizePercentRate(50)).toBe(50);
    expect(normalizePercentRate(100)).toBe(100);
    expect(normalizePercentRate(5.8)).toBe(5.8);
  });

  it('should fix double-converted values (100-10000)', () => {
    expect(normalizePercentRate(2470)).toBe(24.7);
    expect(normalizePercentRate(400)).toBe(4);
    expect(normalizePercentRate(9500)).toBe(95);
    expect(normalizePercentRate(580)).toBe(5.8);
  });

  it('should return null for invalid inputs', () => {
    expect(normalizePercentRate(null)).toBeNull();
    expect(normalizePercentRate(undefined)).toBeNull();
    expect(normalizePercentRate(NaN)).toBeNull();
    expect(normalizePercentRate('abc')).toBeNull();
    expect(normalizePercentRate(0)).toBeNull();
    expect(normalizePercentRate(-5)).toBeNull();
    expect(normalizePercentRate(10001)).toBeNull();
    expect(normalizePercentRate(99999)).toBeNull();
  });

  it('should handle string inputs', () => {
    expect(normalizePercentRate('24.7')).toBe(24.7);
    expect(normalizePercentRate('0.04')).toBe(4);
    expect(normalizePercentRate('2470')).toBe(24.7);
  });

  it('should round to one decimal place', () => {
    expect(normalizePercentRate(24.75)).toBe(24.8);
    expect(normalizePercentRate(0.0467)).toBe(4.7);
  });
});

describe('clampPercentRate', () => {
  it('should return undefined instead of null for missing values', () => {
    expect(clampPercentRate(null)).toBeUndefined();
    expect(clampPercentRate(undefined)).toBeUndefined();
  });

  it('should delegate to normalizePercentRate for valid values', () => {
    expect(clampPercentRate(0.04)).toBe(4);
    expect(clampPercentRate(24.7)).toBe(24.7);
    expect(clampPercentRate(2470)).toBe(24.7);
  });
});
