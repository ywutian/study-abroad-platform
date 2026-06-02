import { normalizeUncertainty } from './profile-application-analysis-v2.service';

/**
 * Regression guard for the 2026-06 fix: the school-card `uncertainty` interval must
 * be GROUNDED in the prediction engine (the single probability authority), never in
 * LLM-authored numbers. The school-analyst prompt no longer emits probabilityLow/High;
 * this asserts that even a stale/rogue LLM payload carrying them is ignored, and the
 * interval is taken from the passed-in prediction. (Previously the LLM emitted its own
 * probabilities — a fabricated second interval that could contradict the prediction's,
 * violating "prediction is the only probability source".)
 */
describe('normalizeUncertainty — interval is prediction-grounded, not LLM-authored', () => {
  it('uses the prediction interval and IGNORES LLM-supplied probabilities', () => {
    const llmTryingToInject = {
      intervalLabel: 'wide',
      probabilityLow: 0.9, // LLM fabrication — must be ignored
      probabilityHigh: 0.95, // LLM fabrication — must be ignored
      reasons: ['holistic review adds variance'],
    };
    const prediction = { probabilityLow: 0.1, probabilityHigh: 0.2 };

    const result = normalizeUncertainty(llmTryingToInject, prediction);

    expect(result?.probabilityLow).toBe(0.1); // from prediction, not 0.9
    expect(result?.probabilityHigh).toBe(0.2); // from prediction, not 0.95
    expect(result?.intervalLabel).toBe('wide'); // qualitative label kept from LLM
    expect(result?.reasons).toEqual(['holistic review adds variance']);
  });

  it('leaves numbers undefined when the prediction has no interval', () => {
    const result = normalizeUncertainty(
      { intervalLabel: 'balanced', reasons: [] },
      {},
    );
    expect(result?.probabilityLow).toBeUndefined();
    expect(result?.probabilityHigh).toBeUndefined();
    expect(result?.intervalLabel).toBe('balanced');
  });

  it('returns undefined when the LLM omits intervalLabel (no qualitative signal)', () => {
    expect(
      normalizeUncertainty(
        { reasons: [] },
        { probabilityLow: 0.1, probabilityHigh: 0.2 },
      ),
    ).toBeUndefined();
  });

  it('returns undefined for non-record LLM input', () => {
    expect(
      normalizeUncertainty(null, { probabilityLow: 0.1, probabilityHigh: 0.2 }),
    ).toBeUndefined();
    expect(normalizeUncertainty('nonsense' as unknown, {})).toBeUndefined();
  });
});
