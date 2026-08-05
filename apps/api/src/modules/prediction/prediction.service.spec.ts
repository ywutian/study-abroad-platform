import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { FeatureFlagService } from '../../common/feature-flags/feature-flag.service';
import { PointsService } from '../points/incentive.service';
import { PredictionService } from './prediction.service';
import { PredictionTransformerService } from './prediction-transformer.service';
import { PredictionStatisticalEngine } from './prediction-statistical-engine.service';
import { PredictionAiEngine } from './prediction-ai-engine.service';
import { PredictionFusionEngine } from './prediction-fusion-engine.service';
import { PredictionCacheService } from './prediction-cache.service';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PredictionHistoricalService } from './prediction-historical.service';
import { PredictionMemoryService } from './prediction-memory.service';
import { PredictionPersistenceService } from './prediction-persistence.service';
import { PredictionReportingService } from './prediction-reporting.service';
import { PredictionPolicyService } from './prediction-policy.service';
// ML platform services (PredictionMlPrimaryService, ModelRegistryService,
// ShadowEvaluatorService, ModelMonitorService, benchmark DistillationService)
// removed 2026-05-07; counselor mode is the only served path.
import { CompliantDistillationService } from './distillation/compliant-distillation.service';
import { DistillationObservationService } from './distillation/distillation-observation.service';
import { CounselorEngineService } from './counselor/counselor-engine.service';

const mockProfile = {
  id: 'profile-1',
  userId: 'user-1',
  gpa: '3.9',
  gpaScale: 4,
  targetMajor: 'Computer Science',
  applicationRound: 'RD',
  nationality: 'US',
  firstGeneration: false,
  recruitedAthlete: false,
  testScores: [{ type: 'SAT', score: 1500, subScores: {} }],
  activities: [],
  awards: [],
  education: [],
};

const mockSchool = {
  id: 'school-1',
  name: 'Massachusetts Institute of Technology',
  nameZh: '麻省理工',
  country: 'US',
  state: 'MA',
  acceptanceRate: 4,
  satAvg: 1540,
  sat25: 1510,
  sat75: 1580,
  act25: 34,
  act75: 36,
  usNewsRank: 2,
  isPrivate: true,
  needBlindInternational: true,
  intlAcceptanceRate: null,
  oosAcceptanceRate: null,
  edAcceptanceRate: null,
  eaAcceptanceRate: null,
  gpaDistribution: null,
};

function counselorResult(overrides: Record<string, unknown> = {}) {
  return {
    probability: 0.42,
    anchor: 0.04,
    tier: 2,
    anchorSource: 'scorecard (acceptanceRate + SAT bands)',
    factors: [
      {
        name: 'School baseline admit rate',
        impact: 'neutral',
        weight: 1,
        detail: 'Anchored at 4.0% (scorecard, Tier 2)',
      },
    ],
    modifierResults: {
      gpaBand: {
        multiplier: 1.1,
        label: 'GPA',
        evidence: 'fixture',
        impact: 'positive',
      },
    },
    missingFields: [],
    sourceContributions: [],
    ruleVersion: 'counselor-cold-start-v2.0-data-activated',
    ...overrides,
  };
}

