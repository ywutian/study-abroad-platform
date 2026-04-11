import { Test, TestingModule } from '@nestjs/testing';
import { ProfileCrudService } from './profile-crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('ProfileCrudService', () => {
  let service: ProfileCrudService;

  const mockPrisma = {
    profile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    recommendationLetter: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockRedis = {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
  };

  const mockCacheInvalidation = {
    onProfileChange: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileCrudService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: CacheInvalidationService, useValue: mockCacheInvalidation },
      ],
    }).compile();

    service = module.get<ProfileCrudService>(ProfileCrudService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // findByUserId
  // ============================================

  describe('findByUserId', () => {
    it('should return cached profile when available', async () => {
      const cachedProfile = { id: 'profile-1', userId: 'user-1' };
      mockRedis.getJSON.mockResolvedValue(cachedProfile);

      const result = await service.findByUserId('user-1');

      expect(result).toEqual(cachedProfile);
      expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled();
    });

    it('should query DB and cache result when not cached', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-1',
        testScores: [],
        activities: [],
        awards: [],
        education: [],
        essays: [],
      };
      mockRedis.getJSON.mockResolvedValue(null);
      mockPrisma.profile.findUnique.mockResolvedValue(profile);

      const result = await service.findByUserId('user-1');

      expect(result).toEqual(profile);
      expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(mockRedis.setJSON).toHaveBeenCalledWith(
        'profile:user-1',
        profile,
        300,
      );
    });

    it('should return null and not cache when profile not found', async () => {
      mockRedis.getJSON.mockResolvedValue(null);
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.findByUserId('nonexistent');

      expect(result).toBeNull();
      expect(mockRedis.setJSON).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // findByIdWithVisibilityCheck
  // ============================================

  describe('findByIdWithVisibilityCheck', () => {
    const baseProfile = {
      id: 'profile-1',
      userId: 'owner-1',
      visibility: 'PUBLIC',
      realName: 'Test User',
      currentSchool: 'Harvard',
      gpa: new Prisma.Decimal(3.8),
      testScores: [],
      activities: [],
      awards: [],
      user: { id: 'owner-1' },
    };

    it('should throw NotFoundException when profile does not exist', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      await expect(
        service.findByIdWithVisibilityCheck(
          'nonexistent',
          'user-1',
          'USER' as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return full profile for the owner', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(baseProfile);

      const result = await service.findByIdWithVisibilityCheck(
        'profile-1',
        'owner-1',
        'USER' as any,
      );

      expect(result).toEqual(baseProfile);
    });

    it('should return full profile for ADMIN regardless of visibility', async () => {
      const privateProfile = { ...baseProfile, visibility: 'PRIVATE' };
      mockPrisma.profile.findUnique.mockResolvedValue(privateProfile);

      const result = await service.findByIdWithVisibilityCheck(
        'profile-1',
        'admin-1',
        'ADMIN' as any,
      );

      expect(result).toEqual(privateProfile);
    });

    it('should throw ForbiddenException for PRIVATE visibility', async () => {
      const privateProfile = { ...baseProfile, visibility: 'PRIVATE' };
      mockPrisma.profile.findUnique.mockResolvedValue(privateProfile);

      await expect(
        service.findByIdWithVisibilityCheck(
          'profile-1',
          'other-user',
          'USER' as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for VERIFIED_ONLY when requester is not VERIFIED', async () => {
      const verifiedOnly = { ...baseProfile, visibility: 'VERIFIED_ONLY' };
      mockPrisma.profile.findUnique.mockResolvedValue(verifiedOnly);

      await expect(
        service.findByIdWithVisibilityCheck(
          'profile-1',
          'other-user',
          'USER' as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return anonymized profile for ANONYMOUS visibility', async () => {
      const anonymousProfile = { ...baseProfile, visibility: 'ANONYMOUS' };
      mockPrisma.profile.findUnique.mockResolvedValue(anonymousProfile);

      const result = await service.findByIdWithVisibilityCheck(
        'profile-1',
        'other-user',
        'USER' as any,
      );

      expect(result!.realName).toBeNull();
      expect(result!.currentSchool).toBe('Private School');
    });
  });

  // ============================================
  // create
  // ============================================

  describe('create', () => {
    it('should create a profile for the given user', async () => {
      const created = { id: 'profile-1', userId: 'user-1' };
      mockPrisma.profile.create.mockResolvedValue(created);

      const result = await service.create('user-1', {});

      expect(result).toEqual(created);
      expect(mockPrisma.profile.create).toHaveBeenCalledWith({
        data: { user: { connect: { id: 'user-1' } } },
      });
    });
  });

  // ============================================
  // update
  // ============================================

  describe('update', () => {
    it('should update profile with converted GPA decimals', async () => {
      const updated = {
        id: 'profile-1',
        userId: 'user-1',
        gpa: new Prisma.Decimal(3.9),
      };
      mockPrisma.profile.update.mockResolvedValue(updated);

      const result = await service.update('user-1', {
        gpa: 3.9,
        gpaScale: 4.0,
      });

      expect(result).toEqual(updated);
      expect(mockPrisma.profile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: expect.objectContaining({
          gpa: expect.any(Prisma.Decimal),
          gpaScale: expect.any(Prisma.Decimal),
        }),
      });
    });

    it('should handle update without GPA fields', async () => {
      const updated = { id: 'profile-1', userId: 'user-1', targetMajor: 'CS' };
      mockPrisma.profile.update.mockResolvedValue(updated);

      const result = await service.update('user-1', {
        targetMajor: 'CS',
      } as any);

      expect(result).toEqual(updated);
    });
  });

  // ============================================
  // upsert
  // ============================================

  describe('upsert', () => {
    it('should upsert profile and invalidate cache', async () => {
      const upserted = { id: 'profile-1', userId: 'user-1' };
      mockPrisma.profile.upsert.mockResolvedValue(upserted);

      const result = await service.upsert('user-1', {
        targetMajor: 'CS',
      } as any);

      expect(result).toEqual(upserted);
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should convert GPA to Decimal on upsert', async () => {
      mockPrisma.profile.upsert.mockResolvedValue({ id: 'p-1' });

      await service.upsert('user-1', { gpa: 3.5 });

      expect(mockPrisma.profile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            gpa: expect.any(Prisma.Decimal),
          }),
        }),
      );
    });

    it('should retry as update when upsert races on unique userId', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`userId`)',
        {
          code: 'P2002',
          clientVersion: '6.8.0',
          meta: { target: ['userId'] },
        },
      );
      const updated = { id: 'profile-1', userId: 'user-1', targetMajor: 'CS' };
      mockPrisma.profile.upsert.mockRejectedValue(p2002Error);
      mockPrisma.profile.update.mockResolvedValue(updated);

      const result = await service.upsert('user-1', {
        targetMajor: 'CS',
      } as any);

      expect(result).toEqual(updated);
      expect(mockPrisma.profile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: expect.objectContaining({ targetMajor: 'CS' }),
      });
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  // ============================================
  // anonymizeProfile
  // ============================================

  describe('anonymizeProfile', () => {
    it('should mask realName and school', () => {
      const profile = {
        realName: 'John Doe',
        currentSchool: 'MIT',
        gpa: new Prisma.Decimal(3.95),
        testScores: [],
        activities: [],
        awards: [],
      } as any;

      const result = service.anonymizeProfile(profile);

      expect(result.realName).toBeNull();
      expect(result.currentSchool).toBe('Private School');
    });

    it('should bucket GPA into ranges', () => {
      const profile = {
        realName: 'Test',
        currentSchool: null,
        gpa: new Prisma.Decimal(3.72),
      } as any;

      const result = service.anonymizeProfile(profile);

      expect(Number(result.gpa)).toBe(3.7);
    });

    it('should handle null GPA gracefully', () => {
      const profile = {
        realName: null,
        currentSchool: null,
        gpa: null,
      } as any;

      const result = service.anonymizeProfile(profile);

      expect(result.gpa).toBeNull();
    });
  });

  describe('recommendation letters', () => {
    it('invalidates application-analysis caches after creating a recommendation letter', async () => {
      const created = {
        id: 'rec-1',
        userId: 'user-1',
        recommenderName: 'Teacher',
      };
      mockPrisma.recommendationLetter.create.mockResolvedValue(created);

      const result = await service.createRecommendationLetter('user-1', {
        recommenderName: 'Teacher',
      } as any);

      expect(result).toEqual(created);
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('invalidates application-analysis caches after updating a recommendation letter', async () => {
      mockPrisma.recommendationLetter.findFirst.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
      });
      mockPrisma.recommendationLetter.update.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
        recommenderName: 'Updated Teacher',
      });

      const result = await service.updateRecommendationLetter(
        'user-1',
        'rec-1',
        {
          recommenderName: 'Updated Teacher',
        } as any,
      );

      expect(result.recommenderName).toBe('Updated Teacher');
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('invalidates application-analysis caches after deleting a recommendation letter', async () => {
      mockPrisma.recommendationLetter.findFirst.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
      });
      mockPrisma.recommendationLetter.delete.mockResolvedValue(undefined);

      const result = await service.deleteRecommendationLetter(
        'user-1',
        'rec-1',
      );

      expect(result).toEqual({ success: true });
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });
});
