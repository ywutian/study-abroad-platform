import { Test, TestingModule } from '@nestjs/testing';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

describe('PredictionCalibrationService', () => {
  let service: PredictionCalibrationService;
  let prisma: PrismaService;
  let redis: RedisService;
  const createOutcomeRecord = (
    result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED',
    status:
      | 'SELF_REPORTED'
      | 'COUNSELOR_VERIFIED'
      | 'DOCUMENT_VERIFIED'
      | 'CONFLICTED'
      | 'CENSORED' = 'COUNSELOR_VERIFIED',
  ) => ({
    result,
    status,
    isFinal: true,
    createdAt: new Date('2026-04-09T00:00:00.000Z'),
    resolvedAt: new Date('2026-04-09T00:00:00.000Z'),
  });

  const mockPrisma = {
    schoolCalibration: {
      findMany: jest.fn(),
    },
    predictionResult: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    school: {
      findMany: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    getJSON: jest.fn().mockResolvedValue(null),
    setJSON: jest.fn().mockResolvedValue('OK'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionCalibrationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<PredictionCalibrationService>(
      PredictionCalibrationService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSchoolCalibrations', () => {
    it('should load from DB when no cache exists', async () => {
      mockPrisma.schoolCalibration.findMany.mockResolvedValue([
        { schoolId: 's1', multiplier: 1.2 },
        { schoolId: 's2', multiplier: 0.8 },
      ]);

      const result = await service.getSchoolCalibrations();

      expect(result).toEqual({ s1: 1.2, s2: 0.8 });
      expect(mockPrisma.schoolCalibration.findMany).toHaveBeenCalled();
    });

    it('should return cached value from Redis', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ s1: 1.1 }));

      const result = await service.getSchoolCalibrations();

      expect(result).toEqual({ s1: 1.1 });
      expect(mockPrisma.schoolCalibration.findMany).not.toHaveBeenCalled();
    });
  });

  describe('invalidateCalibrationCache', () => {
    it('should clear in-memory and Redis cache', async () => {
      await service.invalidateCalibrationCache();

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('applyPlattCalibration', () => {
    it('should apply sigmoid transformation and clamp', () => {
      const result = service.applyPlattCalibration(0.5, { a: 1, b: 0 });

      expect(result).toBeGreaterThanOrEqual(0.05);
      expect(result).toBeLessThanOrEqual(0.95);
    });
  });

  describe('getPlattCalibration', () => {
    it('should query verified headline outcomes only', async () => {
      mockPrisma.predictionResult.findMany.mockResolvedValue(
        Array.from({ length: 50 }, (_, index) => ({
          schoolId: `school-${index}`,
          probability: 0.2 + (index % 5) * 0.1,
          outcomeLabelRecords: [
            createOutcomeRecord(index % 2 === 0 ? 'ADMITTED' : 'REJECTED'),
          ],
        })),
      );

      const result = await service.getPlattCalibration();

      expect(result).not.toBeNull();
      expect(mockPrisma.predictionResult.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ source: null }, { source: { notIn: ['quick-match'] } }],
          outcomeLabelRecords: {
            some: {
              status: { in: ['COUNSELOR_VERIFIED', 'DOCUMENT_VERIFIED'] },
              result: { in: ['ADMITTED', 'REJECTED'] },
            },
          },
        },
        select: {
          schoolId: true,
          probability: true,
          outcomeLabelRecords: {
            select: {
              result: true,
              status: true,
              isFinal: true,
              createdAt: true,
              resolvedAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });
  });

  describe('getCalibrationStats', () => {
    it('should return empty stats when no calibrations exist', async () => {
      mockPrisma.schoolCalibration.findMany.mockResolvedValue([]);

      const result = await service.getCalibrationStats();

      expect(result.totalCalibrations).toBe(0);
      expect(result.averageMultiplier).toBe(1.0);
    });

    it('should compute distribution from multipliers', async () => {
      mockPrisma.schoolCalibration.findMany.mockResolvedValue([
        { multiplier: 1.2 },
        { multiplier: 0.8 },
        { multiplier: 1.0 },
      ]);

      const result = await service.getCalibrationStats();

      expect(result.totalCalibrations).toBe(3);
      expect(result.boostedCount).toBe(1);
      expect(result.reducedCount).toBe(1);
      expect(result.distribution).toBeDefined();
    });
  });

  describe('getSchoolsNeedingCalibration', () => {
    it('should build drift suggestions from verified headline outcomes only', async () => {
      mockPrisma.schoolCalibration.findMany.mockResolvedValue([]);
      mockPrisma.predictionResult.findMany.mockResolvedValue([
        {
          schoolId: 'school-1',
          probability: 0.85,
          outcomeLabelRecords: [createOutcomeRecord('REJECTED')],
        },
        {
          schoolId: 'school-1',
          probability: 0.82,
          outcomeLabelRecords: [createOutcomeRecord('REJECTED')],
        },
        {
          schoolId: 'school-1',
          probability: 0.88,
          outcomeLabelRecords: [createOutcomeRecord('REJECTED')],
        },
        {
          schoolId: 'school-1',
          probability: 0.81,
          outcomeLabelRecords: [createOutcomeRecord('REJECTED')],
        },
        {
          schoolId: 'school-1',
          probability: 0.84,
          outcomeLabelRecords: [createOutcomeRecord('REJECTED')],
        },
      ]);
      mockPrisma.school.findMany.mockResolvedValue([
        {
          id: 'school-1',
          name: 'MIT',
          nameZh: '麻省理工',
          usNewsRank: 2,
        },
      ]);

      const result = await service.getSchoolsNeedingCalibration();

      expect(result).toEqual([
        expect.objectContaining({
          schoolId: 'school-1',
          schoolName: 'MIT',
          predictionCount: 5,
        }),
      ]);
    });
  });
});
