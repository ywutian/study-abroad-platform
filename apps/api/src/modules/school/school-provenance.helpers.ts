import type { FieldProvenance, SchoolProvenance } from '@study-abroad/shared';
import {
  deriveTrustTierFromSource,
  normalizeFieldProvenance,
  normalizeSchoolProvenance,
} from '@study-abroad/shared/utils';

export const SCHOOL_TOP_LEVEL_PROVENANCE_FIELDS = [
  'name',
  'nameZh',
  'country',
  'state',
  'city',
  'website',
  'logoUrl',
  'acceptanceRate',
  'tuition',
  'avgSalary',
  'totalEnrollment',
  'studentCount',
  'satAvg',
  'sat25',
  'sat75',
  'satMath25',
  'satMath75',
  'satReading25',
  'satReading75',
  'actAvg',
  'act25',
  'act75',
  'graduationRate',
  'usNewsRank',
  'qsRank',
  'isPrivate',
  'description',
  'descriptionZh',
  'needBlindInternational',
  'intlStudentPct',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'retentionRate',
  'studentFacultyRatio',
  'percentNeedMet',
  'averageAidPackage',
  'averageNetPrice',
  'roomAndBoard',
  'applicationFee',
  'feeWaiverAvailable',
  'acceptsCommonApp',
  'acceptsCoalition',
  'testOptional',
  'testingPolicy',
  'hasEarlyDecision',
  'salary6YrPostGrad',
  'loanDefaultRate',
  'monthlyLoanPayment',
  'countriesRepresented',
  'studentOrgsCount',
  'nicheSafetyGrade',
  'nicheLifeGrade',
  'nicheFoodGrade',
  'nicheOverallGrade',
] as const;

export const SCHOOL_METADATA_PROVENANCE_FIELDS = [
  'essayCount',
  'applicationType',
  'applicationCycle',
  'toeflMin',
  'ieltsMin',
  'requirements.applicationFee',
  'essayPrompts',
  'deadlines.rea',
  'deadlines.ea',
  'deadlines.ed',
  'deadlines.ed2',
  'deadlines.rd',
] as const;

export const PREDICTION_CRITICAL_FIELDS = [
  'acceptanceRate',
  'tuition',
  'satAvg',
  'actAvg',
  'graduationRate',
  'totalEnrollment',
  'studentCount',
] as const;

type SchoolLike = Record<string, unknown> & {
  metadata?: unknown;
  updatedAt?: Date | string | null;
  scorecardId?: string | null;
  ipedsId?: string | null;
};

