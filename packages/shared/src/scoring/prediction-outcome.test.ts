import { describe, expect, it } from 'vitest';

import {
  CALIBRATION_ELIGIBLE_OUTCOME_RESULTS,
  VERIFIED_OUTCOME_STATUSES,
  getOutcomeStatusPriority,
  isCalibrationEligibleOutcomeRecord,
  isVerifiedOutcomeStatus,
  resolveCanonicalPredictionOutcome,
  toCanonicalOutcomeLabel,
  type OutcomeLabelRecordShape,
} from './prediction-outcome';

// A small factory so each test only states the fields it cares about.
function record(overrides: Partial<OutcomeLabelRecordShape> = {}): OutcomeLabelRecordShape {
  return {
    result: 'ADMITTED',
    status: 'DOCUMENT_VERIFIED',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    resolvedAt: null,
    ...overrides,
  };
}

describe('getOutcomeStatusPriority', () => {
  it('ranks the verification ladder DOCUMENT > COUNSELOR > SELF_REPORTED', () => {
    expect(getOutcomeStatusPriority('DOCUMENT_VERIFIED')).toBe(5);
    expect(getOutcomeStatusPriority('COUNSELOR_VERIFIED')).toBe(4);
    expect(getOutcomeStatusPriority('SELF_REPORTED')).toBe(3);
  });

  it('puts REQUEST_EVIDENCE / CENSORED at 2 and REJECTED / CONFLICTED at the floor of 1', () => {
    expect(getOutcomeStatusPriority('REQUEST_EVIDENCE')).toBe(2);
    expect(getOutcomeStatusPriority('CENSORED')).toBe(2);
    expect(getOutcomeStatusPriority('REJECTED')).toBe(1);
    expect(getOutcomeStatusPriority('CONFLICTED')).toBe(1);
  });

  it('treats any unknown status as the floor priority 1', () => {
    expect(getOutcomeStatusPriority('SOMETHING_ELSE')).toBe(1);
    expect(getOutcomeStatusPriority('')).toBe(1);
  });

  it('produces a strictly descending order across the documented ladder', () => {
    const order = [
      'DOCUMENT_VERIFIED',
      'COUNSELOR_VERIFIED',
      'SELF_REPORTED',
      'REQUEST_EVIDENCE',
      'REJECTED',
    ].map(getOutcomeStatusPriority);
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i]).toBeLessThan(order[i - 1]);
    }
  });
});

describe('isVerifiedOutcomeStatus', () => {
  it('accepts only the two verified statuses', () => {
    expect(isVerifiedOutcomeStatus('DOCUMENT_VERIFIED')).toBe(true);
    expect(isVerifiedOutcomeStatus('COUNSELOR_VERIFIED')).toBe(true);
    expect(VERIFIED_OUTCOME_STATUSES).toEqual(['COUNSELOR_VERIFIED', 'DOCUMENT_VERIFIED']);
  });

  it('rejects self-reported, unverified, and nullish inputs', () => {
    expect(isVerifiedOutcomeStatus('SELF_REPORTED')).toBe(false);
    expect(isVerifiedOutcomeStatus('REQUEST_EVIDENCE')).toBe(false);
    expect(isVerifiedOutcomeStatus(null)).toBe(false);
    expect(isVerifiedOutcomeStatus(undefined)).toBe(false);
    expect(isVerifiedOutcomeStatus('')).toBe(false);
  });
});

describe('toCanonicalOutcomeLabel', () => {
  it('passes ADMITTED and REJECTED through unchanged', () => {
    expect(toCanonicalOutcomeLabel('ADMITTED')).toBe('ADMITTED');
    expect(toCanonicalOutcomeLabel('REJECTED')).toBe('REJECTED');
  });

  it('collapses every other (or nullish) result to CENSORED', () => {
    expect(toCanonicalOutcomeLabel('WAITLISTED')).toBe('CENSORED');
    expect(toCanonicalOutcomeLabel('DEFERRED')).toBe('CENSORED');
    expect(toCanonicalOutcomeLabel('UNKNOWN')).toBe('CENSORED');
    expect(toCanonicalOutcomeLabel('CENSORED')).toBe('CENSORED');
    expect(toCanonicalOutcomeLabel(null)).toBe('CENSORED');
    expect(toCanonicalOutcomeLabel(undefined)).toBe('CENSORED');
  });
});

describe('isCalibrationEligibleOutcomeRecord', () => {
  it('requires BOTH a verified status AND an ADMITTED/REJECTED result', () => {
    expect(CALIBRATION_ELIGIBLE_OUTCOME_RESULTS).toEqual(['ADMITTED', 'REJECTED']);
    expect(
      isCalibrationEligibleOutcomeRecord({ status: 'DOCUMENT_VERIFIED', result: 'ADMITTED' })
    ).toBe(true);
    expect(
      isCalibrationEligibleOutcomeRecord({ status: 'COUNSELOR_VERIFIED', result: 'REJECTED' })
    ).toBe(true);
  });

  it('rejects an unverified status even with an eligible result', () => {
    expect(
      isCalibrationEligibleOutcomeRecord({ status: 'SELF_REPORTED', result: 'ADMITTED' })
    ).toBe(false);
  });

  it('rejects a verified status with a non-eligible result (e.g. WAITLISTED)', () => {
    expect(
      isCalibrationEligibleOutcomeRecord({ status: 'DOCUMENT_VERIFIED', result: 'WAITLISTED' })
    ).toBe(false);
  });

  it('returns false for null / undefined records', () => {
    expect(isCalibrationEligibleOutcomeRecord(null)).toBe(false);
    expect(isCalibrationEligibleOutcomeRecord(undefined)).toBe(false);
  });
});

