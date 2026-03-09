import { Test, TestingModule } from '@nestjs/testing';
import { PeerReviewService } from './peer-review.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role, PeerReviewStatus } from '@prisma/client';

describe('PeerReviewService', () => {
  let service: PeerReviewService;
  let prisma: PrismaService;

  const mockUser = (id: string, role: Role = Role.VERIFIED) => ({
    id,
    role,
    profile: { realName: `User ${id}` },
  });

  const mockReview = {
    id: 'review-1',
    reviewerId: 'user-1',
    revieweeId: 'user-2',
    isAnonymous: false,
    status: PeerReviewStatus.PENDING,
    expiresAt: new Date(Date.now() + 7 * 86400000),
    overallScore: null,
    profileScore: null,
    helpfulScore: null,
    responseScore: null,
    comment: null,
    reverseOverallScore: null,
    reverseProfileScore: null,
    reverseHelpfulScore: null,
    reverseResponseScore: null,
    reverseComment: null,
    completedAt: null,
    createdAt: new Date(),
    reviewer: mockUser('user-1'),
    reviewee: mockUser('user-2'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerReviewService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            peerReview: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            follow: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PeerReviewService>(PeerReviewService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestReview', () => {
    const dto = { isAnonymous: false };

    it('should create a peer review request', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser('user-1'))
        .mockResolvedValueOnce(mockUser('user-2'));
      (prisma.follow.findMany as jest.Mock).mockResolvedValue([
        { followerId: 'user-1', followingId: 'user-2' },
        { followerId: 'user-2', followingId: 'user-1' },
      ]);
      (prisma.peerReview.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.peerReview.create as jest.Mock).mockResolvedValue(mockReview);

      const result = await service.requestReview('user-1', 'user-2', dto);
      expect(result).toBeDefined();
      expect(result.id).toBe('review-1');
    });

    it('should throw BadRequestException for self-review', async () => {
      await expect(
        service.requestReview('user-1', 'user-1', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user not found', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser('user-1'))
        .mockResolvedValueOnce(null);

      await expect(
        service.requestReview('user-1', 'user-2', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if reviewer is not VERIFIED', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser('user-1', Role.USER))
        .mockResolvedValueOnce(mockUser('user-2'));

      await expect(
        service.requestReview('user-1', 'user-2', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if reviewee is not VERIFIED', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser('user-1'))
        .mockResolvedValueOnce(mockUser('user-2', Role.USER));

      await expect(
        service.requestReview('user-1', 'user-2', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if no mutual follow', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser('user-1'))
        .mockResolvedValueOnce(mockUser('user-2'));
      (prisma.follow.findMany as jest.Mock).mockResolvedValue([
        { followerId: 'user-1', followingId: 'user-2' },
        // Only one-way follow
      ]);

      await expect(
        service.requestReview('user-1', 'user-2', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if pending review exists', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser('user-1'))
        .mockResolvedValueOnce(mockUser('user-2'));
      (prisma.follow.findMany as jest.Mock).mockResolvedValue([
        { followerId: 'user-1', followingId: 'user-2' },
        { followerId: 'user-2', followingId: 'user-1' },
      ]);
      (prisma.peerReview.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.requestReview('user-1', 'user-2', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set 7-day expiration', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser('user-1'))
        .mockResolvedValueOnce(mockUser('user-2'));
      (prisma.follow.findMany as jest.Mock).mockResolvedValue([
        { followerId: 'user-1', followingId: 'user-2' },
        { followerId: 'user-2', followingId: 'user-1' },
      ]);
      (prisma.peerReview.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.peerReview.create as jest.Mock).mockImplementation(({ data }) => {
        expect(data.expiresAt).toBeDefined();
        const diff = data.expiresAt.getTime() - Date.now();
        // Implementation uses setDate(getDate() + 7) - 7 calendar days in local time.
        // DST transitions can cause ±1 hour deviation from 7 * 24h.
        expect(diff).toBeGreaterThan(6.9 * 86400000);
        expect(diff).toBeLessThan(7.1 * 86400000);
        return Promise.resolve(mockReview);
      });

      await service.requestReview('user-1', 'user-2', dto);
    });
  });

  describe('submitReview', () => {
    const reviewData = {
      profileScore: 4,
      helpfulScore: 5,
      responseScore: 4,
      overallScore: 4.5,
      comment: 'Very helpful person',
    };

    it('should submit review as reviewer', async () => {
      (prisma.peerReview.findUnique as jest.Mock).mockResolvedValue(mockReview);
      (prisma.peerReview.update as jest.Mock).mockResolvedValue({
        ...mockReview,
        ...reviewData,
      });

      const result = await service.submitReview(
        'user-1',
        'review-1',
        reviewData,
      );
      expect(result).toBeDefined();
    });

    it('should submit review as reviewee (reverse scores)', async () => {
      (prisma.peerReview.findUnique as jest.Mock).mockResolvedValue(mockReview);
      (prisma.peerReview.update as jest.Mock).mockResolvedValue({
        ...mockReview,
        reverseOverallScore: reviewData.overallScore,
      });

      await service.submitReview('user-2', 'review-1', reviewData);

      expect(prisma.peerReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reverseProfileScore: 4,
            reverseHelpfulScore: 5,
            reverseOverallScore: 4.5,
          }),
        }),
      );
    });

    it('should complete review when both sides have submitted', async () => {
      const reviewWithOneScore = {
        ...mockReview,
        reverseOverallScore: 4.0, // reviewee already submitted
      };
      (prisma.peerReview.findUnique as jest.Mock).mockResolvedValue(
        reviewWithOneScore,
      );
      (prisma.peerReview.update as jest.Mock).mockResolvedValue({
        ...reviewWithOneScore,
        ...reviewData,
        status: PeerReviewStatus.COMPLETED,
      });
      (prisma.peerReview.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.submitReview('user-1', 'review-1', reviewData);

      expect(prisma.peerReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PeerReviewStatus.COMPLETED,
          }),
        }),
      );
    });

    it('should throw NotFoundException if review does not exist', async () => {
      (prisma.peerReview.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.submitReview('user-1', 'nonexistent', reviewData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if review is completed', async () => {
      (prisma.peerReview.findUnique as jest.Mock).mockResolvedValue({
        ...mockReview,
        status: PeerReviewStatus.COMPLETED,
      });

      await expect(
        service.submitReview('user-1', 'review-1', reviewData),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if review is expired', async () => {
      (prisma.peerReview.findUnique as jest.Mock).mockResolvedValue({
        ...mockReview,
        status: PeerReviewStatus.EXPIRED,
        expiresAt: new Date(Date.now() - 86400000),
      });

      await expect(
        service.submitReview('user-1', 'review-1', reviewData),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user is not part of the review', async () => {
      (prisma.peerReview.findUnique as jest.Mock).mockResolvedValue(mockReview);

      await expect(
        service.submitReview('user-3', 'review-1', reviewData),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if reviewer already submitted', async () => {
      (prisma.peerReview.findUnique as jest.Mock).mockResolvedValue({
        ...mockReview,
        overallScore: 4.0,
      });

      await expect(
        service.submitReview('user-1', 'review-1', reviewData),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reviewee already submitted', async () => {
      (prisma.peerReview.findUnique as jest.Mock).mockResolvedValue({
        ...mockReview,
        reverseOverallScore: 4.0,
      });

      await expect(
        service.submitReview('user-2', 'review-1', reviewData),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyReviews', () => {
    it('should return reviews where user is reviewer or reviewee', async () => {
      (prisma.peerReview.findMany as jest.Mock).mockResolvedValue([mockReview]);

      const result = await service.getMyReviews('user-1');

      expect(result.reviews).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getUserRating', () => {
    it('should calculate average ratings from completed reviews', async () => {
      (prisma.peerReview.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            overallScore: 4,
            profileScore: 4,
            helpfulScore: 5,
            responseScore: 3,
          },
          {
            overallScore: 5,
            profileScore: 5,
            helpfulScore: 4,
            responseScore: 5,
          },
        ])
        .mockResolvedValueOnce([
          {
            reverseOverallScore: 3,
            reverseProfileScore: 3,
            reverseHelpfulScore: 4,
            reverseResponseScore: 3,
          },
        ]);

      const result = await service.getUserRating('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.count).toBe(3);
      expect(result.overall).toBe(4);
    });

    it('should return empty rating when no reviews exist', async () => {
      (prisma.peerReview.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getUserRating('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.count).toBe(0);
      expect(result.overall).toBeUndefined();
    });
  });

  describe('getUserReviews', () => {
    it('should return completed reviews for a user', async () => {
      (prisma.peerReview.findMany as jest.Mock).mockResolvedValue([mockReview]);

      const result = await service.getUserReviews('user-1');
      expect(result.reviews).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
