import { describe, expect, it } from 'vitest';

import {
  ENGLISH_PROFICIENCY_THRESHOLDS,
  getBestEnglishProficiency,
  isEnglishProficiencyTest,
  normalizeEnglishScore,
} from './english-proficiency';

describe('normalizeEnglishScore', () => {
  it('normalizes by the per-test max (TOEFL/120, IELTS/9, DUOLINGO/160)', () => {
    // Reference values derived from MAX_SCORES.
    expect(normalizeEnglishScore('TOEFL', 120)).toBe(1);
    expect(normalizeEnglishScore('TOEFL', 60)).toBeCloseTo(0.5, 10);
    expect(normalizeEnglishScore('IELTS', 9)).toBe(1);
    expect(normalizeEnglishScore('IELTS', 7.875)).toBeCloseTo(0.875, 10);
    expect(normalizeEnglishScore('DUOLINGO', 160)).toBe(1);
    expect(normalizeEnglishScore('DUOLINGO', 140)).toBeCloseTo(0.875, 10);
  });

  it('returns 0 for an unrecognized test type', () => {
    expect(normalizeEnglishScore('SAT', 1500)).toBe(0);
    expect(normalizeEnglishScore('', 100)).toBe(0);
  });

  it('returns 0 for a zero raw score on a recognized test', () => {
    expect(normalizeEnglishScore('TOEFL', 0)).toBe(0);
  });

  it('is monotonic increasing in the raw score for a fixed test', () => {
    expect(normalizeEnglishScore('TOEFL', 90)).toBeLessThan(normalizeEnglishScore('TOEFL', 110));
  });

  it('does NOT clamp — scores above max normalize above 1', () => {
    // No bounds enforcement in the implementation; this documents real behavior.
    expect(normalizeEnglishScore('IELTS', 18)).toBe(2);
    expect(normalizeEnglishScore('TOEFL', 240)).toBe(2);
  });

  it('does NOT clamp negatives — a negative raw score normalizes below 0', () => {
    expect(normalizeEnglishScore('TOEFL', -120)).toBe(-1);
  });
});

describe('isEnglishProficiencyTest', () => {
  it('recognizes exactly TOEFL, IELTS, and DUOLINGO', () => {
    expect(isEnglishProficiencyTest('TOEFL')).toBe(true);
    expect(isEnglishProficiencyTest('IELTS')).toBe(true);
    expect(isEnglishProficiencyTest('DUOLINGO')).toBe(true);
  });

  it('rejects non-English tests and is case-sensitive', () => {
    expect(isEnglishProficiencyTest('SAT')).toBe(false);
    expect(isEnglishProficiencyTest('ACT')).toBe(false);
    expect(isEnglishProficiencyTest('toefl')).toBe(false); // case-sensitive membership
    expect(isEnglishProficiencyTest('')).toBe(false);
  });
});