describe('resolveCanonicalPredictionOutcome', () => {
  it('returns the CENSORED/empty default for no records', () => {
    for (const empty of [undefined, null, []] as const) {
      expect(resolveCanonicalPredictionOutcome(empty)).toEqual({
        canonicalRecord: null,
        displayRecord: null,
        canonicalOutcomeLabel: 'CENSORED',
        eligibleForCalibration: false,
      });
    }
  });

  it('picks the highest-priority verified ADMITTED record as canonical and calibration-eligible', () => {
    const selfReported = record({ status: 'SELF_REPORTED', result: 'ADMITTED' });
    const documentVerified = record({ status: 'DOCUMENT_VERIFIED', result: 'ADMITTED' });
    const res = resolveCanonicalPredictionOutcome([selfReported, documentVerified]);

    expect(res.canonicalRecord).toBe(documentVerified);
    expect(res.displayRecord).toBe(documentVerified);
    expect(res.canonicalOutcomeLabel).toBe('ADMITTED');
    expect(res.eligibleForCalibration).toBe(true);
  });

  it('does not depend on input order (sort is stable on priority)', () => {
    const selfReported = record({ status: 'SELF_REPORTED', result: 'ADMITTED' });
    const documentVerified = record({ status: 'DOCUMENT_VERIFIED', result: 'ADMITTED' });
    const a = resolveCanonicalPredictionOutcome([selfReported, documentVerified]);
    const b = resolveCanonicalPredictionOutcome([documentVerified, selfReported]);
    expect(a.canonicalRecord).toBe(b.canonicalRecord);
  });

  it('excludes REQUEST_EVIDENCE / REJECTED / CONFLICTED statuses from the canonical record', () => {
    // All records have ineligible *statuses*, so no canonical record can be chosen,
    // yet the highest-priority record is still surfaced as the display record.
    const requestEvidence = record({ status: 'REQUEST_EVIDENCE', result: 'ADMITTED' });
    const conflicted = record({ status: 'CONFLICTED', result: 'ADMITTED' });
    const res = resolveCanonicalPredictionOutcome([requestEvidence, conflicted]);

    expect(res.canonicalRecord).toBeNull();
    expect(res.canonicalOutcomeLabel).toBe('CENSORED');
    expect(res.eligibleForCalibration).toBe(false);
    // displayRecord falls back to the top of the sorted list (priority 2 > 1).
    expect(res.displayRecord).toBe(requestEvidence);
  });

  it('falls through priority ties to isFinal, preferring the final record', () => {
    const nonFinal = record({
      status: 'COUNSELOR_VERIFIED',
      result: 'ADMITTED',
      isFinal: false,
    });
    const final = record({
      status: 'COUNSELOR_VERIFIED',
      result: 'REJECTED',
      isFinal: true,
    });
    const res = resolveCanonicalPredictionOutcome([nonFinal, final]);
    expect(res.canonicalRecord).toBe(final);
    expect(res.canonicalOutcomeLabel).toBe('REJECTED');
  });

  it('breaks isFinal ties by the most recent resolvedAt', () => {
    const older = record({
      status: 'DOCUMENT_VERIFIED',
      result: 'ADMITTED',
      resolvedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const newer = record({
      status: 'DOCUMENT_VERIFIED',
      result: 'REJECTED',
      resolvedAt: new Date('2026-03-01T00:00:00Z'),
    });
    const res = resolveCanonicalPredictionOutcome([older, newer]);
    expect(res.canonicalRecord).toBe(newer);
  });

  it('breaks resolvedAt ties by the most recent createdAt', () => {
    const earlier = record({
      status: 'DOCUMENT_VERIFIED',
      result: 'ADMITTED',
      resolvedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const later = record({
      status: 'DOCUMENT_VERIFIED',
      result: 'REJECTED',
      resolvedAt: null,
      createdAt: new Date('2026-02-01T00:00:00Z'),
    });
    const res = resolveCanonicalPredictionOutcome([earlier, later]);
    expect(res.canonicalRecord).toBe(later);
  });

  it('keeps a verified WAITLISTED record as canonical (valid candidate result) but censors its label and bars calibration', () => {
    const waitlisted = record({ status: 'DOCUMENT_VERIFIED', result: 'WAITLISTED' });
    const res = resolveCanonicalPredictionOutcome([waitlisted]);
    expect(res.canonicalRecord).toBe(waitlisted);
    expect(res.canonicalOutcomeLabel).toBe('CENSORED');
    expect(res.eligibleForCalibration).toBe(false);
  });

  it('does not mutate the caller-supplied array (sorts a copy)', () => {
    const low = record({ status: 'SELF_REPORTED', result: 'ADMITTED' });
    const high = record({ status: 'DOCUMENT_VERIFIED', result: 'ADMITTED' });
    const input = [low, high];
    resolveCanonicalPredictionOutcome(input);
    expect(input).toEqual([low, high]);
  });
});