function pickTimestamp(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return null;
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function deepMergeRecords(
  base: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;

    const current = result[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      result[key] = deepMergeRecords(
        current as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }

    result[key] = value;
  }

  return result;
}

export function getMetadataFieldValue(
  metadata: unknown,
  field: string,
): unknown {
  const meta = toRecord(metadata);
  const requirements = toRecord(meta.requirements);
  const deadlines = toRecord(meta.deadlines);

  switch (field) {
    case 'essayCount':
      return meta.essayCount;
    case 'applicationType':
      return meta.applicationType;
    case 'applicationCycle':
      return meta.applicationCycle;
    case 'toeflMin':
      return requirements.toeflMin;
    case 'ieltsMin':
      return requirements.ieltsMin;
    case 'requirements.applicationFee':
      return requirements.applicationFee;
    case 'essayPrompts':
      return Array.isArray(meta.essayPrompts) && meta.essayPrompts.length > 0
        ? meta.essayPrompts
        : undefined;
    case 'deadlines.rea':
      return deadlines.rea;
    case 'deadlines.ea':
      return deadlines.ea;
    case 'deadlines.ed':
      return deadlines.ed;
    case 'deadlines.ed2':
      return deadlines.ed2;
    case 'deadlines.rd':
      return deadlines.rd;
    default:
      return undefined;
  }
}

export function collectPresentSchoolFacts(
  school: SchoolLike,
): Record<string, unknown> {
  const facts: Record<string, unknown> = {};

  for (const field of SCHOOL_TOP_LEVEL_PROVENANCE_FIELDS) {
    const value = school[field];
    if (value != null && value !== '') {
      facts[field] = value;
    }
  }

  for (const field of SCHOOL_METADATA_PROVENANCE_FIELDS) {
    const value = getMetadataFieldValue(school.metadata, field);
    if (value != null && value !== '') {
      facts[field] = value;
    }
  }

  return facts;
}

function resolveFallbackSourceForField(
  school: SchoolLike,
  field: string,
): string {
  const metadata = toRecord(school.metadata);
  const lastScraped = pickTimestamp(
    typeof metadata.lastScraped === 'string' ? metadata.lastScraped : null,
  );
  const hasBigFuture = Boolean(toRecord(metadata.bigfuture).lastScrapedAt);
  const hasAppily = Boolean(toRecord(metadata.appily).lastScrapedAt);

  if (
    [
      'acceptanceRate',
      'satAvg',
      'sat25',
      'sat75',
      'satMath25',
      'satMath75',
      'satReading25',
      'satReading75',
      'actAvg',
      'act25',
      'act75',
      'studentCount',
      'avgSalary',
      'graduationRate',
    ].includes(field) &&
    school.scorecardId
  ) {
    return 'COLLEGE_SCORECARD';
  }

  if (
    [
      'tuition',
      'totalEnrollment',
      'isPrivate',
      'intlStudentPct',
      'intlAcceptanceRate',
    ].includes(field) &&
    school.ipedsId
  ) {
    return 'IPEDS';
  }

  if (
    [
      'retentionRate',
      'studentFacultyRatio',
      'percentNeedMet',
      'averageAidPackage',
      'averageNetPrice',
      'roomAndBoard',
      'applicationFee',
      'feeWaiverAvailable',
      'acceptsCommonApp',
      'acceptsCoalition',
      'testOptional',
      'testingPolicy',
      'hasEarlyDecision',
    ].includes(field)
  ) {
    if (hasBigFuture) return 'BIGFUTURE';
    if (school.ipedsId) return 'IPEDS';
  }

  if (
    [
      'salary6YrPostGrad',
      'loanDefaultRate',
      'monthlyLoanPayment',
      'countriesRepresented',
      'studentOrgsCount',
      'nicheSafetyGrade',
      'nicheLifeGrade',
      'nicheFoodGrade',
      'nicheOverallGrade',
    ].includes(field)
  ) {
    if (hasAppily) return 'APPILY';
  }

  if (
    [
      'essayCount',
      'applicationType',
      'applicationCycle',
      'toeflMin',
      'ieltsMin',
      'requirements.applicationFee',
      'essayPrompts',
      'deadlines.rea',
      'deadlines.ea',
      'deadlines.ed',
      'deadlines.ed2',
      'deadlines.rd',
    ].includes(field) &&
    lastScraped
  ) {
    return 'SCRAPER';
  }

  if (school.scorecardId) return 'COLLEGE_SCORECARD';
  if (school.ipedsId) return 'IPEDS';
  if (lastScraped) return 'SCRAPER';
  return 'SEED';
}

function resolveFallbackFetchedAt(school: SchoolLike, field: string): string {
  const metadata = toRecord(school.metadata);

  if (
    [
      'essayCount',
      'applicationType',
      'applicationCycle',
      'toeflMin',
      'ieltsMin',
      'requirements.applicationFee',
      'essayPrompts',
      'deadlines.rea',
      'deadlines.ea',
      'deadlines.ed',
      'deadlines.ed2',
      'deadlines.rd',
    ].includes(field)
  ) {
    const lastScraped = pickTimestamp(
      typeof metadata.lastScraped === 'string' ? metadata.lastScraped : null,
    );
    if (lastScraped) return lastScraped;
  }

  const providerStamp =
    pickTimestamp(
      toRecord(metadata.bigfuture).lastScrapedAt as string | null,
    ) ??
    pickTimestamp(toRecord(metadata.appily).lastScrapedAt as string | null);
  if (providerStamp) return providerStamp;

  return pickTimestamp(school.updatedAt) ?? new Date().toISOString();
}

export function createFieldProvenance(params: {
  source: string;
  fetchedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  sourceUrl?: string;
  cycleYear?: number;
  notes?: string;
  confidence?: number;
}): FieldProvenance {
  const tier = deriveTrustTierFromSource(params.source);

  return {
    tier,
    source: params.source,
    fetchedAt: params.fetchedAt ?? new Date().toISOString(),
    ...(params.verifiedAt ? { verifiedAt: params.verifiedAt } : {}),
    ...(params.verifiedBy ? { verifiedBy: params.verifiedBy } : {}),
    ...(params.sourceUrl ? { sourceUrl: params.sourceUrl } : {}),
    ...(typeof params.cycleYear === 'number'
      ? { cycleYear: params.cycleYear }
      : {}),
    ...(params.notes ? { notes: params.notes } : {}),
    ...(tier === 'INFERRED' && typeof params.confidence === 'number'
      ? { confidence: params.confidence }
      : {}),
  };
}

export function buildFieldProvenanceRecord(
  fields: Iterable<string>,
  params: {
    source: string;
    fetchedAt?: string;
    verifiedAt?: string;
    verifiedBy?: string;
    sourceUrl?: string;
    cycleYear?: number;
    notes?: string;
    confidence?: number;
  },
): SchoolProvenance {
  const provenance: SchoolProvenance = {};

  for (const field of fields) {
    provenance[field] = createFieldProvenance(params);
  }

  return provenance;
}

export function buildNormalizedSchoolProvenance(
  school: SchoolLike,
  now = new Date(),
): SchoolProvenance {
  const metadata = toRecord(school.metadata);
  const existing = normalizeSchoolProvenance(metadata.provenance, now);
  const facts = collectPresentSchoolFacts(school);
  const next: SchoolProvenance = { ...existing };

  for (const field of Object.keys(facts)) {
    if (next[field]) continue;

    next[field] = createFieldProvenance({
      source: resolveFallbackSourceForField(school, field),
      fetchedAt: resolveFallbackFetchedAt(school, field),
    });
  }

  return next;
}

export function getNormalizedFieldProvenance(
  school: SchoolLike,
  field: string,
  now = new Date(),
): FieldProvenance | null {
  const metadata = toRecord(school.metadata);
  const existing = normalizeFieldProvenance(
    toRecord(metadata.provenance)[field],
    now,
  );
  if (existing) return existing;

  const facts = collectPresentSchoolFacts(school);
  if (!(field in facts)) return null;

  return createFieldProvenance({
    source: resolveFallbackSourceForField(school, field),
    fetchedAt: resolveFallbackFetchedAt(school, field),
  });
}
