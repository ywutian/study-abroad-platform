import { Test, TestingModule } from '@nestjs/testing';
import { ProfileMemoryService } from './profile-memory.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { MemoryType, EntityType } from '@prisma/client';

describe('ProfileMemoryService', () => {
  let service: ProfileMemoryService;

  const mockPrisma = {
    highSchool: {
      findUnique: jest.fn(),
    },
  };

  const mockMemoryManager = {
    remember: jest.fn().mockResolvedValue(undefined),
    recordEntity: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileMemoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MemoryManagerService, useValue: mockMemoryManager },
      ],
    }).compile();

    service = module.get<ProfileMemoryService>(ProfileMemoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // recordProfileUpdateToMemory
  // ============================================

  describe('recordProfileUpdateToMemory', () => {
    it('should record memory when meaningful fields change', async () => {
      await service.recordProfileUpdateToMemory('user-1', {
        targetMajor: 'Computer Science',
        gpa: 3.9,
      });

      expect(mockMemoryManager.remember).toHaveBeenCalledWith('user-1', {
        type: MemoryType.FACT,
        category: 'profile_update',
        content: expect.stringContaining('Computer Science'),
        importance: 0.6,
        metadata: expect.objectContaining({
          action: 'profile_update',
        }),
      });
    });

    it('should not record memory when no meaningful fields change', async () => {
      await service.recordProfileUpdateToMemory('user-1', {
        nickname: 'John',
      } as any);

      expect(mockMemoryManager.remember).not.toHaveBeenCalled();
    });

    it('should include regionPref in memory content', async () => {
      await service.recordProfileUpdateToMemory('user-1', {
        regionPref: ['northeast', 'west'],
      } as any);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          content: expect.stringContaining('northeast'),
        }),
      );
    });
  });

  // ============================================
  // recordTestScoreToMemory
  // ============================================

  describe('recordTestScoreToMemory', () => {
    it('should record test score with high importance (0.8)', async () => {
      await service.recordTestScoreToMemory('user-1', {
        type: 'SAT',
        score: 1500,
      } as any);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith('user-1', {
        type: MemoryType.FACT,
        category: 'test_score',
        content: expect.stringContaining('SAT'),
        importance: 0.8,
        metadata: expect.objectContaining({
          scoreType: 'SAT',
          score: 1500,
        }),
      });
    });

    it('should include testDate in content when provided', async () => {
      await service.recordTestScoreToMemory('user-1', {
        type: 'TOEFL',
        score: 110,
        testDate: '2025-03-15',
      } as any);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          content: expect.stringContaining('2025-03-15'),
        }),
      );
    });
  });

  // ============================================
  // recordActivityToMemory
  // ============================================

  describe('recordActivityToMemory', () => {
    it('should record activity to memory', async () => {
      await service.recordActivityToMemory('user-1', {
        name: 'Math Olympiad',
        category: 'ACADEMIC',
        role: 'Captain',
        organization: 'School Team',
      } as any);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith('user-1', {
        type: MemoryType.FACT,
        category: 'activity',
        content: expect.stringContaining('Math Olympiad'),
        importance: 0.6,
        metadata: expect.objectContaining({
          activityName: 'Math Olympiad',
          category: 'ACADEMIC',
          role: 'Captain',
        }),
      });
    });
  });

  // ============================================
  // recordAwardToMemory
  // ============================================

  describe('recordAwardToMemory', () => {
    it('should record award with importance 0.7', async () => {
      await service.recordAwardToMemory('user-1', {
        name: 'USAMO',
        level: 'NATIONAL',
        year: 2025,
      } as any);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith('user-1', {
        type: MemoryType.FACT,
        category: 'award',
        content: expect.stringContaining('USAMO'),
        importance: 0.7,
        metadata: expect.objectContaining({
          awardName: 'USAMO',
          level: 'NATIONAL',
          year: 2025,
        }),
      });
    });
  });

  // ============================================
  // recordEducationToMemory
  // ============================================

  describe('recordEducationToMemory', () => {
    it('should record high school with tier info when highSchoolId is provided', async () => {
      mockPrisma.highSchool.findUnique.mockResolvedValue({
        name: 'Phillips Academy',
        tier: 1,
        type: 'boarding',
      });

      await service.recordEducationToMemory('user-1', {
        schoolName: 'Phillips Academy',
        schoolType: 'HIGH_SCHOOL',
        highSchoolId: 'hs-1',
      } as any);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith('user-1', {
        type: MemoryType.FACT,
        category: 'academic',
        content: expect.stringContaining('Tier 1'),
        importance: 0.8,
        metadata: expect.objectContaining({
          schoolType: 'HIGH_SCHOOL',
          highSchoolId: 'hs-1',
          dedupeKey: 'high_school',
        }),
      });
    });

    it('should record non-high-school education with degree and major', async () => {
      await service.recordEducationToMemory('user-1', {
        schoolName: 'MIT',
        schoolType: 'UNIVERSITY',
        degree: 'BS',
        major: 'Computer Science',
        gpa: 3.9,
      } as any);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith('user-1', {
        type: MemoryType.FACT,
        category: 'education',
        content: expect.stringContaining('MIT'),
        importance: 0.7,
        metadata: expect.objectContaining({
          schoolType: 'UNIVERSITY',
          degree: 'BS',
          major: 'Computer Science',
        }),
      });
    });
  });

  // ============================================
  // recordTargetSchoolAddToMemory
  // ============================================

  describe('recordTargetSchoolAddToMemory', () => {
    it('should record target school as PREFERENCE memory', async () => {
      await service.recordTargetSchoolAddToMemory('user-1', 'school-1', 'MIT');

      expect(mockMemoryManager.remember).toHaveBeenCalledWith('user-1', {
        type: MemoryType.PREFERENCE,
        category: 'target_school',
        content: expect.stringContaining('MIT'),
        importance: 0.8,
        metadata: expect.objectContaining({
          action: 'add_target_school',
          schoolId: 'school-1',
        }),
      });
    });

    it('should record school entity when schoolName is provided', async () => {
      await service.recordTargetSchoolAddToMemory('user-1', 'school-1', 'MIT');

      expect(mockMemoryManager.recordEntity).toHaveBeenCalledWith('user-1', {
        type: EntityType.SCHOOL,
        name: 'MIT',
        description: expect.any(String),
        attributes: { isTarget: true },
      });
    });

    it('should not record entity when schoolName is not provided', async () => {
      await service.recordTargetSchoolAddToMemory('user-1', 'school-1');

      expect(mockMemoryManager.remember).toHaveBeenCalled();
      expect(mockMemoryManager.recordEntity).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // recordTargetSchoolRemovalToMemory
  // ============================================

  describe('recordTargetSchoolRemovalToMemory', () => {
    it('should record removal as DECISION memory with low importance', async () => {
      await service.recordTargetSchoolRemovalToMemory('user-1', 'school-1');

      expect(mockMemoryManager.remember).toHaveBeenCalledWith('user-1', {
        type: MemoryType.DECISION,
        category: 'target_school',
        content: expect.any(String),
        importance: 0.5,
        metadata: expect.objectContaining({
          action: 'remove_target_school',
          schoolId: 'school-1',
        }),
      });
    });
  });

  // ============================================
  // recordSetTargetSchoolsToMemory
  // ============================================

  describe('recordSetTargetSchoolsToMemory', () => {
    it('should record bulk target school update', async () => {
      const targets = [
        { schoolId: 's-1', priority: 1, school: { name: 'MIT' } },
        { schoolId: 's-2', priority: 2, school: { name: 'Stanford' } },
      ];

      await service.recordSetTargetSchoolsToMemory('user-1', targets);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith('user-1', {
        type: MemoryType.DECISION,
        category: 'target_school_list',
        content: expect.stringContaining('2'),
        importance: 0.8,
        metadata: expect.objectContaining({
          action: 'set_target_schools',
          count: 2,
        }),
      });
    });

    it('should not record when target schools list is empty', async () => {
      await service.recordSetTargetSchoolsToMemory('user-1', []);

      expect(mockMemoryManager.remember).not.toHaveBeenCalled();
    });

    it('should record school entities for each target school', async () => {
      const targets = [
        { schoolId: 's-1', priority: 1, school: { name: 'MIT' } },
        { schoolId: 's-2', priority: 2, school: { name: 'Stanford' } },
      ];

      await service.recordSetTargetSchoolsToMemory('user-1', targets);

      expect(mockMemoryManager.recordEntity).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // No-op when memoryManager is null
  // ============================================

  describe('with null memoryManager', () => {
    let serviceWithoutMemory: ProfileMemoryService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProfileMemoryService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: MemoryManagerService, useValue: null },
        ],
      }).compile();

      serviceWithoutMemory =
        module.get<ProfileMemoryService>(ProfileMemoryService);
    });

    it('should no-op recordProfileUpdateToMemory when memoryManager is null', async () => {
      await expect(
        serviceWithoutMemory.recordProfileUpdateToMemory('user-1', {
          targetMajor: 'CS',
        }),
      ).resolves.toBeUndefined();
    });

    it('should no-op recordTestScoreToMemory when memoryManager is null', async () => {
      await expect(
        serviceWithoutMemory.recordTestScoreToMemory('user-1', {
          type: 'SAT',
          score: 1500,
        } as any),
      ).resolves.toBeUndefined();
    });

    it('should no-op recordTargetSchoolAddToMemory when memoryManager is null', async () => {
      await expect(
        serviceWithoutMemory.recordTargetSchoolAddToMemory(
          'user-1',
          's-1',
          'MIT',
        ),
      ).resolves.toBeUndefined();
    });
  });
});
