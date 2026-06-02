import type { ProfileInput, SchoolInput } from '../prediction.prompts';
import {
  aLevelToEquivalentSat,
  gaokaoToEquivalentSat,
  gpaToEquivalentSat,
  ibToEquivalentSat,
  majorMultiplier,
  profileContextMultiplier,
} from './counselor-modifiers';

/**
 * Coverage closure (2026-06 oracle-gap analysis): the international test-score
 * concordances and the GPA→SAT heuristic had NO direct tests, so a wrong value
 * would silently mis-score real applicants. These tables are published facts
 * (College Board IB concordance, UCAS tariff, 高考 percentile bands), so they're
 * pinned exactly as a regression guard — plus monotonicity (a concordance must be
 * non-decreasing) and out-of-range rejection. Also covers the lightly-tested
 * majorMultiplier ratio/clamp and the profileContextMultiplier [0.90, 1.13] cap.
 */
describe('Counselor concordances & under-tested modifiers', () => {
  describe('ibToEquivalentSat — College Board IB concordance', () => {
    it.each([
      [45, 1600],
      [44, 1540],
      [42, 1540],
      [41, 1450],
      [38, 1450],
      [37, 1380],
      [35, 1380],
      [34, 1300],
      [32, 1300],
      [31, 1200],
      [24, 1200],
      [0, 1200],
    ])('IB %d → SAT-equiv %d', (ib, sat) => {
      expect(ibToEquivalentSat(ib)).toBe(sat);
    });

    it('rejects out-of-range / non-finite', () => {
      expect(ibToEquivalentSat(46)).toBeNull();
      expect(ibToEquivalentSat(-1)).toBeNull();
      expect(ibToEquivalentSat(NaN)).toBeNull();
    });

    it('is monotonic non-decreasing in score', () => {
      let prev = -1;
      for (let s = 0; s <= 45; s++) {
        const v = ibToEquivalentSat(s) ?? -1;
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    });
  });

  describe('aLevelToEquivalentSat — UCAS tariff concordance', () => {
    it.each([
      [224, 1600],
      [220, 1600],
      [216, 1550],
      [200, 1550],
      [168, 1500],
      [144, 1450],
      [136, 1400],
      [128, 1350],
      [120, 1300],
      [112, 1250],
      [96, 1200],
      [95, 1150],
      [0, 1150],
    ])('UCAS %d pts → SAT-equiv %d', (pts, sat) => {
      expect(aLevelToEquivalentSat(pts)).toBe(sat);
    });

    it('rejects negative / non-finite', () => {
      expect(aLevelToEquivalentSat(-1)).toBeNull();
      expect(aLevelToEquivalentSat(NaN)).toBeNull();
    });

    it('is monotonic non-decreasing', () => {
      let prev = -1;
      for (let p = 0; p <= 240; p += 4) {
        const v = aLevelToEquivalentSat(p) ?? -1;
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    });
  });

  describe('gaokaoToEquivalentSat — 高考 percentile concordance', () => {
    it.each([
      [750, 1550],
      [690, 1550],
      [689, 1500],
      [670, 1500],
      [650, 1450],
      [620, 1400],
      [590, 1350],
      [589, 1280],
      [0, 1280],
    ])('Gaokao %d → SAT-equiv %d', (g, sat) => {
      expect(gaokaoToEquivalentSat(g)).toBe(sat);
    });

    it('rejects out-of-range (>750) / negative / non-finite', () => {
      expect(gaokaoToEquivalentSat(751)).toBeNull();
      expect(gaokaoToEquivalentSat(-1)).toBeNull();
      expect(gaokaoToEquivalentSat(NaN)).toBeNull();
    });

    it('is monotonic non-decreasing', () => {
      let prev = -1;
      for (let g = 0; g <= 750; g += 10) {
        const v = gaokaoToEquivalentSat(g) ?? -1;
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    });
  });

  describe('gpaToEquivalentSat — GPA→SAT heuristic + scale handling', () => {
    it.each([
      [4.0, 4, 1540],
      [3.95, 4, 1520],
      [3.9, 4, 1490],
      [3.85, 4, 1460],
      [3.78, 4, 1420],
      [3.7, 4, 1350],
      [3.5, 4, 1300],
      [3.3, 4, 1230],
      [3.1, 4, 1150],
      [2.5, 4, 1050],
    ])('GPA %f (scale %d) → SAT-equiv %d', (gpa, scale, sat) => {
      expect(gpaToEquivalentSat(gpa, scale)).toBe(sat);
    });

    it('clamps overflow GPA to a perfect 4.0 (never rewarded above 1540)', () => {
      expect(gpaToEquivalentSat(4.5, 4)).toBe(1540);
      expect(gpaToEquivalentSat(5.0, 4)).toBe(gpaToEquivalentSat(4.0, 4));
    });

    it('converts alternative scales proportionally (percentage / weighted)', () => {
      // 95/100*4 = 3.8 → same band as a 3.8/4.0
      expect(gpaToEquivalentSat(95, 100)).toBe(gpaToEquivalentSat(3.8, 4));
      // 4.5/5*4 = 3.6 → same band as a 3.6/4.0
      expect(gpaToEquivalentSat(4.5, 5)).toBe(gpaToEquivalentSat(3.6, 4));
    });

    it('returns null for missing / non-finite GPA', () => {
      expect(gpaToEquivalentSat(undefined, 4)).toBeNull();
      expect(gpaToEquivalentSat(NaN, 4)).toBeNull();
    });

    it('is monotonic non-decreasing in GPA', () => {
      let prev = -1;
      for (let g = 0; g <= 4.0001; g += 0.05) {
        const v = gpaToEquivalentSat(+g.toFixed(2), 4) ?? -1;
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    });
  });

  describe('majorMultiplier — program selectivity ratio', () => {
    const school = {
      id: 's',
      name: 'S',
      acceptanceRate: 0.2,
    } as unknown as SchoolInput & { acceptanceRate: number };
    const profile = (targetMajor?: string): ProfileInput =>
      ({
        gpa: 3.8,
        gpaScale: 4,
        testScores: [],
        activities: [],
        awards: [],
        targetMajor,
      }) as unknown as ProfileInput;

    it('is neutral when no target major', () => {
      expect(majorMultiplier(profile(), school, 0.05).multiplier).toBe(1.0);
    });

    it('is neutral when no program-level data', () => {
      expect(
        majorMultiplier(profile('Computer Science'), school, null).multiplier,
      ).toBe(1.0);
    });

    it('penalizes a more-selective major, clamped at 0.3×', () => {
      // program 5% vs school 20% → ratio 0.25 → clamped to the 0.3 floor
      const r = majorMultiplier(profile('Computer Science'), school, 0.05);
      expect(r.multiplier).toBeCloseTo(0.3, 5);
      expect(r.impact).toBe('negative');
    });

    it('boosts a less-selective major, clamped at 1.5×', () => {
      // program 50% vs school 20% → ratio 2.5 → clamped to the 1.5 ceiling
      const r = majorMultiplier(profile('Classics'), school, 0.5);
      expect(r.multiplier).toBeCloseTo(1.5, 5);
      expect(r.impact).toBe('positive');
    });

    it('is neutral when the program is ~as selective as the school', () => {
      // program 19% vs school 20% → ratio 0.95 → within [0.85, 1.15] → neutral
      expect(majorMultiplier(profile('History'), school, 0.19).multiplier).toBe(
        1.0,
      );
    });
  });

  describe('profileContextMultiplier — bounded [0.90, 1.13]', () => {
    const school = {
      id: 's',
      name: 'S',
      acceptanceRate: 0.1,
      sat25: 1400,
      sat75: 1550,
    } as unknown as SchoolInput;
    const mk = (over: Partial<ProfileInput> = {}): ProfileInput =>
      ({
        gpa: 3.9,
        gpaScale: 4,
        testScores: [],
        activities: [],
        awards: [],
        ...over,
      }) as unknown as ProfileInput;
    const strongProfile = mk({
      activities: [
        {
          name: 'National Research Program',
          category: 'RESEARCH',
          role: 'Lead Researcher',
          hoursPerWeek: 12,
          weeksPerYear: 45,
          yearsActive: 3,
          tier: 1,
        },
      ],
      awards: [
        { name: 'ISEF Grand Award', level: 'INTERNATIONAL', year: 2025 },
        { name: 'National Merit', level: 'NATIONAL', year: 2025 },
      ],
    } as Partial<ProfileInput>);

    it('caps a spike profile at ≤ 1.13 (intentional anti-noise ceiling)', () => {
      const m = profileContextMultiplier(strongProfile, school).multiplier;
      expect(m).toBeLessThanOrEqual(1.13 + 1e-9);
      expect(m).toBeGreaterThanOrEqual(1.0 - 1e-9);
    });

    it('floors at ≥ 0.90', () => {
      const m = profileContextMultiplier(mk(), school).multiplier;
      expect(m).toBeGreaterThanOrEqual(0.9 - 1e-9);
    });

    it('a strong-EC/award profile never scores below the bare profile', () => {
      const bare = profileContextMultiplier(mk(), school).multiplier;
      const strong = profileContextMultiplier(strongProfile, school).multiplier;
      expect(strong).toBeGreaterThanOrEqual(bare - 1e-9);
    });
  });
});
