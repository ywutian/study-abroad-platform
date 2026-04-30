export type CdsRateField =
  | 'acceptanceRate'
  | 'intlAcceptanceRate'
  | 'oosAcceptanceRate'
  | 'transferAcceptanceRate';

export type CdsTerminalStatus =
  | 'VERIFIED_REAL'
  | 'PARTIAL_REAL'
  | 'OFFICIAL_BLANK'
  | 'OFFICIAL_BLOCKED'
  | 'NO_PUBLIC_REAL_DATA'
  | 'MANUAL_REVIEW';

export type CdsSourceType =
  | 'CDS_OFFICIAL'
  | 'OFFICIAL_FACTBOOK'
  | 'OFFICIAL_ADMISSIONS_PROFILE'
  | 'OFFICIAL_STATE_DASHBOARD'
  | 'IPEDS'
  | 'THIRD_PARTY_HINT'
  | 'HEURISTIC';

export interface CdsCounts {
  total?: number | null;
  inState?: number | null;
  outOfState?: number | null;
  international?: number | null;
}

export interface CdsValidatorResult {
  name: string;
  method:
    | 'regex'
    | 'parser'
    | 'llm'
    | 'manual'
    | 'cross_source'
    | 'math'
    | 'domain'
    | 'structure';
  passed: boolean;
  notes?: string;
}

export interface CdsFieldDecision {
  status?: 'VERIFIED_REAL' | 'PARTIAL_REAL' | 'MANUAL_REVIEW';
  formula?: string;
  validators?: CdsValidatorResult[];
}

export interface CdsVerification {
  status: CdsTerminalStatus;
  sourceType: CdsSourceType;
  extractionMethod:
    | 'pdf_regex'
    | 'pdf_llm'
    | 'pdf_manual'
    | 'xlsx_parser'
    | 'docx_parser'
    | 'html_parser'
    | 'official_profile'
    | 'state_dashboard'
    | 'manual_crosscheck';
  officialSource: boolean;
  validators: CdsValidatorResult[];
  fieldDecisions?: Partial<Record<CdsRateField, CdsFieldDecision>>;
  notes?: string;
}

export interface VerifiedCdsBundleRow {
  schoolNameNorm: string;
  cycleYear?: number;
  sourceUrl?: string;
  applicants?: CdsCounts;
  admitted?: CdsCounts;
  enrolled?: CdsCounts;
  rates?: Partial<Record<CdsRateField, number | null>>;
  notes?: string;
  verification?: CdsVerification;
}

export interface VerifiedRateField {
  field: CdsRateField;
  formula: string;
  validatorCount: number;
}

export interface CdsRowValidationResult {
  importable: boolean;
  status: CdsTerminalStatus | 'UNVERIFIED';
  verifiedRateFields: VerifiedRateField[];
  errors: string[];
  warnings: string[];
}

const RATE_FORMULAS: Record<
  CdsRateField,
  { numerator: keyof CdsCounts; denominator: keyof CdsCounts; label: string }
> = {
  acceptanceRate: {
    numerator: 'total',
    denominator: 'total',
    label: 'overall',
  },
  intlAcceptanceRate: {
    numerator: 'international',
    denominator: 'international',
    label: 'international',
  },
  oosAcceptanceRate: {
    numerator: 'outOfState',
    denominator: 'outOfState',
    label: 'out-of-state',
  },
  transferAcceptanceRate: {
    numerator: 'total',
    denominator: 'total',
    label: 'transfer',
  },
};

const OFFICIAL_SOURCE_TYPES = new Set<CdsSourceType>([
  'CDS_OFFICIAL',
  'OFFICIAL_FACTBOOK',
  'OFFICIAL_ADMISSIONS_PROFILE',
  'OFFICIAL_STATE_DASHBOARD',
  'IPEDS',
]);

function cleanCount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizePercent(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const pct = value < 1 ? value * 100 : value;
  if (pct > 100) return null;
  return Math.round(pct * 100) / 100;
}

function passedValidators(
  validators: CdsValidatorResult[] | undefined,
): CdsValidatorResult[] {
  return (validators ?? []).filter((v) => v.passed);
}

function uniqueValidatorMethods(validators: CdsValidatorResult[]) {
  return new Set(validators.map((v) => v.method));
}

function pct(admitted?: number | null, applicants?: number | null) {
  if (admitted == null || applicants == null || applicants <= 0) return null;
  return Math.round((admitted / applicants) * 10000) / 100;
}

function fieldFormula(
  field: CdsRateField,
  applicants: CdsCounts,
  admitted: CdsCounts,
): string | null {
  if (field === 'transferAcceptanceRate') return null;
  const spec = RATE_FORMULAS[field];
  const admittedCount = cleanCount(admitted[spec.numerator]);
  const applicantCount = cleanCount(applicants[spec.denominator]);
  if (admittedCount == null || applicantCount == null || applicantCount <= 0) {
    return null;
  }
  return `${spec.label}: ${admittedCount}/${applicantCount}=${pct(admittedCount, applicantCount)}%`;
}

