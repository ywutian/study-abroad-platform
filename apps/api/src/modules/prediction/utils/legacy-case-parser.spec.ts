import {
  parseGpaRange,
  parseTestScoreRange,
  toTestScoreEntry,
} from './legacy-case-parser';

describe('parseGpaRange', () => {
  it('range on 4.0 scale → midpoint + scale 4.0', () => {
    expect(parseGpaRange('3.7-3.9')).toEqual({
      gpa: 3.8,
      scale: 4.0,
      confidence: 'range-midpoint',
    });
  });

  it('range with spaces is tolerated', () => {
    expect(parseGpaRange(' 3.7 - 3.9 ')).toEqual({
      gpa: 3.8,
      scale: 4.0,
      confidence: 'range-midpoint',
    });
  });

  it('range with "to" separator', () => {
    expect(parseGpaRange('3.7 to 3.9')).toEqual({
      gpa: 3.8,
      scale: 4.0,
      confidence: 'range-midpoint',
    });
  });

  it('range with en-dash', () => {
    expect(parseGpaRange('3.7–3.9')).toEqual({
      gpa: 3.8,
      scale: 4.0,
      confidence: 'range-midpoint',
    });
  });

  it('bare single value → exact', () => {
    expect(parseGpaRange('3.8')).toEqual({
      gpa: 3.8,
      scale: 4.0,
      confidence: 'exact',
    });
  });

  it('"3.9+" → lower-bound-only', () => {
    expect(parseGpaRange('3.9+')).toEqual({
      gpa: 3.9,
      scale: 4.0,
      confidence: 'lower-bound-only',
    });
  });

  it('100-point scale detected from magnitude', () => {
    expect(parseGpaRange('90-95')).toEqual({
      gpa: 92.5,
      scale: 100,
      confidence: 'range-midpoint',
    });
  });

  it('weighted 5.0 scale detected', () => {
    expect(parseGpaRange('4.5')).toEqual({
      gpa: 4.5,
      scale: 5.0,
      confidence: 'exact',
    });
  });

  it('explicit "value / scale" annotation', () => {
    expect(parseGpaRange('3.7 / 4.0')).toEqual({
      gpa: 3.7,
      scale: 4.0,
      confidence: 'exact',
    });
  });

  it('100-point with explicit scale annotation', () => {
    expect(parseGpaRange('92 / 100')).toEqual({
      gpa: 92,
      scale: 100,
      confidence: 'exact',
    });
  });

  it('gibberish → null (refuse to invent data)', () => {
    expect(parseGpaRange('strong')).toBeNull();
    expect(parseGpaRange('N/A')).toBeNull();
    expect(parseGpaRange('high')).toBeNull();
  });

  it('empty / null / whitespace → null', () => {
    expect(parseGpaRange(null)).toBeNull();
    expect(parseGpaRange(undefined)).toBeNull();
    expect(parseGpaRange('')).toBeNull();
    expect(parseGpaRange('   ')).toBeNull();
  });

  it('out-of-range value rejected (5.1 is not valid on any scale below 100)', () => {
    expect(parseGpaRange('5.1')).toBeNull();
  });

  it('malformed range (high < low) → null', () => {
    expect(parseGpaRange('3.9-3.7')).toBeNull();
  });

  it('57 is in the gap between 4.0-scale max and 100-scale min → null', () => {
    // Critical: don't silently assign scale=4 to "57" or scale=100 to "5.5".
    // The 5-60 dead zone rejects ambiguous values.
    expect(parseGpaRange('57')).toBeNull();
  });
});

describe('parseTestScoreRange', () => {
  describe('SAT', () => {
    it('range → integer midpoint', () => {
      expect(parseTestScoreRange('1500-1550', 'SAT')).toEqual({
        type: 'SAT',
        score: 1525,
        confidence: 'range-midpoint',
      });
    });

    it('odd range rounds: 1500-1549 → 1525 (Math.round on 1524.5)', () => {
      // Math.round uses banker's rounding in some runtimes; this asserts
      // what V8 actually does so the behavior is pinned.
      const r = parseTestScoreRange('1500-1549', 'SAT');
      expect(r?.score).toBe(1525);
    });

    it('"1550+" → lower-bound-only', () => {
      expect(parseTestScoreRange('1550+', 'SAT')).toEqual({
        type: 'SAT',
        score: 1550,
        confidence: 'lower-bound-only',
      });
    });

    it('bare "1500" → exact', () => {
      expect(parseTestScoreRange('1500', 'SAT')).toEqual({
        type: 'SAT',
        score: 1500,
        confidence: 'exact',
      });
    });

    it('out-of-range (1700) → null', () => {
      expect(parseTestScoreRange('1700', 'SAT')).toBeNull();
    });

    it('below minimum (200) → null', () => {
      expect(parseTestScoreRange('200', 'SAT')).toBeNull();
    });
  });

  describe('ACT', () => {
    it('range → integer midpoint', () => {
      expect(parseTestScoreRange('32-34', 'ACT')).toEqual({
        type: 'ACT',
        score: 33,
        confidence: 'range-midpoint',
      });
    });

    it('max 36', () => {
      expect(parseTestScoreRange('36', 'ACT')).toEqual({
        type: 'ACT',
        score: 36,
        confidence: 'exact',
      });
    });

    it('37 → null', () => {
      expect(parseTestScoreRange('37', 'ACT')).toBeNull();
    });
  });

  describe('TOEFL', () => {
    it('range → integer midpoint', () => {
      expect(parseTestScoreRange('100-110', 'TOEFL')).toEqual({
        type: 'TOEFL',
        score: 105,
        confidence: 'range-midpoint',
      });
    });

    it('121 → null (above TOEFL max)', () => {
      expect(parseTestScoreRange('121', 'TOEFL')).toBeNull();
    });
  });

  describe('IELTS', () => {
    it('half-step rounding: 7.3 → 7.5', () => {
      expect(parseTestScoreRange('7.3', 'IELTS')?.score).toBe(7.5);
    });

    it('half-step rounding: 7.1 → 7', () => {
      expect(parseTestScoreRange('7.1', 'IELTS')?.score).toBe(7);
    });

    it('6.5-7.0 → 6.5 (midpoint 6.75 rounds down to nearest 0.5)', () => {
      expect(parseTestScoreRange('6.5-7.0', 'IELTS')?.score).toBe(7);
    });
  });

  it('gibberish → null across all types', () => {
    expect(parseTestScoreRange('high', 'SAT')).toBeNull();
    expect(parseTestScoreRange('good', 'ACT')).toBeNull();
  });

  it('null / empty → null', () => {
    expect(parseTestScoreRange(null, 'SAT')).toBeNull();
    expect(parseTestScoreRange('', 'SAT')).toBeNull();
  });
});

describe('toTestScoreEntry', () => {
  it('wraps parsed score with source tag', () => {
    expect(
      toTestScoreEntry({
        type: 'SAT',
        score: 1525,
        confidence: 'range-midpoint',
      }),
    ).toEqual({
      type: 'SAT',
      score: 1525,
      confidence: 'range-midpoint',
      source: 'legacy_range_parse',
    });
  });
});
