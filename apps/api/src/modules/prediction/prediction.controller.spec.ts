import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';
import { SchoolService } from '../school/school.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionReportingService } from './prediction-reporting.service';
import { PredictionFeedbackService } from './prediction-feedback.service';
import { PredictionExplanationService } from './prediction-explanation.service';

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
            previewForUser: jest.fn().mockResolvedValue({
              preview: true,
              scenario: { gpa: 3.9 },
              results: mockPredictionResults.map((result) => ({
                ...result,
                authority: 'PREVIEW',
              })),
              dataCompleteness: 0.8,
            }),
            getPredictionHistory: jest.fn().mockResolvedValue(mockHistory),
            reportActualResult: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            profile: {
              findUnique: jest.fn().mockResolvedValue(mockProfile),
            },
            schoolListItem: {
              findMany: jest.fn().mockResolvedValue([]),
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
        {
          provide: PredictionFeedbackService,
          useValue: {
            submitFeedback: jest.fn(),
          },
        },
        {
          provide: PredictionExplanationService,
          useValue: {
            streamPredictionExplanation: jest.fn(),
            streamPortfolioSummary: jest.fn(),
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
      const result = await controller.predict(mockUser, dto);

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
      const result = await controller.predict(mockUser, dto);

      expect(result).toEqual({ results: [], processingTime: 0 });
      expect(predictionService.predict).not.toHaveBeenCalled();
    });

    it('expands to the UC campuses the user owns (keeping non-UC) when any UC is selected', async () => {
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
      // User owns all 9 UC campuses in their school list.
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue(
        ucIds.map((schoolId) => ({ schoolId })),
      );

      const dto = { schoolIds: ['uc-1', 'school-other'], forceRefresh: false };
      const result = await controller.predict(mockUser, dto);

      const calledWith = (predictionService.predict as jest.Mock).mock
        .calls[0][1];
      expect(calledWith).toEqual(
        expect.arrayContaining([...ucIds, 'school-other']),
      );
      expect(result.ucComparisonExpanded).toBe(true);
    });

    it('only expands to OWNED UC campuses, so a partial UC list does not 400', async () => {
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
      // User has added only UCLA (uc-1) — not all 9.
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([
        { schoolId: 'uc-1' },
      ]);

      const dto = { schoolIds: ['uc-1', 'school-other'], forceRefresh: false };
      await controller.predict(mockUser, dto);

      const calledWith = (predictionService.predict as jest.Mock).mock
        .calls[0][1] as string[];
      // Predicts the owned UC + the non-UC pick, NOT all 9 (which would trip the
      // schoolId ∈ SchoolListItem invariant and 400).
      expect(calledWith).toEqual(
        expect.arrayContaining(['uc-1', 'school-other']),
      );
      expect(calledWith).not.toContain('uc-9');
      expect(calledWith).toHaveLength(2);
    });
  });

  describe('preview', () => {
    it('runs a read-only what-if preview without requiring a profile lookup in the controller', async () => {
      const dto = {
        schoolIds: ['school-1'],
        scenario: { gpa: 3.9, applicationRound: 'EA' },
      };

      const result = await controller.preview(mockUser, 'zh', dto);

      expect(predictionService.previewForUser).toHaveBeenCalledWith(
        'user-1',
        ['school-1'],
        dto.scenario,
        'zh',
      );
      expect(result.preview).toBe(true);
      expect(result.results[0].authority).toBe('PREVIEW');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(prisma.profile.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return prediction history for the user', async () => {
      const pagination = { page: 1, pageSize: 20 };
      const result = await controller.getHistory(mockUser, pagination);

      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(predictionService.getPredictionHistory).toHaveBeenCalledWith(
        'profile-1',
        1,
        20,
        'zh',
      );
      expect(result).toEqual(mockHistory);
    });

    it('should return empty paginated response when profile does not exist', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      const pagination = { page: 1, pageSize: 20 };

      const result = await controller.getHistory(mockUser, pagination);

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
      const result = await controller.reportResult(mockUser, 'school-1', body);

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
      const result = await controller.reportResult(mockUser, 'school-1', body);

      expect(result).toEqual({ success: false, message: 'Profile not found' });
      expect(predictionService.reportActualResult).not.toHaveBeenCalled();
    });

    it('should propagate missing numeric prediction errors', async () => {
      (predictionService.reportActualResult as jest.Mock).mockRejectedValue(
        new NotFoundException('Numeric prediction not found'),
      );

      await expect(
        controller.reportResult(mockUser, 'tier-4-school', {
          result: 'ADMITTED',
        }),
      ).rejects.toThrow('Numeric prediction not found');
    });
  });
});
