import type {
  FieldProvenance,
  ProvenanceStaleness,
  RealDataStatus,
  SchoolFieldSource,
  SchoolProvenance,
  TrustTier,
} from '../types/school-provenance';

const UNAVAILABLE_SOURCE_TOKENS = [
  'OFFICIAL_BLANK',
  'OFFICIAL_BLOCKED',
  'NO_PUBLIC_REAL_DATA',
  'MANUAL_REVIEW',
  'UNAVAILABLE',
];
const OFFICIAL_SOURCE_TOKENS = [
  'COLLEGE_SCORECARD',
  'URBAN_INSTITUTE',
  'IPEDS',
  'CDS_OFFICIAL',
  'CDS_PDF',
  'CDS_LLM_EXTRACT',
  'OFFICIAL_FACTBOOK',
  'OFFICIAL_ADMISSIONS_PROFILE',
  'OFFICIAL_STATE_DASHBOARD',
];
const PARTNER_SOURCE_TOKENS = ['MANUAL_ADMIN', 'PARTNER'];
const SCRAPED_SOURCE_TOKENS = ['BIGFUTURE', 'APPILY', 'SCRAPER', 'SCRAPE'];
const COMMUNITY_SOURCE_TOKENS = ['COMMUNITY'];
const INFERRED_SOURCE_TOKENS = ['INFERRED', 'HEURISTIC', 'AI_'];

export const TRUST_TIER_PREDICTION_WEIGHT: Record<TrustTier, number> = {
  OFFICIAL: 1.0,
  PARTNER: 1.0,
  SCRAPED: 0.9,
  SEED: 0.7,
  COMMUNITY: 0,
  INFERRED: 0,
  UNAVAILABLE: 0,
};

export function isPredictionEligibleTrustTier(tier: TrustTier): boolean {
  return TRUST_TIER_PREDICTION_WEIGHT[tier] > 0;
}

export function deriveTrustTierFromSource(source: string): TrustTier {
  const normalized = source.trim().toUpperCase();

  if (UNAVAILABLE_SOURCE_TOKENS.some((token) => normalized.includes(token))) {
    return 'UNAVAILABLE';
  }
  if (OFFICIAL_SOURCE_TOKENS.some((token) => normalized.includes(token))) {
    return 'OFFICIAL';
  }
  if (PARTNER_SOURCE_TOKENS.some((token) => normalized.includes(token))) {
    return 'PARTNER';
  }
  if (SCRAPED_SOURCE_TOKENS.some((token) => normalized.includes(token))) {
    return 'SCRAPED';
  }
  if (COMMUNITY_SOURCE_TOKENS.some((token) => normalized.includes(token))) {
    return 'COMMUNITY';
  }
  if (INFERRED_SOURCE_TOKENS.some((token) => normalized.includes(token))) {
    return 'INFERRED';
  }
  if (normalized.includes('SEED')) {
    return 'SEED';
  }

  return 'SEED';
}

function normalizeTrustTier(value: unknown, source: string): TrustTier {
  if (typeof value !== 'string') return deriveTrustTierFromSource(source);
  const normalized = value.trim().toUpperCase();
  if (
    normalized === 'OFFICIAL' ||
    normalized === 'PARTNER' ||
    normalized === 'SCRAPED' ||
    normalized === 'SEED' ||
    normalized === 'COMMUNITY' ||
    normalized === 'INFERRED' ||
    normalized === 'UNAVAILABLE'
  ) {
    return normalized;
  }
  return deriveTrustTierFromSource(source);
}

function normalizeRealDataStatus(value: unknown): RealDataStatus | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  if (
    normalized === 'VERIFIED_REAL' ||
    normalized === 'PARTIAL_REAL' ||
    normalized === 'OFFICIAL_BLANK' ||
    normalized === 'OFFICIAL_BLOCKED' ||
    normalized === 'NO_PUBLIC_REAL_DATA' ||
    normalized === 'MANUAL_REVIEW' ||
    normalized === 'PERMANENT_HEURISTIC'
  ) {
    return normalized;
  }
  return undefined;
}

