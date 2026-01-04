import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Visibility, Role, Prisma } from '@prisma/client';

describe('ProfileService', () => {
  let service: ProfileService;
  let prismaService: PrismaService;

  const mockUserId = 'user-123';
  const mockProfileId = 'profile-123';

  const mockProfile = {
    id: mockProfileId,
    userId: mockUserId,
    realName: 'Test User',
    gpa: new Prisma.Decimal(3.8),
    gpaScale: new Prisma.Decimal(4.0),
    currentSchool: 'Test High School',
    currentSchoolType: 'PUBLIC_US',
    grade: 'JUNIOR',
    targetMajor: 'Computer Science',
    regionPref: ['US', 'UK'],
    budgetTier: 'HIGH',
    applicationRound: 'ED',
    visibility: Visibility.PRIVATE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTestScore = {
    id: 'score-123',
    profileId: mockProfileId,
    type: 'SAT',
    score: 1550,
    subScores: { reading: 780, math: 770 },
    testDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: { userId: mockUserId },
  };

  const mockActivity = {
    id: 'activity-123',
    profileId: mockProfileId,
    name: 'Math Club',
    category: 'ACADEMIC',
    role: 'President',
    organization: 'School',
    description: 'Led math competitions',
    startDate: new Date('2023-09-01'),
    endDate: null,
    hoursPerWeek: 5,
    weeksPerYear: 40,
    isOngoing: true,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: { userId: mockUserId },
  };

  const mockAward = {
    id: 'award-123',
    profileId: mockProfileId,
    name: 'AMC Gold',
    level: 'NATIONAL',
    year: 2024,
    description: 'Top 1%',
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: { userId: mockUserId },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: {
            profile: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
            },
            testScore: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            activity: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              updateMany: jest.fn(),
            },
            award: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              updateMany: jest.fn(),
            },
            $transaction: jest.fn((ops) => Promise.all(ops)),
          },
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Profile CRUD Tests
  // ============================================

  describe('findByUserId', () => {
    it('should return profile with all relations', async () => {
      const profileWithRelations = {
        ...mockProfile,
        testScores: [mockTestScore],
        activities: [mockActivity],
        awards: [mockAward],
        education: [],
        essays: [],
      };

      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue(profileWithRelations);

      const result = await service.findByUserId(mockUserId);

      expect(result).toEqual(profileWithRelations);
      expect(prismaService.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: expect.any(Object),
      });
    });

    it('should return null if profile not found', async () => {
      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findByUserId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithVisibilityCheck', () => {
    it('should return own profile regardless of visibility', async () => {
      const privateProfile = { ...mockProfile, visibility: Visibility.PRIVATE };
      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue({
        ...privateProfile,
        user: { id: mockUserId },
      });

      const result = await service.findByIdWithVisibilityCheck(mockProfileId, mockUserId, Role.USER);

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for private profile viewed by others', async () => {
      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue({
        ...mockProfile,
        visibility: Visibility.PRIVATE,
        user: { id: mockUserId },
      });

      await expect(
        service.findByIdWithVisibilityCheck(mockProfileId, 'other-user', Role.USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to view any profile', async () => {
      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue({
        ...mockProfile,
        visibility: Visibility.PRIVATE,
        user: { id: mockUserId },
      });

      const result = await service.findByIdWithVisibilityCheck(mockProfileId, 'admin-user', Role.ADMIN);

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if profile not found', async () => {
      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findByIdWithVisibilityCheck('nonexistent', mockUserId, Role.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for VERIFIED_ONLY profile viewed by non-verified user', async () => {
      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue({
        ...mockProfile,
        visibility: Visibility.VERIFIED_ONLY,
        user: { id: mockUserId },
      });

      await expect(
        service.findByIdWithVisibilityCheck(mockProfileId, 'other-user', Role.USER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('upsert', () => {
    it('should create or update profile', async () => {
      (prismaService.profile.upsert as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.upsert(mockUserId, {
        gpa: 3.9,
        targetMajor: 'Computer Science',
      });

      expect(result).toEqual(mockProfile);
      expect(prismaService.profile.upsert).toHaveBeenCalled();
    });
  });

  // ============================================
  // Test Scores Tests
  // ============================================

  describe('createTestScore', () => {
    it('should create test score', async () => {
      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue({ id: mockProfileId });
      (prismaService.testScore.create as jest.Mock).mockResolvedValue(mockTestScore);

      const result = await service.createTestScore(mockUserId, {
        type: 'SAT',
        score: 1550,
        subScores: { reading: 780, math: 770 },
      });

      expect(result).toEqual(mockTestScore);
    });

    it('should auto-create profile if not exists', async () => {
      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.profile.create as jest.Mock).mockResolvedValue({ id: 'new-profile' });
      (prismaService.testScore.create as jest.Mock).mockResolvedValue(mockTestScore);

      await service.createTestScore(mockUserId, {
        type: 'SAT',
        score: 1550,
      });

      expect(prismaService.profile.create).toHaveBeenCalled();
    });
  });

  describe('updateTestScore', () => {
    it('should update test score', async () => {
      (prismaService.testScore.findUnique as jest.Mock).mockResolvedValue(mockTestScore);
      (prismaService.testScore.update as jest.Mock).mockResolvedValue({
        ...mockTestScore,
        score: 1600,
      });

      const result = await service.updateTestScore(mockUserId, 'score-123', {
        score: 1600,
      });

      expect(result.score).toBe(1600);
    });

    it('should throw NotFoundException if score not found', async () => {
      (prismaService.testScore.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateTestScore(mockUserId, 'nonexistent', { score: 1600 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if score belongs to another user', async () => {
      (prismaService.testScore.findUnique as jest.Mock).mockResolvedValue({
        ...mockTestScore,
        profile: { userId: 'other-user' },
      });

      await expect(
        service.updateTestScore(mockUserId, 'score-123', { score: 1600 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTestScore', () => {
    it('should delete test score', async () => {
      (prismaService.testScore.findUnique as jest.Mock).mockResolvedValue(mockTestScore);
      (prismaService.testScore.delete as jest.Mock).mockResolvedValue(mockTestScore);

      await service.deleteTestScore(mockUserId, 'score-123');

      expect(prismaService.testScore.delete).toHaveBeenCalledWith({
        where: { id: 'score-123' },
      });
    });
  });

  // ============================================
  // Activities Tests
  // ============================================

  describe('createActivity', () => {
    it('should create activity', async () => {
      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue({ id: mockProfileId });
      (prismaService.activity.create as jest.Mock).mockResolvedValue(mockActivity);

      const result = await service.createActivity(mockUserId, {
        name: 'Math Club',
        category: 'ACADEMIC',
        role: 'President',
      });

      expect(result).toEqual(mockActivity);
    });
  });

  describe('updateActivity', () => {
    it('should update activity', async () => {
      (prismaService.activity.findUnique as jest.Mock).mockResolvedValue(mockActivity);
      (prismaService.activity.update as jest.Mock).mockResolvedValue({
        ...mockActivity,
        role: 'Vice President',
      });

      const result = await service.updateActivity(mockUserId, 'activity-123', {
        role: 'Vice President',
      });

      expect(result.role).toBe('Vice President');
    });

    it('should throw NotFoundException if activity not found', async () => {
      (prismaService.activity.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateActivity(mockUserId, 'nonexistent', { role: 'Member' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteActivity', () => {
    it('should delete activity', async () => {
      (prismaService.activity.findUnique as jest.Mock).mockResolvedValue(mockActivity);
      (prismaService.activity.delete as jest.Mock).mockResolvedValue(mockActivity);

      await service.deleteActivity(mockUserId, 'activity-123');

      expect(prismaService.activity.delete).toHaveBeenCalledWith({
        where: { id: 'activity-123' },
      });
    });
  });

  // ============================================
  // Awards Tests
  // ============================================

  describe('createAward', () => {
    it('should create award', async () => {
      (prismaService.profile.findUnique as jest.Mock).mockResolvedValue({ id: mockProfileId });
      (prismaService.award.create as jest.Mock).mockResolvedValue(mockAward);

      const result = await service.createAward(mockUserId, {
        name: 'AMC Gold',
        level: 'NATIONAL',
        year: 2024,
      });

      expect(result).toEqual(mockAward);
    });
  });

  describe('updateAward', () => {
    it('should update award', async () => {
      (prismaService.award.findUnique as jest.Mock).mockResolvedValue(mockAward);
      (prismaService.award.update as jest.Mock).mockResolvedValue({
        ...mockAward,
        description: 'Updated description',
      });

      const result = await service.updateAward(mockUserId, 'award-123', {
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
    });

    it('should throw NotFoundException if award not found', async () => {
      (prismaService.award.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateAward(mockUserId, 'nonexistent', { description: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAward', () => {
    it('should delete award', async () => {
      (prismaService.award.findUnique as jest.Mock).mockResolvedValue(mockAward);
      (prismaService.award.delete as jest.Mock).mockResolvedValue(mockAward);

      await service.deleteAward(mockUserId, 'award-123');

      expect(prismaService.award.delete).toHaveBeenCalledWith({
        where: { id: 'award-123' },
      });
    });
  });
});




