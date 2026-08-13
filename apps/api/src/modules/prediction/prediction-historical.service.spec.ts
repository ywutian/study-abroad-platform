import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionHistoricalService } from './prediction-historical.service';

describe('PredictionHistoricalService', () => {
  let service: PredictionHistoricalService;

  const mockPrisma = {
    admissionCase: {
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
        PredictionHistoricalService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<PredictionHistoricalService>(
      PredictionHistoricalService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSchoolDistribution', () => {
    it('should return null when fewer than 30 cases', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue(
        Array(10).fill({ satRange: '1400-1500', gpaRange: '3.8-4.0' }),
      );

      const result = await service.getSchoolDistribution('school-1');

      expect(result).toBeNull();
    });

    it('should return distribution when 30+ cases exist', async () => {
      const cases = Array(35)
        .fill(null)
        .map(() => ({
          satRange: '1400-1500',
          gpaRange: '3.8-4.0',
          toeflRange: '105-110',
          testScores: null,
          highSchoolType: null,
          curriculumType: null,
          demographicTags: [],
        }));
      mockPrisma.admissionCase.findMany.mockResolvedValue(cases);

      const result = await service.getSchoolDistribution('school-1');

      expect(result).not.toBeNull();
      expect(result!.sampleCount).toBe(35);
    });

    it('should return cached distribution from Redis', async () => {
      mockRedis.getJSON.mockResolvedValue({
        sampleCount: 50,
        satValues: [1400],
        gpaValues: [3.9],
        toeflValues: [105],
      });

      const result = await service.getSchoolDistribution('school-1');

      expect(result).not.toBeNull();
      expect(result!.sampleCount).toBe(50);
      expect(mockPrisma.admissionCase.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getHistoricalProbability', () => {
    it('should return null when fewer than 10 cases', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue(
        Array(5).fill({ result: 'ADMITTED', gpaRange: '3.9', satRange: null }),
      );

      const result = await service.getHistoricalProbability(
        { gpa: 3.9 } as any,
        'school-1',
      );

      expect(result).toBeNull();
    });

    it('should return probability when sufficient cases exist', async () => {
      const cases = Array(15)
        .fill(null)
        .map((_, i) => ({
          result: i < 8 ? 'ADMITTED' : 'REJECTED',
          gpaRange: '3.8-4.0',
          satRange: '1450-1500',
          toeflRange: null,
          testScores: null,
          highSchoolType: null,
          curriculumType: null,
          demographicTags: [],
        }));
      mockPrisma.admissionCase.findMany.mockResolvedValue(cases);

      const result = await service.getHistoricalProbability(
        { gpa: 3.9, gpaScale: 4, satScore: 1470 } as any,
        'school-1',
      );

      expect(result).not.toBeNull();
      expect(result!.probability).toBeGreaterThanOrEqual(0.05);
      expect(result!.probability).toBeLessThanOrEqual(0.95);
      expect(result!.sampleCount).toBe(15);
    });
  });

  describe('getNationalityStats', () => {
    it('should return null when fewer than 3 cases', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([
        { result: 'ADMITTED' },
      ]);

      const result = await service.getNationalityStats('school-1', 'China');

      expect(result).toBeNull();
    });

    it('should compute admit rate from cases', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([
        { result: 'ADMITTED' },
        { result: 'ADMITTED' },
        { result: 'REJECTED' },
        { result: 'REJECTED' },
      ]);

      const result = await service.getNationalityStats('school-1', 'China');

      expect(result).not.toBeNull();
      expect(result!.totalCases).toBe(4);
      expect(result!.admittedCases).toBe(2);
      expect(result!.admitRate).toBe(50);
    });
  });

  describe('invalidateSchoolCache', () => {
    it('should delete Redis cache key', async () => {
      await service.invalidateSchoolCache('school-1');

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
