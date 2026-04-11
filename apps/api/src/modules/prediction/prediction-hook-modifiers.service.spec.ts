import { Test, TestingModule } from '@nestjs/testing';
import {
  PredictionHookModifiersService,
  HookShift,
} from './prediction-hook-modifiers.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ProfileInput, SchoolInput } from './prediction.prompts';
import { adjustInLogOdds, logit, invLogit } from '@study-abroad/shared/scoring';

describe('PredictionHookModifiersService', () => {
  let service: PredictionHookModifiersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionHookModifiersService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PredictionHookModifiersService>(
      PredictionHookModifiersService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Helpers
  // ============================================

  const makeSchool = (
    overrides: Record<string, unknown> = {},
  ): Parameters<PredictionHookModifiersService['getBaseRate']>[0] => ({
    acceptanceRate: 10,
    sat25: 1400,
    sat75: 1550,
    usNewsRank: 5,
    graduationRate: 95,
    ...overrides,
  });

  const makeProfile = (
    overrides: Partial<ProfileInput> = {},
  ): ProfileInput => ({
    testScores: [],
    activities: [],
    awards: [],
    ...overrides,
  });

  const makeSchoolInput = (
    overrides: Record<string, unknown> = {},
  ): SchoolInput & {
    needBlindInternational?: boolean;
    considersLegacy?: boolean;
  } => ({
    id: 'school-1',
    name: 'Harvard University',
    acceptanceRate: 4,
    ...overrides,
  });

  // ============================================
  // getBaseRate
  // ============================================

  describe('getBaseRate', () => {
    it('should use ED acceptance rate when round is ED and edAcceptanceRate is available', async () => {
      const school = makeSchool({
        acceptanceRate: 10,
        edAcceptanceRate: 15,
        intlAcceptanceRate: 8,
      });

      const result = await service.getBaseRate(school, makeProfile(), 'ED');

      // ED rate (15%) should be selected, not overall (10%) or intl (8%)
      expect(result).toBeCloseTo(0.15, 2);
    });

    it('should use ED acceptance rate when round is SCEA', async () => {
      const school = makeSchool({
        acceptanceRate: 10,
        edAcceptanceRate: 12,
      });

      const result = await service.getBaseRate(school, makeProfile(), 'SCEA');

      expect(result).toBeCloseTo(0.12, 2);
    });

    it('should use ED acceptance rate when round is REA', async () => {
      const school = makeSchool({
        acceptanceRate: 10,
        edAcceptanceRate: 14,
      });

      const result = await service.getBaseRate(school, makeProfile(), 'REA');

      expect(result).toBeCloseTo(0.14, 2);
    });

    it('should use ED2 acceptance rate when round is ED2', async () => {
      const school = makeSchool({
        acceptanceRate: 10,
        ed2AcceptanceRate: 18,
      });

      const result = await service.getBaseRate(school, makeProfile(), 'ED2');

      expect(result).toBeCloseTo(0.18, 2);
    });

    it('should use intlAcceptanceRate for international students when no ED rate', async () => {
      const school = makeSchool({
        acceptanceRate: 10,
        intlAcceptanceRate: 6,
      });
      const profile = makeProfile({ isInternational: true });

      const result = await service.getBaseRate(school, profile, 'RD');

      expect(result).toBeCloseTo(0.06, 2);
    });

    it('should fall back to overall acceptanceRate when no specific rate available', async () => {
      const school = makeSchool({ acceptanceRate: 10 });

      const result = await service.getBaseRate(school, makeProfile(), 'RD');

      expect(result).toBeCloseTo(0.1, 2);
    });

    it('should normalize rates stored as percentages (> 1)', async () => {
      const school = makeSchool({ acceptanceRate: 25 }); // 25% stored as 25

      const result = await service.getBaseRate(school, makeProfile(), 'RD');

      expect(result).toBeCloseTo(0.25, 2);
    });

    it('should apply Chinese applicant adjustment (x0.4) for ultra-selective schools', async () => {
      // Ultra-selective: selectivity > 0.85
      // Need high SAT and very low acceptance rate to get selectivity > 0.85
      const school = makeSchool({
        acceptanceRate: 3, // 3% acceptance rate
        sat25: 1480,
        sat75: 1570,
        usNewsRank: 1,
        graduationRate: 98,
      });
      const profile = makeProfile({ nationality: 'CN' });

      const result = await service.getBaseRate(school, profile, 'RD');

      // Without Chinese adjustment: 0.03
      // With Chinese adjustment for ultra-selective: 0.03 * 0.4 = 0.012
      expect(result).toBeLessThan(0.03);
    });

    it('should apply Chinese applicant adjustment for nationality CHN', async () => {
      const school = makeSchool({
        acceptanceRate: 3,
        sat25: 1480,
        sat75: 1570,
        usNewsRank: 1,
        graduationRate: 98,
      });
      const profile = makeProfile({ nationality: 'CHN' });

      const result = await service.getBaseRate(school, profile, 'RD');

      expect(result).toBeLessThan(0.03);
    });

    it('should not apply Chinese adjustment for non-Chinese nationalities', async () => {
      const school = makeSchool({ acceptanceRate: 5 });
      const profile = makeProfile({ nationality: 'US' });

      const result = await service.getBaseRate(school, profile, 'RD');

      expect(result).toBeCloseTo(0.05, 2);
    });

    it('should apply major selectivity multiplier when provided', async () => {
      const school = makeSchool({ acceptanceRate: 10 });

      // competitiveness=5 => multiplier 0.30
      const result = await service.getBaseRate(school, makeProfile(), 'RD', 5);

      // 0.10 * 0.30 = 0.03
      expect(result).toBeCloseTo(0.03, 2);
    });

    it('should not modify rate when major competitiveness is 3 (neutral)', async () => {
      const school = makeSchool({ acceptanceRate: 10 });

      const result = await service.getBaseRate(school, makeProfile(), 'RD', 3);

      expect(result).toBeCloseTo(0.1, 2);
    });

    it('should clamp result to minimum 0.005', async () => {
      // Chinese applicant + ultra-selective + hyper-competitive major
      const school = makeSchool({
        acceptanceRate: 1, // 1%
        sat25: 1500,
        sat75: 1580,
        usNewsRank: 1,
        graduationRate: 99,
      });
      const profile = makeProfile({ nationality: 'CN' });

      const result = await service.getBaseRate(school, profile, 'RD', 5);

      // Even with extreme adjustments, should not go below 0.005
      expect(result).toBeGreaterThanOrEqual(0.005);
    });

    it('should clamp result to maximum 0.95', async () => {
      const school = makeSchool({ acceptanceRate: 99 });

      const result = await service.getBaseRate(
        school,
        makeProfile(),
        'RD',
        1, // very low competition => multiplier 1.50
      );

      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should prioritize ED rate over intl rate for international ED applicants', async () => {
      const school = makeSchool({
        acceptanceRate: 10,
        edAcceptanceRate: 20,
        intlAcceptanceRate: 5,
      });
      const profile = makeProfile({ isInternational: true });

      const result = await service.getBaseRate(school, profile, 'ED');

      // ED rate (20%) should take priority over intl rate (5%)
      expect(result).toBeCloseTo(0.2, 2);
    });
  });

  // ============================================
  // computeHookShifts
  // ============================================

  describe('computeHookShifts', () => {
    it('should return legacy primary shift (+2.14) when student has direct legacy', () => {
      const profile = makeProfile({
        isLegacy: true,
        legacySchools: ['Harvard University'],
      });
      const school = makeSchoolInput({
        name: 'Harvard University',
        considersLegacy: true,
      });

      const shifts = service.computeHookShifts(profile, school);

      const legacyShift = shifts.find((s) => s.hookType === 'LEGACY_PRIMARY');
      expect(legacyShift).toBeDefined();
      expect(legacyShift!.logOddsShift).toBeCloseTo(2.14, 2);
    });

    it('should return legacy secondary shift (+1.10) when legacy at different school', () => {
      const profile = makeProfile({
        isLegacy: true,
        legacySchools: ['Yale University'],
      });
      const school = makeSchoolInput({ name: 'Harvard University' });

      const shifts = service.computeHookShifts(profile, school);

      const legacyShift = shifts.find((s) => s.hookType === 'LEGACY_SECONDARY');
      expect(legacyShift).toBeDefined();
      expect(legacyShift!.logOddsShift).toBeCloseTo(1.1, 2);
    });

    it('should return first-gen shift (+0.4)', () => {
      const profile = makeProfile({ isFirstGen: true });
      const school = makeSchoolInput();

      const shifts = service.computeHookShifts(profile, school);

      const firstGenShift = shifts.find((s) => s.hookType === 'FIRST_GEN');
      expect(firstGenShift).toBeDefined();
      expect(firstGenShift!.logOddsShift).toBeCloseTo(0.4, 2);
    });

    it('should return need-aware full penalty (-1.0) for intl students needing aid at need-aware schools', () => {
      const profile = makeProfile({
        isInternational: true,
        needsFinancialAid: true,
      });
      const school = makeSchoolInput({ needBlindInternational: false });

      const shifts = service.computeHookShifts(profile, school);

      const needAwareShift = shifts.find(
        (s) => s.hookType === 'NEED_AWARE_FULL',
      );
      expect(needAwareShift).toBeDefined();
      expect(needAwareShift!.logOddsShift).toBeCloseTo(-1.0, 2);
    });

    it('should not apply need-aware penalty when school is need-blind for intl', () => {
      const profile = makeProfile({
        isInternational: true,
        needsFinancialAid: true,
      });
      const school = makeSchoolInput({ needBlindInternational: true });

      const shifts = service.computeHookShifts(profile, school);

      const needAwareShift = shifts.find(
        (s) => s.hookType === 'NEED_AWARE_FULL',
      );
      expect(needAwareShift).toBeUndefined();
    });

    it('should not apply need-aware penalty for domestic students', () => {
      const profile = makeProfile({
        isInternational: false,
        needsFinancialAid: true,
      });
      const school = makeSchoolInput({ needBlindInternational: false });

      const shifts = service.computeHookShifts(profile, school);

      const needAwareShift = shifts.find(
        (s) =>
          s.hookType === 'NEED_AWARE_FULL' ||
          s.hookType === 'NEED_AWARE_PARTIAL',
      );
      expect(needAwareShift).toBeUndefined();
    });

    it('should include round bonus for ED (+0.30)', () => {
      const profile = makeProfile();
      const school = makeSchoolInput({ applicationRound: 'ED' });

      const shifts = service.computeHookShifts(profile, school);

      const roundShift = shifts.find((s) => s.hookType === 'ROUND_BONUS');
      expect(roundShift).toBeDefined();
      expect(roundShift!.logOddsShift).toBeCloseTo(0.3, 2);
    });

    it('should include round bonus for ED2 (+0.22)', () => {
      const profile = makeProfile();
      const school = makeSchoolInput({ applicationRound: 'ED2' });

      const shifts = service.computeHookShifts(profile, school);

      const roundShift = shifts.find((s) => s.hookType === 'ROUND_BONUS');
      expect(roundShift).toBeDefined();
      expect(roundShift!.logOddsShift).toBeCloseTo(0.22, 2);
    });

    it('should not include round bonus for RD (shift = 0)', () => {
      const profile = makeProfile();
      const school = makeSchoolInput({ applicationRound: 'RD' });

      const shifts = service.computeHookShifts(profile, school);

      const roundShift = shifts.find((s) => s.hookType === 'ROUND_BONUS');
      expect(roundShift).toBeUndefined();
    });

    it('should not apply legacy when school does not consider legacy', () => {
      const profile = makeProfile({
        isLegacy: true,
        legacySchools: ['Harvard University'],
      });
      const school = makeSchoolInput({
        name: 'Harvard University',
        considersLegacy: false,
      });

      const shifts = service.computeHookShifts(profile, school);

      const legacyShift = shifts.find(
        (s) =>
          s.hookType === 'LEGACY_PRIMARY' || s.hookType === 'LEGACY_SECONDARY',
      );
      expect(legacyShift).toBeUndefined();
    });

    it('should match legacy schools case-insensitively', () => {
      const profile = makeProfile({
        isLegacy: true,
        legacySchools: ['harvard university'],
      });
      const school = makeSchoolInput({ name: 'Harvard University' });

      const shifts = service.computeHookShifts(profile, school);

      const legacyShift = shifts.find((s) => s.hookType === 'LEGACY_PRIMARY');
      expect(legacyShift).toBeDefined();
    });

    it('should return empty shifts for a plain RD domestic applicant with no hooks', () => {
      const profile = makeProfile();
      const school = makeSchoolInput({ applicationRound: 'RD' });

      const shifts = service.computeHookShifts(profile, school);

      expect(shifts).toEqual([]);
    });

    it('should stack multiple hooks (first-gen + ED + legacy)', () => {
      const profile = makeProfile({
        isFirstGen: true,
        isLegacy: true,
        legacySchools: ['Harvard University'],
      });
      const school = makeSchoolInput({
        name: 'Harvard University',
        applicationRound: 'ED',
        considersLegacy: true,
      });

      const shifts = service.computeHookShifts(profile, school);

      expect(shifts.length).toBeGreaterThanOrEqual(3);
      const types = shifts.map((s) => s.hookType);
      expect(types).toContain('LEGACY_PRIMARY');
      expect(types).toContain('FIRST_GEN');
      expect(types).toContain('ROUND_BONUS');
    });
  });

  // ============================================
  // applyHooks
  // ============================================

  describe('applyHooks', () => {
    it('should return original probability when no shifts', () => {
      const result = service.applyHooks(0.5, []);

      expect(result).toBe(0.5);
    });

    it('should increase probability with positive shift', () => {
      const shifts: HookShift[] = [
        {
          hookType: 'LEGACY_PRIMARY',
          logOddsShift: 2.14,
          source: 'test',
        },
      ];

      const result = service.applyHooks(0.1, shifts);

      // adjustInLogOdds(0.10, 2.14) should significantly increase probability
      expect(result).toBeGreaterThan(0.1);
      expect(result).toBeLessThan(1.0);
    });

    it('should decrease probability with negative shift', () => {
      const shifts: HookShift[] = [
        {
          hookType: 'NEED_AWARE_FULL',
          logOddsShift: -1.0,
          source: 'test',
        },
      ];

      const result = service.applyHooks(0.5, shifts);

      expect(result).toBeLessThan(0.5);
      expect(result).toBeGreaterThan(0);
    });

    it('should cap total shift at +3.0', () => {
      const shifts: HookShift[] = [
        { hookType: 'LEGACY_PRIMARY', logOddsShift: 2.14, source: 'test' },
        { hookType: 'FIRST_GEN', logOddsShift: 0.4, source: 'test' },
        { hookType: 'ROUND_BONUS', logOddsShift: 0.3, source: 'test' },
        // Total: 2.84 — still under 3.0, add more
        { hookType: 'EXTRA', logOddsShift: 1.0, source: 'test' },
        // Total raw: 3.84, should be clamped to 3.0
      ];

      const result = service.applyHooks(0.1, shifts);
      const expectedWithCap = adjustInLogOdds(0.1, 3.0);

      expect(result).toBeCloseTo(
        Math.max(0.01, Math.min(0.99, expectedWithCap)),
        4,
      );
    });

    it('should cap total shift at -3.0', () => {
      const shifts: HookShift[] = [
        { hookType: 'PENALTY_1', logOddsShift: -2.0, source: 'test' },
        { hookType: 'PENALTY_2', logOddsShift: -2.0, source: 'test' },
        // Total raw: -4.0, should be clamped to -3.0
      ];

      const result = service.applyHooks(0.5, shifts);
      const expectedWithCap = adjustInLogOdds(0.5, -3.0);

      expect(result).toBeCloseTo(
        Math.max(0.01, Math.min(0.99, expectedWithCap)),
        4,
      );
    });

    it('should produce reasonable values via adjustInLogOdds', () => {
      // Legacy primary on a 10% base should give roughly 47-50% (OR=8.5x)
      const shifts: HookShift[] = [
        { hookType: 'LEGACY_PRIMARY', logOddsShift: 2.14, source: 'test' },
      ];

      const result = service.applyHooks(0.1, shifts);

      // 10% base * OR 8.5 => odds go from 1:9 to 8.5:9 => ~0.486
      expect(result).toBeGreaterThan(0.4);
      expect(result).toBeLessThan(0.55);
    });

    it('should clamp result to [0.01, 0.99]', () => {
      // Very high base + large positive shift
      const highResult = service.applyHooks(0.98, [
        { hookType: 'BOOST', logOddsShift: 3.0, source: 'test' },
      ]);
      expect(highResult).toBeLessThanOrEqual(0.99);

      // Very low base + large negative shift
      const lowResult = service.applyHooks(0.02, [
        { hookType: 'PENALTY', logOddsShift: -3.0, source: 'test' },
      ]);
      expect(lowResult).toBeGreaterThanOrEqual(0.01);
    });

    it('should combine multiple shifts additively in log-odds space', () => {
      const shifts: HookShift[] = [
        { hookType: 'FIRST_GEN', logOddsShift: 0.4, source: 'test' },
        { hookType: 'ROUND_BONUS', logOddsShift: 0.3, source: 'test' },
      ];

      const result = service.applyHooks(0.3, shifts);
      const expected = adjustInLogOdds(0.3, 0.7);

      expect(result).toBeCloseTo(Math.max(0.01, Math.min(0.99, expected)), 4);
    });
  });
});
