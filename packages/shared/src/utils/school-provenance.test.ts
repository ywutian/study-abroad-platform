import { describe, expect, it } from 'vitest';

import {
  TRUST_TIER_PREDICTION_WEIGHT,
  deriveProvenanceStaleness,
  deriveTrustTierFromSource,
  isPredictionEligibleTrustTier,
  normalizeFieldProvenance,
  normalizeSchoolProvenance,
  serializeFieldProvenance,
  toSchoolFieldSource,
} from './school-provenance';

const NOW = new Date('2026-06-22T00:00:00Z');
const FRESH = '2026-05-01T00:00:00Z';

describe('isPredictionEligibleTrustTier', () => {
  it('is true exactly for tiers whose weight is > 0', () => {
    const tiers = Object.keys(
      TRUST_TIER_PREDICTION_WEIGHT
    ) as (keyof typeof TRUST_TIER_PREDICTION_WEIGHT)[];
    for (const tier of tiers) {
      expect(isPredictionEligibleTrustTier(tier)).toBe(TRUST_TIER_PREDICTION_WEIGHT[tier] > 0);
    }
    expect(isPredictionEligibleTrustTier('OFFICIAL')).toBe(true);
    expect(isPredictionEligibleTrustTier('COMMUNITY')).toBe(false);
  });
});

describe('deriveTrustTierFromSource', () => {
  it('classifies by token, case-insensitively', () => {
    expect(deriveTrustTierFromSource('ipeds')).toBe('OFFICIAL');
    expect(deriveTrustTierFromSource('College_Scorecard')).toBe('OFFICIAL');
    expect(deriveTrustTierFromSource('MANUAL_ADMIN')).toBe('PARTNER');
    expect(deriveTrustTierFromSource('bigfuture')).toBe('SCRAPED');
    expect(deriveTrustTierFromSource('community')).toBe('COMMUNITY');
    expect(deriveTrustTierFromSource('ai_gpt5')).toBe('INFERRED');
    expect(deriveTrustTierFromSource('seed')).toBe('SEED');
  });

  it('defaults unknown sources to SEED', () => {
    expect(deriveTrustTierFromSource('totally-unknown')).toBe('SEED');
  });

  it('prioritizes UNAVAILABLE over OFFICIAL for OFFICIAL_BLANK (token precedence)', () => {
    expect(deriveTrustTierFromSource('OFFICIAL_BLANK')).toBe('UNAVAILABLE');
  });
});

describe('deriveProvenanceStaleness', () => {
  it('is FRESH < 180d, AGING <= 365d, STALE beyond', () => {
    expect(deriveProvenanceStaleness(FRESH, NOW)).toBe('FRESH');
    expect(deriveProvenanceStaleness('2025-09-01T00:00:00Z', NOW)).toBe('AGING');
    expect(deriveProvenanceStaleness('2024-01-01T00:00:00Z', NOW)).toBe('STALE');
  });

  it('treats an unparseable date as STALE', () => {
    expect(deriveProvenanceStaleness('not-a-date', NOW)).toBe('STALE');
  });
});

describe('normalizeFieldProvenance', () => {
  it('returns null without a source or fetchedAt', () => {
    expect(normalizeFieldProvenance({}, NOW)).toBeNull();
    expect(normalizeFieldProvenance({ source: 'IPEDS' }, NOW)).toBeNull();
    expect(normalizeFieldProvenance(null, NOW)).toBeNull();
  });

  it('builds a field provenance with derived tier + staleness', () => {
    expect(normalizeFieldProvenance({ source: 'IPEDS', fetchedAt: FRESH }, NOW)).toMatchObject({
      tier: 'OFFICIAL',
      source: 'IPEDS',
      staleness: 'FRESH',
    });
  });

  it('derives source CLOSURE_V2 from a closure-v2 verifiedBy when source is absent', () => {
    expect(
      normalizeFieldProvenance({ verifiedBy: 'closure-v2-run', fetchedAt: FRESH }, NOW)?.source
    ).toBe('CLOSURE_V2');
  });

  it('clamps confidence into [0,1]', () => {
    expect(
      normalizeFieldProvenance({ source: 'IPEDS', fetchedAt: FRESH, confidence: 2 }, NOW)
        ?.confidence
    ).toBe(1);
    expect(
      normalizeFieldProvenance({ source: 'IPEDS', fetchedAt: FRESH, confidence: -3 }, NOW)
        ?.confidence
    ).toBe(0);
  });

  it('accepts `at` as a fetchedAt fallback', () => {
    expect(normalizeFieldProvenance({ source: 'IPEDS', at: FRESH }, NOW)).not.toBeNull();
  });
});

describe('normalizeSchoolProvenance', () => {
  it('keeps valid field entries and drops malformed ones', () => {
    const result = normalizeSchoolProvenance(
      {
        acceptanceRate: { source: 'IPEDS', fetchedAt: FRESH },
        satAvg: { tier: 'OFFICIAL' },
      },
      NOW
    );
    expect(Object.keys(result)).toEqual(['acceptanceRate']);
  });

  it('returns {} for non-object input', () => {
    expect(normalizeSchoolProvenance(null, NOW)).toEqual({});
    expect(normalizeSchoolProvenance([1, 2], NOW)).toEqual({});
  });
});

describe('serializeFieldProvenance', () => {
  it('drops the derived staleness field but keeps the core', () => {
    const p = normalizeFieldProvenance({ source: 'IPEDS', fetchedAt: FRESH }, NOW)!;
    const s = serializeFieldProvenance(p);
    expect(s).not.toHaveProperty('staleness');
    expect(s.tier).toBe('OFFICIAL');
    expect(s.source).toBe('IPEDS');
  });
});

describe('toSchoolFieldSource', () => {
  it('marks an OFFICIAL fresh entry verified + prediction-eligible', () => {
    const p = normalizeFieldProvenance({ source: 'IPEDS', fetchedAt: FRESH }, NOW)!;
    const s = toSchoolFieldSource(p, NOW);
    expect(s.isVerified).toBe(true);
    expect(s.predictionEligible).toBe(true);
    expect(s.staleness).toBe('FRESH');
  });

  it('never trusts a SYNTHESIZED placeholder', () => {
    const p = normalizeFieldProvenance(
      { source: 'IPEDS', fetchedAt: FRESH, origin: 'SYNTHESIZED' },
      NOW
    )!;
    const s = toSchoolFieldSource(p, NOW);
    expect(s.staleness).toBe('STALE');
    expect(s.isVerified).toBe(false);
    expect(s.predictionEligible).toBe(false);
  });

  it('an INFERRED-tier field is not prediction-eligible', () => {
    const p = normalizeFieldProvenance({ source: 'inferred', fetchedAt: FRESH }, NOW)!;
    expect(toSchoolFieldSource(p, NOW).predictionEligible).toBe(false);
  });
});
