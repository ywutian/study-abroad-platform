import { Test, TestingModule } from '@nestjs/testing';
import { PeerReviewController } from './peer-review.controller';
import { PeerReviewService } from './peer-review.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

describe('PeerReviewController', () => {
  let controller: PeerReviewController;
  let service: PeerReviewService;

  const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeerReviewController],
      providers: [
        {
          provide: PeerReviewService,
          useValue: {
            requestReview: jest
              .fn()
              .mockResolvedValue({ id: 'review-1', status: 'PENDING' }),
            submitReview: jest
              .fn()
              .mockResolvedValue({ id: 'review-1', status: 'COMPLETED' }),
            getMyReviews: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            getUserRating: jest
              .fn()
              .mockResolvedValue({ average: 4.5, count: 10 }),
            getUserReviews: jest
              .fn()
              .mockResolvedValue({ items: [], total: 0 }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PeerReviewController>(PeerReviewController);
    service = module.get<PeerReviewService>(PeerReviewService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('requestReview', () => {
    it('should delegate to peerReviewService.requestReview', async () => {
      const dto = { essayId: 'essay-1', message: 'Please review' } as any;
      const result = await controller.requestReview(
        mockUser as any,
        'target-user-1',
        dto,
      );

      expect(service.requestReview).toHaveBeenCalledWith(
        'user-1',
        'target-user-1',
        dto,
      );
      expect(result).toEqual({ id: 'review-1', status: 'PENDING' });
    });
  });

  describe('submitReview', () => {
    it('should delegate to peerReviewService.submitReview', async () => {
      const dto = { rating: 5, comment: 'Great essay' } as any;
      const result = await controller.submitReview(
        mockUser as any,
        'review-1',
        dto,
      );

      expect(service.submitReview).toHaveBeenCalledWith(
        'user-1',
        'review-1',
        dto,
      );
      expect(result).toEqual({ id: 'review-1', status: 'COMPLETED' });
    });
  });

  describe('getMyReviews', () => {
    it('should delegate to peerReviewService.getMyReviews', async () => {
      const result = await controller.getMyReviews(mockUser as any);

      expect(service.getMyReviews).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('getUserRating', () => {
    it('should delegate to peerReviewService.getUserRating', async () => {
      const result = await controller.getUserRating('target-user-1');

      expect(service.getUserRating).toHaveBeenCalledWith('target-user-1');
      expect(result).toEqual({ average: 4.5, count: 10 });
    });
  });

  describe('getUserReviews', () => {
    it('should delegate to peerReviewService.getUserReviews', async () => {
      const result = await controller.getUserReviews('target-user-1');

      expect(service.getUserReviews).toHaveBeenCalledWith('target-user-1');
      expect(result).toEqual({ items: [], total: 0 });
    });
  });
});
