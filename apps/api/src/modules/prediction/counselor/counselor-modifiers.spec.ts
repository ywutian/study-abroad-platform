import type { ProfileInput, SchoolInput } from '../prediction.prompts';
import {
  athleteMultiplier,
  gpaBandMultiplier,
  intlMultiplier,
  legacyHookMultiplier,
  profileContextMultiplier,
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

const baseSchool = (overrides: Partial<SchoolInput> = {}): SchoolInput => ({
  id: 'school-1',
  name: 'Test University',
  acceptanceRate: 0.1,
  sat25: 1400,
  sat75: 1520,
  act25: 30,
  act75: 34,
  testingPolicy: 'OPTIONAL',
  ...overrides,
});

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

    it('does not use launch SAT placeholder bands for GPA fallback', () => {
      const result = gpaBandMultiplier(
        baseProfile({ gpa: 4.0 }),
        baseSchool({
          sat25: 1080,
          sat75: 1320,
          gpaDistribution: undefined,
        }),
      );

      expect(result.multiplier).toBe(1);
      expect(result.label).toBe('GPA');
      expect(result.evidence).toContain('no school percentile data');
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

    it('does not use launch SAT placeholder bands for submitted SAT', () => {
      const result = testBandMultiplier(
        baseProfile({ testScores: [{ type: 'SAT', score: 1500 }] }),
        baseSchool({
          sat25: 1080,
          sat75: 1320,
          act25: null,
          act75: null,
        }),
      );

      expect(result.multiplier).toBe(1);
      expect(result.label).toBe('Test score');
      expect(result.evidence).toContain('no school percentile data');
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

  // 2026-05: `needBlindInternational` defaults to `false` in the DB even when
  // we haven't reviewed a school. Treat verified-true as the only
  // "definitely-need-blind" branch; everything else uses a midpoint between
  // need-blind and need-aware. See docs/PREDICTION_ACCURACY_STRATEGY.md.
  describe('intlMultiplier — need-blind verification semantics', () => {
    const intlProfile: ProfileInput = {
      gpa: 3.85,
      gpaScale: 4,
      testScores: [],
      activities: [],
      awards: [],
      isInternational: true,
    };

    it('uses verified need-blind branch when needBlindInternational === true', () => {
      const result = intlMultiplier(intlProfile, {
        ...baseSchool(),
        acceptanceRate: 0.05,
        needBlindInternational: true,
      });

      expect(result.multiplier).toBeCloseTo(0.5, 3);
      expect(result.label).toContain('need-blind');
    });

    it('uses verified need-aware branch when needBlindInternational === false at elite schools', () => {
      const result = intlMultiplier(intlProfile, {
        ...baseSchool(),
        acceptanceRate: 0.05,
        needBlindInternational: false,
      });

      expect(result.multiplier).toBeCloseTo(0.45, 3);
      expect(result.label).toContain('need-aware');
      expect(result.label).not.toContain('unverified');
    });

    it('uses unverified midpoint at elite schools when status is null', () => {
      const result = intlMultiplier(intlProfile, {
        ...baseSchool(),
        acceptanceRate: 0.05,
        needBlindInternational: null,
      });

      expect(result.multiplier).toBeCloseTo(0.48, 3);
      expect(result.label).toContain('unverified');
    });

    it('uses verified need-aware branch at highly-selective schools', () => {
      const result = intlMultiplier(intlProfile, {
        ...baseSchool(),
        acceptanceRate: 0.15,
        needBlindInternational: false,
      });

      expect(result.multiplier).toBeCloseTo(0.75, 3);
      expect(result.label).toContain('need-aware');
    });

    it('uses unverified midpoint at highly-selective schools when status is null', () => {
      const result = intlMultiplier(intlProfile, {
        ...baseSchool(),
        acceptanceRate: 0.15,
        needBlindInternational: null,
      });

      expect(result.multiplier).toBeCloseTo(0.78, 3);
      expect(result.label).toContain('unverified');
    });

    it('uses verified need-aware branch at moderately-selective schools', () => {
      const result = intlMultiplier(intlProfile, {
        ...baseSchool(),
        acceptanceRate: 0.3,
        needBlindInternational: false,
      });

      expect(result.multiplier).toBeCloseTo(0.7, 3);
      expect(result.label).toContain('need-aware');
    });

    it('uses unverified midpoint at moderately-selective schools when status is null', () => {
      const result = intlMultiplier(intlProfile, {
        ...baseSchool(),
        acceptanceRate: 0.3,
        needBlindInternational: null,
      });

      expect(result.multiplier).toBeCloseTo(0.78, 3);
      expect(result.label).toContain('unverified');
    });
  });

  describe('accuracy-first profile context multiplier', () => {
    it('keeps missing profile signals neutral and records gaps', () => {
      const result = profileContextMultiplier(baseProfile(), baseSchool());

      expect(result.multiplier).toBe(1);
      expect(result.profileSignals.missingGaps).toEqual(
        expect.arrayContaining([
          'grade-level GPA trend',
          'activities',
          'awards',
          'high school context',
        ]),
      );
      expect(result.profileSignals.ignoredByPolicy).toContain('URM status');
    });

    it('applies a small positive multiplier for rising GPA trend', () => {
      const result = profileContextMultiplier(
        baseProfile({
          gpaTrend: {
            direction: 'rising',
            delta: 0.4,
            evidence: 'G9 3.50 → G11 3.90',
          },
        }),
        baseSchool(),
      );

      expect(result.components.gpaTrend.multiplier).toBe(1.06);
      expect(result.multiplier).toBeGreaterThan(1);
      expect(result.profileSignals.usedInProbability).toContain('gpaTrend');
    });

    it('uses strong structured activities conservatively', () => {
      const result = profileContextMultiplier(
        baseProfile({
          targetMajor: 'Computer Science',
          activities: [
            {
              name: 'Research',
              category: 'RESEARCH',
              role: 'Founder',
              tier: 1,
              hoursPerWeek: 8,
              weeksPerYear: 40,
              annualHours: 320,
            },
            {
              name: 'Robotics',
              category: 'ACADEMIC',
              role: 'Captain',
              tier: 2,
              hoursPerWeek: 6,
              weeksPerYear: 35,
              annualHours: 210,
            },
            {
              name: 'Coding Club',
              category: 'CLUB',
              role: 'Lead',
              tier: 3,
              hoursPerWeek: 3,
              weeksPerYear: 30,
            },
          ],
        }),
        baseSchool(),
      );

      expect(result.components.activityStrength.multiplier).toBeGreaterThan(1);
      expect(result.components.activityStrength.multiplier).toBeLessThanOrEqual(
        1.06,
      );
      expect(result.profileSignals.usedInProbability).toContain(
        'activityStrength',
      );
    });

    it('uses national awards conservatively', () => {
      const result = profileContextMultiplier(
        baseProfile({
          awards: [
            {
              name: 'National Olympiad',
              level: 'NATIONAL',
              tier: 5,
              competitionName: 'Olympiad',
            },
          ],
        }),
        baseSchool(),
      );

      expect(result.components.awardStrength.multiplier).toBe(1.07);
      expect(result.profileSignals.usedInProbability).toContain(
        'awardStrength',
      );
    });

    it('does not penalize low-tier high school context', () => {
      const result = profileContextMultiplier(
        baseProfile({
          highSchoolTier: 1,
          highSchoolRecognition: 1,
          highSchoolPlacementRecord: 1,
          highSchoolImpactEnabled: true,
        }),
        baseSchool({ acceptanceRate: 0.05 }),
      );

      expect(result.components.highSchoolContext.multiplier).toBe(1);
    });

    it('applies English readiness only to international applicants', () => {
      const domestic = profileContextMultiplier(
        baseProfile({
          isInternational: false,
          englishProficiency: {
            type: 'TOEFL',
            score: 80,
            normalized: 80 / 120,
          },
        }),
        baseSchool(),
      );
      const international = profileContextMultiplier(
        baseProfile({
          isInternational: true,
          englishProficiency: {
            type: 'TOEFL',
            score: 80,
            normalized: 80 / 120,
          },
        }),
        baseSchool(),
      );

      expect(domestic.components.englishReadiness.multiplier).toBe(1);
      expect(international.components.englishReadiness.multiplier).toBe(0.96);
    });

    it('applies a tiny penalty when international applicant has no English score', () => {
      // 2026-05: missing TOEFL/IELTS for an international applicant now gets
      // 0.98× (was 1.0). Domestic applicants still get neutral.
      const internationalMissing = profileContextMultiplier(
        baseProfile({
          isInternational: true,
          // intentionally no englishProficiency
        }),
        baseSchool(),
      );
      const domesticMissing = profileContextMultiplier(
        baseProfile({
          isInternational: false,
        }),
        baseSchool(),
      );

      expect(internationalMissing.components.englishReadiness.multiplier).toBe(
        0.98,
      );
      expect(domesticMissing.components.englishReadiness.multiplier).toBe(1);
    });

    it('distinguishes verified need-aware from unreviewed financial-aid context', () => {
      const profile = baseProfile({
        isInternational: true,
        needsFinancialAid: true,
      });

      const verifiedNeedAware = profileContextMultiplier(
        profile,
        baseSchool({ acceptanceRate: 0.15, needBlindInternational: false }),
      );
      const unreviewed = profileContextMultiplier(
        profile,
        baseSchool({ acceptanceRate: 0.15, needBlindInternational: null }),
      );

      expect(verifiedNeedAware.components.financialAidContext.multiplier).toBe(
        0.95,
      );
      expect(unreviewed.components.financialAidContext.multiplier).toBe(0.975);
      expect(
        verifiedNeedAware.components.financialAidContext.evidence,
      ).toContain('verified need-aware');
      expect(unreviewed.components.financialAidContext.evidence).toContain(
        'unreviewed',
      );
    });

    it('clamps combined profile context to the accuracy-first range', () => {
      const result = profileContextMultiplier(
        baseProfile({
          targetMajor: 'Computer Science',
          gpaTrend: {
            direction: 'rising',
            delta: 0.5,
            evidence: 'G9 3.40 → G12 3.95',
          },
          highSchoolTier: 5,
          highSchoolRecognition: 5,
          highSchoolPlacementRecord: 5,
          highSchoolImpactEnabled: true,
          isInternational: true,
          needsFinancialAid: false,
          englishProficiency: {
            type: 'TOEFL',
            score: 116,
            normalized: 116 / 120,
          },
          activities: [
            {
              name: 'Research',
              category: 'RESEARCH',
              role: 'Founder',
              tier: 1,
              annualHours: 400,
            },
          ],
          awards: [{ name: 'IMO', level: 'INTERNATIONAL', tier: 5 }],
        }),
        baseSchool({ acceptanceRate: 0.04, sat25: 1510, sat75: 1560 }),
      );

      expect(result.multiplier).toBeLessThanOrEqual(1.08);
      expect(result.multiplier).toBeGreaterThan(1);
    });
  });
});
