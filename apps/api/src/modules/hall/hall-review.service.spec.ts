import { Test, TestingModule } from '@nestjs/testing';
import { HallReviewService } from './hall-review.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { PointsService } from '../points/incentive.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('HallReviewService', () => {
  let service: HallReviewService;

  const mockPrisma = {
    review: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    reviewReaction: {
      upsert: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    pointHistory: {
      create: jest.fn().mockReturnValue({
        then: jest.fn().mockReturnValue({ catch: jest.fn() }),
      }),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockNotificationService = {
    createNotification: jest.fn().mockResolvedValue({}),
  };

  const mockMemoryManager = {
    remember: jest.fn().mockResolvedValue(undefined),
  };

  const mockPointsService = {
    adjustPoints: jest.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HallReviewService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: MemoryManagerService, useValue: mockMemoryManager },
        {
          provide: PointsService,
          useValue: mockPointsService,
        },
      ],
    }).compile();

    service = module.get<HallReviewService>(HallReviewService);

    // 2026-05 Hall Plan C (C2): the peer-review consent + age gate reads
    // `user.findUnique`. Default to a consenting adult so existing tests
    // exercise the happy path; gate-specific tests override per-case.
    mockPrisma.user.findUnique.mockResolvedValue({
      acceptPeerReview: true,
      profile: { birthday: null },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // createReview
  // ============================================

  describe('createReview', () => {
    const reviewData = {
      profileUserId: 'target-user',
      academicScore: 8,
      testScore: 9,
      activityScore: 7,
      awardScore: 6,
      overallScore: 8,
      comment: 'Great profile',
      tags: ['strong-academic'],
      status: 'PUBLISHED' as const,
    };

    it('should throw BadRequestException when reviewing yourself', async () => {
      await expect(
        service.createReview('target-user', {
          ...reviewData,
          profileUserId: 'target-user',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a new review when none exists', async () => {
      const createdReview = {
        id: 'review-1',
        ...reviewData,
        reviewerId: 'reviewer-1',
      };
      mockPrisma.review.findUnique.mockResolvedValue(null);
      mockPrisma.review.create.mockResolvedValue(createdReview);

      const result = await service.createReview('reviewer-1', reviewData);

      expect(mockPrisma.review.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reviewerId: 'reviewer-1',
          profileUserId: 'target-user',
          academicScore: 8,
          status: 'PUBLISHED',
        }),
      });
      expect(result).toEqual(createdReview);
    });

    it('should update existing review instead of creating new one', async () => {
      const existingReview = {
        id: 'review-existing',
        reviewerId: 'reviewer-1',
        profileUserId: 'target-user',
      };
      const updatedReview = { ...existingReview, ...reviewData };

      mockPrisma.review.findUnique.mockResolvedValue(existingReview);
      mockPrisma.review.update.mockResolvedValue(updatedReview);

      const result = await service.createReview('reviewer-1', reviewData);

      expect(mockPrisma.review.update).toHaveBeenCalledWith({
        where: { id: 'review-existing' },
        data: expect.objectContaining({ academicScore: 8 }),
      });
      expect(result).toEqual(updatedReview);
    });
  });

  // ============================================
  // updateReview
  // ============================================

  describe('updateReview', () => {
    it('should update review when owned by reviewer', async () => {
      const existing = { id: 'review-1', reviewerId: 'reviewer-1' };
      const updated = { ...existing, comment: 'Updated' };

      mockPrisma.review.findUnique.mockResolvedValue(existing);
      mockPrisma.review.update.mockResolvedValue(updated);

      const result = await service.updateReview('review-1', 'reviewer-1', {
        comment: 'Updated',
      });

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if review not found', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.updateReview('nonexistent', 'reviewer-1', { comment: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if not owned by reviewer', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'review-1',
        reviewerId: 'other-user',
      });

      await expect(
        service.updateReview('review-1', 'reviewer-1', { comment: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // deleteReview
  // ============================================

  describe('deleteReview', () => {
    it('should delete review when owned by reviewer', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'review-1',
        reviewerId: 'reviewer-1',
      });
      mockPrisma.review.delete.mockResolvedValue({});

      await service.deleteReview('review-1', 'reviewer-1');

      expect(mockPrisma.review.delete).toHaveBeenCalledWith({
        where: { id: 'review-1' },
      });
    });

    it('should throw NotFoundException if review not found', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteReview('nonexistent', 'reviewer-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if not owned by reviewer', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'review-1',
        reviewerId: 'other-user',
      });

      await expect(
        service.deleteReview('review-1', 'reviewer-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // getReviewsForUser
  // ============================================

  describe('getReviewsForUser', () => {
    it('should return paginated reviews with defaults', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(0);

      const result = await service.getReviewsForUser('target-user');

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(0);
    });

    it('should return paginated reviews with custom options', async () => {
      const reviews = [
        {
          id: 'r-1',
          overallScore: 8,
          reviewer: { id: 'u-1', email: 'a@b.c' },
          _count: { reactions: 2 },
        },
      ];
      mockPrisma.review.findMany.mockResolvedValue(reviews);
      mockPrisma.review.count.mockResolvedValue(1);

      const result = await service.getReviewsForUser('target-user', {
        page: 1,
        pageSize: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ============================================
  // getReviewStats
  // ============================================

  describe('getReviewStats', () => {
    it('should return null when no reviews exist', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);

      const result = await service.getReviewStats('user-1');

      expect(result).toBeNull();
    });

    it('should calculate averages and top tags', async () => {
      const reviews = [
        {
          academicScore: 8,
          testScore: 9,
          activityScore: 7,
          awardScore: 6,
          overallScore: 8,
          tags: ['strong-academic', 'leader'],
        },
        {
          academicScore: 6,
          testScore: 7,
          activityScore: 8,
          awardScore: 5,
          overallScore: 7,
          tags: ['strong-academic', 'creative'],
        },
      ];
      mockPrisma.review.findMany.mockResolvedValue(reviews);

      const result = await service.getReviewStats('user-1');

      // 2026-05 Hall Plan C (C2b): numeric `averages` removed — only a
      // count + qualitative top tags are surfaced.
      expect(result).not.toBeNull();
      expect(result!.reviewCount).toBe(2);
      expect(result).not.toHaveProperty('averages');
      expect(result!.topTags[0]).toBe('strong-academic');
    });
  });

  // ============================================
  // reactToReview
  // ============================================

  describe('reactToReview', () => {
    it('should throw NotFoundException if review not found', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.reactToReview('nonexistent', 'user-1', 'helpful'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when reacting to own review', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'review-1',
        reviewerId: 'user-1',
      });

      await expect(
        service.reactToReview('review-1', 'user-1', 'helpful'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upsert reaction and update helpful count', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'review-1',
        reviewerId: 'other-user',
      });
      mockPrisma.reviewReaction.upsert.mockResolvedValue({});
      mockPrisma.reviewReaction.count.mockResolvedValue(5);
      mockPrisma.review.update.mockResolvedValue({});

      const result = await service.reactToReview(
        'review-1',
        'user-1',
        'helpful',
      );

      expect(result).toEqual({ success: true });
      expect(mockPrisma.reviewReaction.upsert).toHaveBeenCalled();
      expect(mockPrisma.review.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: { helpfulCount: 5 },
      });
    });
  });

  // ============================================
  // removeReaction
  // ============================================

  describe('removeReaction', () => {
    it('should delete reaction and update helpful count', async () => {
      mockPrisma.reviewReaction.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.reviewReaction.count.mockResolvedValue(3);
      mockPrisma.review.update.mockResolvedValue({});

      const result = await service.removeReaction(
        'review-1',
        'user-1',
        'helpful',
      );

      expect(result).toEqual({ success: true });
      expect(mockPrisma.reviewReaction.deleteMany).toHaveBeenCalledWith({
        where: { reviewId: 'review-1', userId: 'user-1', type: 'helpful' },
      });
    });
  });

  // ============================================
  // getMyReviews
  // ============================================

  describe('getMyReviews', () => {
    it('should return reviews by the given reviewer', async () => {
      const reviews = [
        {
          id: 'r-1',
          reviewerId: 'user-1',
          profileUser: { id: 'u-2', email: 'test@test.com' },
        },
      ];
      mockPrisma.review.findMany.mockResolvedValue(reviews);

      const result = await service.getMyReviews('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reviewerId: 'user-1' },
        }),
      );
    });
  });

  // ============================================
  // 2026-05 Hall Plan C (C2): peer-review consent + age gate (security B1/B2)
  // ============================================

  describe('peer-review consent + age gate', () => {
    const data = {
      profileUserId: 'target-user',
      academicScore: 8,
      testScore: 8,
      activityScore: 8,
      awardScore: 8,
      overallScore: 8,
      status: 'PUBLISHED' as const,
    };

    it('blocks createReview when the target has opted out of peer review', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        acceptPeerReview: false,
        profile: { birthday: null },
      });

      await expect(service.createReview('reviewer-1', data)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.review.create).not.toHaveBeenCalled();
    });

    it('blocks createReview when the target is under 16', async () => {
      const birthday = new Date();
      birthday.setFullYear(birthday.getFullYear() - 14);
      mockPrisma.user.findUnique.mockResolvedValue({
        acceptPeerReview: true,
        profile: { birthday },
      });

      await expect(service.createReview('reviewer-1', data)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.review.create).not.toHaveBeenCalled();
    });

    it('getReviewsForUser returns an empty page when the target opted out', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ acceptPeerReview: false });

      const result = await service.getReviewsForUser('target-user');

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockPrisma.review.findMany).not.toHaveBeenCalled();
    });

    it('getReviewStats returns null when the target opted out', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ acceptPeerReview: false });

      const result = await service.getReviewStats('target-user');

      expect(result).toBeNull();
      expect(mockPrisma.review.findMany).not.toHaveBeenCalled();
    });
  });
});
