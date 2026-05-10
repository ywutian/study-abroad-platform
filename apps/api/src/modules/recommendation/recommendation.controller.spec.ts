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
