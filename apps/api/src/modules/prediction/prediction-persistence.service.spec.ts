import { Test, TestingModule } from '@nestjs/testing';
import { PredictionPersistenceService } from './prediction-persistence.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionResultDto } from './dto';

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
          profileId_schoolId: {
            profileId: 'profile-1',
            schoolId: 'school-1',
          },
        },
        update: {
          probability: 0.45,
          probabilityLow: 0.35,
          probabilityHigh: 0.55,
          factors: mockResult.factors,
          tier: 'reach',
          confidence: 'medium',
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

    it('should preserve explicit modelVersion when provided', async () => {
      await service.savePrediction('profile-1', 'school-1', {
        ...mockResult,
        modelVersion: 'v5-ml-primary',
      });

      const upsertCall = (prisma.predictionResult.upsert as jest.Mock).mock
        .calls[0][0];
      const snapshotCall = (prisma.predictionSnapshot.create as jest.Mock).mock
        .calls[0][0];

      expect(upsertCall.create.modelVersion).toBe('v5-ml-primary');
      expect(upsertCall.update.modelVersion).toBe('v5-ml-primary');
      expect(snapshotCall.data.modelVersion).toBe('v5-ml-primary');
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
