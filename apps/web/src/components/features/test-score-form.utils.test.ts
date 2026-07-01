import { describe, expect, it } from 'vitest';

import { buildTestScorePayload } from './test-score-form.utils';

describe('buildTestScorePayload', () => {
  it('AP: score is the number of exams, not a single grade (2.5)', () => {
    const r = buildTestScorePayload('AP', {}, [
      { subject: 'Calculus BC', score: '5' },
      { subject: 'Chemistry', score: '5' },
      { subject: 'Physics C', score: '4' },
    ]);
    expect(r.score).toBe(3);
    expect(r.subScores).toEqual({ 'Calculus BC': 5, Chemistry: 5, 'Physics C': 4 });
  });

  it('IB: score is the diploma total, keyed by level (2.5)', () => {
    const r = buildTestScorePayload('IB', {}, [
      { subject: 'Math AA', score: '7', level: 'HL' },
      { subject: 'Physics', score: '6', level: 'HL' },
      { subject: 'English A', score: '5', level: 'SL' },
    ]);
    expect(r.score).toBe(18);
    expect(r.subScores).toEqual({ 'Math AA (HL)': 7, 'Physics (HL)': 6, 'English A (SL)': 5 });
  });

  it('TOEFL: preserves half-point scores (2026 scale) — NOT truncated (2.2)', () => {
    const r = buildTestScorePayload(
      'TOEFL',
      { score: '5.5', toeflReading: '6', toeflListening: '5.5' },
      []
    );
    expect(r.score).toBe(5.5); // parseInt would have made this 5
    expect(r.subScores).toEqual({ reading: 6, listening: 5.5 });
  });

  it('IELTS: preserves x.5 bands (2.2 bonus fix)', () => {
    expect(buildTestScorePayload('IELTS', { score: '7.5' }, []).score).toBe(7.5);
  });

  it('ACT: stores the four subscores (2.3)', () => {
    const r = buildTestScorePayload(
      'ACT',
      {
        score: '34',
        actEnglish: '35',
        actMath: '33',
        actReading: '34',
        actScience: '34',
      },
      []
    );
    expect(r.score).toBe(34);
    expect(r.subScores).toEqual({ english: 35, math: 33, reading: 34, science: 34 });
  });

  it('single-score type with no subscores omits subScores', () => {
    expect(buildTestScorePayload('SAT', { score: '1500' }, []).subScores).toBeUndefined();
  });
});
