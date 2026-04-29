import { Test, TestingModule } from '@nestjs/testing';
import { ProfileScoresService } from './profile-scores.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { ProfileHelpersService } from './profile-helpers.service';
import { CaseIncentiveService } from '../points/incentive.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('ProfileScoresService', () => {
  let service: ProfileScoresService;

  const mockPrisma = {
    testScore: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    activity: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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
    semesterGpa: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCacheInvalidation = {
    onProfileChange: jest.fn().mockResolvedValue(undefined),
  };

  const mockLLMService = {
    chatSimple: jest.fn(),
    chatSimpleGuarded: jest.fn(),
  };

  const mockHelpers = {
    getProfileId: jest.fn().mockResolvedValue('profile-1'),
    verifyProfileOwnership: jest.fn(),
  };

  const mockCaseIncentiveService = {
    charge: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileScoresService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheInvalidationService, useValue: mockCacheInvalidation },
        { provide: LLMService, useValue: mockLLMService },
        { provide: ProfileHelpersService, useValue: mockHelpers },
        { provide: CaseIncentiveService, useValue: mockCaseIncentiveService },
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
      mockPrisma.testScore.findMany.mockResolvedValue([]);
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
      mockPrisma.testScore.findMany.mockResolvedValue([]);
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

    it('should persist explicit subject for subject-based scores', async () => {
      mockPrisma.testScore.findMany.mockResolvedValue([]);
      mockPrisma.testScore.create.mockResolvedValue({ id: 'ts-ap' });

      await service.createTestScore('user-1', {
        type: 'AP',
        score: 5,
        subject: 'Calculus BC',
      } as any);

      expect(mockPrisma.testScore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subject: 'Calculus BC',
          }),
        }),
      );
      expect(mockPrisma.testScore.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subject: 'Calculus BC',
        }),
      });
    });

    it('should extract legacy subject from subScores when subject is absent', async () => {
      mockPrisma.testScore.findMany.mockResolvedValue([]);
      mockPrisma.testScore.create.mockResolvedValue({ id: 'ts-legacy-ap' });

      await service.createTestScore('user-1', {
        type: 'AP',
        score: 4,
        subScores: { subject: 'US History' },
      } as any);

      expect(mockPrisma.testScore.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subject: 'US History',
          subScores: { subject: 'US History' },
        }),
      });
    });

    it('should reuse an identical existing score on retry', async () => {
      const existing = {
        id: 'ts-1',
        profileId: 'profile-1',
        type: 'TOEFL',
        score: 110,
        subScores: { reading: 29, listening: 28 },
        testDate: null,
        createdAt: new Date(),
      };
      mockPrisma.testScore.findMany.mockResolvedValue([existing]);

      const result = await service.createTestScore('user-1', {
        type: 'TOEFL',
        score: 110,
        subScores: { listening: 28, reading: 29 },
      } as any);

      expect(result).toEqual(existing);
      expect(mockPrisma.testScore.create).not.toHaveBeenCalled();
      expect(mockCacheInvalidation.onProfileChange).not.toHaveBeenCalled();
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
      expect(mockLLMService.chatSimpleGuarded).not.toHaveBeenCalled();
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
      mockLLMService.chatSimpleGuarded.mockRejectedValue(
        new Error('LLM error'),
      );

      const result = await service.aiSortActivities('user-1', 'en');

      expect(result.suggestedOrder).toHaveLength(2);
      expect(result.summary).toContain('unavailable');
    });
  });

  // ============================================
  // Semester GPA CRUD
  // ============================================

  describe('getSemesterGpas', () => {
    it('should return semester GPAs for a user', async () => {
      const gpas = [
        { id: 'sg-1', semester: 'g9fall', gpa: 3.8 },
        { id: 'sg-2', semester: 'g9spring', gpa: 3.9 },
      ];
      mockPrisma.profile.findUnique.mockResolvedValue({ semesterGpas: gpas });

      const result = await service.getSemesterGpas('user-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no profile exists', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getSemesterGpas('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('createSemesterGpa', () => {
    it('should create a semester GPA and trigger recalculation', async () => {
      const created = {
        id: 'sg-1',
        profileId: 'profile-1',
        semester: 'g9fall',
        gpa: 3.8,
      };
      mockPrisma.semesterGpa.create.mockResolvedValue(created);
      // recalculateGpa will call profile.findUnique
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [
          { semester: 'g9fall', gpa: 3.8, gpaScale: 4.0, credits: null },
        ],
      });
      mockPrisma.profile.update.mockResolvedValue({});

      const result = await service.createSemesterGpa('user-1', {
        semester: 'g9fall',
        year: 2024,
        gpa: 3.8,
        gpaScale: 4.0,
      } as any);

      expect(result).toEqual(created);
      expect(mockPrisma.profile.update).toHaveBeenCalled();
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('updateSemesterGpa', () => {
    it('should update semester GPA after verifying ownership', async () => {
      mockPrisma.semesterGpa.findUnique.mockResolvedValue({
        id: 'sg-1',
        profile: { id: 'profile-1', userId: 'user-1' },
      });
      mockPrisma.semesterGpa.update.mockResolvedValue({
        id: 'sg-1',
        gpa: 3.9,
      });
      // recalculateGpa
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [],
      });

      const result = await service.updateSemesterGpa('user-1', 'sg-1', {
        gpa: 3.9,
      } as any);

      expect(result.gpa).toBe(3.9);
    });

    it('should throw NotFoundException when semester GPA does not exist', async () => {
      mockPrisma.semesterGpa.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSemesterGpa('user-1', 'nonexistent', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when semester GPA belongs to another user', async () => {
      mockPrisma.semesterGpa.findUnique.mockResolvedValue({
        id: 'sg-1',
        profile: { id: 'profile-2', userId: 'other-user' },
      });

      await expect(
        service.updateSemesterGpa('user-1', 'sg-1', {} as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteSemesterGpa', () => {
    it('should delete semester GPA and trigger recalculation', async () => {
      mockPrisma.semesterGpa.findUnique.mockResolvedValue({
        id: 'sg-1',
        profile: { id: 'profile-1', userId: 'user-1' },
      });
      mockPrisma.semesterGpa.delete.mockResolvedValue({});
      // recalculateGpa
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [],
      });

      await service.deleteSemesterGpa('user-1', 'sg-1');

      expect(mockPrisma.semesterGpa.delete).toHaveBeenCalledWith({
        where: { id: 'sg-1' },
      });
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should throw NotFoundException when semester GPA does not exist', async () => {
      mockPrisma.semesterGpa.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteSemesterGpa('user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when semester GPA belongs to another user', async () => {
      mockPrisma.semesterGpa.findUnique.mockResolvedValue({
        id: 'sg-1',
        profile: { id: 'profile-2', userId: 'other-user' },
      });

      await expect(service.deleteSemesterGpa('user-1', 'sg-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ============================================
  // GPA Recalculation (via updateGpaByGrade / createSemesterGpa)
  // ============================================

  describe('recalculateGpa (via updateGpaByGrade)', () => {
    it('should compute weighted average from grade-level GPAs only', async () => {
      // updateGpaByGrade calls profile.update then recalculateGpa
      mockPrisma.profile.update.mockResolvedValue({});
      // First call: updateGpaByGrade's own update
      // Second call inside recalculateGpa: findUnique returns grade GPAs
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: 3.5,
        gpa10: 3.7,
        gpa11: 3.9,
        gpa12: 4.0,
        semesterGpas: [],
      });

      await service.updateGpaByGrade('user-1', {
        gpa9: 3.5,
        gpa10: 3.7,
        gpa11: 3.9,
        gpa12: 4.0,
      });

      // Weighted: 3.5*0.15 + 3.7*0.25 + 3.9*0.35 + 4.0*0.25 = 0.525 + 0.925 + 1.365 + 1.0 = 3.815
      // Rounded to 2 decimals: 3.82 (3.815 rounds to 3.82)
      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeDefined();
      expect(recalcCall[0].data.gpa).toBe(3.82);
    });

    it('should compute weighted average with only some grade GPAs', async () => {
      mockPrisma.profile.update.mockResolvedValue({});
      // Only gpa9 and gpa11 provided
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: 3.5,
        gpa10: null,
        gpa11: 3.9,
        gpa12: null,
        semesterGpas: [],
      });

      await service.updateGpaByGrade('user-1', { gpa9: 3.5, gpa11: 3.9 });

      // Weights: 9=0.15, 11=0.35. totalWeight=0.50
      // weightedSum = 3.5*0.15 + 3.9*0.35 = 0.525 + 1.365 = 1.89
      // gpa = 1.89 / 0.50 = 3.78
      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeDefined();
      expect(recalcCall[0].data.gpa).toBe(3.78);
    });

    it('should prioritize grade-level GPAs over semester GPAs', async () => {
      mockPrisma.profile.update.mockResolvedValue({});
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: 3.5,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [
          { semester: 'g10fall', gpa: 4.0, gpaScale: 4.0, credits: null },
        ],
      });

      await service.updateGpaByGrade('user-1', { gpa9: 3.5 });

      // Should use grade-level (3.5), NOT semester GPAs
      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeDefined();
      expect(recalcCall[0].data.gpa).toBe(3.5);
    });

    it('should not overwrite GPA when neither grade-level nor semester GPAs exist', async () => {
      mockPrisma.profile.update.mockResolvedValue({});
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [],
      });

      await service.updateGpaByGrade('user-1', {});

      // profile.update called once for the grade fields, but NOT for gpa recalc
      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeUndefined();
    });
  });

  describe('recalculateGpa from semester GPAs (via createSemesterGpa)', () => {
    it('should aggregate semester GPAs to grade level with simple average (no credits)', async () => {
      mockPrisma.semesterGpa.create.mockResolvedValue({ id: 'sg-1' });
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [
          { semester: 'g9fall', gpa: 3.6, gpaScale: 4.0, credits: null },
          { semester: 'g9spring', gpa: 3.8, gpaScale: 4.0, credits: null },
          { semester: 'g10fall', gpa: 3.7, gpaScale: 4.0, credits: null },
        ],
      });
      mockPrisma.profile.update.mockResolvedValue({});

      await service.createSemesterGpa('user-1', {
        semester: 'g10fall',
        year: 2024,
        gpa: 3.7,
        gpaScale: 4.0,
      } as any);

      // Grade 9: (3.6/4*4 + 3.8/4*4) / 2 = (3.6 + 3.8) / 2 = 3.7
      // Grade 10: 3.7/4*4 = 3.7
      // Weights: 9=0.15, 10=0.25. totalWeight=0.40
      // weightedSum = 3.7*0.15 + 3.7*0.25 = 0.555 + 0.925 = 1.48
      // gpa = 1.48 / 0.40 = 3.70
      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeDefined();
      expect(recalcCall[0].data.gpa).toBe(3.7);
    });

    it('should use credit-weighted average when all semesters have credits', async () => {
      mockPrisma.semesterGpa.create.mockResolvedValue({ id: 'sg-1' });
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [
          { semester: 'g9fall', gpa: 3.5, gpaScale: 4.0, credits: 15 },
          { semester: 'g9spring', gpa: 4.0, gpaScale: 4.0, credits: 18 },
        ],
      });
      mockPrisma.profile.update.mockResolvedValue({});

      await service.createSemesterGpa('user-1', {
        semester: 'g9spring',
        year: 2024,
        gpa: 4.0,
        gpaScale: 4.0,
        credits: 18,
      } as any);

      // Grade 9 credit-weighted: (3.5/4*4*15 + 4.0/4*4*18) / (15+18) = (52.5 + 72) / 33 = 124.5/33 = 3.7727...
      // Rounded: 3.77
      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeDefined();
      expect(recalcCall[0].data.gpa).toBe(3.77);
    });

    it('should normalize different gpaScale values to 4.0 scale', async () => {
      mockPrisma.semesterGpa.create.mockResolvedValue({ id: 'sg-1' });
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [
          { semester: 'g9fall', gpa: 4.5, gpaScale: 5.0, credits: null },
          { semester: 'g10fall', gpa: 90, gpaScale: 100, credits: null },
        ],
      });
      mockPrisma.profile.update.mockResolvedValue({});

      await service.createSemesterGpa('user-1', {
        semester: 'g10fall',
        year: 2024,
        gpa: 90,
        gpaScale: 100,
      } as any);

      // Grade 9: 4.5/5*4 = 3.6
      // Grade 10: 90/100*4 = 3.6
      // Weights: 9=0.15, 10=0.25, totalWeight=0.40
      // weightedSum = 3.6*0.15 + 3.6*0.25 = 0.54 + 0.9 = 1.44
      // gpa = 1.44/0.40 = 3.60
      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeDefined();
      expect(recalcCall[0].data.gpa).toBe(3.6);
    });

    it('should fall back to simple average when some semesters lack credits', async () => {
      mockPrisma.semesterGpa.create.mockResolvedValue({ id: 'sg-1' });
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [
          { semester: 'g9fall', gpa: 3.5, gpaScale: 4.0, credits: 15 },
          { semester: 'g9spring', gpa: 4.0, gpaScale: 4.0, credits: null },
        ],
      });
      mockPrisma.profile.update.mockResolvedValue({});

      await service.createSemesterGpa('user-1', {
        semester: 'g9spring',
        year: 2024,
        gpa: 4.0,
        gpaScale: 4.0,
      } as any);

      // Simple average (not credit-weighted because one has null credits):
      // (3.5/4*4 + 4.0/4*4) / 2 = (3.5+4.0)/2 = 3.75
      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeDefined();
      expect(recalcCall[0].data.gpa).toBe(3.75);
    });

    it('should not crash and should skip semesters with non-matching format', async () => {
      mockPrisma.semesterGpa.create.mockResolvedValue({ id: 'sg-1' });
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [
          { semester: 'fall2024', gpa: 3.8, gpaScale: 4.0, credits: null },
          { semester: 'spring2025', gpa: 3.9, gpaScale: 4.0, credits: null },
        ],
      });
      mockPrisma.profile.update.mockResolvedValue({});

      await service.createSemesterGpa('user-1', {
        semester: 'fall2024',
        year: 2024,
        gpa: 3.8,
        gpaScale: 4.0,
      } as any);

      // None match g\d+ pattern, so gradeGpas map is empty, no recalc happens
      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeUndefined();
    });

    it('should handle mixed matching and non-matching semester formats', async () => {
      mockPrisma.semesterGpa.create.mockResolvedValue({ id: 'sg-1' });
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [
          { semester: 'g9fall', gpa: 3.8, gpaScale: 4.0, credits: null },
          { semester: 'fall2024', gpa: 3.9, gpaScale: 4.0, credits: null },
        ],
      });
      mockPrisma.profile.update.mockResolvedValue({});

      await service.createSemesterGpa('user-1', {
        semester: 'g9fall',
        year: 2024,
        gpa: 3.8,
        gpaScale: 4.0,
      } as any);

      // Only g9fall matches, fall2024 is skipped
      // Grade 9: 3.8/4*4 = 3.8
      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeDefined();
      expect(recalcCall[0].data.gpa).toBe(3.8);
    });

    it('should handle case-insensitive semester names (G9Fall)', async () => {
      mockPrisma.semesterGpa.create.mockResolvedValue({ id: 'sg-1' });
      mockPrisma.profile.findUnique.mockResolvedValue({
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        semesterGpas: [
          { semester: 'G9Fall', gpa: 3.8, gpaScale: 4.0, credits: null },
        ],
      });
      mockPrisma.profile.update.mockResolvedValue({});

      await service.createSemesterGpa('user-1', {
        semester: 'G9Fall',
        year: 2024,
        gpa: 3.8,
        gpaScale: 4.0,
      } as any);

      const updateCalls = mockPrisma.profile.update.mock.calls;
      const recalcCall = updateCalls.find(
        (call: any[]) => call[0].data?.gpa !== undefined,
      );
      expect(recalcCall).toBeDefined();
      expect(recalcCall[0].data.gpa).toBe(3.8);
    });

    it('should not recalculate when profile is not found', async () => {
      mockPrisma.semesterGpa.create.mockResolvedValue({ id: 'sg-1' });
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      await service.createSemesterGpa('user-1', {
        semester: 'g9fall',
        year: 2024,
        gpa: 3.8,
        gpaScale: 4.0,
      } as any);

      // profile.update should not be called for gpa recalc
      const updateCalls = mockPrisma.profile.update.mock.calls;
      expect(updateCalls).toHaveLength(0);
    });
  });
});
