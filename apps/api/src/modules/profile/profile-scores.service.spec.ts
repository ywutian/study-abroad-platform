import { Test, TestingModule } from '@nestjs/testing';
import { ProfileScoresService } from './profile-scores.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { ProfileHelpersService } from './profile-helpers.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('ProfileScoresService', () => {
  let service: ProfileScoresService;

  const mockPrisma = {
    testScore: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    activity: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    award: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCacheInvalidation = {
    onProfileChange: jest.fn().mockResolvedValue(undefined),
  };

  const mockLLMService = {
    chatSimple: jest.fn(),
  };

  const mockHelpers = {
    getProfileId: jest.fn().mockResolvedValue('profile-1'),
    verifyProfileOwnership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileScoresService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheInvalidationService, useValue: mockCacheInvalidation },
        { provide: LLMService, useValue: mockLLMService },
        { provide: ProfileHelpersService, useValue: mockHelpers },
      ],
    }).compile();

    service = module.get<ProfileScoresService>(ProfileScoresService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Test Scores
  // ============================================

  describe('createTestScore', () => {
    it('should create a test score and invalidate cache', async () => {
      const created = {
        id: 'ts-1',
        profileId: 'profile-1',
        type: 'SAT',
        score: 1500,
      };
      mockPrisma.testScore.create.mockResolvedValue(created);

      const result = await service.createTestScore('user-1', {
        type: 'SAT',
        score: 1500,
      } as any);

      expect(result).toEqual(created);
      expect(mockHelpers.getProfileId).toHaveBeenCalledWith('user-1');
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should handle testDate when provided', async () => {
      mockPrisma.testScore.create.mockResolvedValue({ id: 'ts-2' });

      await service.createTestScore('user-1', {
        type: 'TOEFL',
        score: 110,
        testDate: '2025-01-15',
      } as any);

      expect(mockPrisma.testScore.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testDate: expect.any(Date),
        }),
      });
    });
  });

  describe('deleteTestScore', () => {
    it('should delete test score after verifying ownership', async () => {
      const score = { id: 'ts-1', profile: { userId: 'user-1' } };
      mockPrisma.testScore.findUnique.mockResolvedValue(score);
      mockHelpers.verifyProfileOwnership.mockReturnValue(score);
      mockPrisma.testScore.delete.mockResolvedValue({});

      await service.deleteTestScore('user-1', 'ts-1');

      expect(mockPrisma.testScore.delete).toHaveBeenCalledWith({
        where: { id: 'ts-1' },
      });
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('getTestScores', () => {
    it('should return test scores for a user', async () => {
      const scores = [
        { id: 'ts-1', type: 'SAT', score: 1500 },
        { id: 'ts-2', type: 'TOEFL', score: 110 },
      ];
      mockPrisma.profile.findUnique.mockResolvedValue({ testScores: scores });

      const result = await service.getTestScores('user-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no profile exists', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getTestScores('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // Activities
  // ============================================

  describe('createActivity', () => {
    it('should create an activity and invalidate cache', async () => {
      const created = {
        id: 'act-1',
        name: 'Debate Club',
        profileId: 'profile-1',
      };
      mockPrisma.activity.create.mockResolvedValue(created);

      const result = await service.createActivity('user-1', {
        name: 'Debate Club',
        category: 'LEADERSHIP',
      } as any);

      expect(result).toEqual(created);
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('deleteActivity', () => {
    it('should delete activity after verifying ownership', async () => {
      const activity = { id: 'act-1', profile: { userId: 'user-1' } };
      mockPrisma.activity.findUnique.mockResolvedValue(activity);
      mockHelpers.verifyProfileOwnership.mockReturnValue(activity);
      mockPrisma.activity.delete.mockResolvedValue({});

      await service.deleteActivity('user-1', 'act-1');

      expect(mockPrisma.activity.delete).toHaveBeenCalledWith({
        where: { id: 'act-1' },
      });
    });
  });

  describe('getActivities', () => {
    it('should return activities ordered by order', async () => {
      const activities = [
        { id: 'act-1', order: 0 },
        { id: 'act-2', order: 1 },
      ];
      mockPrisma.profile.findUnique.mockResolvedValue({ activities });

      const result = await service.getActivities('user-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no profile exists', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getActivities('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('reorderActivities', () => {
    it('should reorder activities in a transaction', async () => {
      mockPrisma.activity.findMany.mockResolvedValue([
        { id: 'act-1' },
        { id: 'act-2' },
      ]);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.reorderActivities('user-1', ['act-2', 'act-1']);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should throw ForbiddenException when activity IDs do not belong to user', async () => {
      mockPrisma.activity.findMany.mockResolvedValue([{ id: 'act-1' }]);

      await expect(
        service.reorderActivities('user-1', ['act-1', 'foreign-act']),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ============================================
  // Awards
  // ============================================

  describe('createAward', () => {
    it('should create an award and invalidate cache', async () => {
      const created = { id: 'award-1', name: 'USAMO', profileId: 'profile-1' };
      mockPrisma.award.create.mockResolvedValue(created);

      const result = await service.createAward('user-1', {
        name: 'USAMO',
        level: 'NATIONAL',
      } as any);

      expect(result).toEqual(created);
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('getAwards', () => {
    it('should return awards for a user', async () => {
      const awards = [{ id: 'award-1', name: 'USAMO' }];
      mockPrisma.profile.findUnique.mockResolvedValue({ awards });

      const result = await service.getAwards('user-1');

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no profile exists', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getAwards('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('reorderAwards', () => {
    it('should throw ForbiddenException for unowned award IDs', async () => {
      mockPrisma.award.findMany.mockResolvedValue([{ id: 'award-1' }]);

      await expect(
        service.reorderAwards('user-1', ['award-1', 'foreign-award']),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ============================================
  // AI Sort Activities
  // ============================================

  describe('aiSortActivities', () => {
    it('should throw BadRequestException when no activities exist', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({ activities: [] });

      await expect(service.aiSortActivities('user-1', 'en')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return single activity without calling LLM', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        targetMajor: 'CS',
        grade: '12',
        activities: [{ id: 'act-1', name: 'Debate' }],
      });

      const result = await service.aiSortActivities('user-1', 'en');

      expect(result.suggestedOrder).toHaveLength(1);
      expect(result.suggestedOrder[0].activityId).toBe('act-1');
      expect(mockLLMService.chatSimple).not.toHaveBeenCalled();
    });

    it('should return fallback when LLM fails', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        targetMajor: 'CS',
        grade: '12',
        activities: [
          { id: 'act-1', name: 'Debate' },
          { id: 'act-2', name: 'Math Club' },
        ],
      });
      mockLLMService.chatSimple.mockRejectedValue(new Error('LLM error'));

      const result = await service.aiSortActivities('user-1', 'en');

      expect(result.suggestedOrder).toHaveLength(2);
      expect(result.summary).toContain('unavailable');
    });
  });
});
