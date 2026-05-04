export const OPEN_DATA_STATUSES = [
  'PENDING',
  'UNKNOWN',
  'SOURCE_FOUND',
  'EXTRACTION_READY',
  'SUSPICIOUS',
  'MANUAL_REVIEW',
  'TERMINAL_CANDIDATE',
] as const;

export const TERMINAL_DATA_STATUSES = [
  'NO_PUBLIC_SOURCE',
  'NO_PUBLIC_ROUND_RATE',
  'NO_PUBLIC_GPA_DISTRIBUTION',
  'NO_PUBLIC_C9_CROSSTAB',
  'NO_PUBLIC_PROGRAM_DATA',
  'NO_PUBLIC_USER_CASE_DATA',
  'OFFICIAL_BLANK_SECTION',
  'OFFICIAL_BLOCKED',
  'NOT_APPLICABLE',
  'NOT_APPLICABLE_NO_SUPPLEMENT',
  'NOT_APPLICABLE_NO_USER_DATA',
  'PERMANENT_HEURISTIC',
] as const;

export type FullFieldKind = 'scalar' | 'relation';

export interface FullFieldAuditSpec {
  key: string;
  kind: FullFieldKind;
  relationCount?: string;
  requiresCurrentYear?: boolean;
  allowsSecondary?: boolean;
  allowsHeuristic?: boolean;
  userGenerated?: boolean;
}

export const FULL_FIELD_AUDIT_SPECS: FullFieldAuditSpec[] = [
  { key: 'acceptanceRate', kind: 'scalar' },
  { key: 'intlAcceptanceRate', kind: 'scalar' },
  { key: 'oosAcceptanceRate', kind: 'scalar' },
  { key: 'transferAcceptanceRate', kind: 'scalar' },
  { key: 'edAcceptanceRate', kind: 'scalar', allowsSecondary: true },
  { key: 'eaAcceptanceRate', kind: 'scalar', allowsSecondary: true },
  { key: 'hasEarlyDecision', kind: 'scalar' },
  { key: 'sat25', kind: 'scalar', allowsSecondary: true },
  { key: 'sat75', kind: 'scalar', allowsSecondary: true },
  { key: 'satAvg', kind: 'scalar', allowsSecondary: true },
  { key: 'satMath25', kind: 'scalar', allowsSecondary: true },
  { key: 'satMath75', kind: 'scalar', allowsSecondary: true },
  { key: 'satReading25', kind: 'scalar', allowsSecondary: true },
  { key: 'satReading75', kind: 'scalar', allowsSecondary: true },
  { key: 'act25', kind: 'scalar', allowsSecondary: true },
  { key: 'act75', kind: 'scalar', allowsSecondary: true },
  { key: 'actAvg', kind: 'scalar', allowsSecondary: true },
  { key: 'gpaDistribution', kind: 'scalar', requiresCurrentYear: true },
  { key: 'cdsAdmitBands', kind: 'relation', relationCount: 'cdsAdmitBands' },
  {
    key: 'programRates',
    kind: 'relation',
    relationCount: 'programs',
    allowsHeuristic: true,
  },
  {
    key: 'deadlines',
    kind: 'relation',
    relationCount: 'deadlines',
    requiresCurrentYear: true,
    allowsSecondary: true,
  },
  {
    key: 'essayPrompts',
    kind: 'relation',
    relationCount: 'essayPrompts',
    requiresCurrentYear: true,
    allowsSecondary: true,
  },
  {
    key: 'rankings',
    kind: 'relation',
    relationCount: 'rankings',
    requiresCurrentYear: true,
    allowsSecondary: true,
  },
  {
    key: 'communityRatings',
    kind: 'relation',
    relationCount: 'communityRatings',
    userGenerated: true,
  },
  {
    key: 'admissionCases',
    kind: 'relation',
    relationCount: 'cases',
    userGenerated: true,
  },
  { key: 'tuition', kind: 'scalar', allowsSecondary: true },
  { key: 'roomAndBoard', kind: 'scalar', allowsSecondary: true },
  { key: 'averageAidPackage', kind: 'scalar', allowsSecondary: true },
  { key: 'averageNetPrice', kind: 'scalar', allowsSecondary: true },
  { key: 'percentNeedMet', kind: 'scalar', allowsSecondary: true },
  { key: 'applicationFee', kind: 'scalar', allowsSecondary: true },
  { key: 'feeWaiverAvailable', kind: 'scalar', allowsSecondary: true },
  { key: 'acceptsCommonApp', kind: 'scalar', allowsSecondary: true },
  { key: 'acceptsCoalition', kind: 'scalar', allowsSecondary: true },
  { key: 'testOptional', kind: 'scalar', allowsSecondary: true },
  { key: 'testingPolicy', kind: 'scalar', allowsSecondary: true },
  { key: 'graduationRate', kind: 'scalar' },
  { key: 'retentionRate', kind: 'scalar', allowsSecondary: true },
  { key: 'salary6YrPostGrad', kind: 'scalar', allowsSecondary: true },
  { key: 'avgSalary', kind: 'scalar', allowsSecondary: true },
  { key: 'loanDefaultRate', kind: 'scalar' },
  { key: 'monthlyLoanPayment', kind: 'scalar', allowsSecondary: true },
  { key: 'totalEnrollment', kind: 'scalar' },
  { key: 'studentFacultyRatio', kind: 'scalar', allowsSecondary: true },
  { key: 'intlStudentPct', kind: 'scalar' },
  { key: 'countriesRepresented', kind: 'scalar', allowsSecondary: true },
  { key: 'studentOrgsCount', kind: 'scalar', allowsSecondary: true },
  { key: 'nicheOverallGrade', kind: 'scalar', allowsSecondary: true },
  { key: 'nicheSafetyGrade', kind: 'scalar', allowsSecondary: true },
  { key: 'nicheLifeGrade', kind: 'scalar', allowsSecondary: true },
  { key: 'nicheFoodGrade', kind: 'scalar', allowsSecondary: true },
  { key: 'description', kind: 'scalar', allowsSecondary: true },
  { key: 'descriptionZh', kind: 'scalar', allowsSecondary: true },
];
