import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('RecommendationController', () => {
  let controller: RecommendationController;
  let service: RecommendationService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecommendationController],
      providers: [
        {
          provide: RecommendationService,
          useValue: {
            generateRecommendation: jest
              .fn()
              .mockResolvedValue({ id: 'rec-1', schools: [] }),
            checkPreflight: jest.fn().mockResolvedValue({ canGenerate: true }),
            getRecommendationHistory: jest.fn().mockResolvedValue([]),
            getRecommendationById: jest.fn().mockResolvedValue({ id: 'rec-1' }),
            getRecommendationMetrics: jest.fn().mockResolvedValue({
              scope: 'recommendation',
              recommendationId: 'rec-1',
              sampleSize: 0,
              insufficientSample: true,
            }),
            recordApplied: jest.fn().mockResolvedValue({ recorded: true }),
            deleteRecommendation: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RecommendationController>(RecommendationController);
    service = module.get<RecommendationService>(RecommendationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateRecommendation', () => {
    it('should delegate to recommendationService.generateRecommendation', async () => {
      const dto = { targetMajor: 'CS', gpa: 3.9 } as any;
      const result = await controller.generateRecommendation(mockUser, dto);

      expect(service.generateRecommendation).toHaveBeenCalledWith(
        'user-1',
        dto,
        'zh',
      );
      expect(result).toEqual({ id: 'rec-1', schools: [] });
    });
  });

  describe('preflight', () => {
    it('should delegate to recommendationService.checkPreflight', async () => {
      const result = await controller.preflight(mockUser);

      expect(service.checkPreflight).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ canGenerate: true });
    });
  });

  describe('getHistory', () => {
    it('should delegate to recommendationService.getRecommendationHistory', async () => {
      const result = await controller.getHistory(mockUser);

      expect(service.getRecommendationHistory).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should delegate to recommendationService.getRecommendationById', async () => {
      const result = await controller.getById(mockUser, 'rec-1');

      expect(service.getRecommendationById).toHaveBeenCalledWith(
        'user-1',
        'rec-1',
      );
      expect(result).toEqual({ id: 'rec-1' });
    });
  });

  describe('outcome metrics', () => {
    it('delegates metrics and application confirmation with the authenticated user', async () => {
      await expect(controller.getMetrics(mockUser, 'rec-1')).resolves.toEqual({
        scope: 'recommendation',
        recommendationId: 'rec-1',
        sampleSize: 0,
        insufficientSample: true,
      });
      await expect(
        controller.recordApplied(mockUser, 'rec-1', 'school-1'),
      ).resolves.toEqual({ recorded: true });

      expect(service.getRecommendationMetrics).toHaveBeenCalledWith(
        'user-1',
        'rec-1',
      );
      expect(service.recordApplied).toHaveBeenCalledWith(
        'user-1',
        'rec-1',
        'school-1',
      );
    });

    it('delegates aggregate metrics without a recommendation id', async () => {
      (service.getRecommendationMetrics as jest.Mock).mockResolvedValueOnce({
        scope: 'user',
        sampleSize: 40,
        insufficientSample: false,
      });

      await expect(controller.getAggregateMetrics(mockUser)).resolves.toEqual(
        expect.objectContaining({ scope: 'user', sampleSize: 40 }),
      );
      expect(service.getRecommendationMetrics).toHaveBeenCalledWith('user-1');
    });
  });

  describe('deleteRecommendation', () => {
    it('should delegate to recommendationService.deleteRecommendation', async () => {
      const result = await controller.deleteRecommendation(mockUser, 'rec-1');

      expect(service.deleteRecommendation).toHaveBeenCalledWith(
        'user-1',
        'rec-1',
      );
      expect(result).toEqual({ message: 'Recommendation deleted' });
    });
  });
});
