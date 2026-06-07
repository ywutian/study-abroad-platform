import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CounselorEngineService } from './counselor-engine.service';
import type { ProfileInput, SchoolInput } from '../prediction.prompts';

/**
 * Monotonicity regression guard — CDS-band path (the recurring-bug surface).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Prediction non-monotonicity — a strictly-BETTER applicant scoring LOWER than a
 * worse one — has recurred ≥3× (#319 geomean, #320 isotonic floor, #321 GPA-proxy
 * de-dup), every time inside the Tier-1 `cds-bands-v1` (by-GPA / by-test band) path.
 *
 * The two guards that were supposed to catch it both have a gap:
 *   - `scripts/run-counselor-invariants.ts` is a full-POPULATION sweep that is NOT
 *     wired into CI (only meaningful on the complete orchestrator seed, which the CI
 *     gate DB doesn't have).
 *   - `counselor-engine.behavioral-matrix.spec.ts` runs in CI but MOCKS THE BAND PATH
 *     AWAY (`schoolCdsAdmitBand.findFirst → null`) so the anchor is always the
 *     deterministic Tier-2 `acceptanceRate`. It therefore exercises the MODIFIER math
 *     but never the band-cell / isotonic-floor logic where every real regression lived.
 *
 * So a NEW non-monotonicity in the band path ships green today. THIS spec closes that:
 * it drives the engine's OWN Tier-1 path (the engine is constructed without an
 * AnchorResolver, so its private `lookupCdsBand` → `isotonicBandRate` runs) with
 * synthetic by-GPA / by-SAT band ladders mocked into Prisma — no real DB — and asserts
 * the core monotonicity invariants specifically over that path.
 *
 * INVARIANTS (mirroring run-counselor-invariants.ts, restricted to the band path):
 *   - I2  GPA-monotonic       — holding test fixed, higher GPA ⇒ prob non-decreasing
 *   - I3  test-monotonic      — holding GPA fixed, higher SAT ⇒ prob non-decreasing
 *   - I4  dominance           — A ≥ B on BOTH GPA and test ⇒ prob(A) ≥ prob(B)
 *   - I16 GPA-monotonic (intl)— I2 also holds for international applicants
 *
 * The dipping-ladder fixtures (3.50-3.74 = 92% but 3.75-4.00 = 88%, the UC-Merced #320
 * shape) deliberately exercise the isotonic floor: with the floor working, a 3.9 applicant
 * is clamped UP to the 92% peak below it, so output stays monotone even though the raw
 * published ladder dips. Bypass the floor and these assertions fail (proven in the PR).
 */
