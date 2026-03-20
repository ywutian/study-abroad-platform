import { Test, TestingModule } from '@nestjs/testing';
import { ProfileEducationService } from './profile-education.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';
import { ProfileHelpersService } from './profile-helpers.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ProfileEducationService', () => {
  let service: ProfileEducationService;

  const mockPrisma = {
    education: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    essay: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
    profileTargetSchool: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCacheInvalidation = {
    onProfileChange: jest.fn().mockResolvedValue(undefined),
  };

  const mockHelpers = {
    getProfileId: jest.fn().mockResolvedValue('profile-1'),
    verifyProfileOwnership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileEducationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheInvalidationService, useValue: mockCacheInvalidation },
        { provide: ProfileHelpersService, useValue: mockHelpers },
      ],
    }).compile();

    service = module.get<ProfileEducationService>(ProfileEducationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Education CRUD
  // ============================================

  describe('createEducation', () => {
    it('should create an education record and invalidate cache', async () => {
      const created = {
        id: 'edu-1',
        schoolName: 'Phillips Academy',
        profileId: 'profile-1',
      };
      mockPrisma.education.create.mockResolvedValue(created);

      const result = await service.createEducation('user-1', {
        schoolName: 'Phillips Academy',
        schoolType: 'HIGH_SCHOOL',
      } as any);

      expect(result).toEqual(created);
      expect(mockHelpers.getProfileId).toHaveBeenCalledWith('user-1');
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should handle optional fields (dates, GPA)', async () => {
      mockPrisma.education.create.mockResolvedValue({ id: 'edu-2' });

      await service.createEducation('user-1', {
        schoolName: 'Test School',
        startDate: '2023-09-01',
        gpa: 3.8,
        gpaScale: 4.0,
      } as any);

      expect(mockPrisma.education.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startDate: expect.any(Date),
          gpa: expect.anything(),
        }),
      });
    });
  });

  describe('updateEducation', () => {
    it('should update education after verifying ownership', async () => {
      const existing = { id: 'edu-1', profile: { userId: 'user-1' } };
      mockPrisma.education.findUnique.mockResolvedValue(existing);
      mockHelpers.verifyProfileOwnership.mockReturnValue(existing);
      const updated = { ...existing, schoolName: 'Updated School' };
      mockPrisma.education.update.mockResolvedValue(updated);

      const result = await service.updateEducation('user-1', 'edu-1', {
        schoolName: 'Updated School',
      } as any);

      expect(result.schoolName).toBe('Updated School');
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should throw when ownership verification fails', async () => {
      mockPrisma.education.findUnique.mockResolvedValue(null);
      mockHelpers.verifyProfileOwnership.mockImplementation(() => {
        throw new NotFoundException('Education not found');
      });

      await expect(
        service.updateEducation('user-1', 'nonexistent', {
          schoolName: 'Test',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteEducation', () => {
    it('should delete education after verifying ownership', async () => {
      const existing = { id: 'edu-1', profile: { userId: 'user-1' } };
      mockPrisma.education.findUnique.mockResolvedValue(existing);
      mockHelpers.verifyProfileOwnership.mockReturnValue(existing);
      mockPrisma.education.delete.mockResolvedValue({});

      await service.deleteEducation('user-1', 'edu-1');

      expect(mockPrisma.education.delete).toHaveBeenCalledWith({
        where: { id: 'edu-1' },
      });
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should throw ForbiddenException for unowned education', async () => {
      mockPrisma.education.findUnique.mockResolvedValue({
        id: 'edu-1',
        profile: { userId: 'other-user' },
      });
      mockHelpers.verifyProfileOwnership.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.deleteEducation('user-1', 'edu-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getEducation', () => {
    it('should return education records for a user', async () => {
      const records = [{ id: 'edu-1', schoolName: 'Phillips Academy' }];
      mockPrisma.profile.findUnique.mockResolvedValue({ education: records });

      const result = await service.getEducation('user-1');

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no profile exists', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getEducation('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // Target Schools
  // ============================================

  describe('getTargetSchools', () => {
    it('should return target schools ordered by priority', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({ id: 'profile-1' });
      const targets = [
        {
          profileId: 'profile-1',
          schoolId: 's-1',
          priority: 1,
          school: { name: 'MIT' },
        },
      ];
      mockPrisma.profileTargetSchool.findMany.mockResolvedValue(targets);

      const result = await service.getTargetSchools('user-1');

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no profile exists', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getTargetSchools('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('addTargetSchool', () => {
    it('should create a new target school entry', async () => {
      mockPrisma.profileTargetSchool.findUnique.mockResolvedValue(null);
      const created = { profileId: 'profile-1', schoolId: 's-1', priority: 0 };
      mockPrisma.profileTargetSchool.create.mockResolvedValue(created);

      const result = await service.addTargetSchool('user-1', 's-1');

      expect(result).toEqual(created);
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should return existing entry if already present (idempotent)', async () => {
      const existing = { profileId: 'profile-1', schoolId: 's-1', priority: 1 };
      mockPrisma.profileTargetSchool.findUnique.mockResolvedValue(existing);

      const result = await service.addTargetSchool('user-1', 's-1');

      expect(result).toEqual(existing);
      expect(mockPrisma.profileTargetSchool.create).not.toHaveBeenCalled();
    });
  });

  describe('removeTargetSchool', () => {
    it('should remove target school and invalidate cache', async () => {
      mockPrisma.profileTargetSchool.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeTargetSchool('user-1', 's-1');

      expect(mockPrisma.profileTargetSchool.deleteMany).toHaveBeenCalledWith({
        where: { profileId: 'profile-1', schoolId: 's-1' },
      });
      expect(mockCacheInvalidation.onProfileChange).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  // ============================================
  // Essays CRUD
  // ============================================

  describe('createEssay', () => {
    it('should create an essay with computed word count', async () => {
      const created = { id: 'essay-1', title: 'My Essay', wordCount: 5 };
      mockPrisma.essay.create.mockResolvedValue(created);

      const result = await service.createEssay('user-1', {
        title: 'My Essay',
        content: 'This is my college essay content',
        prompt: 'Why us?',
      } as any);

      expect(result).toEqual(created);
      expect(mockPrisma.essay.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          wordCount: 6,
        }),
      });
    });
  });

  describe('deleteEssay', () => {
    it('should delete essay after verifying ownership', async () => {
      const essay = { id: 'essay-1', profile: { userId: 'user-1' } };
      mockPrisma.essay.findUnique.mockResolvedValue(essay);
      mockHelpers.verifyProfileOwnership.mockReturnValue(essay);
      mockPrisma.essay.delete.mockResolvedValue({});

      await service.deleteEssay('user-1', 'essay-1');

      expect(mockPrisma.essay.delete).toHaveBeenCalledWith({
        where: { id: 'essay-1' },
      });
    });
  });

  describe('getEssays', () => {
    it('should return essays for a user', async () => {
      const essays = [{ id: 'essay-1', title: 'My Essay' }];
      mockPrisma.profile.findUnique.mockResolvedValue({ essays });

      const result = await service.getEssays('user-1');

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no profile exists', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getEssays('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getEssayById', () => {
    it('should return essay after verifying ownership', async () => {
      const essay = {
        id: 'essay-1',
        profile: { userId: 'user-1' },
        title: 'My Essay',
      };
      mockPrisma.essay.findUnique.mockResolvedValue(essay);
      mockHelpers.verifyProfileOwnership.mockReturnValue(essay);

      const result = await service.getEssayById('user-1', 'essay-1');

      expect(result.title).toBe('My Essay');
    });

    it('should throw NotFoundException for nonexistent essay', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue(null);
      mockHelpers.verifyProfileOwnership.mockImplementation(() => {
        throw new NotFoundException('Essay not found');
      });

      await expect(
        service.getEssayById('user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
