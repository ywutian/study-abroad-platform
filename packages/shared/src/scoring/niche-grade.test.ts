import { describe, expect, it } from 'vitest';

import {
  NICHE_GRADES,
  NICHE_GRADE_QUERY_VALUES,
  decodeNicheGradeParam,
  encodeNicheGradeParam,
  isNicheGradeAtLeast,
  isValidNicheGrade,
  nicheGradeToScore,
} from './niche-grade';

describe('nicheGradeToScore', () => {
  it('maps known reference grades to their documented [0,1] scores', () => {
    expect(nicheGradeToScore('A+')).toBe(1.0);
    expect(nicheGradeToScore('A')).toBe(0.93);
    expect(nicheGradeToScore('B-')).toBe(0.67);
    expect(nicheGradeToScore('C')).toBe(0.53);
    expect(nicheGradeToScore('F')).toBe(0.13);
  });

  it('returns null for missing / falsy input (no-data signal, distinct from low score)', () => {
    expect(nicheGradeToScore(null)).toBeNull();
    expect(nicheGradeToScore(undefined)).toBeNull();
    expect(nicheGradeToScore('')).toBeNull();
  });

  it('returns null for an unrecognized grade', () => {
    expect(nicheGradeToScore('?')).toBeNull();
    expect(nicheGradeToScore('E')).toBeNull(); // E is not a Niche grade
    expect(nicheGradeToScore('Z')).toBeNull();
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(nicheGradeToScore('  a+  ')).toBe(1.0);
    expect(nicheGradeToScore('b-')).toBe(0.67);
  });

  it('is monotonic non-increasing across NICHE_GRADES (best -> worst)', () => {
    const scores = NICHE_GRADES.map((g) => nicheGradeToScore(g));
    for (const s of scores) {
      expect(s).not.toBeNull();
    }
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeLessThan(scores[i - 1]!);
    }
  });

  it('keeps every grade score within [0, 1]', () => {
    for (const g of NICHE_GRADES) {
      const s = nicheGradeToScore(g)!;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('isValidNicheGrade', () => {
  it('accepts every canonical grade (case/whitespace insensitive)', () => {
    for (const g of NICHE_GRADES) {
      expect(isValidNicheGrade(g)).toBe(true);
    }
    expect(isValidNicheGrade(' a+ ')).toBe(true);
    expect(isValidNicheGrade('b')).toBe(true);
  });

  it('rejects non-strings and unrecognized strings', () => {
    expect(isValidNicheGrade(null)).toBe(false);
    expect(isValidNicheGrade(undefined)).toBe(false);
    expect(isValidNicheGrade(1.0)).toBe(false);
    expect(isValidNicheGrade({})).toBe(false);
    expect(isValidNicheGrade('E')).toBe(false);
    expect(isValidNicheGrade('')).toBe(false);
  });

  it('does not false-positive on Object.prototype keys', () => {
    expect(isValidNicheGrade('toString')).toBe(false);
    expect(isValidNicheGrade('constructor')).toBe(false);
  });

  it('agrees with nicheGradeToScore on validity for sampled inputs', () => {
    for (const sample of ['A+', 'B', 'F', 'E', '?', '']) {
      expect(isValidNicheGrade(sample)).toBe(nicheGradeToScore(sample) !== null);
    }
  });
});

describe('encodeNicheGradeParam / decodeNicheGradeParam', () => {
  it('encodes display grades to their underscore query values', () => {
    expect(encodeNicheGradeParam('A+')).toBe('A_PLUS');
    expect(encodeNicheGradeParam('B-')).toBe('B_MINUS');
    expect(encodeNicheGradeParam('A')).toBe('A');
    expect(encodeNicheGradeParam('F')).toBe('F');
  });

  it('round-trips encode -> decode back to the original grade for every grade', () => {
    for (const g of NICHE_GRADES) {
      expect(decodeNicheGradeParam(encodeNicheGradeParam(g))).toBe(g);
    }
  });

  it('decode normalizes case and whitespace', () => {
    expect(decodeNicheGradeParam(' a_plus ')).toBe('A+');
    expect(decodeNicheGradeParam('b_minus')).toBe('B-');
  });

  it('decode returns null for missing or unrecognized query values', () => {
    expect(decodeNicheGradeParam(null)).toBeNull();
    expect(decodeNicheGradeParam(undefined)).toBeNull();
    expect(decodeNicheGradeParam('')).toBeNull();
    expect(decodeNicheGradeParam('A+')).toBeNull(); // display form is NOT a query value
    expect(decodeNicheGradeParam('NOT_A_GRADE')).toBeNull();
  });

  it('query value list aligns positionally with the grade list', () => {
    expect(NICHE_GRADE_QUERY_VALUES.length).toBe(NICHE_GRADES.length);
    NICHE_GRADES.forEach((g, i) => {
      expect(encodeNicheGradeParam(g)).toBe(NICHE_GRADE_QUERY_VALUES[i]);
    });
  });
});

describe('isNicheGradeAtLeast', () => {
  it('is true when grade meets or exceeds the minimum', () => {
    expect(isNicheGradeAtLeast('A', 'B')).toBe(true);
    expect(isNicheGradeAtLeast('B', 'B')).toBe(true); // equal passes (>=)
    expect(isNicheGradeAtLeast('A+', 'F')).toBe(true);
  });

  it('is false when grade is below the minimum', () => {
    expect(isNicheGradeAtLeast('C', 'B')).toBe(false);
    expect(isNicheGradeAtLeast('B-', 'B')).toBe(false);
  });

  it('is false when either grade is missing or invalid (cannot compare no-data)', () => {
    expect(isNicheGradeAtLeast(null, 'B')).toBe(false);
    expect(isNicheGradeAtLeast('A', null)).toBe(false);
    expect(isNicheGradeAtLeast('?', 'B')).toBe(false);
    expect(isNicheGradeAtLeast('A', '?')).toBe(false);
    expect(isNicheGradeAtLeast(undefined, undefined)).toBe(false);
  });

  it('honors case/whitespace normalization through to the comparison', () => {
    expect(isNicheGradeAtLeast(' a ', ' b ')).toBe(true);
  });
});
