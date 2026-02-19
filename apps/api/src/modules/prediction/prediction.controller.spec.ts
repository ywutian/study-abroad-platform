import { Test, TestingModule } from '@nestjs/testing';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PredictionController', () => {
  let controller: PredictionController;
  let predictionService: PredictionService;
  let prisma: PrismaService;

  const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };

  const mockProfile = { id: 'profile-1', userId: 'user-1' };

  const mockPredictionResults = [
    { schoolId: 'school-1', probability: 0.75, tier: 'TARGET' },
    { schoolId: 'school-2', probability: 0.45, tier: 'REACH' },
  ];

  const mockHistory = [
    {
      id: 'pred-1',
      schoolId: 'school-1',
      probability: 0.75,
      createdAt: new Date(),
    },
  ];

  const mockCalibration = {
    totalPredictions: 100,
    accuracy: 0.82,
    brierScore: 0.15,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PredictionController],
      providers: [
        {
          provide: PredictionService,
          useValue: {
            predict: jest.fn().mockResolvedValue(mockPredictionResults),
            getPredictionHistory: jest.fn().mockResolvedValue(mockHistory),
            reportActualResult: jest.fn().mockResolvedValue(undefined),
            getCalibrationData: jest.fn().mockResolvedValue(mockCalibration),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            profile: {
              findUnique: jest.fn().mockResolvedValue(mockProfile),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<PredictionController>(PredictionController);
    predictionService = module.get<PredictionService>(PredictionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('predict', () => {
    it('should run prediction and return results with processing time', async () => {
      const dto = { schoolIds: ['school-1', 'school-2'], forceRefresh: false };
      const result = await controller.predict(mockUser as any, dto as any);

      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(predictionService.predict).toHaveBeenCalledWith(
        'profile-1',
        ['school-1', 'school-2'],
        false,
      );
      expect(result.results).toEqual(mockPredictionResults);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should return empty results when profile does not exist', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const dto = { schoolIds: ['school-1'], forceRefresh: false };
      const result = await controller.predict(mockUser as any, dto as any);

      expect(result).toEqual({ results: [], processingTime: 0 });
      expect(predictionService.predict).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return prediction history for the user', async () => {
      const result = await controller.getHistory(mockUser as any);

      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(predictionService.getPredictionHistory).toHaveBeenCalledWith(
        'profile-1',
      );
      expect(result).toEqual(mockHistory);
    });

    it('should return empty array when profile does not exist', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await controller.getHistory(mockUser as any);

      expect(result).toEqual([]);
      expect(predictionService.getPredictionHistory).not.toHaveBeenCalled();
    });
  });

  describe('reportResult', () => {
    it('should report actual result for calibration', async () => {
      const body = { result: 'ADMITTED' as const };
      const result = await controller.reportResult(
        mockUser as any,
        'school-1',
        body,
      );

      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(predictionService.reportActualResult).toHaveBeenCalledWith(
        'profile-1',
        'school-1',
        'ADMITTED',
      );
      expect(result).toEqual({
        success: true,
        message: 'Result recorded for calibration',
      });
    });

    it('should return failure when profile does not exist', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const body = { result: 'REJECTED' as const };
      const result = await controller.reportResult(
        mockUser as any,
        'school-1',
        body,
      );

      expect(result).toEqual({ success: false, message: 'Profile not found' });
      expect(predictionService.reportActualResult).not.toHaveBeenCalled();
    });
  });

  describe('getCalibration', () => {
    it('should return calibration data', async () => {
      const result = await controller.getCalibration();

      expect(predictionService.getCalibrationData).toHaveBeenCalled();
      expect(result).toEqual(mockCalibration);
    });
  });
});
