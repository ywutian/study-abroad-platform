import {
  evaluatePredictionEligibility,
  buildPredictionEligibilityMessage,
  hasGpaSignal,
} from './prediction-eligibility.util';

describe('evaluatePredictionEligibility', () => {
  const eligible = {
    hasGpa: true,
    hasBasicInfo: true,
    schoolListCount: 1,
  };

  it('allows a prediction when GPA + basic info + ≥1 school are present', () => {
    const result = evaluatePredictionEligibility(eligible);
    expect(result.canRunPrediction).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks MISSING_GPA when GPA is absent', () => {
    const result = evaluatePredictionEligibility({
      ...eligible,
      hasGpa: false,
    });
    expect(result.canRunPrediction).toBe(false);
    expect(result.blockers).toEqual(['MISSING_GPA']);
  });

  it('blocks MISSING_BASIC_INFO when neither major nor grade is set', () => {
    const result = evaluatePredictionEligibility({
      ...eligible,
      hasBasicInfo: false,
    });
    expect(result.canRunPrediction).toBe(false);
    expect(result.blockers).toEqual(['MISSING_BASIC_INFO']);
  });

  it('blocks NO_TARGET_SCHOOLS when the school list is empty', () => {
    const result = evaluatePredictionEligibility({
      ...eligible,
      schoolListCount: 0,
    });
    expect(result.canRunPrediction).toBe(false);
    expect(result.blockers).toEqual(['NO_TARGET_SCHOOLS']);
  });

  it('reports every blocker for a near-empty profile, in stable order', () => {
    const result = evaluatePredictionEligibility({
      hasGpa: false,
      hasBasicInfo: false,
      schoolListCount: 0,
    });
    expect(result.canRunPrediction).toBe(false);
    expect(result.blockers).toEqual([
      'MISSING_GPA',
      'MISSING_BASIC_INFO',
      'NO_TARGET_SCHOOLS',
    ]);
  });

  it('treats a negative school count as no schools', () => {
    const result = evaluatePredictionEligibility({
      ...eligible,
      schoolListCount: -1,
    });
    expect(result.blockers).toEqual(['NO_TARGET_SCHOOLS']);
  });
});

describe('buildPredictionEligibilityMessage', () => {
  it('builds a Chinese message for the zh locale', () => {
    const msg = buildPredictionEligibilityMessage(['MISSING_GPA'], 'zh');
    expect(msg).toContain('填写 GPA');
    expect(msg).toContain('运行录取预测前');
  });

  it('builds an English message for the en locale', () => {
    const msg = buildPredictionEligibilityMessage(
      ['MISSING_GPA', 'NO_TARGET_SCHOOLS'],
      'en',
    );
    expect(msg).toContain('add your GPA');
    expect(msg).toContain('add at least 1 target school');
  });

  it('falls back to English for unknown / missing locales', () => {
    expect(buildPredictionEligibilityMessage(['MISSING_GPA'], null)).toContain(
      'add your GPA',
    );
    expect(buildPredictionEligibilityMessage(['MISSING_GPA'], 'fr')).toContain(
      'add your GPA',
    );
  });

  it('returns an eligible message when there are no blockers', () => {
    expect(buildPredictionEligibilityMessage([], 'zh')).toContain('已满足');
    expect(buildPredictionEligibilityMessage([], 'en')).toContain('eligible');
  });
});

describe('hasGpaSignal', () => {
  it('is false for a null / undefined profile', () => {
    expect(hasGpaSignal(null)).toBe(false);
    expect(hasGpaSignal(undefined)).toBe(false);
  });

  it('is false when no GPA field is present', () => {
    expect(hasGpaSignal({ gpa: null, semesterGpas: [] })).toBe(false);
    expect(hasGpaSignal({})).toBe(false);
  });

  it('is true for a cumulative GPA', () => {
    expect(hasGpaSignal({ gpa: 3.8 })).toBe(true);
  });

  it('is true for a grade-level GPA only (no cumulative)', () => {
    expect(hasGpaSignal({ gpa: null, gpa11: 3.9 })).toBe(true);
    expect(hasGpaSignal({ gpa12: 3.7 })).toBe(true);
  });

  it('is true when per-semester GPAs exist', () => {
    expect(hasGpaSignal({ semesterGpas: [{ id: 's1' }] })).toBe(true);
  });
});