describe('CounselorEngineService — CDS-band monotonicity (regression guard for #319/#320/#321)', () => {
  let service: CounselorEngineService;
  let prisma: {
    schoolCdsAdmitBand: { findFirst: jest.Mock; findMany: jest.Mock };
    schoolProgram: { findFirst: jest.Mock };
  };

  // GPA-band ladder convention (standard 4.0 scale), low → high — must match the
  // engine's gpaToBands() output and isotonicBandRate()'s LADDERS constant.
  const GPA_LADDER = [
    '<3.00',
    '3.00-3.24',
    '3.25-3.49',
    '3.50-3.74',
    '3.75-4.00',
  ] as const;
  // SAT-band ladder convention, low → high — must match the engine's satToBand().
  const SAT_LADDER = ['<1300', '1300-1399', '1400-1499', '1500-1600'] as const;

  /**
   * Build a Prisma mock that serves a synthetic CDS band table.
   *
   * @param table  rows keyed as `${testType}|${testBand}|${gpaBand}` → admit rate (0-1)
   *
   * Implements both queries the band path uses against the REAL engine logic:
   *   - findFirst({ where:{ schoolId, gpaBand, testType, testBand } }) → the matched cell
   *   - findMany({ where:{ schoolId, testType, testBand, gpaBand:{ in:[...] } } }) →
   *     the strictly-lower bands consumed by isotonicBandRate()
   * The engine — not the mock — applies the isotonic max; the mock only returns raw rows.
   */
  const installBandTable = (table: Record<string, number>) => {
    prisma.schoolCdsAdmitBand.findFirst.mockImplementation(
      async ({ where }: any) => {
        const key = `${where.testType}|${where.testBand}|${where.gpaBand}`;
        const rate = table[key];
        return rate == null ? null : { admitRate: new Prisma.Decimal(rate) };
      },
    );
    prisma.schoolCdsAdmitBand.findMany.mockImplementation(
      async ({ where }: any) => {
        const wanted: string[] = where.gpaBand?.in ?? [];
        return wanted
          .map((gpaBand) => ({
            gpaBand,
            key: `${where.testType}|${where.testBand}|${gpaBand}`,
          }))
          .filter(({ key }) => table[key] != null)
          .map(({ gpaBand, key }) => ({
            gpaBand,
            admitRate: new Prisma.Decimal(table[key]),
          }));
      },
    );
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
      // NOTE: AnchorResolverService is intentionally NOT provided. It's @Optional()
      // on the engine, so the engine falls back to its OWN private lookupCdsBand +
      // isotonicBandRate — the exact code path that regressed in #319/#320/#321.
    }).compile();
    service = module.get(CounselorEngineService);
  });

  const profile = (
    overrides: Partial<ProfileInput> & {
      recruitedAthlete?: boolean;
      urmStatus?: string;
    } = {},
  ): ProfileInput =>
    ({
      gpa: 3.7,
      gpaScale: 4,
      testScores: [{ type: 'SAT', score: 1450 }],
      activities: [],
      awards: [],
      isInternational: false,
      ...overrides,
    }) as ProfileInput;

  const school = (
    overrides: Partial<SchoolInput & { acceptanceRate: number }> = {},
  ): SchoolInput & { acceptanceRate: number } =>
    ({
      id: 'school-band-test',
      name: 'Band Test University',
      acceptanceRate: 0.45,
      sat25: 1300,
      satAvg: 1400,
      sat75: 1500,
      isPrivate: false,
      needBlindInternational: false,
      ...overrides,
    }) as SchoolInput & { acceptanceRate: number };

  const compute = async (
    p: ProfileInput,
    s: ReturnType<typeof school>,
    round?: string,
  ) => service.compute(p, s, round);

  const probOf = async (
    p: ProfileInput,
    s: ReturnType<typeof school>,
    round?: string,
  ): Promise<number> => (await compute(p, s, round)).probability;

  // A representative SAT inside the school's mid-50 (its own band cell exists) so a
  // GPA sweep at fixed test always lands a Tier-1 cell.
  const FIXED_SAT = 1450; // → SAT band '1400-1499'

  /**
   * Synthetic GPA_ONLY ladder with a DELIBERATE DIP at the top — the UC-Merced #320
   * shape. Raw published rates are non-monotone (3.50-3.74 = 0.92 > 3.75-4.00 = 0.88);
   * the engine's isotonic floor must repair this so SERVED output stays monotone.
   */
  const DIPPING_GPA_ONLY: Record<string, number> = {
    'GPA_ONLY|ANY|<3.00': 0.55,
    'GPA_ONLY|ANY|3.00-3.24': 0.62,
    'GPA_ONLY|ANY|3.25-3.49': 0.8,
    'GPA_ONLY|ANY|3.50-3.74': 0.92, // peak
    'GPA_ONLY|ANY|3.75-4.00': 0.88, // ← dips below the band beneath it
  };

  /** Well-formed, already-monotone GPA_ONLY ladder (control). */
  const MONOTONE_GPA_ONLY: Record<string, number> = {
    'GPA_ONLY|ANY|<3.00': 0.4,
    'GPA_ONLY|ANY|3.00-3.24': 0.5,
    'GPA_ONLY|ANY|3.25-3.49': 0.62,
    'GPA_ONLY|ANY|3.50-3.74': 0.74,
    'GPA_ONLY|ANY|3.75-4.00': 0.85,
  };

  // GPA values that fall squarely inside each band (avoids boundary ambiguity).
  const GPA_SWEEP = [2.5, 3.1, 3.35, 3.6, 3.9];

  // Assert each successive value is >= the previous (allowing a tiny float epsilon).
  const expectNonDecreasing = (series: Array<{ x: string; p: number }>) => {
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1];
      const cur = series[i];
      // toBeGreaterThanOrEqual with a 1e-9 slack to tolerate clamp-bound ties.
      expect(cur.p).toBeGreaterThanOrEqual(prev.p - 1e-9);
    }
  };

  // Sanity: prove these tests actually drive the Tier-1 band path (not a Tier-2
  // acceptanceRate fallback). If this ever regresses to Tier-2 the monotonicity
  // assertions would pass trivially via modifiers — this guards the guard.
  describe('precondition — the band path is actually exercised', () => {
    it('a GPA_ONLY ladder hit resolves a Tier-1 cds-bands-v1 anchor', async () => {
      installBandTable(MONOTONE_GPA_ONLY);
      const r = await compute(profile({ gpa: 3.6, testScores: [] }), school());
      expect(r.tier).toBe(1);
      expect(r.anchorSource).toBe('cds-bands-v1');
      // The matched 3.50-3.74 cell encodes GPA → gpaBand modifier suppressed.
      expect(r.modifierResults.gpaBand.label).toContain('already encoded');
      expect(prisma.schoolCdsAdmitBand.findFirst).toHaveBeenCalled();
    });

    it('a SAT-banded ladder hit resolves Tier-1 and encodes BOTH gpa + test', async () => {
      installBandTable({
        'SAT|1400-1499|3.50-3.74': 0.5,
        'SAT|1400-1499|3.75-4.00': 0.6,
      });
      const r = await compute(
        profile({ gpa: 3.9, testScores: [{ type: 'SAT', score: FIXED_SAT }] }),
        school(),
      );
      expect(r.tier).toBe(1);
      expect(r.anchorSource).toBe('cds-bands-v1');
      expect(r.modifierResults.gpaBand.label).toContain('already encoded');
      expect(r.modifierResults.testBand.label).toContain('already encoded');
    });
  });

  // ===========================================================================
  // I2 — GPA-monotonic over the band path (the #320 isotonic-floor surface)
  // ===========================================================================
  describe('I2 · GPA-monotonic (test fixed) over the CDS-band path', () => {
    it('monotone GPA_ONLY ladder ⇒ output non-decreasing as GPA rises', async () => {
      installBandTable(MONOTONE_GPA_ONLY);
      const series = [];
      for (const gpa of GPA_SWEEP) {
        const p = await probOf(profile({ gpa, testScores: [] }), school());
        series.push({ x: `gpa ${gpa}`, p });
      }
      expectNonDecreasing(series);
    });

    it('DIPPING GPA_ONLY ladder (UC-Merced #320) ⇒ isotonic floor keeps output non-decreasing', async () => {
      installBandTable(DIPPING_GPA_ONLY);
      const series = [];
      for (const gpa of GPA_SWEEP) {
        const p = await probOf(profile({ gpa, testScores: [] }), school());
        series.push({ x: `gpa ${gpa}`, p });
      }
      // Without the isotonic floor, the 3.9 point (raw 0.88) drops below the
      // 3.6 point (raw 0.92) → this assertion fires. With the floor it's clamped
      // up to 0.92 and the series is monotone.
      expectNonDecreasing(series);
    });

    it('the 3.9 served anchor on the dipping ladder is clamped UP to the 0.92 peak (not the raw 0.88)', async () => {
      installBandTable(DIPPING_GPA_ONLY);
      const hi = await compute(profile({ gpa: 3.9, testScores: [] }), school());
      const peak = await compute(
        profile({ gpa: 3.6, testScores: [] }),
        school(),
      );
      expect(hi.tier).toBe(1);
      // anchor for the 3.9 cell is repaired to the running max of lower bands (0.92).
      expect(hi.anchor).toBeCloseTo(0.92, 5);
      // and therefore the 3.9 prediction is >= the 3.6 prediction.
      expect(hi.probability).toBeGreaterThanOrEqual(peak.probability - 1e-9);
    });

    it('SAT-banded ladder ⇒ GPA-monotone within a fixed SAT band', async () => {
      // Both GPA + test encoded; sweeping GPA at a fixed in-band SAT must be monotone.
      installBandTable({
        'SAT|1400-1499|<3.00': 0.3,
        'SAT|1400-1499|3.00-3.24': 0.42,
        'SAT|1400-1499|3.25-3.49': 0.55,
        'SAT|1400-1499|3.50-3.74': 0.7, // peak
        'SAT|1400-1499|3.75-4.00': 0.64, // ← dip; isotonic floor must repair
      });
      const series = [];
      for (const gpa of GPA_SWEEP) {
        const p = await probOf(
          profile({ gpa, testScores: [{ type: 'SAT', score: FIXED_SAT }] }),
          school(),
        );
        series.push({ x: `gpa ${gpa}`, p });
      }
      expectNonDecreasing(series);
    });
  });

  // ===========================================================================
  // I3 — test-monotonic over the band path (holding GPA fixed)
  // ===========================================================================
  describe('I3 · test-monotonic (GPA fixed) over the CDS-band path', () => {
    it('higher SAT band ⇒ output non-decreasing at a fixed GPA', async () => {
      // A by-SAT ladder at a fixed GPA band (3.50-3.74). Each higher SAT band
      // is a strictly-better applicant and must not score lower.
      installBandTable({
        'SAT|<1300|3.50-3.74': 0.3,
        'SAT|1300-1399|3.50-3.74': 0.4,
        'SAT|1400-1499|3.50-3.74': 0.52,
        'SAT|1500-1600|3.50-3.74': 0.65,
      });
      const series = [];
      // One representative score inside each SAT band, low → high.
      for (const sat of [1250, 1350, 1450, 1550]) {
        const p = await probOf(
          profile({ gpa: 3.6, testScores: [{ type: 'SAT', score: sat }] }),
          school(),
        );
        series.push({ x: `sat ${sat}`, p });
      }
      expectNonDecreasing(series);
    });
  });

  // ===========================================================================
  // I4 — dominance: better on BOTH axes ⇒ never lower (the #319 inversion surface)
  // ===========================================================================
  describe('I4 · dominance over the CDS-band path', () => {
    it('strictly-better (higher GPA AND higher SAT) ⇒ prob(A) >= prob(B)', async () => {
      installBandTable({
        // Lower-left cell (B) and upper-right cell (A) of a by-(GPA,SAT) grid.
        'SAT|1300-1399|3.25-3.49': 0.35,
        'SAT|1500-1600|3.75-4.00': 0.6,
        // Lower bands present so the isotonic floor has neighbours to scan.
        'SAT|1500-1600|3.50-3.74': 0.58,
      });
      const dominated = await probOf(
        profile({ gpa: 3.35, testScores: [{ type: 'SAT', score: 1350 }] }),
        school(),
      );
      const dominant = await probOf(
        profile({ gpa: 3.9, testScores: [{ type: 'SAT', score: 1550 }] }),
        school(),
      );
      expect(dominant).toBeGreaterThanOrEqual(dominated - 1e-9);
    });

    it('dominance still holds when the dominant cell dips in the raw ladder (isotonic repair)', async () => {
      // The dominant (top GPA) cell is published LOWER than the cell just below it.
      // The isotonic floor must repair it so dominance is not violated.
      installBandTable({
        'GPA_ONLY|ANY|3.25-3.49': 0.6,
        'GPA_ONLY|ANY|3.50-3.74': 0.9, // peak
        'GPA_ONLY|ANY|3.75-4.00': 0.84, // ← dominant applicant's raw cell dips
      });
      const dominated = await probOf(
        profile({ gpa: 3.35, testScores: [] }),
        school(),
      );
      const dominant = await probOf(
        profile({ gpa: 3.9, testScores: [] }),
        school(),
      );
      expect(dominant).toBeGreaterThanOrEqual(dominated - 1e-9);
    });
  });

  // ===========================================================================
  // I16 — GPA-monotonic ALSO for international applicants over the band path
  // ===========================================================================
  describe('I16 · GPA-monotonic (international) over the CDS-band path', () => {
    it('intl applicant: dipping GPA_ONLY ladder ⇒ output still non-decreasing', async () => {
      installBandTable(DIPPING_GPA_ONLY);
      const series = [];
      for (const gpa of GPA_SWEEP) {
        const p = await probOf(
          profile({
            gpa,
            testScores: [],
            isInternational: true,
            nationality: 'CN',
            highSchoolLocation: 'CN',
          }),
          // A selective private where the intl modifier is most active.
          school({ acceptanceRate: 0.2, isPrivate: true }),
        );
        series.push({ x: `gpa ${gpa}`, p });
      }
      expectNonDecreasing(series);
    });
  });
});
