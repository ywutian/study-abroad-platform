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

export interface FieldProvenance {
  tier: TrustTier;
  source: string;
  fetchedAt: string;
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
