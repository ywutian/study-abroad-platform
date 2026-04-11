import {
  resolveCanonicalPredictionOutcome,
  type OutcomeLabelRecordShape,
} from '@study-abroad/shared/scoring';

describe('prediction outcome truth helpers', () => {
  const createOutcomeRecord = (
    result: OutcomeLabelRecordShape['result'],
    status: OutcomeLabelRecordShape['status'],
    overrides: Partial<OutcomeLabelRecordShape> = {},
  ): OutcomeLabelRecordShape => ({
    id: `${status}-${result}`,
    result,
    status,
    createdAt: new Date('2026-04-09T00:00:00.000Z'),
    resolvedAt: new Date('2026-04-09T00:00:00.000Z'),
    isFinal: false,
    ...overrides,
  });

  it('prefers document-verified labels over self-reported labels', () => {
    const outcome = resolveCanonicalPredictionOutcome([
      createOutcomeRecord('ADMITTED', 'SELF_REPORTED'),
      createOutcomeRecord('REJECTED', 'DOCUMENT_VERIFIED'),
    ]);

    expect(outcome.canonicalRecord?.status).toBe('DOCUMENT_VERIFIED');
    expect(outcome.canonicalRecord?.result).toBe('REJECTED');
    expect(outcome.canonicalOutcomeLabel).toBe('REJECTED');
    expect(outcome.eligibleForCalibration).toBe(true);
  });

  it('treats waitlist-like outcomes as censored even when verified', () => {
    const outcome = resolveCanonicalPredictionOutcome([
      createOutcomeRecord('WAITLISTED', 'DOCUMENT_VERIFIED'),
    ]);

    expect(outcome.canonicalRecord?.result).toBe('WAITLISTED');
    expect(outcome.canonicalOutcomeLabel).toBe('CENSORED');
    expect(outcome.eligibleForCalibration).toBe(false);
  });

  it('prefers final records when verification priority ties', () => {
    const outcome = resolveCanonicalPredictionOutcome([
      createOutcomeRecord('REJECTED', 'COUNSELOR_VERIFIED', {
        isFinal: false,
        resolvedAt: new Date('2026-04-09T00:00:00.000Z'),
      }),
      createOutcomeRecord('ADMITTED', 'COUNSELOR_VERIFIED', {
        isFinal: true,
        resolvedAt: new Date('2026-04-08T00:00:00.000Z'),
      }),
    ]);

    expect(outcome.canonicalRecord?.result).toBe('ADMITTED');
    expect(outcome.canonicalOutcomeLabel).toBe('ADMITTED');
    expect(outcome.eligibleForCalibration).toBe(true);
  });
});
