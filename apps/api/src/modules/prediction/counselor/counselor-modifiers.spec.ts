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

    it('treats EA below overall as neutral (non-binding EA confers no advantage — not a data anomaly)', () => {
      const result = roundMultiplier(
        'EA',
        baseSchool({ acceptanceRate: 0.1, eaAcceptanceRate: 0.05 }),
      );

      expect(result.multiplier).toBe(1);
      expect(result.label).toContain('no admit-rate advantage');
      expect(result.label).not.toContain('anomaly');
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

    it('falls back to a selectivity-scaled ED heuristic when no yield is known', () => {
      // 2026-05-31: the ED fallback is scaled by selectivity (was a flat 2.5×,
      // which over-boosted at T30+ and overflowed past 100% above ~45% admit).
      // A 10% overall rate → 2.4×.
      const result = roundMultiplier('ED', baseSchool({ acceptanceRate: 0.1 }));

      expect(result.multiplier).toBe(2.4);
      expect(result.label).toBe('Early Decision');
    });

    it('scales the ED fallback down at less-selective schools', () => {
      // elite (<8%) → 3.0×, T30 (20-30%) → 1.8×, >45% → 1.15× (a flat 2.5×
      // there would overflow past 100%). Published-aggregate pattern.
      expect(
        roundMultiplier('ED', baseSchool({ acceptanceRate: 0.05 })).multiplier,
      ).toBe(3.0);
      expect(
        roundMultiplier('ED', baseSchool({ acceptanceRate: 0.25 })).multiplier,
      ).toBe(1.8);
      expect(
        roundMultiplier('ED', baseSchool({ acceptanceRate: 0.6 })).multiplier,
      ).toBe(1.15);
    });

    it('raises REA/SCEA to 2.3x for the elite tier it serves', () => {
      // was 1.5×; real REA÷overall ≈ 2.3-2.4× (Harvard 2.43×, Yale 2.4×).
      const result = roundMultiplier(
        'REA',
        baseSchool({ acceptanceRate: 0.04 }),
      );
      expect(result.multiplier).toBe(2.3);
      expect(result.label).toContain('Restrictive Early Action');
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

  // 2026-05-31 48-flagship audit: replaced the flat 1.2 in-state default with verified
  // per-state ratios + selectivity damping + a per-school OOS guard. These lock the
  // intra-state heterogeneity behavior (one state value can't fit GT and UGA at once).
  describe('geoMultiplier — per-state in-state recalibration', () => {
    const inState = (state: string) =>
      baseProfile({ isInternational: false, stateOfResidence: state });

    it('selective flagship gets the FULL verified state ratio (GA Tech 2.36×)', () => {
      const result = geoMultiplier(
        inState('GA'),
        baseSchool({
          isPrivate: false,
          state: 'GA',
          acceptanceRate: 0.1407,
          oosAcceptanceRate: 0.1042,
        }),
      );
      expect(result.label).toContain('In-state');
      expect(result.multiplier).toBeCloseTo(2.36, 2);
    });

    it('less-selective same-state public is DAMPED by selectivity (UGA ~1.58×, not 2.36×)', () => {
      const result = geoMultiplier(
        inState('GA'),
        baseSchool({
          isPrivate: false,
          state: 'GA',
          acceptanceRate: 0.3792,
          oosAcceptanceRate: 0.311,
        }),
      );
      expect(result.label).toContain('In-state');
      // 1 + (2.36-1) * weight(0.3792) = 1 + 1.36 * 0.427 ≈ 1.58
      expect(result.multiplier).toBeCloseTo(1.58, 1);
      expect(result.multiplier).toBeLessThan(2.36);
      expect(result.multiplier).toBeGreaterThan(1);
    });

    it('near-open-access same-state public is NEUTRALIZED by damping (Georgia State)', () => {
      const result = geoMultiplier(
        inState('GA'),
        baseSchool({
          isPrivate: false,
          state: 'GA',
          acceptanceRate: 0.5543,
          oosAcceptanceRate: 0.3736,
        }),
      );
      expect(result.label.toLowerCase()).toContain('neutral');
    });

    it('per-school OOS guard neutralizes a residency-flat school in a strong-pref state', () => {
      // TX is a strong-residency state, but a school whose OWN published OOS ≈ overall
      // does not price residency → neutral (isolates the guard from damping: at 0.30
      // overall, damping alone would NOT fully neutralize).
      const result = geoMultiplier(
        inState('TX'),
        baseSchool({
          isPrivate: false,
          state: 'TX',
          acceptanceRate: 0.3,
          oosAcceptanceRate: 0.3,
        }),
      );
      expect(result.label.toLowerCase()).toContain('neutral');
    });

    it('untracked state falls to the NEUTRAL default (burden of proof), not a flat 1.2 boost', () => {
      const result = geoMultiplier(
        inState('OH'),
        baseSchool({
          isPrivate: false,
          state: 'OH',
          acceptanceRate: 0.508,
          oosAcceptanceRate: 0.497,
        }),
      );
      expect(result.label.toLowerCase()).toContain('neutral');
    });
  });

  // PRIMARY path: a school's OWN published in-state rate overrides the state-map+damping
  // fallback (real per-school data beats the flagship-ratio proxy). Symmetric with OOS.
  describe('geoMultiplier — per-school published in-state rate (PRIMARY)', () => {
    const inState = (state: string) =>
      baseProfile({ isInternational: false, stateOfResidence: state });

    it('uses published in-state÷overall directly, overriding the state-map fallback', () => {
      const result = geoMultiplier(
        inState('NC'),
        baseSchool({
          isPrivate: false,
          state: 'NC',
          acceptanceRate: 0.1534,
          oosAcceptanceRate: 0.0663,
          inStateAcceptanceRate: 0.38, // published: 38% / 15.34% = 2.48×
        }),
      );
      expect(result.label).toContain('In-state');
      expect(result.multiplier).toBeCloseTo(2.48, 1);
      expect(result.evidence?.toLowerCase()).toContain('school-published');
    });

    it('PRIMARY overrides fallback even in an UNTRACKED state (real data > proxy)', () => {
      // WA is in the map at 1.18, but a published in-state rate must win.
      const result = geoMultiplier(
        inState('CO'), // CO is NOT in STATE_IN_STATE_OVER_OVERALL (would default to 1.0)
        baseSchool({
          isPrivate: false,
          state: 'CO',
          acceptanceRate: 0.4,
          oosAcceptanceRate: 0.25,
          inStateAcceptanceRate: 0.6, // 60%/40% = 1.5× — a real boost the default-1.0 would miss
        }),
      );
      expect(result.multiplier).toBeCloseTo(1.5, 2);
    });

    it('cross-check guard: OOS ≥ in-state → neutral despite a stale-low overall (Ohio State artifact)', () => {
      const result = geoMultiplier(
        inState('OH'),
        baseSchool({
          isPrivate: false,
          state: 'OH',
          acceptanceRate: 0.508, // stale/low — would imply a false 57.3/50.8 = 1.13× boost
          oosAcceptanceRate: 0.59,
          inStateAcceptanceRate: 0.573, // OOS 59% ≥ in-state 57.3% → residency not favorable
        }),
      );
      expect(result.label.toLowerCase()).toContain('neutral');
    });

    it('published in-state ≈ overall → neutral', () => {
      const result = geoMultiplier(
        inState('MD'),
        baseSchool({
          isPrivate: false,
          state: 'MD',
          acceptanceRate: 0.45,
          oosAcceptanceRate: 0.42,
          inStateAcceptanceRate: 0.46, // ≈ overall → ratio ~1.02 → neutral
        }),
      );
      expect(result.label.toLowerCase()).toContain('neutral');
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

    it('applies a measured intl penalty at less-selective (>=40%) schools', () => {
      // 2026-05-31 aggregate self-calibration: the empirical intl/overall median
      // at >=40%-admit schools is ~0.70 (the old 0.95 was too lenient). Set to
      // 0.80 (inside the empirical IQR). See scripts/audit-fallback-calibration.ts.
      const result = intlMultiplier(intlProfile, {
        ...baseSchool(),
        acceptanceRate: 0.5,
      });
      expect(result.multiplier).toBeCloseTo(0.8, 3);
      expect(result.label).toContain('less-selective');
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

    // Bug #2 — OOS data must stay BOUNDED (PR #290), but the bound was raised
    // 1.3→1.8 on 2026-05-31: revenue-seeking UCs/CSUs genuinely admit OOS at up
    // to ~2× the resident rate (UC Fall 2024 official: Irvine 1.73×, Cal Poly
    // 2.07×), so 1.3 under-predicted real data. 1.8 captures almost all of it
    // while staying bounded (not unbounded) per PR #290's intent; the
    // data-integrity gate guards against contaminated oos rows.
    // Source: apps/api/scripts/closure-reports/overnight-2026-05-25/data-integrity-audit.md (Check 5a)
    it('Bug #2 (PR #290): geoMultiplier keeps OOS ratios bounded (≤ 1.8) when oos > overall', () => {
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
      expect(result.multiplier).toBeLessThanOrEqual(1.8);
      // ratio = 18/15.64 ≈ 1.15 — within clamp, passes through unchanged
      expect(result.multiplier).toBeCloseTo(18 / 15.64, 2);
    });

    it('Bug #2 (PR #290): geoMultiplier clamps extreme oos/overall ratios to 1.8', () => {
      // Edge case: oos=80 vs overall=30 (ratio=2.67) → clamp 1.8
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
      expect(result.multiplier).toBe(1.8);
    });
  });
});
