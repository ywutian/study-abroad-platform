import type {
  FieldProvenance,
  ProvenanceStaleness,
  SchoolFieldSource,
  SchoolProvenance,
  TrustTier,
} from '../types/school-provenance';

const OFFICIAL_SOURCE_TOKENS = ['COLLEGE_SCORECARD', 'URBAN_INSTITUTE', 'IPEDS'];
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
};

export function isPredictionEligibleTrustTier(tier: TrustTier): boolean {
  return TRUST_TIER_PREDICTION_WEIGHT[tier] > 0;
}

export function deriveTrustTierFromSource(source: string): TrustTier {
  const normalized = source.trim().toUpperCase();

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

export function normalizeFieldProvenance(value: unknown, now = new Date()): FieldProvenance | null {
  const entry = toRecord(value);
  const source = typeof entry.source === 'string' ? entry.source : undefined;
  const fetchedAt =
    typeof entry.fetchedAt === 'string'
      ? entry.fetchedAt
      : typeof entry.at === 'string'
        ? entry.at
        : undefined;

  if (!source || !fetchedAt) {
    return null;
  }

  const tier =
    typeof entry.tier === 'string'
      ? (entry.tier.toUpperCase() as TrustTier)
      : deriveTrustTierFromSource(source);
  const confidence =
    typeof entry.confidence === 'number' ? Math.min(1, Math.max(0, entry.confidence)) : undefined;

  return {
    tier,
    source,
    fetchedAt,
    verifiedAt: typeof entry.verifiedAt === 'string' ? entry.verifiedAt : undefined,
    verifiedBy: typeof entry.verifiedBy === 'string' ? entry.verifiedBy : undefined,
    sourceUrl: typeof entry.sourceUrl === 'string' ? entry.sourceUrl : undefined,
    cycleYear: typeof entry.cycleYear === 'number' ? entry.cycleYear : undefined,
    notes: typeof entry.notes === 'string' ? entry.notes : undefined,
    confidence: tier === 'INFERRED' ? confidence : undefined,
    staleness: deriveProvenanceStaleness(fetchedAt, now),
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
    ...(provenance.tier === 'INFERRED' && typeof provenance.confidence === 'number'
      ? { confidence: provenance.confidence }
      : {}),
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
    staleness,
    isVerified:
      Boolean(provenance.verifiedAt || provenance.verifiedBy) ||
      provenance.tier === 'OFFICIAL' ||
      provenance.tier === 'PARTNER',
    predictionEligible: isPredictionEligibleTrustTier(provenance.tier),
  };
}