describe('PredictionService counselor primary', () => {
  let service: PredictionService;
  let prisma: any;
  let aiEngine: any;
  let fusionEngine: any;
  let cacheService: any;
  let persistenceService: any;
  let counselorEngine: any;

  beforeEach(async () => {
    prisma = {
      profile: { findUnique: jest.fn().mockResolvedValue(mockProfile) },
      school: { findMany: jest.fn().mockResolvedValue([mockSchool]) },
      // 2026-05 Phase 1 Bug 1+2: predict() now validates schoolIds via
      // schoolListItem.findMany ({ where: { userId, schoolId: { in: [...] } } })
      // and completeness via schoolListItem.count. Mock findMany to echo
      // back whatever schoolIds were requested (so I2 ownership check
      // passes), and count to return a positive number (so I1
      // completeness check has a non-zero targetSchools weight).
      schoolListItem: {
        findMany: jest
          .fn()
          .mockImplementation(
            (args?: { where?: { schoolId?: { in?: string[] } } }) => {
              const requested = args?.where?.schoolId?.in;
              if (Array.isArray(requested)) {
                return Promise.resolve(
                  requested.map((schoolId) => ({ schoolId, round: 'RD' })),
                );
              }
              return Promise.resolve([]);
            },
          ),
        count: jest.fn().mockResolvedValue(1),
      },
      assessmentResult: { findMany: jest.fn().mockResolvedValue([]) },
      schoolProgram: { findMany: jest.fn().mockResolvedValue([]) },
      predictionResult: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };
    aiEngine = { predictWithAI: jest.fn() };
    fusionEngine = { fusePredictions: jest.fn() };
    cacheService = {
      hashProfileData: jest.fn().mockReturnValue('profile-hash'),
      getFromCache: jest.fn().mockResolvedValue(null),
      saveToCache: jest.fn().mockResolvedValue(undefined),
      invalidateUserCache: jest.fn().mockResolvedValue(undefined),
    };
    persistenceService = {
      savePrediction: jest.fn().mockResolvedValue({
        predictionResultId: 'prediction-result-1',
        predictionSnapshotId: 'prediction-snapshot-1',
      }),
    };
    counselorEngine = {
      compute: jest.fn().mockResolvedValue(counselorResult()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RedisService,
          useValue: {
            setNX: jest.fn().mockResolvedValue(true),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictionTransformerService,
          useClass: PredictionTransformerService,
        },
        {
          provide: PredictionStatisticalEngine,
          useValue: { predictWithStats: jest.fn() },
        },
        { provide: PredictionAiEngine, useValue: aiEngine },
        { provide: PredictionFusionEngine, useValue: fusionEngine },
        { provide: PredictionCacheService, useValue: cacheService },
        {
          provide: PredictionCalibrationService,
          useValue: {
            getPlattCalibration: jest.fn().mockResolvedValue(null),
            getSchoolCalibrations: jest.fn().mockResolvedValue({}),
            invalidateCalibrationCache: jest.fn(),
            applyPlattCalibration: jest.fn(),
          },
        },
        {
          provide: PredictionHistoricalService,
          useValue: {
            getSchoolDistribution: jest.fn().mockResolvedValue(null),
            getHistoricalProbability: jest.fn().mockResolvedValue(null),
            getNationalityStats: jest.fn().mockResolvedValue(null),
            getFeederSignal: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: PredictionMemoryService,
          useValue: {
            getMemoryContext: jest.fn().mockResolvedValue({
              previousPredictions: [],
              knownPreferences: [],
              profileInsights: [],
              memoryAdjustments: new Map(),
            }),
            recordPredictionToMemory: jest.fn().mockResolvedValue(undefined),
            recordBridgePredictionToMemory: jest.fn(),
          },
        },
        { provide: PredictionPersistenceService, useValue: persistenceService },
        {
          provide: PredictionReportingService,
          useValue: {
            getPredictionHistory: jest.fn(),
            reportActualResult: jest.fn(),
            getCalibrationData: jest.fn(),
          },
        },
        {
          provide: PredictionPolicyService,
          useValue: {
            resolveServedPolicyVersionId: jest
              .fn()
              .mockReturnValue('policy-v1'),
            buildTracePayload: jest.fn().mockReturnValue({
              policyVersionId: 'policy-v1',
              cohortKey: 'US__US_HS',
              roundContext: 'RD',
              priorTier: 'school_overall_fallback',
              driftSignalIds: [],
              relationshipSignalIds: [],
              calibrationPath: [],
              uncertaintyReasons: [],
              sourceSummary: [],
            }),
          },
        },
        { provide: PointsService, useValue: { charge: jest.fn() } },
        {
          provide: FeatureFlagService,
          useValue: { isEnabled: jest.fn().mockResolvedValue(false) },
        },
        { provide: CompliantDistillationService, useValue: {} },
        {
          provide: DistillationObservationService,
          useValue: { record: jest.fn() },
        },
        { provide: CounselorEngineService, useValue: counselorEngine },
      ],
    }).compile();

    service = module.get(PredictionService);
  });

  it('serves counselor directly and drops fusion response fields', async () => {
    const output = await service.predict('profile-1', ['school-1'], true, 'en');

    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toMatchObject({
      schoolId: 'school-1',
      probability: 0.42,
      predictionMethod: 'counselor',
      modelVersion: 'counselor-cold-start-v2.0-data-activated',
    });
    expect(output.results[0].engineScores).toBeUndefined();
    expect(output.results[0].crossEngineConsistency).toBeUndefined();
    expect(aiEngine.predictWithAI).not.toHaveBeenCalled();
    expect(fusionEngine.fusePredictions).not.toHaveBeenCalled();
    expect(cacheService.saveToCache).toHaveBeenCalledWith(
      'profile-1',
      'school-1',
      expect.objectContaining({ predictionMethod: 'counselor' }),
      'profile-hash',
      'policy-v1',
      'counselor-v2',
    );

    const persisted = persistenceService.savePrediction.mock.calls[0][2];
    expect(persisted.servedTrace.engine).toBe('counselor');
    expect(persisted.servedTrace.counselor.ruleVersion).toBe(
      'counselor-cold-start-v2.0-data-activated',
    );
    expect(persisted.servedTrace.shadow).toBeUndefined();
  });

  it('uses per-school application round in the counselor call', async () => {
    prisma.schoolListItem.findMany.mockResolvedValue([
      { schoolId: 'school-1', round: 'EA' },
    ]);

    const output = await service.predict('profile-1', ['school-1'], true, 'en');

    expect(counselorEngine.compute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'EA',
    );
    expect(output.results[0].roundContext).toBe('EA');
  });

  it('returns Tier 4 unavailable without persistence or cache writes', async () => {
    counselorEngine.compute.mockResolvedValueOnce(
      counselorResult({
        probability: 0,
        anchor: 0,
        tier: 4,
        anchorSource: 'none',
        factors: [],
        insufficientData: { reason: 'school_missing_acceptance_rate' },
        modifierResults: {},
        missingFields: ['school.acceptanceRate'],
        sourceContributions: [],
      }),
    );

    const output = await service.predict('profile-1', ['school-1'], true, 'en');

    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toMatchObject({
      probability: null,
      tier: 'unavailable',
      predictionMethod: 'insufficient_data',
      insufficientData: {
        tier: 4,
        reason: 'school_missing_acceptance_rate',
      },
    });
    expect(output.results[0].sourceSummary?.[0]?.label).toBe(
      'Insufficient data',
    );
    expect(persistenceService.savePrediction).not.toHaveBeenCalled();
    expect(cacheService.saveToCache).not.toHaveBeenCalled();
  });

  it('previewPredict defaults to counselor and exposes trace only when requested', async () => {
    const output = await service.previewPredict(
      {
        gpa: 3.9,
        gpaScale: 4,
        targetMajor: 'Computer Science',
        testScores: [{ type: 'SAT', score: 1500 }],
        activities: [],
        awards: [],
      },
      ['school-1'],
      { includeServedTrace: true, applicationRound: 'RD', locale: 'en' },
    );

    expect(output.results).toHaveLength(1);
    expect(output.results[0].predictionMethod).toBe('counselor');
    expect((output.results[0] as any).servedTrace.engine).toBe('counselor');
    expect(persistenceService.savePrediction).not.toHaveBeenCalled();
    expect(cacheService.saveToCache).not.toHaveBeenCalled();
  });

  describe('served suggestions: factual early-round + low-confidence specificity', () => {
    const baseProfile = (overrides: Record<string, unknown> = {}) =>
      ({
        targetMajor: 'Computer Science',
        testScores: [{ type: 'SAT', score: 1500 }],
        activities: [],
        awards: [],
        ...overrides,
      }) as any;

    const earlyTip = (school: Record<string, unknown>, profile: any) =>
      (service as any).buildEarlyRoundSuggestion(school, profile, '', false) as
        string | null;

    const callSuggest = (
      tier: 'reach' | 'match' | 'safety',
      confidence: 'low' | 'medium' | 'high',
      profile: any,
      school: Record<string, unknown>,
    ) =>
      (service as any).generateSuggestions(
        tier,
        confidence,
        profile,
        school,
        undefined,
        'en',
      ) as string[];

    /**
     * The feedback was "the estimate is good but Improve chances needs to be
     * bigger and carry more of these". A reach school produced exactly TWO
     * suggestions — the essay tip and the early-round tip — while
     * MAJOR_CATEGORY_PROGRAMS held 46 major-matched entries that could only
     * ever appear as a comma-joined fragment inside someone else's bullet.
     * `competitionNames` was never referenced on the reach path at all.
     */
    it('gives a reach school named programs as suggestions of their own', () => {
      const out = callSuggest(
        'reach',
        'high',
        baseProfile({ targetMajor: 'Computer Science' }),
        { hasEarlyDecision: true },
      );

      // Was 2 before: essay + early round.
      expect(out.length).toBeGreaterThan(2);
      // Both catalogue halves must surface, not just summer-inside-early-round.
      expect(out.some((s) => /summer program/i.test(s))).toBe(true);
      expect(out.some((s) => /competition/i.test(s))).toBe(true);
    });

    it('does not re-suggest a program the student already lists', () => {
      const withRsi = baseProfile({
        targetMajor: 'Computer Science',
        activities: [{ name: 'RSI' }],
      });
      const out = callSuggest('reach', 'high', withRsi, {
        hasEarlyDecision: true,
      });

      // Dedup is by activity name against the catalogue; RSI must not come back
      // as advice to go do RSI.
      const summerLine = out.find((s) => /summer program/i.test(s)) ?? '';
      expect(summerLine).not.toMatch(/\bRSI\b/);
    });

    it('still caps at 5 so the panel cannot be flooded', () => {
      const thin = baseProfile({
        targetMajor: 'Computer Science',
        testScores: [],
        activities: [],
        awards: [],
      });
      expect(
        callSuggest('reach', 'low', thin, { hasEarlyDecision: true }).length,
      ).toBeLessThanOrEqual(5);
    });

    // ---- fix ②: early-round advice must match what the school actually offers ----
    it('recommends non-binding Early Action — never ED — for an EA-only school (MIT)', () => {
      const tip = earlyTip(
        { hasEarlyDecision: false, hasEarlyAction: true },
        baseProfile({ isInternational: true }),
      );
      expect(tip).toMatch(/Early Action/i);
      expect(tip).not.toMatch(/Early Decision/i);
    });

    it('recommends binding ED with an aid caveat for international applicants at an ED school', () => {
      const tip = earlyTip(
        { hasEarlyDecision: true },
        baseProfile({ isInternational: true }),
      );
      expect(tip).toMatch(/Early Decision/i);
      expect((tip ?? '').toLowerCase()).toContain('binding');
      expect((tip ?? '').toLowerCase()).toContain('financial-aid');
    });

    it('does NOT attach the binding-aid caveat for a domestic full-pay applicant', () => {
      const tip = earlyTip({ hasEarlyDecision: true }, baseProfile());
      expect(tip).toMatch(/Early Decision/i);
      expect((tip ?? '').toLowerCase()).not.toContain('financial-aid');
    });

    it('invents no early round when the school offers none (UC system)', () => {
      const tip = earlyTip(
        { hasEarlyDecision: false, hasEarlyAction: false },
        baseProfile(),
      );
      expect(tip).toBeNull();
    });

    it('reach suggestions for an EA-only school never tell the applicant to apply ED', () => {
      const joined = callSuggest('reach', 'high', baseProfile(), {
        hasEarlyDecision: false,
        hasEarlyAction: true,
        acceptanceRate: 4,
      }).join(' || ');
      expect(joined).not.toMatch(/Early Decision/i);
      expect(joined).toMatch(/Early Action/i);
    });

    // ---- fix ③: low-confidence noise → specific actionable gaps ----
    it('drops the vague "data is limited / complete your profile" line at low confidence', () => {
      const suggestions = callSuggest(
        'reach',
        'low',
        baseProfile({
          activities: [{ category: 'STEM', role: 'Lead' }],
          awards: [{ level: 'NATIONAL' }],
        }),
        { hasEarlyAction: true, acceptanceRate: 4 },
      );
      expect(suggestions.join(' ')).not.toMatch(
        /data is limited|complete your profile/i,
      );
    });

    it('names the specific missing soft factors at low confidence instead of a generic nudge', () => {
      const joined = callSuggest('match', 'low', baseProfile(), {
        acceptanceRate: 40,
      }).join(' ');
      expect(joined).toMatch(/activities|awards/i);
      expect(joined).toContain('profile');
    });
  });
});