describe('getBestEnglishProficiency', () => {
  it('returns undefined when there are no scores at all', () => {
    expect(getBestEnglishProficiency([])).toBeUndefined();
  });

  it('returns undefined when no English proficiency test is present', () => {
    expect(
      getBestEnglishProficiency([
        { type: 'SAT', score: 1500 },
        { type: 'ACT', score: 36 },
      ])
    ).toBeUndefined();
  });

  it('returns the only English test when there is just one, with its normalized value', () => {
    const best = getBestEnglishProficiency([{ type: 'TOEFL', score: 105 }]);
    expect(best).toEqual({ score: 105, type: 'TOEFL', normalized: 0.875 });
  });

  it('ignores non-English tests when selecting the best', () => {
    const best = getBestEnglishProficiency([
      { type: 'SAT', score: 1600 },
      { type: 'IELTS', score: 7 },
    ]);
    expect(best).toBeDefined();
    expect(best?.type).toBe('IELTS');
    expect(best?.score).toBe(7);
    expect(best?.normalized).toBeCloseTo(7 / 9, 10);
  });

  it('picks the highest normalized score across different test types', () => {
    // IELTS 8 -> 0.8889, TOEFL 100 -> 0.8333, DUOLINGO 130 -> 0.8125.
    const best = getBestEnglishProficiency([
      { type: 'TOEFL', score: 100 },
      { type: 'IELTS', score: 8 },
      { type: 'DUOLINGO', score: 130 },
    ]);
    expect(best?.type).toBe('IELTS');
    expect(best?.score).toBe(8);
    expect(best?.normalized).toBeCloseTo(8 / 9, 10);
  });

  it('compares on the normalized scale, not the raw score (smaller raw number can win)', () => {
    // DUOLINGO 160 -> 1.0 should beat TOEFL 110 -> 0.9167 despite the larger raw number.
    const best = getBestEnglishProficiency([
      { type: 'TOEFL', score: 110 },
      { type: 'DUOLINGO', score: 160 },
    ]);
    expect(best?.type).toBe('DUOLINGO');
    expect(best?.normalized).toBe(1);
  });

  it('keeps the first-seen test on a normalized tie (strict > comparison)', () => {
    // Both normalize to 0.875; first one (TOEFL) should win since the loop uses `norm > best`.
    const best = getBestEnglishProficiency([
      { type: 'TOEFL', score: 105 },
      { type: 'IELTS', score: 7.875 },
    ]);
    expect(best?.type).toBe('TOEFL');
    expect(best?.score).toBe(105);
  });
});

describe('ENGLISH_PROFICIENCY_THRESHOLDS', () => {
  it('exposes the documented neutral/penalty boundaries on the 0-1 scale', () => {
    expect(ENGLISH_PROFICIENCY_THRESHOLDS.baseline).toBe(0.875);
    expect(ENGLISH_PROFICIENCY_THRESHOLDS.hardPenalty).toBe(0.75);
    expect(ENGLISH_PROFICIENCY_THRESHOLDS.maxBonus).toBe(10);
    expect(ENGLISH_PROFICIENCY_THRESHOLDS.hardPenaltyValue).toBe(-8);
  });

  it('baseline > hardPenalty so the bonus/penalty bands are ordered correctly', () => {
    expect(ENGLISH_PROFICIENCY_THRESHOLDS.baseline).toBeGreaterThan(
      ENGLISH_PROFICIENCY_THRESHOLDS.hardPenalty
    );
  });

  it('baseline threshold matches the documented per-test reference scores', () => {
    // Doc: baseline 0.875 == TOEFL 105 == IELTS 7.875 == Duolingo 140.
    expect(normalizeEnglishScore('TOEFL', 105)).toBeCloseTo(
      ENGLISH_PROFICIENCY_THRESHOLDS.baseline,
      10
    );
    expect(normalizeEnglishScore('IELTS', 7.875)).toBeCloseTo(
      ENGLISH_PROFICIENCY_THRESHOLDS.baseline,
      10
    );
    expect(normalizeEnglishScore('DUOLINGO', 140)).toBeCloseTo(
      ENGLISH_PROFICIENCY_THRESHOLDS.baseline,
      10
    );
  });

  it('hardPenalty threshold matches the documented per-test reference scores', () => {
    // Doc: hardPenalty 0.75 == TOEFL 90 == IELTS 6.75 == Duolingo 120.
    expect(normalizeEnglishScore('TOEFL', 90)).toBeCloseTo(
      ENGLISH_PROFICIENCY_THRESHOLDS.hardPenalty,
      10
    );
    expect(normalizeEnglishScore('IELTS', 6.75)).toBeCloseTo(
      ENGLISH_PROFICIENCY_THRESHOLDS.hardPenalty,
      10
    );
    expect(normalizeEnglishScore('DUOLINGO', 120)).toBeCloseTo(
      ENGLISH_PROFICIENCY_THRESHOLDS.hardPenalty,
      10
    );
  });
});