function fieldRateMatchesCounts(
  field: CdsRateField,
  rate: number,
  applicants: CdsCounts,
  admitted: CdsCounts,
) {
  if (field === 'transferAcceptanceRate') return null;
  const spec = RATE_FORMULAS[field];
  const admittedCount = cleanCount(admitted[spec.numerator]);
  const applicantCount = cleanCount(applicants[spec.denominator]);
  const computed = pct(admittedCount, applicantCount);
  if (computed == null) return null;
  return Math.abs(computed - rate) <= 0.1;
}

function residencyTotalsApproximatelyMatch(counts: CdsCounts | undefined) {
  const total = cleanCount(counts?.total);
  const inState = cleanCount(counts?.inState);
  const outOfState = cleanCount(counts?.outOfState);
  const international = cleanCount(counts?.international);
  const parts = [inState, outOfState, international].filter(
    (v): v is number => v != null,
  );
  if (total == null || parts.length < 2) return true;
  const sum = parts.reduce((a, b) => a + b, 0);
  const diff = Math.abs(sum - total);
  return diff <= Math.max(5, total * 0.05);
}

export function validateVerifiedCdsRow(
  row: VerifiedCdsBundleRow,
): CdsRowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const verification = row.verification;
  const status = verification?.status ?? 'UNVERIFIED';
  const verifiedRateFields: VerifiedRateField[] = [];

  if (!verification) {
    errors.push('missing verification block');
    return { importable: false, status, verifiedRateFields, errors, warnings };
  }

  if (!['VERIFIED_REAL', 'PARTIAL_REAL'].includes(verification.status)) {
    errors.push(`non-importable status: ${verification.status}`);
  }

  if (!verification.officialSource) {
    errors.push('source is not marked official');
  }

  if (!OFFICIAL_SOURCE_TYPES.has(verification.sourceType)) {
    errors.push(
      `sourceType is not accepted for real import: ${verification.sourceType}`,
    );
  }

  const rowValidators = passedValidators(verification.validators);
  const rowMethods = uniqueValidatorMethods(rowValidators);
  if (rowValidators.length < 2 || rowMethods.size < 2) {
    errors.push('requires at least two passing independent validators');
  }

  if (!row.sourceUrl) errors.push('sourceUrl is required');
  if (!row.cycleYear)
    warnings.push('cycleYear missing; importer will default to 2024');

  if (!residencyTotalsApproximatelyMatch(row.applicants)) {
    errors.push('applicant residency counts do not reconcile with total');
  }
  if (!residencyTotalsApproximatelyMatch(row.admitted)) {
    errors.push('admitted residency counts do not reconcile with total');
  }

  const applicants = row.applicants ?? {};
  const admitted = row.admitted ?? {};
  for (const field of Object.keys(row.rates ?? {}) as CdsRateField[]) {
    const rate = normalizePercent(row.rates?.[field]);
    if (rate == null) continue;
    const decision = verification.fieldDecisions?.[field];
    const fieldValidators = [
      ...rowValidators,
      ...passedValidators(decision?.validators),
    ];
    const fieldMethods = uniqueValidatorMethods(fieldValidators);
    const matchesCounts = fieldRateMatchesCounts(
      field,
      rate,
      applicants,
      admitted,
    );
    const formula =
      decision?.formula ?? fieldFormula(field, applicants, admitted);

    if (matchesCounts === false) {
      errors.push(
        `${field} does not match admitted/applicants counts within 0.1pp`,
      );
      continue;
    }
    if (matchesCounts == null && field !== 'transferAcceptanceRate') {
      warnings.push(
        `${field} has no count formula and will not be imported in strict mode`,
      );
      continue;
    }
    if (fieldValidators.length < 2 || fieldMethods.size < 2) {
      warnings.push(
        `${field} lacks two independent validators and will not be imported`,
      );
      continue;
    }
    verifiedRateFields.push({
      field,
      formula: formula ?? `${field}: verified without count formula`,
      validatorCount: fieldValidators.length,
    });
  }

  if (
    Object.keys(row.rates ?? {}).length > 0 &&
    verifiedRateFields.length === 0
  ) {
    errors.push('no rate fields passed verified-real import checks');
  }

  return {
    importable: errors.length === 0,
    status,
    verifiedRateFields,
    errors,
    warnings,
  };
}

export function buildVerifiedFieldProvenance(
  row: VerifiedCdsBundleRow,
  field: CdsRateField | string,
  verifiedField: VerifiedRateField | undefined,
  actorUserId: string,
) {
  const verification = row.verification;
  return {
    source: verification?.sourceType ?? 'CDS_OFFICIAL',
    tier: 'OFFICIAL',
    realDataStatus: verification?.status ?? 'VERIFIED_REAL',
    sourceUrl: row.sourceUrl ?? null,
    cycleYear: row.cycleYear ?? 2024,
    extractionMethod: verification?.extractionMethod ?? null,
    validatorCount:
      verifiedField?.validatorCount ??
      passedValidators(verification?.validators).length,
    originalFormula: verifiedField?.formula ?? null,
    verifiedBy: actorUserId,
    fetchedAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    confidence: verification?.status === 'VERIFIED_REAL' ? 0.99 : 0.9,
    notes: verification?.notes ?? row.notes ?? null,
    field,
  };
}
