import { resolveApplicationYear } from '@study-abroad/shared';
import { Test, TestingModule } from '@nestjs/testing';
import { PredictionPersistenceService } from './prediction-persistence.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionResultDto } from './dto';
import { COUNSELOR_RULE_VERSION } from './counselor/counselor-engine.service';
import * as Sentry from '@sentry/node';

jest.mock('@sentry/node');

describe('PredictionPersistenceService', () => {
  let service: PredictionPersistenceService;
  let prisma: PrismaService;

  const mockResult: PredictionResultDto = {
    schoolId: 'school-1',
    schoolName: 'MIT',
    probability: 0.45,
    probabilityLow: 0.35,
    probabilityHigh: 0.55,
    confidence: 'medium',
    tier: 'reach',
    factors: [
      {
        name: 'GPA',
        impact: 'positive',
        weight: 0.3,
        detail: 'GPA 3.85 is competitive',
      },
    ],
    suggestions: ['Consider research experience'],
    comparison: {
      gpaPercentile: 85,
      testScorePercentile: 80,
      activityStrength: 'strong',
    },
    engineScores: {
      stats: 0.45,
      ai: 0.4,
      weights: { stats: 0.5, ai: 0.5 },
      fusionMethod: 'weighted_ensemble_2_stats_ai',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionPersistenceService,
        {
          provide: PrismaService,
          useValue: {
            predictionPolicyVersion: {
              findUnique: jest.fn().mockResolvedValue(null),
              upsert: jest.fn().mockResolvedValue({
                id: 'legacy-v3-enterprise',
              }),
            },
            predictionResult: {
              upsert: jest.fn().mockResolvedValue({ id: 'pred-1' }),
            },
            predictionSnapshot: {
              create: jest.fn().mockResolvedValue({ id: 'snap-1' }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PredictionPersistenceService>(
      PredictionPersistenceService,
    );
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('savePrediction', () => {
    it('should upsert prediction result with correct data', async () => {
      await service.savePrediction('profile-1', 'school-1', mockResult);

      expect(prisma.predictionResult.upsert).toHaveBeenCalledWith({
        where: {
          profileId_schoolId_applicationYear: {
            profileId: 'profile-1',
            schoolId: 'school-1',
            applicationYear: resolveApplicationYear(),
          },
        },
        update: {
          probability: 0.45,
          probabilityLow: 0.35,
          probabilityHigh: 0.55,
          factors: mockResult.factors,
          tier: 'reach',
          confidence: 'medium',
          applicationRound: undefined,
          // Derived, never hardcoded: a literal year would go red every
          // August when the season rolls over.
          applicationYear: resolveApplicationYear(),
          engineScores: mockResult.engineScores,
          suggestions: mockResult.suggestions,
          comparison: mockResult.comparison,
          modelVersion: 'v3-enterprise',
          policyVersionId: undefined,
          source: 'prediction',
          authority: 'AUTHORITATIVE',
        },
        create: {
          profileId: 'profile-1',
          schoolId: 'school-1',
          probability: 0.45,
          probabilityLow: 0.35,
          probabilityHigh: 0.55,
          factors: mockResult.factors,
          tier: 'reach',
          confidence: 'medium',
          applicationRound: undefined,
          // Derived, never hardcoded: a literal year would go red every
          // August when the season rolls over.
          applicationYear: resolveApplicationYear(),
          engineScores: mockResult.engineScores,
          suggestions: mockResult.suggestions,
          comparison: mockResult.comparison,
          modelVersion: 'v3-enterprise',
          policyVersionId: undefined,
          source: 'prediction',
          authority: 'AUTHORITATIVE',
        },
      });
    });

    it('should create a prediction snapshot for trend tracking', async () => {
      await service.savePrediction('profile-1', 'school-1', mockResult);

      expect(prisma.predictionSnapshot.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          schoolId: 'school-1',
          probability: 0.45,
          probabilityLow: 0.35,
          probabilityHigh: 0.55,
          tier: 'reach',
          confidence: 'medium',
          applicationRound: undefined,
          // Derived, never hardcoded: a literal year would go red every
          // August when the season rolls over.
          applicationYear: resolveApplicationYear(),
          source: 'prediction',
          modelVersion: 'v3-enterprise',
          policyVersionId: undefined,
          authority: 'AUTHORITATIVE',
        },
      });
    });

    it('should declare authority=AUTHORITATIVE on upsert + snapshot', async () => {
      await service.savePrediction('profile-1', 'school-1', mockResult);

      const upsertCall = (prisma.predictionResult.upsert as jest.Mock).mock
        .calls[0][0];
      expect(upsertCall.create.authority).toBe('AUTHORITATIVE');
      expect(upsertCall.update.authority).toBe('AUTHORITATIVE');

      const snapshotCall = (prisma.predictionSnapshot.create as jest.Mock).mock
        .calls[0][0];
      expect(snapshotCall.data.authority).toBe('AUTHORITATIVE');
    });

    it('should call upsert before snapshot (sequential)', async () => {
      const callOrder: string[] = [];
      (prisma.predictionResult.upsert as jest.Mock).mockImplementation(
        async () => {
          callOrder.push('upsert');
          return { id: 'pred-1' };
        },
      );
      (prisma.predictionSnapshot.create as jest.Mock).mockImplementation(
        async () => {
          callOrder.push('snapshot');
          return { id: 'snap-1' };
        },
      );

      await service.savePrediction('profile-1', 'school-1', mockResult);

      expect(callOrder).toEqual(['upsert', 'snapshot']);
    });

    it('should not throw when upsert fails (graceful degradation)', async () => {
      (prisma.predictionResult.upsert as jest.Mock).mockRejectedValue(
        new Error('Unique constraint violation P2002'),
      );

      await expect(
        service.savePrediction('profile-1', 'school-1', mockResult),
      ).resolves.not.toThrow();
    });

    it('reports a swallowed persist failure to Sentry (no more silent drops — v5-ml-primary lesson)', async () => {
      (prisma.predictionResult.upsert as jest.Mock).mockRejectedValue(
        new Error('FK constraint violation P2003'),
      );

      await service.savePrediction('profile-1', 'school-1', mockResult);

      // The failure is still swallowed (best-effort persistence), but it must be
      // REPORTED, not silent — that silence is how the v5-ml-primary FK drop hid.
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ area: 'prediction-persistence' }),
        }),
      );
    });

    it('should not throw when snapshot creation fails', async () => {
      (prisma.predictionSnapshot.create as jest.Mock).mockRejectedValue(
        new Error('FK constraint violation'),
      );

      await expect(
        service.savePrediction('profile-1', 'school-1', mockResult),
      ).resolves.not.toThrow();
    });

    it('should skip snapshot when upsert fails', async () => {
      (prisma.predictionResult.upsert as jest.Mock).mockRejectedValue(
        new Error('DB connection lost'),
      );

      await service.savePrediction('profile-1', 'school-1', mockResult);

      // Since the entire try block fails at upsert, snapshot should not be called
      expect(prisma.predictionSnapshot.create).not.toHaveBeenCalled();
    });

    it('should default to v3-enterprise when result modelVersion is absent', async () => {
      await service.savePrediction('profile-1', 'school-1', mockResult);

      const upsertCall = (prisma.predictionResult.upsert as jest.Mock).mock
        .calls[0][0];
      expect(upsertCall.create.modelVersion).toBe('v3-enterprise');
      expect(upsertCall.update.modelVersion).toBe('v3-enterprise');
    });

    it('self-heals the counselor served-policy lineage instead of throwing (v5-ml-primary regression)', async () => {
      // The served path stamps policyVersionId = the engine rule version, which
      // is NOT a hand-seeded DB row. Persistence must self-heal it (like legacy),
      // NOT throw MissingPredictionPolicyVersionError as it would for the stale
      // v5-ml-primary id.
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (prisma.predictionPolicyVersion.upsert as jest.Mock).mockResolvedValue({
        id: COUNSELOR_RULE_VERSION,
      });

      await expect(
        service.savePrediction('profile-1', 'school-1', {
          ...mockResult,
          policyVersionId: COUNSELOR_RULE_VERSION,
        }),
      ).resolves.toBeDefined();

      // counselor policy row upserted ACTIVE → FK satisfied, no throw
      expect(prisma.predictionPolicyVersion.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: COUNSELOR_RULE_VERSION },
          create: expect.objectContaining({
            id: COUNSELOR_RULE_VERSION,
            version: COUNSELOR_RULE_VERSION,
            status: 'ACTIVE',
          }),
        }),
      );
      const counselorUpsert = (prisma.predictionResult.upsert as jest.Mock).mock
        .calls[0][0];
      expect(counselorUpsert.create.policyVersionId).toBe(
        COUNSELOR_RULE_VERSION,
      );
    });

    it('should preserve explicit modelVersion when provided', async () => {
      await service.savePrediction('profile-1', 'school-1', {
        ...mockResult,
        modelVersion: 'counselor-cold-start-v1',
      });

      const upsertCall = (prisma.predictionResult.upsert as jest.Mock).mock
        .calls[0][0];
      const snapshotCall = (prisma.predictionSnapshot.create as jest.Mock).mock
        .calls[0][0];

      expect(upsertCall.create.modelVersion).toBe('counselor-cold-start-v1');
      expect(upsertCall.update.modelVersion).toBe('counselor-cold-start-v1');
      expect(snapshotCall.data.modelVersion).toBe('counselor-cold-start-v1');
    });

    it('should persist policyVersionId when it exists', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'policy-v1',
      });

      await service.savePrediction('profile-1', 'school-1', {
        ...mockResult,
        policyVersionId: 'policy-v1',
      });

      const upsertCall = (prisma.predictionResult.upsert as jest.Mock).mock
        .calls[0][0];
      const snapshotCall = (prisma.predictionSnapshot.create as jest.Mock).mock
        .calls[0][0];

      expect(upsertCall.create.policyVersionId).toBe('policy-v1');
      expect(upsertCall.update.policyVersionId).toBe('policy-v1');
      expect(snapshotCall.data.policyVersionId).toBe('policy-v1');
    });

    it('should backfill legacy policyVersionId before persisting', async () => {
      await service.savePrediction('profile-1', 'school-1', {
        ...mockResult,
        policyVersionId: 'legacy-v3-enterprise',
      });

      const upsertCall = (prisma.predictionResult.upsert as jest.Mock).mock
        .calls[0][0];
      const snapshotCall = (prisma.predictionSnapshot.create as jest.Mock).mock
        .calls[0][0];

      expect(prisma.predictionPolicyVersion.upsert).toHaveBeenCalledWith({
        where: { id: 'legacy-v3-enterprise' },
        update: {},
        create: expect.objectContaining({
          id: 'legacy-v3-enterprise',
          policyKey: 'default',
          version: 'legacy-v3-enterprise',
          status: 'RETIRED',
        }),
        select: { id: true },
      });
      expect(upsertCall.create.policyVersionId).toBe('legacy-v3-enterprise');
      expect(upsertCall.update.policyVersionId).toBe('legacy-v3-enterprise');
      expect(snapshotCall.data.policyVersionId).toBe('legacy-v3-enterprise');
    });

    it('should refuse to persist unknown non-legacy policyVersionId', async () => {
      const errorSpy = jest
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);

      await service.savePrediction('profile-1', 'school-1', {
        ...mockResult,
        policyVersionId: 'policy-missing',
      });

      expect(prisma.predictionPolicyVersion.upsert).not.toHaveBeenCalled();
      expect(prisma.predictionResult.upsert).not.toHaveBeenCalled();
      expect(prisma.predictionSnapshot.create).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Prediction policy version policy-missing not found',
      );
    });

    it('should handle result with undefined optional fields', async () => {
      const minimalResult: PredictionResultDto = {
        schoolId: 'school-1',
        schoolName: 'Test School',
        probability: 0.5,
        confidence: 'low',
        tier: 'match',
        factors: [],
        suggestions: [],
        comparison: {
          gpaPercentile: 50,
          testScorePercentile: 50,
          activityStrength: 'average',
        },
      };

      await expect(
        service.savePrediction('profile-1', 'school-1', minimalResult),
      ).resolves.not.toThrow();

      expect(prisma.predictionResult.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            probability: 0.5,
            probabilityLow: undefined,
            probabilityHigh: undefined,
            engineScores: undefined,
          }),
        }),
      );
    });

    it('should use source "prediction" for both create and update', async () => {
      await service.savePrediction('profile-1', 'school-1', mockResult);

      const upsertCall = (prisma.predictionResult.upsert as jest.Mock).mock
        .calls[0][0];
      expect(upsertCall.create.source).toBe('prediction');
      expect(upsertCall.update.source).toBe('prediction');

      const snapshotCall = (prisma.predictionSnapshot.create as jest.Mock).mock
        .calls[0][0];
      expect(snapshotCall.data.source).toBe('prediction');
    });
  });
});
