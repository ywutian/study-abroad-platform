import { describe, expect, it } from 'vitest';

import {
  ENGLISH_PROFICIENCY_THRESHOLDS,
  getBestEnglishProficiency,
  isEnglishProficiencyTest,
  normalizeEnglishScore,
  toLegacyToeflEquivalent,
} from './english-proficiency';

describe('TOEFL 1-6 scale (ETS, effective 2026-01-21)', () => {
  // The regression that mattered: a post-2026-01 score of 5.5 used to be read
  // as 5.5/120 = 0.046 and drew the hard penalty. 5.5 is C1.
  it('reads a score at or below 6 as the new scale, not a legacy total', () => {
    expect(normalizeEnglishScore('TOEFL', 5.5)).toBeGreaterThan(
      ENGLISH_PROFICIENCY_THRESHOLDS.baseline
    );
    expect(toLegacyToeflEquivalent('TOEFL', 5.5)).toBe(110);
    expect(toLegacyToeflEquivalent('TOEFL', 6)).toBe(117);
    expect(toLegacyToeflEquivalent('TOEFL', 4.5)).toBe(90);
  });

  it('passes a legacy total straight through', () => {
    expect(toLegacyToeflEquivalent('TOEFL', 105)).toBe(105);
    expect(normalizeEnglishScore('TOEFL', 105)).toBeCloseTo(0.875, 10);
  });

  it('clamps a legacy total to the top of its scale', () => {
    expect(toLegacyToeflEquivalent('TOEFL', 240)).toBe(120);
    expect(normalizeEnglishScore('TOEFL', 240)).toBe(1);
  });

  it('a top new-scale score beats a mid legacy score', () => {
    expect(normalizeEnglishScore('TOEFL', 6)).toBeGreaterThan(normalizeEnglishScore('TOEFL', 100));
  });

  // The documented ceiling of magnitude sniffing: the mapping is intentionally
  // discontinuous at 6, because 6 and 7 are readings on different scales
  // (C2 vs a legacy total of 7). Pinned so nobody "fixes" it into a smooth
  // curve, which would silently reintroduce the original bug.
  it('is deliberately discontinuous across the 6/7 boundary', () => {
    expect(toLegacyToeflEquivalent('TOEFL', 6)).toBe(117);
    expect(toLegacyToeflEquivalent('TOEFL', 7)).toBe(7);
    expect(normalizeEnglishScore('TOEFL', 7)).toBeLessThan(normalizeEnglishScore('TOEFL', 6));
  });
});

describe('cross-test comparability', () => {
  // The whole point: these three are the SAME proficiency per the published
  // concordances, so they must score the same. Under the old score/max they
  // did not.
  it('puts TOEFL 105, IELTS 7.5 and DET 137 at the same normalized value', () => {
    const toefl = normalizeEnglishScore('TOEFL', 105);
    const ielts = normalizeEnglishScore('IELTS', 7.5);
    const det = normalizeEnglishScore('DUOLINGO', 137);

    expect(ielts).toBeCloseTo(toefl, 10);
    expect(det).toBeCloseTo(toefl, 10);
    expect(toefl).toBeCloseTo(ENGLISH_PROFICIENCY_THRESHOLDS.baseline, 10);
  });

  it('no longer demands IELTS 7.875 to reach baseline', () => {
    // Old behaviour: 7.875/9 == 0.875 exactly. ETS/IELTS concordance puts
    // TOEFL 105 at IELTS 7.5, so 7.875 must now clear the bar with room.
    expect(normalizeEnglishScore('IELTS', 7.875)).toBeGreaterThan(
      ENGLISH_PROFICIENCY_THRESHOLDS.baseline
    );
  });

  it('keeps IELTS 6.5 below the hard-penalty line and 7.0 above it', () => {
    const { hardPenalty } = ENGLISH_PROFICIENCY_THRESHOLDS;
    expect(normalizeEnglishScore('IELTS', 6.5)).toBeLessThan(hardPenalty);
    expect(normalizeEnglishScore('IELTS', 7.0)).toBeGreaterThan(hardPenalty);
  });
});

