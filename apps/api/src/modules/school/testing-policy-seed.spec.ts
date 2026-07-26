import { TestingPolicy } from '@prisma/client';
import {
  TESTING_POLICIES,
  TESTING_POLICY_SOURCE,
} from '../../../prisma/seed-testing-policy-2026-07-25';

/**
 * Structural guard for the testing-policy table.
 *
 * These values drive `testBandMultiplier`: a wrong REQUIRED multiplies a
 * no-score applicant's probability by 0.1. That is not something to discover
 * from a user report — especially since a hand-edit to this file has no other
 * check on it.
 *
 * Deliberately does NOT assert individual policies. Those are facts about the
 * world that change every cycle; pinning them here would just mean editing two
 * files instead of one. What is pinned is that every row is well-formed and
 * traceable to a source.
 */
describe('testing-policy seed table', () => {
  it('has no duplicate schools', () => {
    const counts = new Map<string, number>();
    for (const row of TESTING_POLICIES) {
      counts.set(row.nameNorm, (counts.get(row.nameNorm) ?? 0) + 1);
    }
    expect([...counts].filter(([, n]) => n > 1)).toEqual([]);
  });

  it('uses only values the TestingPolicy enum defines', () => {
    const valid = Object.keys(TestingPolicy);
    const invalid = TESTING_POLICIES.filter((r) => !valid.includes(r.policy));
    expect(invalid.map((r) => `${r.nameNorm}: ${r.policy}`)).toEqual([]);
  });

  // UNKNOWN is the column default and means "not on record". Writing it back
  // would be a no-op row that reads like a verified finding.
  it('never writes UNKNOWN — that is the absence of a value, not a value', () => {
    expect(
      TESTING_POLICIES.filter((r) => r.policy === 'UNKNOWN').map(
        (r) => r.nameNorm,
      ),
    ).toEqual([]);
  });

  it('carries a resolvable https source for every row', () => {
    const bad = TESTING_POLICIES.filter(
      (r) => !/^https:\/\/[^\s]+$/.test(r.sourceUrl),
    );
    expect(bad.map((r) => `${r.nameNorm}: ${r.sourceUrl}`)).toEqual([]);
  });

  // The note records the wording the policy was read from. Without it a future
  // reader cannot tell a verified value from a guess.
  it('carries evidence text for every row', () => {
    const thin = TESTING_POLICIES.filter((r) => (r.note ?? '').length < 20);
    expect(thin.map((r) => r.nameNorm)).toEqual([]);
  });

  it('normalizes school names the way nameNorm lookups expect', () => {
    const wrong = TESTING_POLICIES.filter(
      (r) => r.nameNorm !== r.nameNorm.trim().toLowerCase(),
    );
    expect(wrong.map((r) => r.nameNorm)).toEqual([]);
  });

  // The seed writes this token into provenance; school-data-merger ranks it
  // above the bulk aggregators. If they drift apart, a Scorecard sync silently
  // reverts every row here — the failure mode fixed on 2026-07-24.
  it('stamps a provenance source that the merger protects', () => {
    expect(TESTING_POLICY_SOURCE).toBe('OFFICIAL_ADMISSIONS_PAGE');
  });
});
