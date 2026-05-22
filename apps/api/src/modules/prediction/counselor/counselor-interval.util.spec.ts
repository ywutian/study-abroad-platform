import {
  deriveCounselorConfidence,
  deriveCounselorInterval,
} from './counselor-interval.util';

describe('deriveCounselorConfidence', () => {
  it('Tier-1 anchor (CDS cell) with few missing fields → high', () => {
    expect(deriveCounselorConfidence(1, 0)).toBe('high');
    expect(deriveCounselorConfidence(1, 2)).toBe('high');
  });

  it('Tier-1 but many missing fields → medium (not high)', () => {
    expect(deriveCounselorConfidence(1, 3)).toBe('medium');
  });

  it('Tier-2 anchor (school-wide rate) → medium', () => {
    expect(deriveCounselorConfidence(2, 0)).toBe('medium');
    expect(deriveCounselorConfidence(2, 4)).toBe('medium');
  });

  it('Tier-3 or very sparse profile → low', () => {
    expect(deriveCounselorConfidence(3, 0)).toBe('low');
    expect(deriveCounselorConfidence(2, 5)).toBe('low');
  });
});

describe('deriveCounselorInterval', () => {
  it('is relative — NOT a flat ±5pp band', () => {
    // At a 4% reach school the flat band would be 0%–9%; the log-odds band
    // must stay strictly above 0 and be asymmetric.
    const { low, high } = deriveCounselorInterval(0.04, 'medium');
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(0.04);
    expect(high).toBeGreaterThan(0.04);
    // asymmetric: the gap up differs from the gap down
    expect(Math.abs(high - 0.04 - (0.04 - low))).toBeGreaterThan(0.001);
  });

  it('widens as confidence drops', () => {
    const width = (c: 'low' | 'medium' | 'high') => {
      const i = deriveCounselorInterval(0.3, c);
      return i.high - i.low;
    };
    expect(width('low')).toBeGreaterThan(width('medium'));
    expect(width('medium')).toBeGreaterThan(width('high'));
  });

  it('stays relative near the extremes — never a flat band', () => {
    // The width floor lives in log-odds space (minimum k), so even a
    // high-confidence band at p=0.95 stays asymmetric and relative rather
    // than collapsing to a flat ±pp.
    const { low, high } = deriveCounselorInterval(0.95, 'high');
    expect(low).toBeGreaterThan(0.9);
    expect(high).toBeLessThanOrEqual(0.98);
    expect(Math.abs(high - 0.95 - (0.95 - low))).toBeGreaterThan(0.001);
  });

  it('clamps to (0, 0.98]', () => {
    const { low, high } = deriveCounselorInterval(0.97, 'low');
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(0.98);
  });

  it('returns a zero interval for a non-positive or invalid probability', () => {
    expect(deriveCounselorInterval(0, 'medium')).toEqual({ low: 0, high: 0 });
    expect(deriveCounselorInterval(NaN, 'medium')).toEqual({ low: 0, high: 0 });
  });
});
