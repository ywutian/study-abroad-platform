import { Test, TestingModule } from '@nestjs/testing';
import { PredictionReportingService } from './prediction-reporting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

describe('PredictionReportingService', () => {
  let service: PredictionReportingService;
  let prisma: PrismaService;
  let memoryManager: MemoryManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionReportingService,
        {
          provide: PrismaService,
          useValue: {
            predictionResult: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
              findFirst: jest.fn().mockResolvedValue(null),
            },
            school: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          },
        },
        {
          provide: MemoryManagerService,
          useValue: {
            remember: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<PredictionReportingService>(
      PredictionReportingService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    memoryManager = module.get<MemoryManagerService>(MemoryManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPredictionHistory', () => {
    it('should return paginated results with default page and pageSize', async () => {
      const mockItems = [
        {
          id: 'pred-1',
          profileId: 'profile-1',
          schoolId: 'school-1',
          probability: 0.45,
        },
        {
          id: 'pred-2',
          profileId: 'profile-1',
          schoolId: 'school-2',
          probability: 0.65,
        },
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        mockItems,
      );
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getPredictionHistory('profile-1');

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should pass correct skip and take for pagination', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(50);

      await service.getPredictionHistory('profile-1', 3, 10);

      expect(prisma.predictionResult.findMany).toHaveBeenCalledWith({
        where: { profileId: 'profile-1' },
        orderBy: { updatedAt: 'desc' },
        skip: 20, // (3-1) * 10
        take: 10,
      });
    });

    it('should calculate totalPages correctly', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(25);

      const result = await service.getPredictionHistory('profile-1', 1, 10);

      expect(result.totalPages).toBe(3); // ceil(25/10)
    });

    it('should return empty results when no predictions exist', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getPredictionHistory('profile-1');

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should order by updatedAt descending', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(0);

      await service.getPredictionHistory('profile-1');

      expect(prisma.predictionResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
        }),
      );
    });

    it('should run findMany and count in parallel', async () => {
      const callOrder: string[] = [];
      (prisma.predictionResult.findMany as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            callOrder.push('findMany-start');
            setTimeout(() => {
              callOrder.push('findMany-end');
              resolve([]);
            }, 10);
          }),
      );
      (prisma.predictionResult.count as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            callOrder.push('count-start');
            setTimeout(() => {
              callOrder.push('count-end');
              resolve(0);
            }, 10);
          }),
      );

      await service.getPredictionHistory('profile-1');

      // Both should start before either finishes (parallel via Promise.all)
      expect(callOrder.indexOf('findMany-start')).toBeLessThan(
        callOrder.indexOf('findMany-end'),
      );
      expect(callOrder.indexOf('count-start')).toBeLessThan(
        callOrder.indexOf('count-end'),
      );
      // Both starts should happen before any end
      const firstEnd = Math.min(
        callOrder.indexOf('findMany-end'),
        callOrder.indexOf('count-end'),
      );
      expect(callOrder.indexOf('findMany-start')).toBeLessThan(firstEnd);
      expect(callOrder.indexOf('count-start')).toBeLessThan(firstEnd);
    });

    it('should handle page 1 with skip 0', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(0);

      await service.getPredictionHistory('profile-1', 1, 20);

      expect(prisma.predictionResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe('reportActualResult', () => {
    it('should update prediction with actual result and reportedAt', async () => {
      await service.reportActualResult('profile-1', 'school-1', 'ADMITTED');

      expect(prisma.predictionResult.updateMany).toHaveBeenCalledWith({
        where: { profileId: 'profile-1', schoolId: 'school-1' },
        data: {
          actualResult: 'ADMITTED',
          reportedAt: expect.any(Date),
        },
      });
    });

    it('should handle REJECTED result', async () => {
      await service.reportActualResult('profile-1', 'school-1', 'REJECTED');

      expect(prisma.predictionResult.updateMany).toHaveBeenCalledWith({
        where: { profileId: 'profile-1', schoolId: 'school-1' },
        data: expect.objectContaining({ actualResult: 'REJECTED' }),
      });
    });

    it('should handle WAITLISTED result', async () => {
      await service.reportActualResult('profile-1', 'school-1', 'WAITLISTED');

      expect(prisma.predictionResult.updateMany).toHaveBeenCalledWith({
        where: { profileId: 'profile-1', schoolId: 'school-1' },
        data: expect.objectContaining({ actualResult: 'WAITLISTED' }),
      });
    });

    it('should write feedback to memory system when prediction exists', async () => {
      (prisma.predictionResult.findFirst as jest.Mock).mockResolvedValue({
        id: 'pred-1',
        probability: 0.7,
      });
      (prisma.school.findUnique as jest.Mock).mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
      });

      await service.reportActualResult('profile-1', 'school-1', 'ADMITTED');

      // fireAndForget calls memoryManager.remember asynchronously
      // We need to wait for the microtask to flush
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(memoryManager.remember).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({
          type: 'FACT',
          category: 'prediction_feedback',
          importance: 0.7,
          metadata: expect.objectContaining({
            schoolId: 'school-1',
            predicted: 0.7,
            actual: 'ADMITTED',
            isCorrect: true, // ADMITTED and probability > 0.5
          }),
        }),
      );
    });

    it('should mark prediction as incorrect when REJECTED but probability > 0.5', async () => {
      (prisma.predictionResult.findFirst as jest.Mock).mockResolvedValue({
        id: 'pred-1',
        probability: 0.7,
      });
      (prisma.school.findUnique as jest.Mock).mockResolvedValue({
        id: 'school-1',
        name: 'Harvard',
      });

      await service.reportActualResult('profile-1', 'school-1', 'REJECTED');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(memoryManager.remember).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            isCorrect: false, // REJECTED but probability was > 0.5
          }),
        }),
      );
    });

    it('should mark prediction as correct when REJECTED and probability <= 0.5', async () => {
      (prisma.predictionResult.findFirst as jest.Mock).mockResolvedValue({
        id: 'pred-1',
        probability: 0.3,
      });
      (prisma.school.findUnique as jest.Mock).mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
      });

      await service.reportActualResult('profile-1', 'school-1', 'REJECTED');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(memoryManager.remember).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            isCorrect: true, // REJECTED and probability <= 0.5
          }),
        }),
      );
    });

    it('should skip memory recording when prediction not found', async () => {
      (prisma.predictionResult.findFirst as jest.Mock).mockResolvedValue(null);

      await service.reportActualResult('profile-1', 'school-1', 'ADMITTED');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(memoryManager.remember).not.toHaveBeenCalled();
    });

    it('should use schoolId in memory content when school name not found', async () => {
      (prisma.predictionResult.findFirst as jest.Mock).mockResolvedValue({
        id: 'pred-1',
        probability: 0.5,
      });
      (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);

      await service.reportActualResult('profile-1', 'school-1', 'ADMITTED');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(memoryManager.remember).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({
          content: expect.stringContaining('school-1'),
        }),
      );
    });

    it('should not throw when updateMany fails (graceful degradation)', async () => {
      (prisma.predictionResult.updateMany as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        service.reportActualResult('profile-1', 'school-1', 'ADMITTED'),
      ).resolves.not.toThrow();
    });

    it('should not throw when memory recording fails', async () => {
      (prisma.predictionResult.findFirst as jest.Mock).mockResolvedValue({
        id: 'pred-1',
        probability: 0.7,
      });
      (memoryManager.remember as jest.Mock).mockRejectedValue(
        new Error('Memory system error'),
      );

      await expect(
        service.reportActualResult('profile-1', 'school-1', 'ADMITTED'),
      ).resolves.not.toThrow();
    });
  });

  describe('reportActualResult without MemoryManager', () => {
    let serviceWithoutMemory: PredictionReportingService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PredictionReportingService,
          {
            provide: PrismaService,
            useValue: {
              predictionResult: {
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn().mockResolvedValue(0),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                findFirst: jest.fn().mockResolvedValue({
                  id: 'pred-1',
                  probability: 0.5,
                }),
              },
              school: {
                findUnique: jest.fn().mockResolvedValue({ name: 'MIT' }),
              },
            },
          },
          // MemoryManagerService is @Optional, so we don't provide it
        ],
      }).compile();

      serviceWithoutMemory = module.get<PredictionReportingService>(
        PredictionReportingService,
      );
    });

    it('should succeed without memory manager (optional dependency)', async () => {
      await expect(
        serviceWithoutMemory.reportActualResult(
          'profile-1',
          'school-1',
          'ADMITTED',
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('getCalibrationData', () => {
    it('should return total predictions and count with actual results', async () => {
      (prisma.predictionResult.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20); // with actual results
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getCalibrationData();

      expect(result.totalPredictions).toBe(100);
      expect(result.withActualResults).toBe(20);
    });

    it('should return 5 calibration buckets', async () => {
      (prisma.predictionResult.count as jest.Mock)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(10);
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getCalibrationData();

      expect(result.calibrationBuckets).toHaveLength(5);
      expect(result.calibrationBuckets.map((b) => b.predictedRange)).toEqual([
        '0-20%',
        '20-40%',
        '40-60%',
        '60-80%',
        '80-100%',
      ]);
    });

    it('should correctly calculate admit rates per bucket', async () => {
      const mockResults = [
        { probability: 0.1, actualResult: 'ADMITTED' },
        { probability: 0.15, actualResult: 'REJECTED' },
        { probability: 0.15, actualResult: 'REJECTED' },
        { probability: 0.5, actualResult: 'ADMITTED' },
        { probability: 0.5, actualResult: 'ADMITTED' },
        { probability: 0.55, actualResult: 'REJECTED' },
        { probability: 0.85, actualResult: 'ADMITTED' },
      ];
      (prisma.predictionResult.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(7);
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        mockResults,
      );

      const result = await service.getCalibrationData();

      // 0-20% bucket: 3 entries (0.1, 0.15, 0.15), 1 ADMITTED -> rate 1/3
      const bucket0_20 = result.calibrationBuckets.find(
        (b) => b.predictedRange === '0-20%',
      );
      expect(bucket0_20!.count).toBe(3);
      expect(bucket0_20!.actualAdmitRate).toBeCloseTo(1 / 3, 5);

      // 40-60% bucket: 3 entries (0.5, 0.5, 0.55), 2 ADMITTED -> rate 2/3
      const bucket40_60 = result.calibrationBuckets.find(
        (b) => b.predictedRange === '40-60%',
      );
      expect(bucket40_60!.count).toBe(3);
      expect(bucket40_60!.actualAdmitRate).toBeCloseTo(2 / 3, 5);

      // 80-100% bucket: 1 entry (0.85), 1 ADMITTED -> rate 1.0
      const bucket80_100 = result.calibrationBuckets.find(
        (b) => b.predictedRange === '80-100%',
      );
      expect(bucket80_100!.count).toBe(1);
      expect(bucket80_100!.actualAdmitRate).toBe(1.0);
    });

    it('should return 0 admit rate for empty buckets', async () => {
      (prisma.predictionResult.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getCalibrationData();

      for (const bucket of result.calibrationBuckets) {
        expect(bucket.count).toBe(0);
        expect(bucket.actualAdmitRate).toBe(0);
      }
    });

    it('should handle Decimal-like probability values from Prisma', async () => {
      // Prisma Decimal has valueOf() for Number() coercion. Simulate with an
      // object whose valueOf returns the numeric value, plus a plain string.
      const mockResults = [
        { probability: { valueOf: () => 0.3 }, actualResult: 'ADMITTED' },
        { probability: '0.3', actualResult: 'REJECTED' },
      ];
      (prisma.predictionResult.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2);
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        mockResults,
      );

      const result = await service.getCalibrationData();

      // Number({ valueOf: () => 0.3 }) = 0.3, Number('0.3') = 0.3
      // Both fall in 20-40% bucket
      const bucket20_40 = result.calibrationBuckets.find(
        (b) => b.predictedRange === '20-40%',
      );
      expect(bucket20_40!.count).toBe(2);
    });

    it('should handle WAITLISTED as non-admitted in calibration', async () => {
      const mockResults = [
        { probability: 0.5, actualResult: 'WAITLISTED' },
        { probability: 0.55, actualResult: 'ADMITTED' },
      ];
      (prisma.predictionResult.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2);
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        mockResults,
      );

      const result = await service.getCalibrationData();

      const bucket40_60 = result.calibrationBuckets.find(
        (b) => b.predictedRange === '40-60%',
      );
      // 2 entries, only 1 ADMITTED (WAITLISTED is not ADMITTED)
      expect(bucket40_60!.count).toBe(2);
      expect(bucket40_60!.actualAdmitRate).toBe(0.5);
    });

    it('should only query predictions with actual results for bucketing', async () => {
      (prisma.predictionResult.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10);
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await service.getCalibrationData();

      expect(prisma.predictionResult.findMany).toHaveBeenCalledWith({
        where: { actualResult: { not: null } },
        select: { probability: true, actualResult: true },
      });
    });

    it('should correctly bucket boundary value 0.2 into 20-40% bucket', async () => {
      // The logic is p >= min && p < max, so 0.2 goes into 20-40% (not 0-20%)
      const mockResults = [{ probability: 0.2, actualResult: 'ADMITTED' }];
      (prisma.predictionResult.count as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        mockResults,
      );

      const result = await service.getCalibrationData();

      const bucket0_20 = result.calibrationBuckets.find(
        (b) => b.predictedRange === '0-20%',
      );
      const bucket20_40 = result.calibrationBuckets.find(
        (b) => b.predictedRange === '20-40%',
      );
      expect(bucket0_20!.count).toBe(0);
      expect(bucket20_40!.count).toBe(1);
    });
  });
});
