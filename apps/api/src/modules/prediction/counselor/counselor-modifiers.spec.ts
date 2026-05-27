import type { ProfileInput, SchoolInput } from '../prediction.prompts';
import {
  athleteMultiplier,
  geoMultiplier,
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
      // 2026-05-24 curve recalibration: was 0.4 + 0.7 * pct (median maps to
      // 0.75, a hidden penalty); now 0.5 + pct so median = 1.0 neutral.
      expect(result.multiplier).toBeCloseTo(0.5 + (0.054 + 0.946 / 2), 3);
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

  // closure-v2: GPA is calibrated by the high school's course-rigor rating
  // (rigor-in-context) — only on the equivSat heuristic path, only when
  // highSchoolAcademicRigor is set.
  describe('gpaBandMultiplier — academic-rigor calibration', () => {
    it('lifts the GPA multiplier at a high-rigor (grade-deflation) school', () => {
      const baseline = gpaBandMultiplier(
        baseProfile({ gpa: 3.85 }),
        baseSchool({ gpaDistribution: undefined }),
      );
      const withRigor = gpaBandMultiplier(
        baseProfile({ gpa: 3.85, highSchoolAcademicRigor: 5 }),
        baseSchool({ gpaDistribution: undefined }),
      );
      expect(withRigor.multiplier).toBeGreaterThan(baseline.multiplier);
      // smooth ±9% post-band nudge — never flips a discrete band
      expect(withRigor.label).toBe(baseline.label);
      expect(withRigor.multiplier / baseline.multiplier).toBeCloseTo(1.09, 2);
    });

    it('lowers a GPA at a low-rigor (lenient) school', () => {
      const withRigor = gpaBandMultiplier(
        baseProfile({ gpa: 3.75, highSchoolAcademicRigor: 1 }),
        baseSchool({ gpaDistribution: undefined }),
      );
      expect(withRigor.multiplier).toBeLessThan(0.85);
    });

    it('is zero-drift when highSchoolAcademicRigor is unset', () => {
      const noRigor = gpaBandMultiplier(
        baseProfile({ gpa: 3.85 }),
        baseSchool({ gpaDistribution: undefined }),
      );
      expect(noRigor.label).toContain('below school median');
      expect(noRigor.multiplier).toBe(0.85);
    });

    it('does not apply rigor when highSchoolImpactEnabled is false', () => {
      const suppressed = gpaBandMultiplier(
        baseProfile({
          gpa: 3.85,
          highSchoolAcademicRigor: 5,
          highSchoolImpactEnabled: false,
        }),
        baseSchool({ gpaDistribution: undefined }),
      );
      expect(suppressed.multiplier).toBe(0.85); // identical to the unset case
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
          act25: null as any,
          act75: null as any,
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

    // closure-v2: yield-informed ED fallback (CDS C2).
    it('estimates the ED boost from CDS yield when no ED rate is published', () => {
      const lowYield = roundMultiplier(
        'ED',
        baseSchool({ acceptanceRate: 0.2, yieldRate: 25 }),
      );
      const highYield = roundMultiplier(
        'ED',
        baseSchool({ acceptanceRate: 0.2, yieldRate: 70 }),
      );

      expect(lowYield.label).toContain('yield-informed');
      expect(lowYield.multiplier).toBeGreaterThan(highYield.multiplier);
      expect(lowYield.multiplier).toBeLessThanOrEqual(3.2);
      expect(highYield.multiplier).toBeGreaterThanOrEqual(2.0);
    });

    it('prefers the published ED rate over the yield estimate', () => {
      const result = roundMultiplier(
        'ED',
        baseSchool({
          acceptanceRate: 0.1,
          edAcceptanceRate: 0.2,
          yieldRate: 25,
        }),
      );

      expect(result.label).toContain('school-published');
      expect(result.label).not.toContain('yield-informed');
    });

    it('falls back to the flat 2.5x ED heuristic when no yield is known', () => {
      const result = roundMultiplier('ED', baseSchool({ acceptanceRate: 0.1 }));

      expect(result.multiplier).toBe(2.5);
      expect(result.label).toBe('Early Decision');
    });
  });

  // closure-v2: geoMultiplier prefers an explicit state of residence over the
  // high-school location, and falls back to the legacy field when it is unset.
  describe('geoMultiplier — state of residence preference', () => {
    it('uses stateOfResidence over highSchoolLocation when both are present', () => {
      const result = geoMultiplier(
        baseProfile({
          isInternational: false,
          stateOfResidence: 'CA',
          highSchoolLocation: 'NY',
        }),
        baseSchool({ isPrivate: false, state: 'CA' }),
      );

      expect(result.label).toContain('In-state');
    });

    it('falls back to highSchoolLocation when stateOfResidence is unset', () => {
      const result = geoMultiplier(
        baseProfile({ isInternational: false, highSchoolLocation: 'CA' }),
        baseSchool({ isPrivate: false, state: 'CA' }),
      );

      expect(result.label).toContain('In-state');
    });

    it('classifies out-of-state by stateOfResidence even if HS is in-state', () => {
      const result = geoMultiplier(
        baseProfile({
          isInternational: false,
          stateOfResidence: 'NY',
          highSchoolLocation: 'CA',
        }),
        baseSchool({ isPrivate: false, state: 'CA' }),
      );

      expect(result.label).toContain('Out-of-state');
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
      // 2026-05-24 calibration: was capped at 1.06 (effectively noise).
      // Raised to 1.12 to give visible reward while staying within the
      // prediction-gate regression bounds on profile-signal delta.
      expect(result.components.activityStrength.multiplier).toBeLessThanOrEqual(
        1.12,
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

      // 2026-05-24 calibration: was 1.07 — far below NACAC/Crimson estimates
      // of 1.3-1.6× admit lift for national/international winners. Raised
      // to 1.13 (modest, bounded by outer profileContext cap so the
      // prediction-gate p95/max delta gates still pass).
      expect(result.components.awardStrength.multiplier).toBe(1.13);
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

      // 2026-05-24 calibration: outer cap was [0.95, 1.08] — too tight.
      // New cap [0.90, 1.13] balances rewarding strong profiles with the
      // prediction-gate regression bounds.
      expect(result.multiplier).toBeLessThanOrEqual(1.13);
      expect(result.multiplier).toBeGreaterThan(1);
    });
  });

  // closure-v2: the need-aware financial-aid penalty is refined by how much
  // demonstrated need the school actually meets (CDS H2 percentNeedMet).
  describe('financialAidContext — percentNeedMet refinement', () => {
    const aidProfile = (o: Partial<ProfileInput> = {}) =>
      baseProfile({ isInternational: true, needsFinancialAid: true, ...o });
    const needAware = (o: Partial<SchoolInput> = {}) =>
      baseSchool({ needBlindInternational: false, acceptanceRate: 0.1, ...o });
    const fac = (p: ProfileInput, s: SchoolInput) =>
      profileContextMultiplier(p, s).components.financialAidContext.multiplier;

    it('compounds the penalty at a gapping school (low % need met)', () => {
      expect(fac(aidProfile(), needAware({ percentNeedMet: 80 }))).toBeLessThan(
        fac(aidProfile(), needAware()),
      );
    });

    it('is zero-drift when percentNeedMet is unset', () => {
      expect(fac(aidProfile(), needAware())).toBeCloseTo(0.95, 5);
    });

    it('does not penalize further at a full-demonstrated-need school', () => {
      expect(fac(aidProfile(), needAware({ percentNeedMet: 100 }))).toBeCloseTo(
        0.95,
        5,
      );
    });

    it('stays neutral at a need-blind school regardless of percentNeedMet', () => {
      expect(
        fac(
          aidProfile(),
          needAware({ needBlindInternational: true, percentNeedMet: 70 }),
        ),
      ).toBe(1.0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Regression tests locking in past bug fixes.
  // Each test cites the original PR / audit that motivated the fix; the test
  // exists so the bug cannot silently come back. Removing one of these tests
  // requires re-reading the linked audit and confirming the underlying data /
  // schema invariant still holds.
  // ───────────────────────────────────────────────────────────────────────────
  describe('regression: past bug fixes', () => {
    // Bug #1 — SMU gpaDistribution bands summed to 110% (PR #295).
    // The fix lives in `normalizeGpaDistribution`: distributions whose
    // normalised total falls outside [0.95, 1.05] must be REJECTED so the
    // engine falls back to the heuristic equivSat path. If we silently used a
    // 110% distribution, percentile math overshoots 1.0 and the band
    // multiplier becomes unbounded.
    // Source: apps/api/scripts/closure-reports/overnight-2026-05-25/data-integrity-audit.md (Check 4)
    it('Bug #1 (PR #295): rejects gpaDistribution that sums to ~1.10 (SMU-style)', () => {
      // Synthetic distribution that totals 1.20 — engine must NOT use the
      // data-driven percentile path. With a 4.0 GPA and an SAT band of
      // 1340-1480, the heuristic fallback yields ×1.3 (above 75th pct).
      const result = gpaBandMultiplier(
        baseProfile({ gpa: 4.0 }),
        baseSchool({
          sat25: 1340,
          sat75: 1480,
          gpaDistribution: {
            '<3.00': 0.05,
            '3.00-3.24': 0.06,
            '3.25-3.49': 0.13,
            '3.50-3.74': 0.26,
            '3.75-4.00': 0.7, // sum = 1.20
          },
        }),
      );

      // Must fall back to heuristic, not data-driven percentile.
      expect(result.label).not.toContain('school-published');
      expect(result.label).toContain('GPA above 75th percentile');
      expect(result.multiplier).toBe(1.3);
    });

    it('Bug #1 (PR #295): rejects gpaDistribution that sums to ~0.80 (under-spec)', () => {
      const result = gpaBandMultiplier(
        baseProfile({ gpa: 3.85 }),
        baseSchool({
          sat25: 1340,
          sat75: 1480,
          gpaDistribution: {
            '<3.00': 0.05,
            '3.00-3.24': 0.05,
            '3.25-3.49': 0.1,
            '3.50-3.74': 0.2,
            '3.75-4.00': 0.4, // sum = 0.80
          },
        }),
      );
      expect(result.label).not.toContain('school-published');
    });

    // Bug #3 — UChicago edAcceptanceRate=0.16 stored as fraction not percent (PR #295).
    // Engine's `normalizeRate` must treat 0.16 (fraction) and 16 (percentage)
    // identically. If we read 0.16 as 0.16% (raw) the ED ratio becomes
    // 0.0016 / 0.05 = 0.03 → "data anomaly" instead of a real ED boost.
    // Source: apps/api/scripts/closure-reports/overnight-2026-05-25/data-integrity-audit.md (Check 3b)
    it('Bug #3 (PR #295): roundMultiplier normalizes fractional and percentage rates identically', () => {
      const fractional = roundMultiplier(
        'ED',
        baseSchool({
          acceptanceRate: 0.05, // 5% as fraction
          edAcceptanceRate: 0.18, // 18% as fraction
        }),
      );
      const percentage = roundMultiplier(
        'ED',
        baseSchool({
          acceptanceRate: 5, // 5% as percent
          edAcceptanceRate: 18, // 18% as percent
        }),
      );
      expect(fractional.multiplier).toBeCloseTo(percentage.multiplier, 4);
      expect(fractional.label).toContain('school-published');
      expect(percentage.label).toContain('school-published');
      // ratio = 18/5 = 3.6 → clamped to 3.5
      expect(fractional.multiplier).toBeCloseTo(3.5, 4);
    });

    it('Bug #3 (PR #295): mixed-convention inputs (fraction vs percent) still normalise', () => {
      // Overall stored as percent (5), ED stored as fraction (0.18) — the
      // engine MUST detect each independently. Pre-fix this produced ratio
      // 0.18/5 = 0.036 → "data anomaly" branch.
      const mixed = roundMultiplier(
        'ED',
        baseSchool({
          acceptanceRate: 5, // percent
          edAcceptanceRate: 0.18, // fraction
        }),
      );
      // Both normalise to 0.05 and 0.18, ratio = 3.6 → clamped 3.5
      expect(mixed.multiplier).toBeCloseTo(3.5, 4);
      expect(mixed.label).toContain('school-published');
    });

    // Bug #6 — Pomona ED2 + hasEarlyDecision2=false must NOT use ED1 rate (PR #295).
    // When a school offers ED1 only (hasEarlyDecision2=false), an ED2 attempt
    // must short-circuit to neutral — never re-use the ED1 admit rate as
    // an ED2 boost. Before the fix, the engine silently fell through to the
    // ED branch and applied the ED1 rate ratio to an applicant who could
    // not, in reality, even submit an ED2 application.
    // Source: PR #295 (closure-v2 hasEarlyDecision2 schema drift fix).
    it('Bug #6 (PR #295): ED2 round at hasEarlyDecision2=false school returns neutral', () => {
      const result = roundMultiplier(
        'ED2',
        baseSchool({
          acceptanceRate: 0.07,
          edAcceptanceRate: 0.16, // ED1 rate published
          hasEarlyDecision: true,
          hasEarlyDecision2: false,
        }),
      );
      // Must NOT apply ED1 rate as ED2 multiplier; explicit neutral guard.
      expect(result.multiplier).toBe(1.0);
      expect(result.label).toContain('Early Decision 2');
      expect(result.evidence).toMatch(/no ED2|treating as RD/i);
    });

    it('Bug #6 (PR #295): ED1 round at hasEarlyDecision=false school returns neutral', () => {
      const result = roundMultiplier(
        'ED',
        baseSchool({
          acceptanceRate: 0.07,
          edAcceptanceRate: 0.16, // value present but flag says no ED
          hasEarlyDecision: false,
        }),
      );
      expect(result.multiplier).toBe(1.0);
      expect(result.label).toContain('does not offer Early Decision');
    });

    // Bug #7 — gpaDistribution stored as percentage (e.g. 79.2) vs fraction (0.792) (PR #295).
    // `normalizeGpaDistribution` detects raw totals > 2 and divides by 100.
    // Same applicant, same school, same bands stored in either convention
    // must yield the identical multiplier.
    // Source: apps/api/scripts/closure-reports/overnight-2026-05-25/data-integrity-audit.md (Check 4b)
    it('Bug #7 (PR #295): identical multiplier whether gpaDistribution is fraction or percent', () => {
      const distroFraction = {
        '<3.00': 0.02,
        '3.00-3.24': 0.05,
        '3.25-3.49': 0.1,
        '3.50-3.74': 0.2,
        '3.75-4.00': 0.63,
      };
      // Same shape, percentage convention (numbers ×100).
      const distroPercent = {
        '<3.00': 2,
        '3.00-3.24': 5,
        '3.25-3.49': 10,
        '3.50-3.74': 20,
        '3.75-4.00': 63,
      };
      const asFraction = gpaBandMultiplier(
        baseProfile({ gpa: 3.85 }),
        baseSchool({ gpaDistribution: distroFraction }),
      );
      const asPercent = gpaBandMultiplier(
        baseProfile({ gpa: 3.85 }),
        baseSchool({ gpaDistribution: distroPercent }),
      );

      // Both must use the data-driven path (label contains "school-published")
      expect(asFraction.label).toContain('school-published');
      expect(asPercent.label).toContain('school-published');
      // Multipliers should be identical to within float tolerance.
      expect(asFraction.multiplier).toBeCloseTo(asPercent.multiplier, 6);
    });

    // Bug #2 — UMich oosAcceptanceRate=18 > acceptanceRate=15.64 invariant (PR #290).
    // When the published OOS rate is higher than the overall rate (a data
    // quirk for CSU campuses, SUNY, and some flagships), the ratio must
    // still be clamped to ≤ 1.3 so an out-of-state applicant never gets an
    // *unbounded* geographic boost relative to the school baseline. The
    // clamp keeps the modifier defensible even when the source row is
    // counter-intuitive.
    // Source: apps/api/scripts/closure-reports/overnight-2026-05-25/data-integrity-audit.md (Check 5a)
    it('Bug #2 (PR #290): geoMultiplier clamps ratios ≤ 1.3 even when oos > overall', () => {
      const result = geoMultiplier(
        baseProfile({
          isInternational: false,
          stateOfResidence: 'NY', // out-of-state for UMich (MI)
        }),
        {
          ...baseSchool({
            isPrivate: false,
            state: 'MI',
            acceptanceRate: 15.64,
          }),
          oosAcceptanceRate: 18, // > overall
        },
      );
      expect(result.label).toContain('Out-of-state');
      expect(result.multiplier).toBeLessThanOrEqual(1.3);
      // ratio = 18/15.64 ≈ 1.15 — within clamp
      expect(result.multiplier).toBeCloseTo(18 / 15.64, 2);
    });

    it('Bug #2 (PR #290): geoMultiplier clamps extreme oos/overall ratios too', () => {
      // Hypothetical edge case: oos=80 vs overall=30 (ratio=2.67) → clamp 1.3
      const result = geoMultiplier(
        baseProfile({
          isInternational: false,
          stateOfResidence: 'NY',
        }),
        {
          ...baseSchool({
            isPrivate: false,
            state: 'CA',
            acceptanceRate: 30,
          }),
          oosAcceptanceRate: 80,
        },
      );
      expect(result.multiplier).toBe(1.3);
    });
  });
});
