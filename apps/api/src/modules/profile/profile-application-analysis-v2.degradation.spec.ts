import {
  mergeStringLists,
  resolveAnalysisDegradation,
} from './profile-application-analysis-v2.service';

/**
 * Guards for the 2026-06 output-quality fix.
 *
 * Two defects let a poor analysis look healthy:
 *  1. Silent degradation — when every LLM call failed (bad key / wrong model /
 *     provider outage) the per-school catch still pushed a deterministic card, so
 *     schoolResults was non-empty and the run was reported `fresh`. The AI never
 *     ran, but nothing said so. `resolveAnalysisDegradation` now surfaces it.
 *  2. Deterministic dilution — the old merge concatenated LLM + deterministic and
 *     kept the first 5, so a good 2-item LLM answer got padded with 3 generic
 *     template lines. `mergeStringLists` now serves the LLM as-is once it clears a
 *     minimum and only backfills the floor when the LLM came back sparse.
 */
describe('resolveAnalysisDegradation — systemic LLM failure is not silent', () => {
  it('reports partial failure for an explicitly enabled analysis policy', () => {
    expect(
      resolveAnalysisDegradation({
        llmCallsAttempted: 4,
        llmCallsFailed: 1,
        validationErrorCount: 1,
        schoolResultCount: 3,
        strictPartialFailure: true,
      }),
    ).toEqual({ isDegraded: true, degradedReason: 'partialAnalysisFailed' });
  });
  it('degrades with llmUnavailable when EVERY live LLM call failed', () => {
    const r = resolveAnalysisDegradation({
      llmCallsAttempted: 4, // 3 school analysts + portfolio
      llmCallsFailed: 4, // all 401'd
      validationErrorCount: 4,
      schoolResultCount: 3, // catch still pushed deterministic cards
    });
    expect(r.isDegraded).toBe(true);
    expect(r.degradedReason).toBe('llmUnavailable');
  });

  it('does NOT degrade on partial failure — some LLM calls succeeded', () => {
    const r = resolveAnalysisDegradation({
      llmCallsAttempted: 4,
      llmCallsFailed: 1, // one school failed, the rest + portfolio worked
      validationErrorCount: 1,
      schoolResultCount: 3,
    });
    expect(r.isDegraded).toBe(false);
    expect(r.degradedReason).toBeUndefined();
  });

  it('does NOT trip llmUnavailable in deterministic mode (zero LLM attempts)', () => {
    const r = resolveAnalysisDegradation({
      llmCallsAttempted: 0, // gold/governance replay skips the LLM
      llmCallsFailed: 0,
      validationErrorCount: 0,
      schoolResultCount: 3,
    });
    expect(r.isDegraded).toBe(false);
  });

  it('degrades with schoolAnalysisFailed when nothing could be analyzed', () => {
    const r = resolveAnalysisDegradation({
      llmCallsAttempted: 1,
      llmCallsFailed: 1,
      validationErrorCount: 2,
      schoolResultCount: 0, // no school cards at all
    });
    expect(r.isDegraded).toBe(true);
    expect(r.degradedReason).toBe('schoolAnalysisFailed');
  });

  it('stays fresh on a fully healthy run', () => {
    const r = resolveAnalysisDegradation({
      llmCallsAttempted: 4,
      llmCallsFailed: 0,
      validationErrorCount: 0,
      schoolResultCount: 3,
    });
    expect(r.isDegraded).toBe(false);
    expect(r.degradedReason).toBeUndefined();
  });
});

describe('mergeStringLists — LLM narrative leads, deterministic is only a floor', () => {
  const llm = ['LLM reason A', 'LLM reason B', 'LLM reason C'];
  const deterministic = [
    'The focus schools now have usable predictions and policy cards.',
    'Complete the core profile fields first.',
  ];

  it('serves the LLM list as-is when it cleared the minimum (no generic padding)', () => {
    const merged = mergeStringLists(llm, deterministic);
    expect(merged).toEqual(llm);
    // the generic deterministic template line must NOT dilute a good answer
    expect(merged).not.toContain(
      'The focus schools now have usable predictions and policy cards.',
    );
  });

  it('backfills from the deterministic floor when the LLM came back sparse', () => {
    const merged = mergeStringLists(['only one LLM item'], deterministic);
    expect(merged[0]).toBe('only one LLM item');
    expect(merged).toContain('Complete the core profile fields first.');
  });

  it('falls back entirely to the deterministic floor when the LLM is empty', () => {
    expect(mergeStringLists([], deterministic)).toEqual(deterministic);
  });

  it('dedupes and caps at five', () => {
    const many = ['a', 'a', 'b', 'c', 'd', 'e', 'f'];
    const merged = mergeStringLists(many, []);
    expect(merged).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
