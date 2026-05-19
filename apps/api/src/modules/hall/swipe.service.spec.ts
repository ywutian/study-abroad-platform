import { Test, TestingModule } from '@nestjs/testing';
import { SwipeService } from './swipe.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';
import { SwipePrediction } from './swipe-dto';

describe('SwipeService', () => {
  let service: SwipeService;
  let _prismaService: PrismaService;

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

  // 2026-05 Hall Plan C (C3): de-gamified. SwipeStats now only carries the
  // private calibration counters — no streak / badge / dailyChallenge.
  const mockStats = {
    id: 'stats-1',
    userId: 'user-1',
    totalSwipes: 10,
    correctCount: 7,
    updatedAt: new Date(),
  };

  const mockPrisma = {
    admissionCase: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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
    _prismaService = module.get<PrismaService>(PrismaService);
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
      expect(dto.acceptanceRate).toBe(4);
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
      mockPrisma.admissionCase.findFirst.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.ADMIT,
      });

      expect(result.isCorrect).toBe(true);
      expect(result.actualResult).toBe('admitted');
    });

    it('should handle incorrect prediction', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.REJECT,
      });

      expect(result.isCorrect).toBe(false);
    });

    // 2026-05 Hall Plan C (C3): de-gamified — the result no longer carries
    // points / streak / badge fields.
    it('returns a de-gamified result with no points/streak/badge fields', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.ADMIT,
      });

      expect(result).not.toHaveProperty('pointsEarned');
      expect(result).not.toHaveProperty('currentStreak');
      expect(result).not.toHaveProperty('badgeUpgraded');
      expect(result).not.toHaveProperty('currentBadge');
    });

    it('should throw NotFoundException when case does not exist', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue(null);

      await expect(
        service.submitSwipe('user-1', {
          caseId: 'nonexistent',
          prediction: SwipePrediction.ADMIT,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on duplicate submission (P2002)', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue(mockCase);
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
      mockPrisma.admissionCase.findFirst.mockResolvedValue(mockCase);
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

    it('should use upsert for stats instead of find-then-create', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue(mockCase);
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
    // 2026-05 Hall Plan C (C3): de-gamified — getStats returns only the
    // private calibration counters (total / correct / accuracy).
    it('should return de-gamified calibration stats with upsert', async () => {
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);

      const result = await service.getStats('user-1');

      expect(result.totalSwipes).toBe(10);
      expect(result.correctCount).toBe(7);
      expect(result.accuracy).toBe(70);
      expect(result).not.toHaveProperty('currentStreak');
      expect(result).not.toHaveProperty('bestStreak');
      expect(result).not.toHaveProperty('badge');
      expect(result).not.toHaveProperty('dailyChallengeCount');
    });

    it('should return 0 accuracy for zero swipes', async () => {
      const zeroStats = { ...mockStats, totalSwipes: 0, correctCount: 0 };
      mockPrisma.swipeStats.upsert.mockResolvedValue(zeroStats);

      const result = await service.getStats('user-1');

      expect(result.accuracy).toBe(0);
    });
  });

  // ============ checkPrediction (private, tested via submitSwipe) ============

  describe('prediction checking (via submitSwipe)', () => {
    beforeEach(() => {
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);
    });

    it('should match admit prediction with ADMITTED result', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
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
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
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
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        ...mockCase,
        result: 'WAITLISTED',
      });
      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.WAITLIST,
      });
      expect(result.isCorrect).toBe(true);
    });

    // 2026-05 Hall Plan C (C3): deferred ≠ waitlisted — they are distinct
    // admission states. Deferred cases are excluded from the deck and a
    // WAITLIST guess on one no longer counts as correct.
    it('does not treat DEFERRED as a correct WAITLIST guess', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        ...mockCase,
        result: 'DEFERRED',
      });
      const result = await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.WAITLIST,
      });
      expect(result.isCorrect).toBe(false);
    });
  });

  // ============ calibration counters (de-gamified, Plan C C3) ============

  describe('calibration counters (via submitSwipe)', () => {
    it('increments only totalSwipes / correctCount — no streak/badge writes', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.ADMIT,
      });

      expect(mockPrisma.swipeStats.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          totalSwipes: { increment: 1 },
          correctCount: { increment: 1 },
        },
      });
    });

    it('does not increment correctCount on a wrong guess', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue(mockCase);
      mockPrisma.swipeStats.upsert.mockResolvedValue(mockStats);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      await service.submitSwipe('user-1', {
        caseId: 'case-1',
        prediction: SwipePrediction.REJECT,
      });

      expect(mockPrisma.swipeStats.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          totalSwipes: { increment: 1 },
          correctCount: undefined,
        },
      });
    });
  });
});
