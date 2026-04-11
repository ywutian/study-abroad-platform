export type OutcomeLabelStatus =
  | 'SELF_REPORTED'
  | 'COUNSELOR_VERIFIED'
  | 'DOCUMENT_VERIFIED'
  | 'CONFLICTED'
  | 'CENSORED';

export type OutcomeLabelResult =
  | 'ADMITTED'
  | 'REJECTED'
  | 'WAITLISTED'
  | 'DEFERRED'
  | 'WITHDRAWN'
  | 'UNKNOWN'
  | 'CENSORED';

export type CanonicalOutcomeLabel = 'ADMITTED' | 'REJECTED' | 'CENSORED';

export type OutcomeLabelRecordShape = {
  id?: string;
  result: string;
  status: string;
  notes?: string | null;
  evidenceUrl?: string | null;
  round?: string | null;
  isFinal?: boolean | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

export const VERIFIED_OUTCOME_STATUSES: OutcomeLabelStatus[] = [
  'COUNSELOR_VERIFIED',
  'DOCUMENT_VERIFIED',
];

export const CALIBRATION_ELIGIBLE_OUTCOME_RESULTS: OutcomeLabelResult[] = ['ADMITTED', 'REJECTED'];

const CANONICAL_CANDIDATE_RESULTS = new Set<OutcomeLabelResult>([
  'ADMITTED',
  'REJECTED',
  'WAITLISTED',
  'DEFERRED',
  'WITHDRAWN',
  'UNKNOWN',
  'CENSORED',
]);

export function getOutcomeStatusPriority(status: string): number {
  switch (status as OutcomeLabelStatus) {
    case 'DOCUMENT_VERIFIED':
      return 5;
    case 'COUNSELOR_VERIFIED':
      return 4;
    case 'SELF_REPORTED':
      return 3;
    case 'CENSORED':
      return 2;
    case 'CONFLICTED':
    default:
      return 1;
  }
}

export function isVerifiedOutcomeStatus(
  status?: string | null
): status is (typeof VERIFIED_OUTCOME_STATUSES)[number] {
  return VERIFIED_OUTCOME_STATUSES.includes(status as OutcomeLabelStatus);
}

export function toCanonicalOutcomeLabel(result?: string | null): CanonicalOutcomeLabel {
  return result === 'ADMITTED' || result === 'REJECTED' ? result : 'CENSORED';
}

export function isCalibrationEligibleOutcomeRecord(
  record?: Pick<OutcomeLabelRecordShape, 'status' | 'result'> | null
): boolean {
  if (!record) return false;
  return (
    isVerifiedOutcomeStatus(record.status) &&
    CALIBRATION_ELIGIBLE_OUTCOME_RESULTS.includes(record.result as OutcomeLabelResult)
  );
}

export function resolveCanonicalPredictionOutcome(records?: OutcomeLabelRecordShape[] | null): {
  canonicalRecord: OutcomeLabelRecordShape | null;
  displayRecord: OutcomeLabelRecordShape | null;
  canonicalOutcomeLabel: CanonicalOutcomeLabel;
  eligibleForCalibration: boolean;
} {
  if (!records?.length) {
    return {
      canonicalRecord: null,
      displayRecord: null,
      canonicalOutcomeLabel: 'CENSORED',
      eligibleForCalibration: false,
    };
  }

  const sorted = [...records].sort((a, b) => {
    const priorityDiff = getOutcomeStatusPriority(b.status) - getOutcomeStatusPriority(a.status);
    if (priorityDiff !== 0) return priorityDiff;
    if (Boolean(b.isFinal) !== Boolean(a.isFinal)) {
      return Number(Boolean(b.isFinal)) - Number(Boolean(a.isFinal));
    }
    const aResolved = a.resolvedAt?.getTime() ?? 0;
    const bResolved = b.resolvedAt?.getTime() ?? 0;
    if (aResolved !== bResolved) return bResolved - aResolved;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const canonicalRecord =
    sorted.find(
      (record) =>
        record.status !== 'CONFLICTED' &&
        CANONICAL_CANDIDATE_RESULTS.has(record.result as OutcomeLabelResult)
    ) ?? null;

  return {
    canonicalRecord,
    displayRecord: canonicalRecord ?? sorted[0] ?? null,
    canonicalOutcomeLabel: toCanonicalOutcomeLabel(canonicalRecord?.result),
    eligibleForCalibration: isCalibrationEligibleOutcomeRecord(canonicalRecord),
  };
}
