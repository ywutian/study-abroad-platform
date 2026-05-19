import { Test, TestingModule } from '@nestjs/testing';
import { HallService } from './hall.service';
import { HallRankingService } from './hall-ranking.service';
import { HallReviewService } from './hall-review.service';
import { HallListService } from './hall-list.service';
import { HallVerifiedService } from './hall-verified.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService, PointAction } from '../points/incentive.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { NotificationService } from '../notification/notification.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('../../common/utils/scoring', () => ({
  extractProfileMetrics: jest.fn().mockReturnValue({
    gpa: 3.8,
    gpaScale: 4.0,
    satScore: 1500,
    actScore: null,
    toeflScore: 110,
    activityCount: 5,
    awardCount: 3,
    nationalAwardCount: 1,
    internationalAwardCount: 0,
  }),
  extractSchoolMetrics: jest.fn().mockReturnValue({}),
  calculateScoreBreakdown: jest.fn().mockReturnValue({
    academic: 80,
    activity: 70,
    award: 60,
    overall: 72,
  }),
  calculateOverallScore: jest.fn().mockReturnValue(72),
}));

describe('HallService', () => {
  let service: HallService;
  let _prisma: PrismaService;
  const mockPointsService = {
    adjustPoints: jest.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  };

  const mockPrisma = {
    profile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
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
    userList: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    userListVote: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    school: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    schoolListItem: {
      findMany: jest.fn(),
    },
    pointHistory: {
      create: jest.fn().mockReturnValue({
        then: jest.fn().mockReturnValue({
          catch: jest.fn(),
        }),
      }),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    admissionCase: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    follow: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HallService,
        HallRankingService,
        HallReviewService,
        HallListService,
        HallVerifiedService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: MemoryManagerService,
          useValue: null,
        },
        {
          provide: LLMService,
          useValue: null,
        },
        {
          provide: NotificationService,
          useValue: { createNotification: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: PointsService,
          useValue: mockPointsService,
        },
      ],
    }).compile();

    service = module.get<HallService>(HallService);
    _prisma = module.get<PrismaService>(PrismaService);

    // 2026-05 Hall Plan C (C2): the peer-review consent + age gate reads
    // `user.findUnique`. Default to a consenting adult so the review tests
    // exercise the happy path.
    mockPrisma.user.findUnique.mockResolvedValue({
      acceptPeerReview: true,
      profile: { birthday: null },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // calcBands (tested via HallRankingService)
  // ============================================

  describe('calcBands (via ranking sub-service)', () => {
    let rankingService: HallRankingService;

    beforeEach(() => {
      rankingService = (service as any).ranking;
    });

    it('should return zeros for empty values', () => {
      const result = rankingService.calcBands([]);
      expect(result).toEqual({ p25: 0, p50: 0, p75: 0 });
    });

    it('should compute percentile bands for a sorted array', () => {
      const result = rankingService.calcBands([10, 20, 30, 40, 50, 60, 70, 80]);
      expect(result.p25).toBeGreaterThan(0);
      expect(result.p50).toBeGreaterThanOrEqual(result.p25);
      expect(result.p75).toBeGreaterThanOrEqual(result.p50);
    });

    it('should handle single-element array', () => {
      const result = rankingService.calcBands([50]);
      expect(result).toEqual({ p25: 50, p50: 50, p75: 50 });
    });
  });

  // ============================================
  // Public Profiles
  // ============================================

  describe('getPublicProfiles', () => {
    it('should return profiles with ANONYMOUS and VERIFIED_ONLY visibility', async () => {
      const profiles = [
        {
          id: 'profile-1',
          userId: 'user-1',
          grade: '12',
          gpa: 3.8,
          gpaScale: 4.0,
          targetMajor: 'CS',
          visibility: 'VERIFIED_ONLY',
          _count: { testScores: 2, activities: 3, awards: 1 },
        },
        {
          id: 'profile-2',
          userId: 'user-2',
          grade: '11',
          gpa: 3.5,
          gpaScale: 4.0,
          targetMajor: 'Engineering',
          visibility: 'ANONYMOUS',
          _count: { testScores: 1, activities: 2, awards: 0 },
        },
      ];
      mockPrisma.profile.findMany.mockResolvedValue(profiles);
      mockPrisma.profile.count.mockResolvedValue(2);

      const result = await service.getPublicProfiles();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].userId).toBe('user-1');
      expect(result.data[1].userId).toMatch(/^anon-/);
      expect(result.data[1].userId).not.toBe('user-2');
    });

    it('should filter by search term (targetMajor)', async () => {
      mockPrisma.profile.findMany.mockResolvedValue([]);
      mockPrisma.profile.count.mockResolvedValue(0);

      await service.getPublicProfiles('Computer');

      expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetMajor: { contains: 'Computer', mode: 'insensitive' },
          }),
        }),
      );
    });

    // 2026-05 Hall Plan C (security B3): precise gpa is no longer exposed.
    it('does not expose precise gpa/gpaScale on public profiles', async () => {
      mockPrisma.profile.findMany.mockResolvedValue([
        {
          id: 'p-1',
          userId: 'u-1',
          grade: null,
          targetMajor: null,
          visibility: 'VERIFIED_ONLY',
          _count: { testScores: 0, activities: 0, awards: 0 },
        },
      ]);
      mockPrisma.profile.count.mockResolvedValue(1);

      const result = await service.getPublicProfiles();
      expect(result.data[0]).not.toHaveProperty('gpa');
      expect(result.data[0]).not.toHaveProperty('gpaScale');
    });
  });

  // ============================================
  // Reviews
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

    it('should award SUBMIT_REVIEW via PointsService for new PUBLISHED review', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);
      mockPrisma.review.create.mockResolvedValue({ id: 'review-new' });

      await service.createReview('reviewer-1', reviewData);

      // Hall refactor Phase 1: points now flow through PointsService.adjustPoints
      // (admin-configurable), not a direct pointHistory.create write that
      // bypassed the enabled flag and dynamic config.
      expect(mockPointsService.adjustPoints).toHaveBeenCalledWith(
        'reviewer-1',
        PointAction.SUBMIT_REVIEW,
        expect.objectContaining({
          profileUserId: reviewData.profileUserId,
        }),
      );
    });

    it('should NOT award points for DRAFT review', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);
      mockPrisma.review.create.mockResolvedValue({ id: 'review-draft' });

      await service.createReview('reviewer-1', {
        ...reviewData,
        status: 'DRAFT',
      });

      expect(mockPointsService.adjustPoints).not.toHaveBeenCalled();
    });

    it('should NOT award points when updating existing review', async () => {
      const existing = {
        id: 'review-old',
        reviewerId: 'reviewer-1',
        profileUserId: 'target-user',
      };
      mockPrisma.review.findUnique.mockResolvedValue(existing);
      mockPrisma.review.update.mockResolvedValue({
        ...existing,
        ...reviewData,
      });

      await service.createReview('reviewer-1', reviewData);

      // Updates should never re-award points.
      expect(mockPointsService.adjustPoints).not.toHaveBeenCalled();
    });
  });

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

  describe('getReviewsForUser', () => {
    it('should return paginated reviews', async () => {
      const reviews = [
        {
          id: 'r-1',
          overallScore: 8,
          reviewer: { id: 'u-1', email: 'a@b.c', role: 'USER' },
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
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should use default pagination when no options', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(0);

      const result = await service.getReviewsForUser('target-user');

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

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

      // 2026-05 Hall Plan C (C2b): numeric `averages` removed.
      expect(result).not.toBeNull();
      expect(result!.reviewCount).toBe(2);
      expect(result).not.toHaveProperty('averages');
      expect(result!.topTags[0]).toBe('strong-academic');
    });
  });

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

  describe('removeReaction', () => {
    it('should delete reaction and update count', async () => {
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
  // User Lists
  // ============================================

  describe('createList', () => {
    it('should create a new list', async () => {
      const listData = {
        title: 'Top 10 Schools',
        description: 'My picks',
        category: 'schools',
        items: [{ name: 'Harvard' }],
        isPublic: true,
      };
      const created = { id: 'list-1', userId: 'user-1', ...listData };
      mockPrisma.userList.create.mockResolvedValue(created);

      const result = await service.createList('user-1', listData);

      expect(result).toEqual(created);
      expect(mockPrisma.userList.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          title: 'Top 10 Schools',
          isPublic: true,
        }),
      });
    });

    it('should default isPublic to true when not specified', async () => {
      mockPrisma.userList.create.mockResolvedValue({ id: 'list-2' });

      await service.createList('user-1', {
        title: 'Test',
        items: [],
      });

      expect(mockPrisma.userList.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isPublic: true,
        }),
      });
    });
  });

  describe('updateList', () => {
    it('should update list when owned by user', async () => {
      const existing = { id: 'list-1', userId: 'user-1' };
      const updated = { ...existing, title: 'Updated Title' };

      mockPrisma.userList.findUnique.mockResolvedValue(existing);
      mockPrisma.userList.update.mockResolvedValue(updated);

      const result = await service.updateList('list-1', 'user-1', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundException if list not found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(
        service.updateList('nonexistent', 'user-1', { title: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if not owned by user', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'other-user',
      });

      await expect(
        service.updateList('list-1', 'user-1', { title: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteList', () => {
    it('should delete list when owned by user', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'user-1',
      });
      mockPrisma.userList.delete.mockResolvedValue({});

      await service.deleteList('list-1', 'user-1');

      expect(mockPrisma.userList.delete).toHaveBeenCalledWith({
        where: { id: 'list-1' },
      });
    });

    it('should throw NotFoundException if list not found or not owned', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(service.deleteList('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPublicLists', () => {
    it('should return paginated public lists', async () => {
      const lists = [{ id: 'list-1', title: 'Top Schools', isPublic: true }];
      mockPrisma.userList.findMany.mockResolvedValue(lists);
      mockPrisma.userList.count.mockResolvedValue(1);

      const result = await service.getPublicLists({ page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by category when provided', async () => {
      mockPrisma.userList.findMany.mockResolvedValue([]);
      mockPrisma.userList.count.mockResolvedValue(0);

      await service.getPublicLists({ page: 1, pageSize: 20 }, 'schools');

      expect(mockPrisma.userList.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublic: true, category: 'schools' },
        }),
      );
    });
  });

  describe('getMyLists', () => {
    it('should return user own lists', async () => {
      const lists = [{ id: 'list-1', userId: 'user-1', title: 'My List' }];
      mockPrisma.userList.findMany.mockResolvedValue(lists);

      const result = await service.getMyLists('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.userList.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        }),
      );
    });
  });

  describe('getListById', () => {
    it('should return list by id', async () => {
      const list = { id: 'list-1', title: 'Test List' };
      mockPrisma.userList.findUnique.mockResolvedValue(list);

      const result = await service.getListById('list-1');
      expect(result).toEqual(list);
    });

    it('should throw NotFoundException if list not found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(service.getListById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('voteList', () => {
    it('should throw NotFoundException if list not found or not public', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(
        service.voteList('nonexistent', 'user-1', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if list is not public', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'other-user',
        isPublic: false,
      });

      await expect(service.voteList('list-1', 'user-1', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when voting on own list', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'user-1',
        isPublic: true,
      });

      await expect(service.voteList('list-1', 'user-1', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should upsert vote successfully', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'other-user',
        isPublic: true,
        title: 'Some List',
        category: 'schools',
      });
      const vote = {
        id: 'vote-1',
        listId: 'list-1',
        userId: 'user-1',
        value: 1,
      };
      mockPrisma.userListVote.upsert.mockResolvedValue(vote);

      const result = await service.voteList('list-1', 'user-1', 1);

      expect(result).toEqual(vote);
      expect(mockPrisma.userListVote.upsert).toHaveBeenCalledWith({
        where: { listId_userId: { listId: 'list-1', userId: 'user-1' } },
        update: { value: 1 },
        create: { listId: 'list-1', userId: 'user-1', value: 1 },
      });
    });
  });

  describe('removeVote', () => {
    it('should delete vote for given list and user', async () => {
      mockPrisma.userListVote.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeVote('list-1', 'user-1');

      expect(mockPrisma.userListVote.deleteMany).toHaveBeenCalledWith({
        where: { listId: 'list-1', userId: 'user-1' },
      });
    });
  });

  describe('getListVoteCount', () => {
    it('should return aggregated vote sum', async () => {
      mockPrisma.userListVote.aggregate.mockResolvedValue({
        _sum: { value: 42 },
      });

      const result = await service.getListVoteCount('list-1');
      expect(result).toBe(42);
    });

    it('should return 0 when no votes', async () => {
      mockPrisma.userListVote.aggregate.mockResolvedValue({
        _sum: { value: null },
      });

      const result = await service.getListVoteCount('list-1');
      expect(result).toBe(0);
    });
  });

  // ============================================
  // Ranking
  // ============================================

  describe('getProfileRanking', () => {
    const mockUserProfile = {
      userId: 'user-1',
      testScores: [],
      activities: [],
      awards: [],
    };

    it('should return message when user has no profile', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
      });
      mockPrisma.profile.findMany.mockResolvedValue([]);
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getProfileRanking('user-1', 'school-1');

      expect(result.rank).toBeNull();
      expect(result.message).toBe('Complete your profile first');
    });

    it('should return ranking when user has a profile', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
      });
      mockPrisma.profile.findMany.mockResolvedValue([mockUserProfile]);
      mockPrisma.profile.findUnique.mockResolvedValue(mockUserProfile);

      const result = await service.getProfileRanking('user-1', 'school-1');

      expect(result.rank).toBe(1);
      expect(result.total).toBe(1);
      expect(result.percentile).toBe(100);
    });

    it('should include user in competitor list if not already present', async () => {
      const competitor = {
        userId: 'comp-1',
        testScores: [],
        activities: [],
        awards: [],
      };
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
      });
      mockPrisma.profile.findMany.mockResolvedValue([competitor]);
      mockPrisma.profile.findUnique.mockResolvedValue(mockUserProfile);

      const result = await service.getProfileRanking('user-1', 'school-1');

      expect(result.total).toBe(2);
    });
  });

  describe('getBatchRanking', () => {
    it('should return empty rankings for empty schoolIds', async () => {
      const result = await service.getBatchRanking('user-1', []);
      expect(result.rankings).toEqual([]);
    });

    it('should return rankings for multiple schools', async () => {
      const schools = [
        { id: 'school-1', name: 'MIT', nameZh: 'MIT' },
        { id: 'school-2', name: 'Stanford', nameZh: null },
      ];
      const userProfile = {
        userId: 'user-1',
        testScores: [],
        activities: [],
        awards: [],
      };

      mockPrisma.school.findMany.mockResolvedValue(schools);
      mockPrisma.profile.findUnique.mockResolvedValue(userProfile);
      mockPrisma.schoolListItem.findMany.mockResolvedValue([]);
      mockPrisma.profile.findMany.mockResolvedValue([]);

      const result = await service.getBatchRanking('user-1', [
        'school-1',
        'school-2',
      ]);

      expect(result.rankings).toHaveLength(2);
      expect(result.rankings[0].schoolId).toBe('school-1');
      expect(result.rankings[1].schoolId).toBe('school-2');
      expect(result.rankings[0].yourRank).toBe(1);
      expect(result.rankings[0].percentile).toBe(100);
    });

    it('should return empty rankings when user has no profile', async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { id: 'school-1', name: 'MIT' },
      ]);
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getBatchRanking('user-1', ['school-1']);
      expect(result.rankings).toEqual([]);
    });
  });

  describe('getTargetSchoolRanking', () => {
    it('should return empty when user has no school list items', async () => {
      mockPrisma.schoolListItem.findMany.mockResolvedValue([]);

      const result = await service.getTargetSchoolRanking('user-1');

      expect(result.rankings).toEqual([]);
      expect(result.totalTargetSchools).toBe(0);
    });
  });

  describe('getRankingAnalysis', () => {
    it('should return fallback when aiService is unavailable (null)', async () => {
      const result = await service.getRankingAnalysis('user-1', 'school-1');

      expect(result.analysis).toContain('AI');
      expect(result.strengths).toEqual([]);
      expect(result.improvements).toEqual([]);
    });
  });
});
