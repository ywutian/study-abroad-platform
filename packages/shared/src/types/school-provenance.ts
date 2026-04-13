export type TrustTier = 'OFFICIAL' | 'PARTNER' | 'SCRAPED' | 'SEED' | 'COMMUNITY' | 'INFERRED';

export type ProvenanceStaleness = 'FRESH' | 'AGING' | 'STALE';

export interface FieldProvenance {
  tier: TrustTier;
  source: string;
  fetchedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  confidence?: number;
  staleness?: ProvenanceStaleness;
}

export type SchoolProvenance = Partial<Record<string, FieldProvenance>>;

export interface SchoolFieldSource {
  tier: TrustTier;
  source: string;
  fetchedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  confidence?: number;
  staleness: ProvenanceStaleness;
  isVerified: boolean;
  predictionEligible: boolean;
}

export type SchoolFieldSources = Record<string, SchoolFieldSource>;
