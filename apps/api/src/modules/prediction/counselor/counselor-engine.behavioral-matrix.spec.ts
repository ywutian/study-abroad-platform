import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ProfileInput, SchoolInput } from '../prediction.prompts';
import { AnchorResolverService } from './anchor-resolver.service';
import { CounselorEngineService } from './counselor-engine.service';

/**
 * Behavioral matrix for the counselor prediction engine.
 *
 * Where `counselor-engine.service.spec.ts` covers specific real-world
 * scenarios, THIS file is a systematic one-factor-at-a-time (OFAT) sweep:
 * hold a baseline fixed, vary exactly one input dimension, and assert the
 * prediction moves in the documented direction.
 *
 * EVERY assertion below states its BASIS in a comment — an admissions fact
 * or an engineering invariant. A test that fails is either a real bug OR a
 * wrong premise; both are worth catching. This is the regression net for
 * the 2026-05-21 prediction audit.
 *
 * Methodology notes:
 *  - Monotonicity tests mock `schoolCdsAdmitBand.findFirst → null` so the
 *    anchor is the deterministic Tier-2 `acceptanceRate`. This isolates the
 *    MODIFIER logic from CDS-cell-boundary noise (a higher GPA can land in
 *    a different cell with a noisily different rate — real, not a bug, but
 *    it would obscure modifier monotonicity).
 *  - "not lower" (>=) is used rather than strict ">" because two inputs can
 *    legitimately land on the same clamp bound.
 */
