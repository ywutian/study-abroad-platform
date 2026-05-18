export type TrustTier =
  | 'OFFICIAL'
  | 'PARTNER'
  | 'SCRAPED'
  | 'SEED'
  | 'COMMUNITY'
  | 'INFERRED'
  | 'UNAVAILABLE';

export type ProvenanceStaleness = 'FRESH' | 'AGING' | 'STALE';

export type RealDataStatus =
  | 'VERIFIED_REAL'
  | 'PARTIAL_REAL'
  | 'OFFICIAL_BLANK'
  | 'OFFICIAL_BLOCKED'
  | 'NO_PUBLIC_REAL_DATA'
  | 'MANUAL_REVIEW'
  | 'PERMANENT_HEURISTIC';

/**
 * Whether a provenance entry reflects a real recorded source, or was
 * synthesized at read time as a placeholder for a field that has a value but
 * no recorded provenance. Absent ⇒ treat as 'RECORDED' (legacy data).
 *
 * SYNTHESIZED entries must never claim a specific source, date, or freshness —
 * they exist only so the UI can render an honest "unverified" state.
 */
export type ProvenanceOrigin = 'RECORDED' | 'SYNTHESIZED';

export interface FieldProvenance {
  tier: TrustTier;
  source: string;
  fetchedAt: string;
  origin?: ProvenanceOrigin;
  verifiedAt?: string;
  verifiedBy?: string;
  sourceUrl?: string;
  cycleYear?: number;
  notes?: string;
  confidence?: number;
  staleness?: ProvenanceStaleness;
  realDataStatus?: RealDataStatus;
  validatorCount?: number;
  originalFormula?: string;
  extractionMethod?: string;
  reason?: string;
  permanent?: boolean;
}

export type SchoolProvenance = Partial<Record<string, FieldProvenance>>;

export interface SchoolFieldSource {
  tier: TrustTier;
  source: string;
  fetchedAt: string;
  origin?: ProvenanceOrigin;
  verifiedAt?: string;
  verifiedBy?: string;
  sourceUrl?: string;
  cycleYear?: number;
  notes?: string;
  confidence?: number;
  staleness: ProvenanceStaleness;
  realDataStatus?: RealDataStatus;
  validatorCount?: number;
  originalFormula?: string;
  extractionMethod?: string;
  reason?: string;
  permanent?: boolean;
  isVerified: boolean;
  predictionEligible: boolean;
}

export type SchoolFieldSources = Record<string, SchoolFieldSource>;
