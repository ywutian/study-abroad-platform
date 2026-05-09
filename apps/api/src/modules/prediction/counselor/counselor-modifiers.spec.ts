import type { ProfileInput, SchoolInput } from '../prediction.prompts';
import {
  athleteMultiplier,
  gpaBandMultiplier,
  legacyHookMultiplier,
  roundMultiplier,
  testBandMultiplier,
} from './counselor-modifiers';

const baseProfile = (overrides: Partial<ProfileInput> = {}): ProfileInput => ({
  gpa: 3.85,
  gpaScale: 4,
  testScores: [],
  activities: [],
  awards: [],
  ...overrides,
});

const baseSchool = (overrides: Partial<SchoolInput> = {}): SchoolInput =>
  ({
    id: 'school-1',
    name: 'Test University',
    acceptanceRate: 0.1,
    sat25: 1400,
    sat75: 1520,
    act25: 30,
    act75: 34,
    testingPolicy: 'OPTIONAL',
    ...overrides,
  }) as SchoolInput;

describe('counselor modifiers launch guards', () => {
  describe('gpaBandMultiplier with CDS C9 distribution', () => {
    it('uses the v4 step percentile formula and right-open GPA bands', () => {
      const result = gpaBandMultiplier(
        baseProfile({ gpa: 3.75 }),
        baseSchool({
          gpaDistribution: {
            '<3.00': 0.5,
            '3.00-3.24': 0.2,
            '3.25-3.49': 0.6,
            '3.50-3.74': 4.1,
            '3.75-4.00': 94.6,
          },
        }),
      );

      expect(result.label).toContain('school-published');
      expect(result.multiplier).toBeCloseTo(0.4 + 0.7 * (0.054 + 0.946 / 2), 3);
    });

    it('falls back to GPA-to-SAT logic when distribution sum is invalid', () => {
      const result = gpaBandMultiplier(
        baseProfile({ gpa: 4.0 }),
        baseSchool({
          sat25: 1450,
          sat75: 1520,
          gpaDistribution: {
            '<3.00': 0.1,
            '3.00-3.24': 0.1,
            '3.25-3.49': 0.1,
            '3.50-3.74': 0.1,
            '3.75-4.00': 0.1,
          },
        }),
      );

      expect(result.label).toBe('GPA above 75th percentile');
      expect(result.multiplier).toBe(1.3);
    });
  });

  describe('testBandMultiplier testingPolicy and ACT handling', () => {
    it('ignores SAT/ACT at test-blind schools', () => {
      const result = testBandMultiplier(
        baseProfile({ testScores: [{ type: 'SAT', score: 1560 }] }),
        baseSchool({ testingPolicy: 'BLIND' }),
      );

      expect(result.multiplier).toBe(1);
      expect(result.label).toContain('Test-blind');
    });

    it('penalizes missing scores at test-required schools', () => {
      const result = testBandMultiplier(
        baseProfile({ testScores: [] }),
        baseSchool({ testingPolicy: 'REQUIRED' }),
      );

      expect(result.multiplier).toBe(0.1);
      expect(result.label).toContain('Missing required');
    });

    it('applies implicit no-score penalty at selective test-optional schools', () => {
      const result = testBandMultiplier(
        baseProfile({ testScores: [] }),
        baseSchool({ testingPolicy: 'OPTIONAL', acceptanceRate: 0.05 }),
      );

      expect(result.multiplier).toBe(0.85);
      expect(result.label).toContain('highly selective test-optional');
    });

    it('compares ACT directly against act25/act75 when available', () => {
      const result = testBandMultiplier(
        baseProfile({ testScores: [{ type: 'ACT', score: 34 }] }),
        baseSchool({
          sat25: 1000,
          sat75: 1100,
          act25: 30,
          act75: 34,
        }),
      );

      expect(result.multiplier).toBe(1.2);
      expect(result.evidence).toContain('ACT 34');
    });
  });

  describe('roundMultiplier data and availability guards', () => {
    it('clamps real ED/EA ratios to 3.5x', () => {
      const result = roundMultiplier(
        'ED',
        baseSchool({ acceptanceRate: 0.05, edAcceptanceRate: 0.5 }),
      );

      expect(result.multiplier).toBe(3.5);
      expect(result.label).toContain('school-published');
    });

    it('neutralizes published round rates below overall admit rate', () => {
      const result = roundMultiplier(
        'EA',
        baseSchool({ acceptanceRate: 0.1, eaAcceptanceRate: 0.05 }),
      );

      expect(result.multiplier).toBe(1);
      expect(result.label).toContain('data anomaly');
    });

    it('neutralizes unsupported rounds before heuristic fallback', () => {
      const result = roundMultiplier(
        'ED',
        baseSchool({ hasEarlyDecision: false }),
      );

      expect(result.multiplier).toBe(1);
      expect(result.label).toContain('does not offer Early Decision');
    });
  });

  describe('unchecked hook boosts', () => {
    it('does not apply self-reported legacy boost without evidence', () => {
      const result = legacyHookMultiplier(
        baseProfile({
          isLegacy: true,
          legacySchools: ['Test University'],
        }),
        baseSchool(),
      );

      expect(result.multiplier).toBe(1);
      expect(result.label).toContain('evidence required');
    });

    it('does not apply self-reported recruited-athlete boost without evidence', () => {
      const result = athleteMultiplier(baseProfile({ recruitedAthlete: true }));

      expect(result.multiplier).toBe(1);
      expect(result.label).toContain('evidence required');
    });
  });
});
