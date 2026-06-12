import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CounselorEngineService } from './counselor-engine.service';
import type { ProfileInput, SchoolInput } from '../prediction.prompts';

/**
 * Coverage for the cold-start counselor engine.
 *
 * The engine has two parts that need separate testing:
 *   1. Anchor resolution (4-tier fallback) — Tier 1 CDS bands, Tier 2/3
 *      scorecard, Tier 4 insufficient data
 *   2. Modifier composition + clamp — verify final probability stays inside
 *      [anchor × 0.3, anchor × 2.5] regardless of how aggressive the modifiers
 *
 * Real-world scenarios (UCM strong CA, UCB strong CA, MIT strong, Penn ED legacy,
 * China intl at need-blind) double as documentation — anyone debugging a
 * "this number looks wrong" report can read these tests to confirm the math.
 */
describe('CounselorEngineService', () => {
  let service: CounselorEngineService;
  let prisma: {
    schoolCdsAdmitBand: { findFirst: jest.Mock; findMany: jest.Mock };
    schoolProgram: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      schoolCdsAdmitBand: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      schoolProgram: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CounselorEngineService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CounselorEngineService);
  });

  // Helpers to build input shapes
  const profile = (
    overrides: Partial<ProfileInput> & {
      recruitedAthlete?: boolean;
      urmStatus?: string;
    } = {},
  ): ProfileInput => ({
    gpa: 3.9,
    gpaScale: 4,
    testScores: [{ type: 'SAT', score: 1500 }],
    activities: [],
    awards: [],
    isInternational: false,
    ...overrides,
  });

  const school = (
    overrides: Partial<
      SchoolInput & {
        acceptanceRate: number;
        state: string;
        isPrivate: boolean;
        needBlindInternational: boolean | null;
      }
    > = {},
  ) =>
    ({
      id: 'school-test',
      name: 'Test University',
      acceptanceRate: 0.5,
      sat25: 1300,
      satAvg: 1400,
      sat75: 1500,
      isPrivate: false,
      needBlindInternational: false,
      ...overrides,
    }) as any;

  // -------------------------------------------------------------------------
  // Anchor resolution (4-tier fallback)
  // -------------------------------------------------------------------------

  describe('Tier 1 — CDS bands anchor', () => {
    it('uses cds-bands rate when (school, gpaBand, satBand) cell exists', async () => {
      prisma.schoolCdsAdmitBand.findFirst.mockResolvedValue({
        admitRate: new Prisma.Decimal(0.92),
      });

      const result = await service.compute(
        profile(),
        school({ acceptanceRate: 0.5 }),
      );

      expect(result.tier).toBe(1);
      expect(result.anchorSource).toBe('cds-bands-v1');
      expect(result.anchor).toBeCloseTo(0.92, 2);
    });

    it('tolerates admitRate stored as percentage (88 → 0.88)', async () => {
      prisma.schoolCdsAdmitBand.findFirst.mockResolvedValue({
        admitRate: new Prisma.Decimal(88),
      });

      const result = await service.compute(profile(), school());

      expect(result.anchor).toBeCloseTo(0.88, 2);
    });
  });

  describe('Tier 2 — scorecard with SAT bands', () => {
    it('falls back to school.acceptanceRate when no CDS band match', async () => {
      const result = await service.compute(
        profile(),
        school({ acceptanceRate: 0.49, sat25: 1300, sat75: 1500 }),
      );

      expect(result.tier).toBe(2);
      expect(result.anchorSource).toContain('SAT bands');
      expect(result.anchor).toBeCloseTo(0.49, 2);
    });

    it('handles acceptanceRate stored as percentage (49 → 0.49)', async () => {
      const result = await service.compute(
        profile(),
        school({ acceptanceRate: 49 }),
      );

      expect(result.anchor).toBeCloseTo(0.49, 2);
    });
  });

  describe('GPA-proxy de-duplication + input clamps (2026-06 invariant deep-dive)', () => {
    // sat25 1510: a strong 3.9 GPA maps to equivSat ~1490 (< sat25) → the heuristic
    // GPA-vs-SAT path would flag it "below 25th" → ×0.50. That proxy is the SAME axis
    // testBand measures, so when a real SAT is present it must be dampened toward
    // neutral (sqrt) rather than double-counted.
    const eliteNoGpaDist = {
      acceptanceRate: 0.08,
      sat25: 1510,
      sat75: 1560,
      satAvg: 1535,
    };

    it('softens the heuristic GPA PENALTY toward neutral when a real test is present', async () => {
      const withTest = await service.compute(
        profile({ gpa: 3.9, testScores: [{ type: 'SAT', score: 1500 }] }),
        school(eliteNoGpaDist),
      );
      // ×0.50 (heuristic "below 25th") → sqrt → ~0.707, not double-counted.
      expect(withTest.modifierResults.gpaBand.multiplier).toBeCloseTo(
        Math.sqrt(0.5),
        2,
      );
    });

    it('leaves a GPA-proxy BOOST at full strength (penalty-side-only de-dup)', async () => {
      // Low-SAT school: a 4.0 GPA maps to equivSat ~1540 (> sat75 1300) → heuristic
      // boost ×1.3. The boost is a legit signal and the gpa×test combine already
      // correlation-corrects it downstream, so F1 must NOT sqrt-dampen it here
      // (doing so double-dampened 082-cooper-union below its floor).
      const result = await service.compute(
        profile({ gpa: 4.0, testScores: [{ type: 'SAT', score: 1250 }] }),
        school({ acceptanceRate: 0.7, sat25: 1100, sat75: 1300, satAvg: 1200 }),
      );
      expect(result.modifierResults.gpaBand.multiplier).toBeCloseTo(1.3, 2);
    });

    it('keeps the full GPA-proxy when NO real test exists (de-dup must not fire)', async () => {
      const noTest = await service.compute(
        profile({ gpa: 3.9, testScores: [] }),
        school(eliteNoGpaDist),
      );
      expect(noTest.modifierResults.gpaBand.multiplier).toBeCloseTo(0.5, 2);
    });

    it('clamps an impossible SAT to the physical ceiling (9999 scored as 1600)', async () => {
      const s = school({ acceptanceRate: 0.7, sat25: 1100, sat75: 1300 });
      const legit = await service.compute(
        profile({ gpa: 3.8, testScores: [{ type: 'SAT', score: 1600 }] }),
        s,
      );
      const garbage = await service.compute(
        profile({ gpa: 3.8, testScores: [{ type: 'SAT', score: 9999 }] }),
        s,
      );
      expect(garbage.probability).toBeCloseTo(legit.probability, 5);
    });

    it('clamps an overflow GPA to a perfect 4.0 (5.0/scale-4 scored as 4.0)', async () => {
      const s = school({ acceptanceRate: 0.7, sat25: 1100, sat75: 1300 });
      const over = await service.compute(
        profile({
          gpa: 5.0,
          gpaScale: 4,
          testScores: [{ type: 'SAT', score: 1400 }],
        }),
        s,
      );
      const perfect = await service.compute(
        profile({
          gpa: 4.0,
          gpaScale: 4,
          testScores: [{ type: 'SAT', score: 1400 }],
        }),
        s,
      );
      expect(over.probability).toBeCloseTo(perfect.probability, 5);
    });
  });

  describe('Tier 3 — scorecard without SAT bands', () => {
    it('still works when sat25/sat75 are missing', async () => {
      const result = await service.compute(
        profile(),
        school({
          acceptanceRate: 0.6,
          sat25: undefined,
          sat75: undefined,
          satAvg: undefined,
        }),
      );

      expect(result.tier).toBe(3);
      expect(result.anchor).toBeCloseTo(0.6, 2);
    });
  });

  describe('Tier 4 — insufficient data', () => {
    it('returns insufficientData sentinel when school has no acceptanceRate', async () => {
      const result = await service.compute(
        profile(),
        school({ acceptanceRate: null as any }),
      );

      expect(result.tier).toBe(4);
      expect(result.insufficientData).toBeDefined();
      expect(result.insufficientData?.reason).toContain(
        'school_missing_acceptance_rate',
      );
      expect(result.factors).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Modifier composition + the absolute clamp
  // -------------------------------------------------------------------------

  describe('clamp guarantees no outrageous outputs', () => {
    it('caps at 2.5× anchor even when modifiers stack high', async () => {
      // ED + recruited athlete + legacy + first-gen would normally produce
      // 2.5 × 4.0 × 3.0 × 1.4 = 42× but clamp limits to 2.5×
      const result = await service.compute(
        profile({
          isLegacy: true,
          legacySchools: ['Test University'],
          isFirstGen: true,
          recruitedAthlete: true,
        }),
        school({ acceptanceRate: 0.2 }),
        'ED',
      );

      expect(result.probability).toBeLessThanOrEqual(0.2 * 2.5 + 0.001);
    });

    it('floors at 0.1× anchor (relative floor) when modifiers stack low', async () => {
      // PR · prediction-counselor-fix (2026-05-21): floor relaxed from
      // anchor*0.3 / 0.02-absolute to a pure anchor*0.1 relative floor
      // (see counselor-engine.service.ts:251). This test now verifies the
      // new looser floor — at 0.1 anchor, floor is 0.01 (1.0%) instead of
      // the old 0.03 (3.0%). The semantic intent is unchanged: bad
      // applicants at hard schools land at the relative floor, just at a
      // value calibrated to the school's true difficulty rather than a
      // one-size-fits-all 0.02 absolute.
      const result = await service.compute(
        profile({
          gpa: 2.0,
          testScores: [{ type: 'SAT', score: 1000 }],
          isInternational: true,
        }),
        school({
          acceptanceRate: 0.1,
          sat25: 1400,
          sat75: 1500,
          needBlindInternational: false,
        }),
      );

      // anchor=0.1 → floor = 0.01
      expect(result.probability).toBeGreaterThanOrEqual(0.1 * 0.1 - 0.001);
      // The pre-existing scale (≤ anchor × 2.5) is preserved
      expect(result.probability).toBeLessThanOrEqual(0.1 * 2.5);
    });

    it('respects relative floor of anchor*0.1 even if profile is weak', async () => {
      // PR · prediction-counselor-fix (2026-05-21): floor is now relative
      // (anchor × 0.1) instead of absolute 0.02 — see
      // counselor-engine.service.ts:251 for why. For anchor=0.02 the floor
      // is 0.002 (0.2%). For anchor=0.5 the floor is 0.05 (5%). Behaviour
      // for very-tiny-anchor schools is gentler now.
      const result = await service.compute(
        profile({ gpa: 2.0, testScores: [{ type: 'SAT', score: 800 }] }),
        school({ acceptanceRate: 0.02, sat25: 1500 }),
      );

      // anchor=0.02 → floor = 0.002
      expect(result.probability).toBeGreaterThanOrEqual(0.002);
      // Still bounded sanely from above by anchor × 2.5 = 0.05
      expect(result.probability).toBeLessThanOrEqual(0.05);
    });

    it('respects absolute ceiling of 0.98 even if anchor × 2.5 exceeds 1', async () => {
      const result = await service.compute(
        profile({ recruitedAthlete: true }),
        school({ acceptanceRate: 0.5 }),
        'ED',
      );

      expect(result.probability).toBeLessThanOrEqual(0.98);
    });
  });

  // -------------------------------------------------------------------------
  // Geomean academic correctness (2026-05-24 fix)
  // -------------------------------------------------------------------------

  describe('geomean academic correction — applied uniformly (monotonic)', () => {
    // Geometric mean is a correlation correction (GPA and test are correlated; a plain
    // product double-counts a consistent profile). It is applied UNIFORMLY whenever both
    // academic dimensions are active. An earlier version applied it only when BOTH were
    // non-neutral (else product) — but that product↔geomean switch was NON-MONOTONIC:
    // a strictly-WORSE applicant (both stats below band → geomean lift) could outscore a
    // better one (one stat in the neutral middle-50 → full product penalty). geomean is
    // monotonic in both inputs, so applying it uniformly removes the boundary discontinuity.
    // (2026-06 monotonicity audit: the old switch inverted ~21% of ranked schools.)

    it('keeps a neutral-test strong applicant near anchor (no collapse)', async () => {
      const middleSatResult = await service.compute(
        profile({ gpa: 3.9, testScores: [{ type: 'SAT', score: 1450 }] }),
        school({ acceptanceRate: 0.3, sat25: 1400, sat75: 1500 }),
      );
      expect(middleSatResult.probability).toBeGreaterThanOrEqual(0.3 - 0.05);
    });

    it('applies geomean (no cap-slam) when both gpaBand and testBand are boosts', async () => {
      const bothStrongResult = await service.compute(
        profile({ gpa: 3.95, testScores: [{ type: 'SAT', score: 1560 }] }),
        school({ acceptanceRate: 0.05, sat25: 1400, sat75: 1500 }),
      );
      expect(bothStrongResult.probability).toBeGreaterThan(0.05 * 0.1);
      expect(bothStrongResult.probability).toBeLessThanOrEqual(0.05 * 2.5);
    });

    it('MONOTONIC: a strictly-worse applicant never outscores a better one (top-GPA-saturated school)', async () => {
      // Regression for the 2026-06 non-monotonicity. At a school where almost all admits
      // are top-GPA (so 3.3 and 3.7 both map near the bottom GPA percentile) and the better
      // applicant's SAT lands in the neutral middle-50 while the worse applicant's is below
      // 25th, the old product↔geomean switch made the worse applicant score HIGHER.
      const sat: any = {
        acceptanceRate: 0.38,
        sat25: 1220,
        sat75: 1400,
        gpaDistribution: {
          '<3.00': 0.008,
          '3.00-3.24': 0.0016,
          '3.25-3.49': 0.0031,
          '3.50-3.74': 0.0125,
          '3.75-4.00': 0.9748,
        },
      };
      const better = await service.compute(
        profile({ gpa: 3.7, testScores: [{ type: 'SAT', score: 1300 }] }), // in-band test
        school(sat),
      );
      const worse = await service.compute(
        profile({ gpa: 3.3, testScores: [{ type: 'SAT', score: 1180 }] }), // below-25th test
        school(sat),
      );
      expect(better.probability).toBeGreaterThanOrEqual(
        worse.probability - 0.001,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Real-world scenarios (also document expected behavior for ops)
  // -------------------------------------------------------------------------

  describe('real-world scenarios', () => {
    it('UCM strong CA in-state RD: ~85-92%', async () => {
      prisma.schoolCdsAdmitBand.findFirst.mockResolvedValue({
        admitRate: new Prisma.Decimal(0.92),
      });
      const result = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'SAT', score: 1500 }],
          highSchoolLocation: 'CA',
          targetMajor: 'computer-science',
          isInternational: false,
        }),
        school({
          id: 'ucm',
          name: 'University of California, Merced',
          acceptanceRate: 0.88,
          sat25: 1180,
          sat75: 1400,
          state: 'CA',
          isPrivate: false,
        }),
        'RD',
      );
      expect(result.tier).toBe(1);
      expect(result.probability).toBeGreaterThanOrEqual(0.8);
      expect(result.probability).toBeLessThanOrEqual(0.98);
    });

    it('UCB strong CA in-state RD: ~17-30%', async () => {
      // No CDS band data for UCB high stats → falls to Tier 2
      const result = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'SAT', score: 1500 }],
          highSchoolLocation: 'CA',
          targetMajor: 'computer-science',
        }),
        school({
          id: 'ucb',
          name: 'University of California, Berkeley',
          acceptanceRate: 0.11,
          sat25: 1330,
          satAvg: 1430,
          sat75: 1530,
          state: 'CA',
          isPrivate: false,
        }),
        'RD',
      );
      // anchor 0.11 × strong academic geomean ~1.15 × in-state CA 1.2 = ~0.15
      // (in-state÷overall, not the old in-state÷OOS 1.8 that over-predicted UC)
      expect(result.probability).toBeGreaterThanOrEqual(0.13);
      expect(result.probability).toBeLessThanOrEqual(0.3);
    });

    it('MIT very strong RD: ~5-10% (cap binds at 2.5× anchor)', async () => {
      const result = await service.compute(
        profile({
          gpa: 4.0,
          testScores: [{ type: 'SAT', score: 1580 }],
          targetMajor: 'computer-science',
          isInternational: false,
        }),
        school({
          id: 'mit',
          name: 'Massachusetts Institute of Technology',
          acceptanceRate: 0.04,
          sat25: 1520,
          sat75: 1580,
          isPrivate: true,
          needBlindInternational: true,
        }),
        'RD',
      );
      // anchor 0.04 × 2.5 cap = 0.10 max
      expect(result.probability).toBeGreaterThanOrEqual(0.03);
      expect(result.probability).toBeLessThanOrEqual(0.11);
    });

    it('Penn ED with legacy hook: ~25-40% (capped at 2.5× ED-adjusted anchor)', async () => {
      const result = await service.compute(
        profile({
          gpa: 3.95,
          testScores: [{ type: 'SAT', score: 1530 }],
          isLegacy: true,
          legacySchools: ['University of Pennsylvania'],
        }),
        school({
          id: 'penn',
          name: 'University of Pennsylvania',
          acceptanceRate: 0.07,
          sat25: 1470,
          sat75: 1560,
          isPrivate: true,
        }),
        'ED',
      );
      // anchor 0.07; ED 2.5× legacy 3× = 7.5×; clamped to 2.5× = 0.175
      expect(result.probability).toBeGreaterThanOrEqual(0.07);
      expect(result.probability).toBeLessThanOrEqual(0.2);
    });

    it('China intl at need-aware (e.g. NYU): heavy intl penalty', async () => {
      const result = await service.compute(
        profile({
          gpa: 3.85,
          testScores: [{ type: 'SAT', score: 1500 }],
          isInternational: true,
          nationality: 'CN',
        }),
        school({
          id: 'nyu',
          name: 'New York University',
          acceptanceRate: 0.12,
          sat25: 1370,
          sat75: 1530,
          isPrivate: true,
          needBlindInternational: false,
        }),
        'RD',
      );
      // anchor 0.12 × intl-need-aware 0.4 (still kicks in for <20% selective)
      // × strong stats ~1.1 ≈ 0.053; floored at 0.12 × 0.3 = 0.036
      expect(result.probability).toBeGreaterThanOrEqual(0.036);
      expect(result.probability).toBeLessThanOrEqual(0.12);
    });

    it('China intl at less-selective UC (e.g. UCM): no heavy penalty', async () => {
      // Regression test for 4/26 evening: counselor was returning 35-40% for
      // strong CN intl applicants at UCM (anchor 88%) because flat 0.4× intl
      // penalty was calibrated for elite schools. UCM admits ~85% of intl
      // applicants per IPEDS — should be NO meaningful penalty.
      const result = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'SAT', score: 1500 }],
          isInternational: true,
          nationality: 'CN',
        }),
        school({
          id: 'ucm',
          name: 'University of California, Merced',
          acceptanceRate: 0.88,
          sat25: 1180,
          sat75: 1400,
          state: 'CA',
          isPrivate: false,
          needBlindInternational: false,
        }),
        'RD',
      );
      // anchor 0.88 × intl-less-selective 0.95 × strong GPA 1.3 × strong test 1.5
      // = 1.63 → capped at 0.88 × 2.5 = 2.20 → 0.98 ceiling.
      // Bottom line: strong intl applicant at non-selective school should NOT
      // be punished into the 30s.
      expect(result.probability).toBeGreaterThanOrEqual(0.7);
      expect(result.probability).toBeLessThanOrEqual(0.98);
    });

    it('intl + highSchoolLocation set: geo modifier does NOT double-penalize', async () => {
      // The exact bug that produced UCM 37% in prod: a CN intl applicant whose
      // highSchoolLocation is set to a non-CA value would get hit by both
      // intlMultiplier (0.4×) AND geoMultiplier (0.5× OOS at CA strong-pref
      // public). Combined 0.2× wiped strong applicants down to ~30%.
      // Fix: geoMultiplier returns NEUTRAL when isInternational is true.
      const withLocation = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'SAT', score: 1500 }],
          isInternational: true,
          nationality: 'CN',
          highSchoolLocation: 'CN',
        }),
        school({
          id: 'ucm',
          name: 'University of California, Merced',
          acceptanceRate: 0.88,
          sat25: 1180,
          sat75: 1400,
          state: 'CA',
          isPrivate: false,
        }),
        'RD',
      );
      const withoutLocation = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'SAT', score: 1500 }],
          isInternational: true,
          nationality: 'CN',
        }),
        school({
          id: 'ucm',
          name: 'University of California, Merced',
          acceptanceRate: 0.88,
          sat25: 1180,
          sat75: 1400,
          state: 'CA',
          isPrivate: false,
        }),
        'RD',
      );

      // Both should produce the SAME probability — geo must be neutralized for
      // intl regardless of whether highSchoolLocation is set.
      expect(withLocation.probability).toBeCloseTo(
        withoutLocation.probability,
        2,
      );
      // Sanity: no factor named with "Out-of-state" should appear for the
      // intl applicant (geo modifier returned its neutral skip variant).
      const oosFactor = withLocation.factors.find((f) =>
        f.name.toLowerCase().includes('out-of-state'),
      );
      expect(oosFactor).toBeUndefined();
    });

    it('uses oosAcceptanceRate ratio for domestic out-of-state applicants when available', async () => {
      const result = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'SAT', score: 1450 }],
          isInternational: false,
          highSchoolLocation: 'NY',
        }),
        school({
          id: 'ucd',
          name: 'University of California, Davis',
          acceptanceRate: 0.418,
          oosAcceptanceRate: 0.573,
          sat25: 1280,
          sat75: 1450,
          isPrivate: false,
          state: 'CA',
        }),
        'RD',
      );

      expect(result.modifierResults.geo.label).toContain('school data');
      // NOTE (2026-05-21): UC mid-selectivity campuses genuinely admit
      // out-of-state applicants at HIGHER rates than the overall pool —
      // they recruit non-residents for tuition revenue and the OOS pool is
      // more self-selected. So oosRate (0.573) > overallRate (0.418) is a
      // REAL pattern, not corruption. As of 2026-05-31 the OOS ratio clamp was
      // raised 1.3→1.8, so the real ratio (0.573/0.418 ≈ 1.37) now passes
      // through instead of being capped — more accurate for revenue-seeking UCs.
      expect(result.modifierResults.geo.multiplier).toBeCloseTo(
        0.573 / 0.418,
        2,
      );
    });

    it('Tier 1 (SAT cell): suppresses gpa+test modifiers — no double-counting', async () => {
      // Regression test for PR-10 architectural fix. When CDS C9 cell is for
      // (gpa=3.75-4.0, sat=1500-1600), the cell admit rate ALREADY reflects
      // strong-stats applicants. Multiplying by gpa×1.3 + test×1.5 again
      // would over-credit strong applicants and overshoot the cap on every
      // Tier 1 hit. After this fix, Tier 1 cell rate is the dominant signal.
      prisma.schoolCdsAdmitBand.findFirst.mockImplementation(
        async ({ where }: any) => {
          // Only respond to the SAT-band query (first candidate the engine tries).
          if (where.testType === 'SAT' && where.testBand === '1500-1600') {
            return { admitRate: new Prisma.Decimal(0.65) };
          }
          return null;
        },
      );

      const result = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'SAT', score: 1500 }],
          highSchoolLocation: 'CA',
          isInternational: false,
        }),
        school({
          id: 'ucd',
          name: 'University of California, Davis',
          acceptanceRate: 0.37, // NOT used as anchor; Tier 1 cell wins
          state: 'CA',
          isPrivate: false,
        }),
        'RD',
      );

      expect(result.tier).toBe(1);
      expect(result.anchor).toBeCloseTo(0.65, 2);
      // Anchor 0.65 (Tier 1 SAT cell) × gpa 1.0 (suppressed) × test 1.0 (suppressed)
      // × geo 1.0 (ALSO suppressed): the UC by-GPA band already conditions on a top GPA,
      // and the flat CA in-state multiplier is measured against the overall all-GPA pool,
      // so stacking it on the band over-predicts (UC is test-blind + GPA-saturated → the
      // marginal top-GPA lift is small). Result ≈ 0.65 (the band itself) — the honest
      // "strong in-state at less-selective UC Davis", NOT 0.65 × 1.3 × 1.5 × 1.2 (the
      // gpa+test+geo quadruple-count we prevent).
      expect(result.probability).toBeGreaterThanOrEqual(0.6);
      expect(result.probability).toBeLessThanOrEqual(0.72);

      // factors[] should include the suppression note for both gpa and test
      const gpaFactor = result.factors.find((f) =>
        f.name.toLowerCase().includes('gpa'),
      );
      expect(gpaFactor?.detail.toLowerCase()).toContain('encoded');
    });

    it('Tier 1 (GPA_ONLY cell): suppresses only gpa modifier — test still applies', async () => {
      // GPA_ONLY cells (e.g., UCD freshman profile by HS GPA, no SAT cross-tab)
      // encode only the gpa dimension. Test modifier still applies normally.
      prisma.schoolCdsAdmitBand.findFirst.mockImplementation(
        async ({ where }: any) => {
          // Only the GPA_ONLY candidate matches (no SAT/ACT cells loaded).
          if (where.testType === 'GPA_ONLY' && where.testBand === 'ANY') {
            return { admitRate: new Prisma.Decimal(0.42) };
          }
          return null;
        },
      );

      const result = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'SAT', score: 1500 }],
          highSchoolLocation: 'NY', // OOS
          isInternational: false,
        }),
        school({
          id: 'ucd',
          name: 'University of California, Davis',
          acceptanceRate: 0.37,
          sat25: 1280,
          sat75: 1450,
          state: 'CA',
          isPrivate: false,
        }),
        'RD',
      );

      expect(result.tier).toBe(1);
      expect(result.anchor).toBeCloseTo(0.42, 2);
      // Anchor 0.42 (GPA-band) × gpa 1.0 (suppressed) × test 1.5 (still applies,
      // 1500 above sat75+50=1500) × geo 0.85 = 0.5355. Geo is the generic public-OOS
      // 0.85× fallback: this UCD fixture has no oosAcceptanceRate, and CA is NOT in the
      // strong-residency 0.5× set — UCs admit OOS *easier*, not harder (2026-05-31 audit /
      // #312); in prod UCD's published OOS rate drives the data path instead.
      // Test modifier MUST still fire because GPA_ONLY cell doesn't encode test signal.
      expect(result.probability).toBeGreaterThanOrEqual(0.45);
      expect(result.probability).toBeLessThanOrEqual(0.6);

      const gpaFactor = result.factors.find((f) =>
        f.name.toLowerCase().includes('gpa'),
      );
      expect(gpaFactor?.detail.toLowerCase()).toContain('encoded');
      const testFactor = result.factors.find((f) =>
        f.name.toLowerCase().includes('test score'),
      );
      // Test factor SHOULD be in factors[] (not suppressed) — and its detail
      // should NOT contain "encoded" wording.
      expect(testFactor).toBeDefined();
      expect(testFactor!.detail.toLowerCase()).not.toContain('encoded');
    });

    it('IB 42 student: uses IB→SAT concordance (1540 equiv) instead of NEUTRAL', async () => {
      // PR-14: Before this fix, IB 42 was treated as "no test score" → NEUTRAL.
      // Now uses College Board IB Concordance: 42 → SAT 1540.
      const result = await service.compute(
        profile({
          gpa: 3.85,
          testScores: [{ type: 'IB', score: 42 }],
          isInternational: true,
          nationality: 'CN',
        }),
        school({
          id: 'cornell',
          name: 'Cornell University',
          acceptanceRate: 0.084,
          intlAcceptanceRate: 0.035,
          sat25: 1470,
          sat75: 1560,
          isPrivate: true,
        }),
        'RD',
      );
      // IB 42 → equivSAT 1540, vs Cornell sat75=1560 → falls in middle 50 (0.85×)
      // anchor 0.084 × intl ratio 0.42 × gpa 1.1 (3.85 above sat50) × test 0.85 = 0.033
      // floored at 0.084 × 0.3 = 0.025. Result in [0.025, 0.10] range.
      expect(result.probability).toBeGreaterThanOrEqual(0.025);
      expect(result.probability).toBeLessThanOrEqual(0.1);

      const testFactor = result.factors.find((f) =>
        f.name.toLowerCase().includes('test score'),
      );
      // Test factor MUST appear (not silently dropped)
      expect(testFactor).toBeDefined();
      expect(testFactor!.detail).toContain('IB 42');
    });

    it('Gaokao 690 student: uses Gaokao→SAT concordance (1550 equiv)', async () => {
      const result = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'GAOKAO', score: 690 }],
          isInternational: true,
          nationality: 'CN',
        }),
        school({
          id: 'ucb',
          name: 'University of California, Berkeley',
          acceptanceRate: 0.116,
          sat25: 1330,
          sat75: 1530,
          isPrivate: false,
          state: 'CA',
        }),
        'RD',
      );
      // Gaokao 690 → equivSAT 1550, vs UCB sat75 1530 → 1550 ≥ 1530+50? No (1550<1580) → 1.2× (above sat75)
      // anchor 0.116 × strong stats × intl PR-8 → ~0.12-0.15 range
      expect(result.probability).toBeGreaterThanOrEqual(0.04);
      expect(result.probability).toBeLessThanOrEqual(0.3);

      const testFactor = result.factors.find((f) =>
        f.name.toLowerCase().includes('test score'),
      );
      expect(testFactor).toBeDefined();
      expect(testFactor!.detail).toContain('Gaokao 690');
    });

    it('A-Level 3A* (168 UCAS pts) student: uses A-Level→SAT concordance', async () => {
      const result = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'A_LEVEL', score: 168 }],
          isInternational: true,
          nationality: 'CN',
        }),
        school({
          id: 'imperial',
          name: 'Imperial College',
          acceptanceRate: 0.15,
          sat25: 1450,
          sat75: 1550,
          isPrivate: true,
        }),
        'RD',
      );
      // 168 UCAS → equivSAT 1500, vs sat75 1550 → falls in middle 50 (0.85×)
      expect(result.probability).toBeGreaterThanOrEqual(0.04);
      expect(result.probability).toBeLessThanOrEqual(0.4);

      const testFactor = result.factors.find((f) =>
        f.name.toLowerCase().includes('test score'),
      );
      expect(testFactor).toBeDefined();
      expect(testFactor!.detail).toContain('A-Level');
    });

    it('Test-optional at MIT (highly selective, <20% admit): 0.85× penalty', async () => {
      const result = await service.compute(
        profile({
          gpa: 4.0,
          testScores: [],
          applyingTestOptional: true,
        }),
        school({
          id: 'mit',
          name: 'Massachusetts Institute of Technology',
          acceptanceRate: 0.0455,
          sat25: 1520,
          sat75: 1580,
          isPrivate: true,
          needBlindInternational: true,
        }),
        'RD',
      );
      // anchor 0.0455 × test 0.85 (test-optional penalty) × gpa 1.3 (3.95+ → 1500 equivSAT > sat75) = 0.050
      // (no other modifiers active)
      expect(result.probability).toBeGreaterThanOrEqual(0.014);
      expect(result.probability).toBeLessThanOrEqual(0.1);

      const testFactor = result.factors.find((f) =>
        f.name.toLowerCase().includes('test-optional'),
      );
      expect(testFactor).toBeDefined();
      expect(testFactor!.detail).toContain('Common App');
    });

    it('Test-optional at less-selective school (≥20% admit): no penalty (modifierResults captures it)', async () => {
      const result = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [],
          applyingTestOptional: true,
          isInternational: false,
        }),
        school({
          id: 'ucd',
          name: 'University of California, Davis',
          acceptanceRate: 0.418,
          sat25: 1280,
          sat75: 1450,
          isPrivate: false,
          state: 'CA',
        }),
        'RD',
      );
      // Test-optional has no penalty at >20% admit (UCD 41.8%) per Common App data.
      // Factor is neutral (1.0×) so filtered from factors[] UI, but
      // modifierResults captures the explicit handling for trace/audit.
      expect(result.probability).toBeGreaterThanOrEqual(0.1);
      expect(result.probability).toBeLessThanOrEqual(0.98);

      // Architecture: neutral modifiers are skipped from factors[] UI to keep
      // the breakdown focused. Test the modifierResults trace instead.
      expect(result.modifierResults.testBand?.label).toContain(
        'less-selective',
      );
      expect(result.modifierResults.testBand?.multiplier).toBe(1.0);
    });

    it('UC weighted GPA 4.30 (gpaScale 4.4): tries UC weighted band first', async () => {
      // PR-14: gpaToBands emits ['4.20-4.40', '3.75-4.00'] when gpaScale > 4.0
      // Test that lookupCdsBand tries the UC band first.
      const bandsQueried: string[] = [];
      prisma.schoolCdsAdmitBand.findFirst.mockImplementation(
        async ({ where }: any) => {
          bandsQueried.push(where.gpaBand);
          // Return cell only when query matches the UC weighted band
          if (where.gpaBand === '4.20-4.40' && where.testType === 'GPA_ONLY') {
            return { admitRate: new Prisma.Decimal(0.55) };
          }
          return null;
        },
      );

      const result = await service.compute(
        profile({
          gpa: 4.3,
          gpaScale: 4.4,
          testScores: [{ type: 'SAT', score: 1500 }],
          isInternational: false,
          highSchoolLocation: 'CA',
        }),
        school({
          id: 'ucd',
          name: 'University of California, Davis',
          acceptanceRate: 0.418,
          sat25: 1280,
          sat75: 1450,
          isPrivate: false,
          state: 'CA',
        }),
        'RD',
      );
      // First-tried band should be UC weighted (4.20-4.40)
      expect(bandsQueried[0]).toBe('4.20-4.40');
      // Tier 1 cell hit at 0.55
      expect(result.tier).toBe(1);
      expect(result.anchor).toBeCloseTo(0.55, 2);
    });

    it('uses intlAcceptanceRate ratio when school publishes it', async () => {
      // When the school has both intlAcceptanceRate and acceptanceRate, the
      // multiplier comes directly from intl/overall ratio (clamped 0.3-1.2).
      // No need for the selectivity-tier heuristic.
      const result = await service.compute(
        profile({
          gpa: 3.9,
          testScores: [{ type: 'SAT', score: 1500 }],
          isInternational: true,
          nationality: 'CN',
        }),
        school({
          id: 'cornell',
          name: 'Cornell University',
          acceptanceRate: 0.07,
          intlAcceptanceRate: 0.05, // ratio = 0.05 / 0.07 = 0.71
          sat25: 1470,
          sat75: 1560,
          isPrivate: true,
          needBlindInternational: false,
        }),
        'RD',
      );
      // anchor 0.07 × intl-ratio 0.71 × strong stats ~1.3 = 0.065
      // capped at 0.07 × 2.5 = 0.175
      expect(result.probability).toBeGreaterThanOrEqual(0.04);
      expect(result.probability).toBeLessThanOrEqual(0.18);
      // Verify the ratio path was taken (label gives it away)
      const intlFactor = result.factors.find((f) =>
        f.name.toLowerCase().includes('school-published'),
      );
      expect(intlFactor).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Factor breakdown UI contract
  // -------------------------------------------------------------------------

  describe('factors[] breakdown', () => {
    it('always includes the school baseline as the first factor', async () => {
      const result = await service.compute(
        profile(),
        school({ acceptanceRate: 0.5 }),
      );
      expect(result.factors[0].name).toBe('School baseline admit rate');
      expect(result.factors[0].detail).toContain('50.0%');
    });

    it('skips neutral modifiers from the breakdown', async () => {
      // domestic, no hook, no legacy → those modifiers all return ×1.0 neutral
      const result = await service.compute(
        profile({
          isInternational: false,
          isLegacy: false,
          isFirstGen: false,
        }),
        school({ acceptanceRate: 0.5 }),
      );

      // factors[] should not contain neutral-impact modifier rows beyond the anchor
      // (RD round is also neutral)
      const names = result.factors.map((f) => f.name);
      expect(names).not.toContain('First-generation status');
      expect(names).not.toContain('Recruited athlete');
    });

    it('annotates clamp activation when modifiers exceed bounds', async () => {
      const result = await service.compute(
        profile({
          gpa: 4.0,
          testScores: [{ type: 'SAT', score: 1570 }],
        }),
        school({ acceptanceRate: 0.05, sat25: 1440, sat75: 1540 }),
        'ED',
      );

      // ED at a 5% school → ×3.0 (selectivity-scaled) and strong stats push the
      // combined modifiers above the anchor×2.5 cap, so the engine annotates it.
      const clampNote = result.factors.find((f) =>
        f.name.includes('Capped at 2.5'),
      );
      expect(clampNote).toBeDefined();
    });

    it('never leaks a raw "(×N.NN)" coefficient into a user-facing factor detail', async () => {
      // factor.detail renders verbatim in the student/parent-facing prediction
      // card AND feeds the application-analysis narrative
      // (normalizeFactorStrings). The multiplier belongs in `weight` (magnitude)
      // + `impact` (direction), never in the prose. Regression guard for the
      // engine double-append + the evidence self-append leaks (ED/EA/OOS/
      // in-state/intl/major modifier lines). Natural-prose forms like "~1.8× the
      // overall rate" are fine — only the parenthetical "(×N.NN)" / "(N.NN×
      // ratio)" engineering coefficient is the leak.
      const elite = await service.compute(
        profile({
          isInternational: true,
          gpa: 3.95,
          testScores: [{ type: 'SAT', score: 1560 }],
        }),
        school({
          acceptanceRate: 0.07,
          intlAcceptanceRate: 0.05, // school-published intl rate → intl line
          edAcceptanceRate: 0.16, // school-published ED rate → ED line
          hasEarlyDecision: true,
          sat25: 1500,
          sat75: 1570,
        }),
        'ED',
      );
      const inStatePublic = await service.compute(
        profile({ gpa: 3.8, highSchoolLocation: 'CA' as any }),
        school({
          state: 'CA',
          acceptanceRate: 0.4,
          inStateAcceptanceRate: 0.55, // → in-state published line
          oosAcceptanceRate: 0.3, // → OOS line for a non-resident run
        }),
      );

      // Guard would be vacuous if no non-anchor modifier ever fired.
      expect(elite.factors.length).toBeGreaterThan(1);
      for (const f of [...elite.factors, ...inStatePublic.factors]) {
        expect(f.detail).not.toMatch(/\(×|× ratio\)/);
      }
    });
  });
});