export function deriveProvenanceStaleness(
  fetchedAt: string,
  now = new Date()
): ProvenanceStaleness {
  const timestamp = new Date(fetchedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return 'STALE';
  }

  const ageMs = now.getTime() - timestamp;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (ageDays < 180) return 'FRESH';
  if (ageDays <= 365) return 'AGING';
  return 'STALE';
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

/**
 * Derive a `source` for provenance entries that omit it.
 *
 * closure-v2 collected data carries `tier` + `verifiedBy` + `sourceUrl` but no
 * explicit `source` field. Without this fallback, `normalizeFieldProvenance`
 * would discard every closure-v2 entry as malformed — silently losing real,
 * verified source URLs. Deriving a source keeps verified data instead.
 */
function deriveProvenanceSource(entry: Record<string, unknown>): string | undefined {
  const verifiedBy = typeof entry.verifiedBy === 'string' ? entry.verifiedBy : undefined;
  const sourceUrl = typeof entry.sourceUrl === 'string' ? entry.sourceUrl : undefined;

  if (verifiedBy && verifiedBy.toLowerCase().startsWith('closure-v2')) {
    return 'CLOSURE_V2';
  }
  if (verifiedBy) return verifiedBy;
  if (sourceUrl) return 'SCRAPER';
  return undefined;
}

export function normalizeFieldProvenance(value: unknown, now = new Date()): FieldProvenance | null {
  const entry = toRecord(value);
  const source =
    (typeof entry.source === 'string' ? entry.source : undefined) ?? deriveProvenanceSource(entry);
  const fetchedAt =
    typeof entry.fetchedAt === 'string'
      ? entry.fetchedAt
      : typeof entry.at === 'string'
        ? entry.at
        : typeof entry.verifiedAt === 'string'
          ? entry.verifiedAt
          : undefined;

  if (!source || !fetchedAt) {
    return null;
  }

  const tier = normalizeTrustTier(entry.tier, source);
  const confidence =
    typeof entry.confidence === 'number' ? Math.min(1, Math.max(0, entry.confidence)) : undefined;
  const realDataStatus = normalizeRealDataStatus(entry.realDataStatus);

  return {
    tier,
    source,
    fetchedAt,
    verifiedAt: typeof entry.verifiedAt === 'string' ? entry.verifiedAt : undefined,
    verifiedBy: typeof entry.verifiedBy === 'string' ? entry.verifiedBy : undefined,
    sourceUrl: typeof entry.sourceUrl === 'string' ? entry.sourceUrl : undefined,
    cycleYear: typeof entry.cycleYear === 'number' ? entry.cycleYear : undefined,
    notes:
      typeof entry.notes === 'string'
        ? entry.notes
        : typeof entry.note === 'string'
          ? entry.note
          : undefined,
    confidence,
    staleness: deriveProvenanceStaleness(fetchedAt, now),
    ...(realDataStatus ? { realDataStatus } : {}),
    ...(typeof entry.validatorCount === 'number' ? { validatorCount: entry.validatorCount } : {}),
    ...(typeof entry.originalFormula === 'string'
      ? { originalFormula: entry.originalFormula }
      : {}),
    ...(typeof entry.extractionMethod === 'string'
      ? { extractionMethod: entry.extractionMethod }
      : {}),
    ...(typeof entry.reason === 'string' ? { reason: entry.reason } : {}),
    ...(typeof entry.permanent === 'boolean' ? { permanent: entry.permanent } : {}),
  };
}

export function normalizeSchoolProvenance(value: unknown, now = new Date()): SchoolProvenance {
  const raw = toRecord(value);
  const normalized: SchoolProvenance = {};

  for (const [field, entry] of Object.entries(raw)) {
    const provenance = normalizeFieldProvenance(entry, now);
    if (provenance) {
      normalized[field] = provenance;
    }
  }

  return normalized;
}

export function serializeFieldProvenance(
  provenance: FieldProvenance
): Omit<FieldProvenance, 'staleness'> {
  return {
    tier: provenance.tier,
    source: provenance.source,
    fetchedAt: provenance.fetchedAt,
    ...(provenance.verifiedAt ? { verifiedAt: provenance.verifiedAt } : {}),
    ...(provenance.verifiedBy ? { verifiedBy: provenance.verifiedBy } : {}),
    ...(provenance.sourceUrl ? { sourceUrl: provenance.sourceUrl } : {}),
    ...(typeof provenance.cycleYear === 'number' ? { cycleYear: provenance.cycleYear } : {}),
    ...(provenance.notes ? { notes: provenance.notes } : {}),
    ...(typeof provenance.confidence === 'number' ? { confidence: provenance.confidence } : {}),
    ...(provenance.realDataStatus ? { realDataStatus: provenance.realDataStatus } : {}),
    ...(typeof provenance.validatorCount === 'number'
      ? { validatorCount: provenance.validatorCount }
      : {}),
    ...(provenance.originalFormula ? { originalFormula: provenance.originalFormula } : {}),
    ...(provenance.extractionMethod ? { extractionMethod: provenance.extractionMethod } : {}),
    ...(provenance.reason ? { reason: provenance.reason } : {}),
    ...(typeof provenance.permanent === 'boolean' ? { permanent: provenance.permanent } : {}),
  };
}

export function serializeSchoolProvenance(provenance: SchoolProvenance): SchoolProvenance {
  const serialized: SchoolProvenance = {};

  for (const [field, entry] of Object.entries(provenance)) {
    if (!entry) continue;
    serialized[field] = serializeFieldProvenance(entry);
  }

  return serialized;
}

export function toSchoolFieldSource(
  provenance: FieldProvenance,
  now = new Date()
): SchoolFieldSource {
  const staleness = provenance.staleness ?? deriveProvenanceStaleness(provenance.fetchedAt, now);

  return {
    tier: provenance.tier,
    source: provenance.source,
    fetchedAt: provenance.fetchedAt,
    ...(provenance.verifiedAt ? { verifiedAt: provenance.verifiedAt } : {}),
    ...(provenance.verifiedBy ? { verifiedBy: provenance.verifiedBy } : {}),
    ...(provenance.sourceUrl ? { sourceUrl: provenance.sourceUrl } : {}),
    ...(typeof provenance.cycleYear === 'number' ? { cycleYear: provenance.cycleYear } : {}),
    ...(provenance.notes ? { notes: provenance.notes } : {}),
    ...(typeof provenance.confidence === 'number' ? { confidence: provenance.confidence } : {}),
    ...(provenance.realDataStatus ? { realDataStatus: provenance.realDataStatus } : {}),
    ...(typeof provenance.validatorCount === 'number'
      ? { validatorCount: provenance.validatorCount }
      : {}),
    ...(provenance.originalFormula ? { originalFormula: provenance.originalFormula } : {}),
    ...(provenance.extractionMethod ? { extractionMethod: provenance.extractionMethod } : {}),
    ...(provenance.reason ? { reason: provenance.reason } : {}),
    ...(typeof provenance.permanent === 'boolean' ? { permanent: provenance.permanent } : {}),
    staleness,
    isVerified:
      Boolean(provenance.verifiedAt || provenance.verifiedBy) ||
      provenance.tier === 'OFFICIAL' ||
      provenance.tier === 'PARTNER',
    predictionEligible: isPredictionEligibleTrustTier(provenance.tier),
  };
}
