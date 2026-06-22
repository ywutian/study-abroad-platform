import { describe, expect, it } from 'vitest';

import {
  isSchoolTestingPolicy,
  matchesLegacyTestOptionalFilter,
  resolveSchoolTestingPolicyValue,
  toLegacyTestOptionalFlag,
} from './school-policy';

describe('isSchoolTestingPolicy', () => {
  it('accepts the four valid policies', () => {
    for (const p of ['REQUIRED', 'OPTIONAL', 'BLIND', 'UNKNOWN']) {
      expect(isSchoolTestingPolicy(p)).toBe(true);
    }
  });

  it('rejects anything else (case-sensitive, no test-flexible)', () => {
    expect(isSchoolTestingPolicy('TEST_FLEXIBLE')).toBe(false);
    expect(isSchoolTestingPolicy('optional')).toBe(false);
    expect(isSchoolTestingPolicy(null)).toBe(false);
    expect(isSchoolTestingPolicy(123)).toBe(false);
  });
});

describe('resolveSchoolTestingPolicyValue', () => {
  it('preserves an explicit policy — incl. UNKNOWN (gold case 007)', () => {
    expect(resolveSchoolTestingPolicyValue({ testingPolicy: 'BLIND' })).toBe('BLIND');
    // explicit UNKNOWN must NOT be inferred away even when testOptional is set
    expect(resolveSchoolTestingPolicyValue({ testingPolicy: 'UNKNOWN', testOptional: true })).toBe(
      'UNKNOWN'
    );
  });

  it('infers from testOptional only when no explicit policy', () => {
    expect(resolveSchoolTestingPolicyValue({ testOptional: true })).toBe('OPTIONAL');
    expect(resolveSchoolTestingPolicyValue({ testOptional: false })).toBe('REQUIRED');
    expect(resolveSchoolTestingPolicyValue({})).toBe('UNKNOWN');
  });
});

describe('toLegacyTestOptionalFlag', () => {
  it('maps explicit policies to the legacy boolean (BLIND -> false)', () => {
    expect(toLegacyTestOptionalFlag({ testingPolicy: 'OPTIONAL' })).toBe(true);
    expect(toLegacyTestOptionalFlag({ testingPolicy: 'REQUIRED' })).toBe(false);
    expect(toLegacyTestOptionalFlag({ testingPolicy: 'BLIND' })).toBe(false);
  });

  it('falls back to the raw testOptional for UNKNOWN, else undefined', () => {
    expect(
      toLegacyTestOptionalFlag({ testingPolicy: 'UNKNOWN', testOptional: null })
    ).toBeUndefined();
    expect(toLegacyTestOptionalFlag({})).toBeUndefined();
  });
});

describe('matchesLegacyTestOptionalFilter', () => {
  it('matches OPTIONAL policies, not REQUIRED/BLIND', () => {
    expect(matchesLegacyTestOptionalFilter({ testingPolicy: 'OPTIONAL' })).toBe(true);
    expect(matchesLegacyTestOptionalFilter({ testingPolicy: 'REQUIRED' })).toBe(false);
    expect(matchesLegacyTestOptionalFilter({ testingPolicy: 'BLIND' })).toBe(false);
  });

  it('for explicit UNKNOWN, matches only when testOptional is exactly true', () => {
    expect(matchesLegacyTestOptionalFilter({ testingPolicy: 'UNKNOWN', testOptional: true })).toBe(
      true
    );
    expect(matchesLegacyTestOptionalFilter({ testingPolicy: 'UNKNOWN', testOptional: false })).toBe(
      false
    );
  });
});
