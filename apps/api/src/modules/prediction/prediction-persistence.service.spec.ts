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
          source: 'prediction',
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
          source: 'prediction',
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
        },
      });
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

    it('should use v3-enterprise model version', async () => {
      await service.savePrediction('profile-1', 'school-1', mockResult);

      const upsertCall = (prisma.predictionResult.upsert as jest.Mock).mock
        .calls[0][0];
      expect(upsertCall.create.modelVersion).toBe('v3-enterprise');
      expect(upsertCall.update.modelVersion).toBe('v3-enterprise');
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
