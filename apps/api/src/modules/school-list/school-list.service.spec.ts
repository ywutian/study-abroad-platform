import { Test, TestingModule } from '@nestjs/testing';
import { SchoolListService } from './school-list.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

// Mock scoring utils
jest.mock('../../common/utils/scoring', () => ({
  extractProfileMetrics: jest.fn().mockReturnValue({
    gpa: 3.8,
    sat: 1500,
    toefl: 110,
    activityCount: 5,
    awardCount: 2,
  }),
  calculateOverallScore: jest.fn().mockReturnValue(75),
  calculateProbability: jest.fn().mockReturnValue(0.5),
  calculateTier: jest.fn().mockReturnValue('match'),
}));

describe('SchoolListService', () => {
  let service: SchoolListService;
  let prisma: PrismaService;

  const mockSchool = {
    id: 'school-1',
    name: 'MIT',
    nameZh: '麻省理工',
    usNewsRank: 1,
    acceptanceRate: 4,
    tuition: 55000,
    city: 'Cambridge',
    state: 'MA',
  };

  const mockListItem = {
    id: 'item-1',
    userId: 'user-1',
    schoolId: 'school-1',
    tier: 'REACH',
    round: 'ED',
    notes: 'Dream school',
    isAIRecommended: false,
    createdAt: new Date(),
    school: mockSchool,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolListService,
        {
          provide: PrismaService,
          useValue: {
            schoolListItem: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            school: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            profile: {
              findUnique: jest.fn(),
            },
            predictionResult: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            essayPrompt: {
              groupBy: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
            },
            schoolDeadline: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SchoolListService>(SchoolListService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSchoolList', () => {
    it('should return formatted school list items', async () => {
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([
        mockListItem,
      ]);

      const result = await service.getUserSchoolList('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].schoolId).toBe('school-1');
      expect(result[0].school.name).toBe('MIT');
      expect(result[0].tier).toBe('REACH');
    });

    it('should return empty array when user has no list items', async () => {
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getUserSchoolList('user-1');
      expect(result).toEqual([]);
    });

    it('should handle null optional fields gracefully', async () => {
      const itemWithNulls = {
        ...mockListItem,
        round: null,
        notes: null,
        school: {
          ...mockSchool,
          nameZh: null,
          usNewsRank: null,
          acceptanceRate: null,
          tuition: null,
          city: null,
          state: null,
        },
      };
      (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([
        itemWithNulls,
      ]);

      const result = await service.getUserSchoolList('user-1');
      expect(result[0].round).toBeUndefined();
      expect(result[0].notes).toBeUndefined();
      expect(result[0].school.nameZh).toBeUndefined();
    });
  });

  describe('addSchool', () => {
    const dto = {
      schoolId: 'school-1',
      tier: 'REACH' as any,
      round: 'ED',
      notes: 'Dream school',
    };

    it('should add a school to the list', async () => {
      (prisma.school.findUnique as jest.Mock).mockResolvedValue(mockSchool);
      (prisma.schoolListItem.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.schoolListItem.create as jest.Mock).mockResolvedValue(
        mockListItem,
      );

      const result = await service.addSchool('user-1', dto);

      expect(result.schoolId).toBe('school-1');
      expect(prisma.schoolListItem.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if school does not exist', async () => {
      (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.addSchool('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if school already in list', async () => {
      (prisma.school.findUnique as jest.Mock).mockResolvedValue(mockSchool);
      (prisma.schoolListItem.findUnique as jest.Mock).mockResolvedValue(
        mockListItem,
      );

      await expect(service.addSchool('user-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateItem', () => {
    const updateDto = {
      tier: 'TARGET' as any,
      round: 'RD',
      notes: 'Updated notes',
    };

    it('should update a school list item', async () => {
      (prisma.schoolListItem.findFirst as jest.Mock).mockResolvedValue(
        mockListItem,
      );
      (prisma.schoolListItem.update as jest.Mock).mockResolvedValue({
        ...mockListItem,
        ...updateDto,
      });

      const result = await service.updateItem('user-1', 'item-1', updateDto);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if item not found', async () => {
      (prisma.schoolListItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateItem('user-1', 'nonexistent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem', () => {
    it('should delete a school list item', async () => {
      (prisma.schoolListItem.findFirst as jest.Mock).mockResolvedValue(
        mockListItem,
      );
      (prisma.schoolListItem.delete as jest.Mock).mockResolvedValue(undefined);

      await service.removeItem('user-1', 'item-1');
      expect(prisma.schoolListItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('should throw NotFoundException if item not found', async () => {
      (prisma.schoolListItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.removeItem('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAIRecommendations', () => {
    it('should return categorized recommendations', async () => {
      const mockProfile = {
        id: 'profile-1',
        userId: 'user-1',
        testScores: [],
        activities: [],
        awards: [],
      };

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (prisma.school.findMany as jest.Mock).mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          ...mockSchool,
          id: `school-${i}`,
          name: `School ${i}`,
          usNewsRank: i + 1,
        })),
      );

      const { calculateTier } = require('../../common/utils/scoring');
      // Return mixed tiers so all categories get filled
      (calculateTier as jest.Mock)
        .mockReturnValueOnce('reach')
        .mockReturnValueOnce('match')
        .mockReturnValueOnce('safety')
        .mockReturnValueOnce('reach')
        .mockReturnValueOnce('match')
        .mockReturnValueOnce('safety')
        .mockReturnValue('match');

      const result = await service.getAIRecommendations('user-1');

      expect(result).toHaveProperty('safety');
      expect(result).toHaveProperty('target');
      expect(result).toHaveProperty('reach');
    });

    it('should throw BadRequestException if profile not found', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getAIRecommendations('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateRound (via addSchool)', () => {
    const baseDto = {
      schoolId: 'school-1',
      tier: 'REACH' as any,
      round: 'ED',
      notes: '',
    };

    beforeEach(() => {
      (prisma.school.findUnique as jest.Mock).mockResolvedValue(mockSchool);
      (prisma.schoolListItem.findUnique as jest.Mock).mockResolvedValue(null); // no duplicate
      (prisma.schoolDeadline.findMany as jest.Mock).mockResolvedValue([]); // no deadline data → skip availability check
    });

    it('should reject ED + ED (same binding round conflict)', async () => {
      (prisma.schoolListItem.findFirst as jest.Mock).mockResolvedValue({
        ...mockListItem,
        round: 'ED',
        school: { name: 'Harvard' },
      });

      await expect(
        service.addSchool('user-1', { ...baseDto, round: 'ED' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject ED + REA (cross binding conflict)', async () => {
      // First call: same binding round check → no conflict
      // Second call: cross-binding check (ED already exists)
      (prisma.schoolListItem.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // no same round
        .mockResolvedValueOnce(null); // no REA/SCEA
      (prisma.schoolListItem.create as jest.Mock).mockResolvedValue(
        mockListItem,
      );

      // Now try to add REA when ED exists
      (prisma.schoolListItem.findFirst as jest.Mock)
        .mockReset()
        .mockResolvedValueOnce(null) // REA not yet applied
        .mockResolvedValueOnce({
          ...mockListItem,
          round: 'ED',
          school: { name: 'MIT' },
        }); // ED exists → conflict

      await expect(
        service.addSchool('user-1', { ...baseDto, round: 'REA' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject ED2 + SCEA (cross binding conflict)', async () => {
      (prisma.schoolListItem.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // no same round
        .mockResolvedValueOnce({
          ...mockListItem,
          round: 'SCEA',
          school: { name: 'Stanford' },
        }); // SCEA exists

      await expect(
        service.addSchool('user-1', { ...baseDto, round: 'ED2' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow RD + RD (non-binding rounds)', async () => {
      (prisma.schoolListItem.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.schoolListItem.create as jest.Mock).mockResolvedValue({
        ...mockListItem,
        round: 'RD',
      });

      const result = await service.addSchool('user-1', {
        ...baseDto,
        round: 'RD',
      });
      expect(result).toBeDefined();
    });

    it('should reject round not in available list', async () => {
      (prisma.schoolListItem.findFirst as jest.Mock).mockResolvedValue(null);
      // School has specific deadline data — EA is not among them
      (prisma.schoolDeadline.findMany as jest.Mock).mockResolvedValue([
        { round: 'ED', deadline: new Date() },
        { round: 'RD', deadline: new Date() },
      ]);

      await expect(
        service.addSchool('user-1', { ...baseDto, round: 'EA' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip availability check when no deadline data', async () => {
      (prisma.schoolListItem.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.schoolDeadline.findMany as jest.Mock).mockResolvedValue([]); // no data
      (prisma.schoolListItem.create as jest.Mock).mockResolvedValue({
        ...mockListItem,
        round: 'EA',
      });

      const result = await service.addSchool('user-1', {
        ...baseDto,
        round: 'EA',
      });
      expect(result).toBeDefined();
    });
  });
});