describe('normalizeEnglishScore', () => {
  it('returns 0 for an unrecognized test type', () => {
    expect(normalizeEnglishScore('SAT', 1500)).toBe(0);
    expect(normalizeEnglishScore('', 100)).toBe(0);
  });

  it('returns 0 for a non-finite score', () => {
    expect(normalizeEnglishScore('TOEFL', Number.NaN)).toBe(0);
    expect(normalizeEnglishScore('IELTS', Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('is monotonic non-decreasing within each scale', () => {
    // TOEFL is split deliberately: 1-6 and 0-120 are different scales, so
    // monotonicity only holds within one. See the boundary test below.
    const cases: Array<[string, number[]]> = [
      ['TOEFL', [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]],
      ['TOEFL', [7, 20, 40, 70, 90, 105, 120]],
      ['IELTS', [4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10]],
      ['DUOLINGO', [10, 60, 90, 105, 120, 137, 145, 160, 200]],
    ];

    for (const [type, scores] of cases) {
      for (let i = 1; i < scores.length; i++) {
        const prev = normalizeEnglishScore(type, scores[i - 1]);
        const curr = normalizeEnglishScore(type, scores[i]);
        expect({ type, score: scores[i], monotonic: curr >= prev }).toEqual({
          type,
          score: scores[i],
          monotonic: true,
        });
      }
    }
  });

  it('clamps out-of-domain scores instead of extrapolating past the scale', () => {
    // The old implementation happily returned 2 for IELTS 18 and -1 for
    // TOEFL -120.
    expect(normalizeEnglishScore('IELTS', 18)).toBeLessThanOrEqual(1);
    expect(normalizeEnglishScore('DUOLINGO', 500)).toBeLessThanOrEqual(1);
    expect(normalizeEnglishScore('TOEFL', -120)).toBeGreaterThanOrEqual(0);
    expect(normalizeEnglishScore('IELTS', -5)).toBeGreaterThanOrEqual(0);
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
    expect(isEnglishProficiencyTest('toefl')).toBe(false);
    expect(isEnglishProficiencyTest('')).toBe(false);
  });
});

describe('getBestEnglishProficiency', () => {
  it('returns undefined when no English proficiency test is present', () => {
    expect(getBestEnglishProficiency([])).toBeUndefined();
    expect(
      getBestEnglishProficiency([
        { type: 'SAT', score: 1500 },
        { type: 'ACT', score: 36 },
      ])
    ).toBeUndefined();
  });

  it('returns the only English test with its normalized value', () => {
    expect(getBestEnglishProficiency([{ type: 'TOEFL', score: 105 }])).toEqual({
      score: 105,
      type: 'TOEFL',
      normalized: 0.875,
    });
  });

  it('ignores non-English tests when selecting the best', () => {
    const best = getBestEnglishProficiency([
      { type: 'SAT', score: 1600 },
      { type: 'IELTS', score: 7 },
    ]);
    expect(best?.type).toBe('IELTS');
    expect(best?.score).toBe(7);
  });

  it('compares on the concordance scale, not the raw number', () => {
    // DET 160 (~IELTS 9) must beat TOEFL 100 despite both raw numbers being
    // on incomparable scales.
    const best = getBestEnglishProficiency([
      { type: 'TOEFL', score: 100 },
      { type: 'DUOLINGO', score: 160 },
    ]);
    expect(best?.type).toBe('DUOLINGO');
  });

  it('picks the genuinely strongest result across test types', () => {
    // IELTS 8 -> legacy 111; TOEFL 100 -> 100; DET 130 -> ~101.
    const best = getBestEnglishProficiency([
      { type: 'TOEFL', score: 100 },
      { type: 'IELTS', score: 8 },
      { type: 'DUOLINGO', score: 130 },
    ]);
    expect(best?.type).toBe('IELTS');
    expect(best?.score).toBe(8);
  });

  it('keeps the first-seen test on a normalized tie', () => {
    const best = getBestEnglishProficiency([
      { type: 'TOEFL', score: 105 },
      { type: 'IELTS', score: 7.5 },
    ]);
    expect(best?.type).toBe('TOEFL');
  });
});

describe('ENGLISH_PROFICIENCY_THRESHOLDS', () => {
  it('exposes the documented boundaries and orders them correctly', () => {
    const t = ENGLISH_PROFICIENCY_THRESHOLDS;
    expect(t).toEqual({
      baseline: 0.875,
      hardPenalty: 0.75,
      maxBonus: 10,
      hardPenaltyValue: -8,
    });
    expect(t.baseline).toBeGreaterThan(t.hardPenalty);
  });

  it('keeps the TOEFL anchors the thresholds were calibrated against', () => {
    expect(normalizeEnglishScore('TOEFL', 105)).toBeCloseTo(
      ENGLISH_PROFICIENCY_THRESHOLDS.baseline,
      10
    );
    expect(normalizeEnglishScore('TOEFL', 90)).toBeCloseTo(
      ENGLISH_PROFICIENCY_THRESHOLDS.hardPenalty,
      10
    );
  });
});
