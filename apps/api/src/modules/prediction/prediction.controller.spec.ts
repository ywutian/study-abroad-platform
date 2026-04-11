import { Test, TestingModule } from '@nestjs/testing';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';
import { SchoolService } from '../school/school.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionReportingService } from './prediction-reporting.service';

describe('PredictionController', () => {
  let controller: PredictionController;
  let predictionService: PredictionService;
  let schoolService: { getUcSchoolIds: jest.Mock };
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

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
          provide: SchoolService,
          useValue: {
            getUcSchoolIds: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PredictionService,
          useValue: {
            predict: jest.fn().mockResolvedValue({
              results: mockPredictionResults,
              dataCompleteness: 0.8,
              memoryContext: {},
            }),
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
        {
          provide: PredictionReportingService,
          useValue: {
            resolveCanonicalOutcome: jest.fn().mockReturnValue({
              canonicalRecord: null,
              displayRecord: null,
              canonicalOutcomeLabel: 'CENSORED',
              eligibleForCalibration: false,
            }),
            mapLatestOutcomeLabel: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<PredictionController>(PredictionController);
    predictionService = module.get<PredictionService>(PredictionService);
    schoolService = module.get(SchoolService);
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
        'zh',
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

    it('should expand to all 9 UC campuses when any UC school is selected', async () => {
      const ucIds = [
        'uc-1',
        'uc-2',
        'uc-3',
        'uc-4',
        'uc-5',
        'uc-6',
        'uc-7',
        'uc-8',
        'uc-9',
      ];
      schoolService.getUcSchoolIds.mockResolvedValue(ucIds);

      const dto = { schoolIds: ['uc-1', 'school-other'], forceRefresh: false };
      const result = await controller.predict(mockUser as any, dto as any);

      expect(predictionService.predict).toHaveBeenCalledWith(
        'profile-1',
        ucIds,
        false,
        'zh',
      );
      expect(result.ucComparisonExpanded).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should return prediction history for the user', async () => {
      const pagination = { page: 1, pageSize: 20 };
      const result = await controller.getHistory(mockUser as any, pagination);

      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(predictionService.getPredictionHistory).toHaveBeenCalledWith(
        'profile-1',
        1,
        20,
      );
      expect(result).toEqual(mockHistory);
    });

    it('should return empty paginated response when profile does not exist', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      const pagination = { page: 1, pageSize: 20 };

      const result = await controller.getHistory(mockUser as any, pagination);

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });
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
        {
          notes: undefined,
          evidenceUrl: undefined,
          round: undefined,
          isFinal: undefined,
        },
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
