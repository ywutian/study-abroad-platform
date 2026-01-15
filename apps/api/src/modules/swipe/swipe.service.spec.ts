import { Test, TestingModule } from '@nestjs/testing';
import { SwipeService } from './swipe.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';
import { SwipePrediction } from './dto';

describe('SwipeService', () => {
  let service: SwipeService;
  let prismaService: PrismaService;

  const mockSchool = {
    id: 'school-1',
    name: 'MIT',
    nameZh: '麻省理工学院',
    usNewsRank: 2,
    acceptanceRate: new Prisma.Decimal(3.96),
  };

  const mockCase = {
    id: 'case-1',
    userId: 'other-user',
    schoolId: 'school-1',
    year: 2025,
    round: 'EA',
    result: 'ADMITTED',
    major: 'Computer Science',
    gpaRange: '3.9-4.0',
    satRange: '1550-1600',
    actRange: null,
    toeflRange: '110-120',
    tags: ['strong_research'],
    visibility: Visibility.ANONYMOUS,
    isVerified: true,
    verifiedAt: new Date(),
    essayType: null,
    essayPrompt: null,
    essayContent: null,
    promptNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    school: mockSchool,
    user: {
      profile: {
        grade: 'SENIOR',
        currentSchoolType: 'PRIVATE_US',
        activities: [
          { category: 'RESEARCH' },
          { category: 'LEADERSHIP' },
          { category: 'ACADEMIC' },
        ],
        awards: [{ level: 'NATIONAL' }, { level: 'STATE' }],
        testScores: [
          { type: 'AP', score: 5 },
          { type: 'AP', score: 5 },
          { type: 'AP', score: 4 },
        ],
      },
    },
  };

  const mockStats = {
    id: 'stats-1',
    userId: 'user-1',
    totalSwipes: 10,
    correctCount: 7,
    streak: 3,
    bestStreak: 5,
    badge: 'bronze',
    dailyChallengeCount: 2,
    dailyChallengeDate: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    admissionCase: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    caseSwipe: {
      create: jest.fn(),
      count: jest.fn(),
    },
    swipeStats: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    pointHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwipeService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: MemoryManagerService,
          useValue: {
            remember: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<SwipeService>(SwipeService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============ getNextCases ============

  describe('getNextCases', () => {
    it('should return cases with meta info', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([mockCase]);
      mockPrisma.admissionCase.count.mockResolvedValue(50);
      mockPrisma.caseSwipe.count.mockResolvedValue(10);

      const result = await service.getNextCases('user-1', 5);

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].schoolName).toBe('MIT');
      expect(result.cases[0].schoolNameZh).toBe('麻省理工学院');
      expect(result.meta.totalAvailable).toBe(50);
      expect(result.meta.totalSwiped).toBe(10);
      expect(result.meta.hasMore).toBe(true);

      // Applicant profile aggregates
      expect(result.cases[0].applicantGrade).toBe('SENIOR');
      expect(result.cases[0].applicantSchoolType).toBe('PRIVATE_US');
      expect(result.cases[0].activityCount).toBe(3);
      expect(result.cases[0].activityHighlights).toEqual([
        'RESEARCH',
        'LEADERSHIP',
        'ACADEMIC',
      ]);
      expect(result.cases[0].awardCount).toBe(2);
      expect(result.cases[0].highestAwardLevel).toBe('NATIONAL');
      expect(result.cases[0].apCount).toBe(3);
    });

    it('should use Prisma relation filter (swipes: none) instead of notIn', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);
      mockPrisma.admissionCase.count.mockResolvedValue(0);
      mockPrisma.caseSwipe.count.mockResolvedValue(0);

      await service.getNextCases('user-1', 5);

      expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            swipes: { none: { userId: 'user-1' } },
            visibility: {
              in: [Visibility.ANONYMOUS, Visibility.VERIFIED_ONLY],
            },
            userId: { not: 'user-1' },
          }),
        }),
      );
    });

    it('should return empty cases with hasMore=false when no cases available', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);
      mockPrisma.admissionCase.count.mockResolvedValue(0);
      mockPrisma.caseSwipe.count.mockResolvedValue(0);

      const result = await service.getNextCases('user-1', 5);

      expect(result.cases).toHaveLength(0);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.totalAvailable).toBe(0);
    });

    it('should map case fields to DTO correctly', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([mockCase]);
      mockPrisma.admissionCase.count.mockResolvedValue(1);
      mockPrisma.caseSwipe.count.mockResolvedValue(0);

      const result = await service.getNextCases('user-1', 5);
      const dto = result.cases[0];

      expect(dto.id).toBe('case-1');
      expect(dto.year).toBe(2025);
      expect(dto.round).toBe('EA');
      expect(dto.major).toBe('Computer Science');
      expect(dto.gpaRange).toBe('3.9-4.0');
      expect(dto.tags).toEqual(['strong_research']);
      expect(dto.isVerified).toBe(true);
      expect(dto.usNewsRank).toBe(2);
      expect(dto.acceptanceRate).toBeCloseTo(3.96);
    });

    it('should request count*2 cases for shuffling', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);
      mockPrisma.admissionCase.count.mockResolvedValue(0);
      mockPrisma.caseSwipe.count.mockResolvedValue(0);

      await service.getNextCases('user-1', 7);

      expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 14,
        }),
      );
    });
  });

  // ============ submitSwipe ============

  describe('submitSwipe', () => {
    it('should handle correct prediction', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.ADMIT,
      });

      expect(result.isCorrect).toBe(true);
      expect(result.pointsEarned).toBeGreaterThan(0);
      expect(result.currentStreak).toBe(mockStats.streak + 1);
    });

    it('should handle incorrect prediction', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.REJECT,
      });

      expect(result.isCorrect).toBe(false);
      expect(result.pointsEarned).toBe(0);
      expect(result.currentStreak).toBe(0);
    });

    it('should throw NotFoundException when case does not exist', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue(null);

      await expect(
        service.submitSwipe('user-1', {
          caseId: 'nonexistent',
          prediction: SwipePrediction.ADMIT,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on duplicate submission (P2002)', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.0.0',
          meta: { target: ['userId', 'caseId'] },
        },
      );
      mockPrisma.$transaction.mockRejectedValue(p2002Error);

      await expect(
        service.submitSwipe('user-1', {
          caseId: 'case-1',
          prediction: SwipePrediction.ADMIT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should re-throw non-P2002 errors', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(
        service.submitSwipe('user-1', {
          caseId: 'case-1',
          prediction: SwipePrediction.ADMIT,
        }),
      ).rejects.toThrow('DB connection lost');
    });

    it('should cap points at 20 per swipe', async () => {
      const highStreakStats = { ...mockStats, streak: 20 };
      mockPrisma.admissionCase.findUnique.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(highStreakStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.ADMIT,
      });

      expect(result.pointsEarned).toBeLessThanOrEqual(20);
    });

    it('should use upsert for stats instead of find-then-create', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.ADMIT,
      });

      expect(mockPrisma.swipeStats.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: { userId: 'user-1' },
        update: {},
      });
    });
  });

  // ============ getStats ============

  describe('getStats', () => {
    it('should return stats with upsert', async () => {
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);

      const result = await service.getStats('user-1');

      expect(result.totalSwipes).toBe(10);
      expect(result.correctCount).toBe(7);
      expect(result.accuracy).toBe(70);
      expect(result.currentStreak).toBe(3);
      expect(result.bestStreak).toBe(5);
      expect(result.badge).toBe('bronze');
    });

    it('should return 0 accuracy for zero swipes', async () => {
      const zeroStats = { ...mockStats, totalSwipes: 0, correctCount: 0 };
      mockPrisma.swipeStats.upsert.mockResolvedValue(zeroStats);

      const result = await service.getStats('user-1');

      expect(result.accuracy).toBe(0);
    });

    it('should reset daily challenge count on new day', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const oldDateStats = {
        ...mockStats,
        dailyChallengeDate: yesterday,
        dailyChallengeCount: 5,
      };
      mockPrisma.swipeStats.upsert.mockResolvedValue(oldDateStats);

      const result = await service.getStats('user-1');

      expect(result.dailyChallengeCount).toBe(0);
    });

    it('should show current daily challenge count for today', async () => {
      const todayStats = {
        ...mockStats,
        dailyChallengeDate: new Date(),
        dailyChallengeCount: 5,
      };
      mockPrisma.swipeStats.upsert.mockResolvedValue(todayStats);

      const result = await service.getStats('user-1');

      expect(result.dailyChallengeCount).toBe(5);
    });
  });

  // ============ getLeaderboard ============

  describe('getLeaderboard', () => {
    it('should return leaderboard with masked user info', async () => {
      mockPrisma.swipeStats.findMany.mockResolvedValue([
        {
          ...mockStats,
          userId: 'other-user-abc123',
          user: { id: 'other-user-abc123', profile: { realName: '张三' } },
        },
      ]);
      mockPrisma.swipeStats.findUnique.mockResolvedValue(null);

      const result = await service.getLeaderboard('user-1', 20);

      expect(result.entries).toHaveLength(1);
      // 非当前用户应该脱敏
      expect(result.entries[0].userId).toBe('****c123');
      expect(result.entries[0].userName).toBe('张**');
      expect(result.entries[0].isCurrentUser).toBe(false);
    });

    it('should show full info for current user', async () => {
      mockPrisma.swipeStats.findMany.mockResolvedValue([
        {
          ...mockStats,
          userId: 'user-1',
          user: { id: 'user-1', profile: { realName: '李四' } },
        },
      ]);

      const result = await service.getLeaderboard('user-1', 20);

      expect(result.entries[0].userId).toBe('user-1');
      expect(result.entries[0].userName).toBe('李四');
      expect(result.entries[0].isCurrentUser).toBe(true);
    });

    it('should include current user rank when not in top N', async () => {
      mockPrisma.swipeStats.findMany.mockResolvedValue([]);
      mockPrisma.swipeStats.findUnique.mockResolvedValue({
        ...mockStats,
        userId: 'user-1',
        user: { id: 'user-1', profile: { realName: '李四' } },
      });
      mockPrisma.swipeStats.count.mockResolvedValue(5);

      const result = await service.getLeaderboard('user-1', 20);

      expect(result.currentUserEntry).toBeDefined();
      expect(result.currentUserEntry?.rank).toBe(6);
      expect(result.currentUserEntry?.isCurrentUser).toBe(true);
    });
  });

  // ============ checkPrediction (private, tested via submitSwipe) ============

  describe('prediction checking (via submitSwipe)', () => {
    beforeEach(() => {
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);
    });

    it('should match admit prediction with ADMITTED result', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue({
        ...mockCase,
        result: 'ADMITTED',
      });
      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.ADMIT,
      });
      expect(result.isCorrect).toBe(true);
    });

    it('should match reject prediction with REJECTED result', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue({
        ...mockCase,
        result: 'REJECTED',
      });
      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.REJECT,
      });
      expect(result.isCorrect).toBe(true);
    });

    it('should match waitlist prediction with WAITLISTED result', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue({
        ...mockCase,
        result: 'WAITLISTED',
      });
      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.WAITLIST,
      });
      expect(result.isCorrect).toBe(true);
    });

    it('should treat DEFERRED as WAITLIST', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue({
        ...mockCase,
        result: 'DEFERRED',
      });
      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.WAITLIST,
      });
      expect(result.isCorrect).toBe(true);
    });
  });

  // ============ calculateBadge (private, tested via badge upgrade detection) ============

  describe('badge calculation (via submitSwipe)', () => {
    it('should upgrade badge when threshold is reached', async () => {
      const statsAt19 = {
        ...mockStats,
        correctCount: 19,
        streak: 0,
        badge: 'bronze',
      };
      mockPrisma.admissionCase.findUnique.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(statsAt19);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.ADMIT,
      });

      // correctCount goes from 19 to 20, should upgrade to silver
      expect(result.badgeUpgraded).toBe(true);
      expect(result.currentBadge).toBe('silver');
    });

    it('should not upgrade badge when below threshold', async () => {
      const statsAt18 = {
        ...mockStats,
        correctCount: 18,
        streak: 0,
        badge: 'bronze',
      };
      mockPrisma.admissionCase.findUnique.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(statsAt18);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.ADMIT,
      });

      // correctCount goes from 18 to 19, still bronze
      expect(result.badgeUpgraded).toBe(false);
      expect(result.currentBadge).toBe('bronze');
    });
  });
});