describe('CounselorEngineService — behavioral matrix (OFAT)', () => {
  let service: CounselorEngineService;
  let prisma: {
    schoolCdsAdmitBand: { findFirst: jest.Mock };
    schoolProgram: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      // Tier-2 anchor (= acceptanceRate) — deterministic, isolates modifiers.
      schoolCdsAdmitBand: { findFirst: jest.fn().mockResolvedValue(null) },
      schoolProgram: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CounselorEngineService,
        AnchorResolverService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CounselorEngineService);
  });

  const profile = (
    overrides: Partial<ProfileInput> & {
      recruitedAthlete?: boolean;
      urmStatus?: string;
      firstGeneration?: boolean;
    } = {},
  ): ProfileInput => ({
    gpa: 3.7,
    gpaScale: 4,
    testScores: [{ type: 'SAT', score: 1400 }],
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
      acceptanceRate: 0.4,
      sat25: 1300,
      satAvg: 1400,
      sat75: 1500,
      isPrivate: true,
      needBlindInternational: false,
      ...overrides,
    }) as SchoolInput & { acceptanceRate: number };

  const probOf = async (
    p: ProfileInput,
    s: ReturnType<typeof school>,
    round?: string,
  ): Promise<number> => {
    const r = await service.compute(p, s, round);
    return r.probability;
  };

  // ===========================================================================
  // A · ACADEMIC MONOTONICITY
  //   Basis: a higher GPA or test score is never a liability in US admissions.
  // ===========================================================================
  describe('A · academic monotonicity', () => {
    it('A1 — raising GPA never lowers probability', async () => {
      const lo = await probOf(profile({ gpa: 3.0 }), school());
      const mid = await probOf(profile({ gpa: 3.6 }), school());
      const hi = await probOf(profile({ gpa: 4.0 }), school());
      expect(mid).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(hi).toBeGreaterThanOrEqual(mid - 1e-9);
    });

    it('A2 — raising SAT never lowers probability', async () => {
      const lo = await probOf(
        profile({ testScores: [{ type: 'SAT', score: 1200 }] }),
        school(),
      );
      const hi = await probOf(
        profile({ testScores: [{ type: 'SAT', score: 1580 }] }),
        school(),
      );
      expect(hi).toBeGreaterThanOrEqual(lo - 1e-9);
    });

    it('A3 — a 4.0/1600 profile beats a 2.5/1100 profile', async () => {
      const weak = await probOf(
        profile({ gpa: 2.5, testScores: [{ type: 'SAT', score: 1100 }] }),
        school(),
      );
      const strong = await probOf(
        profile({ gpa: 4.0, testScores: [{ type: 'SAT', score: 1600 }] }),
        school(),
      );
      expect(strong).toBeGreaterThan(weak);
    });
  });

  // ===========================================================================
  // B · ACTIVITY & AWARD MONOTONICITY
  //   Basis: a stronger extracurricular / award record never hurts.
  // ===========================================================================
  describe('B · activity & award monotonicity', () => {
    it('B2 — an international-level award never lowers probability vs none', async () => {
      const none = await probOf(profile({ awards: [] }), school());
      const intl = await probOf(
        profile({
          awards: [
            {
              title: 'International Olympiad Medal',
              level: 'INTERNATIONAL',
            } as ProfileInput['awards'][number],
          ],
        }),
        school(),
      );
      expect(intl).toBeGreaterThanOrEqual(none - 1e-9);
    });

    it('B3 — international award scores >= school-level award', async () => {
      const schoolAward = await probOf(
        profile({
          awards: [
            {
              title: 'School Honor',
              level: 'SCHOOL',
            } as ProfileInput['awards'][number],
          ],
        }),
        school(),
      );
      const intlAward = await probOf(
        profile({
          awards: [
            {
              title: 'International Medal',
              level: 'INTERNATIONAL',
            } as ProfileInput['awards'][number],
          ],
        }),
        school(),
      );
      expect(intlAward).toBeGreaterThanOrEqual(schoolAward - 1e-9);
    });
  });

  // ===========================================================================
  // C · SCHOOL-TIER MONOTONICITY
  //   Basis: the same applicant has a higher chance at a less-selective school.
  // ===========================================================================
  describe('C · school-tier monotonicity', () => {
    it('C1 — same profile, higher admit-rate school → not-lower probability', async () => {
      const p = profile({ gpa: 3.8 });
      const reach = await probOf(p, school({ acceptanceRate: 0.04 }));
      const match = await probOf(p, school({ acceptanceRate: 0.25 }));
      const safety = await probOf(p, school({ acceptanceRate: 0.7 }));
      expect(match).toBeGreaterThanOrEqual(reach - 1e-9);
      expect(safety).toBeGreaterThanOrEqual(match - 1e-9);
    });

    it('C2 — reach (4% admit) strictly below safety (70% admit)', async () => {
      const p = profile({ gpa: 3.8 });
      const reach = await probOf(p, school({ acceptanceRate: 0.04 }));
      const safety = await probOf(p, school({ acceptanceRate: 0.7 }));
      expect(safety).toBeGreaterThan(reach);
    });
  });

  // ===========================================================================
  // D · APPLICATION ROUND
  //   Basis: ED/EA admit rates are documented as higher than RD at most
  //   selective US schools (binding-commitment + yield-protection).
  // ===========================================================================
  describe('D · application round', () => {
    it('D1 — ED never lowers probability vs RD', async () => {
      const p = profile({ gpa: 3.8 });
      const rd = await probOf(p, school(), 'RD');
      const ed = await probOf(p, school(), 'ED');
      expect(ed).toBeGreaterThanOrEqual(rd - 1e-9);
    });
  });

  // ===========================================================================
  // E · HOOKS
  //   Basis: recruited athletes / legacy / first-gen are documented soft or
  //   hard boosts in US holistic admissions.
  // ===========================================================================
  describe('E · hooks', () => {
    it('E1 — recruited athlete never lowers probability', async () => {
      const base = await probOf(profile(), school());
      const athlete = await probOf(
        profile({ recruitedAthlete: true }),
        school(),
      );
      expect(athlete).toBeGreaterThanOrEqual(base - 1e-9);
    });

    it('E2 — first-generation never lowers probability', async () => {
      const base = await probOf(profile(), school());
      const firstGen = await probOf(
        profile({ firstGeneration: true }),
        school(),
      );
      expect(firstGen).toBeGreaterThanOrEqual(base - 1e-9);
    });
  });

  // ===========================================================================
  // F · NATIONALITY & GEOGRAPHY
  //   Basis: at SELECTIVE PRIVATE schools the international pool faces a higher
  //   bar (need-aware admission + de-facto quota). NOTE: at revenue-seeking
  //   public campuses (mid-tier UCs) this does NOT hold — intl/OOS rates can
  //   exceed in-state — so F1 is asserted only for a selective private.
  // ===========================================================================
  describe('F · nationality & geography', () => {
    it('F1 — international applicant ≤ domestic at a selective private', async () => {
      const sel = school({ acceptanceRate: 0.08, isPrivate: true });
      const domestic = await probOf(profile({ isInternational: false }), sel);
      const intl = await probOf(profile({ isInternational: true }), sel);
      expect(intl).toBeLessThanOrEqual(domestic + 1e-9);
    });

    it('F2 — international modifier never produces a >1 boost at a selective private', async () => {
      // Basis: an international applicant should never be EASIER than the
      // overall pool at an 8%-admit private — that would be a sign error.
      const sel = school({ acceptanceRate: 0.08, isPrivate: true });
      const r = await service.compute(profile({ isInternational: true }), sel);
      const intlMod = r.modifierResults?.intl?.multiplier ?? 1;
      expect(intlMod).toBeLessThanOrEqual(1.0 + 1e-9);
    });
  });

  // ===========================================================================
  // G · CLAMP / FLOOR / CEILING
  //   Basis: documented engine invariant — result ∈ [anchor×0.1, anchor×2.5],
  //   capped at 0.98. (counselor-engine.service.ts ~line 251.)
  // ===========================================================================
  describe('G · clamp / floor / ceiling', () => {
    it('G1 — result stays within [anchor×0.1, min(0.98, anchor×2.5)]', async () => {
      const s = school({ acceptanceRate: 0.3 });
      for (const p of [
        profile({ gpa: 2.0, testScores: [{ type: 'SAT', score: 900 }] }),
        profile({ gpa: 4.0, testScores: [{ type: 'SAT', score: 1600 }] }),
        profile(),
      ]) {
        const r = await service.compute(p, s);
        expect(r.probability).toBeGreaterThanOrEqual(0.3 * 0.1 - 1e-9);
        expect(r.probability).toBeLessThanOrEqual(
          Math.min(0.98, 0.3 * 2.5) + 1e-9,
        );
      }
    });

    it('G2 — strongest profile never reaches 100%', async () => {
      const r = await probOf(
        profile({
          gpa: 4.0,
          testScores: [{ type: 'SAT', score: 1600 }],
          recruitedAthlete: true,
        }),
        school({ acceptanceRate: 0.9 }),
        'ED',
      );
      expect(r).toBeLessThanOrEqual(0.98);
    });

    it('G3 — weakest profile at hardest school stays > 0', async () => {
      const r = await probOf(
        profile({ gpa: 1.8, testScores: [{ type: 'SAT', score: 800 }] }),
        school({ acceptanceRate: 0.03 }),
      );
      expect(r).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // H · EDGE CASES — must not crash, must return sane output
  // ===========================================================================
  describe('H · edge cases', () => {
    it('H1 — empty profile (no GPA, no scores) does not crash', async () => {
      const r = await service.compute(
        {
          gpaScale: 4,
          testScores: [],
          activities: [],
          awards: [],
          isInternational: false,
        },
        school(),
      );
      expect(r).toBeDefined();
      // Either a real probability OR a tier-4 insufficient-data sentinel.
      expect(
        typeof r.probability === 'number' || r.insufficientData != null,
      ).toBe(true);
    });

    it('H2 — test-optional applicant (GPA only, no SAT/ACT) does not crash', async () => {
      const r = await service.compute(profile({ testScores: [] }), school());
      expect(r).toBeDefined();
      expect(typeof r.probability).toBe('number');
    });

    it('H3 — single-activity profile scores no higher than a rich-activity profile', async () => {
      const oneActivity = await probOf(
        profile({
          activities: [
            {
              name: 'Club',
              role: 'Member',
            } as ProfileInput['activities'][number],
          ],
        }),
        school(),
      );
      const richActivity = await probOf(
        profile({
          activities: [
            {
              name: 'Research',
              role: 'Lead',
            } as ProfileInput['activities'][number],
            {
              name: 'Olympiad',
              role: 'Medalist',
            } as ProfileInput['activities'][number],
            {
              name: 'Government',
              role: 'President',
            } as ProfileInput['activities'][number],
          ],
        }),
        school(),
      );
      expect(oneActivity).toBeLessThanOrEqual(richActivity + 1e-9);
    });

    it('H4 — non-4.0 GPA scale is handled without crash', async () => {
      const r5 = await service.compute(
        profile({ gpa: 4.5, gpaScale: 5 }),
        school(),
      );
      const r100 = await service.compute(
        profile({ gpa: 92, gpaScale: 100 }),
        school(),
      );
      expect(typeof r5.probability).toBe('number');
      expect(typeof r100.probability).toBe('number');
    });
  });

  // ===========================================================================
  // I · DETERMINISM
  //   Basis: prediction must be reproducible — no Math.random in the path.
  // ===========================================================================
  describe('I · determinism', () => {
    it('I1 — identical input yields identical probability across runs', async () => {
      const p = profile({ gpa: 3.85 });
      const s = school({ acceptanceRate: 0.2 });
      const runs = await Promise.all([
        probOf(p, s),
        probOf(p, s),
        probOf(p, s),
      ]);
      expect(runs[1]).toBe(runs[0]);
      expect(runs[2]).toBe(runs[0]);
    });
  });
});
