import { Test, TestingModule } from '@nestjs/testing';
import { RankingService, RankingWeights } from './ranking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolService } from '../school/school.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Niche-grade weights default to 0 in numeric-only tests so existing
// expectations are preserved. Override individually when testing Niche logic.
const ZERO_NICHE_WEIGHTS = {
  nicheOverall: 0,
  safetyGrade: 0,
  studentLifeGrade: 0,
  campusFoodGrade: 0,
};

describe('RankingService', () => {
  let service: RankingService;
  let prisma: PrismaService;
  let schoolService: SchoolService;

  const mockUserId = 'user-001';
  const mockRankingId = 'ranking-001';

  // Helper to create a mock School object matching the Prisma School type
  const createMockSchool = (overrides: Record<string, unknown> = {}) => ({
    id: 'school-default',
    name: 'Default University',
    nameZh: null,
    country: 'US',
    state: 'CA',
    city: 'Los Angeles',
    usNewsRank: 50,
    qsRank: null,
    acceptanceRate: new Prisma.Decimal(20.0),
    tuition: 50000,
    avgSalary: 80000,
    totalEnrollment: 10000,
    satAvg: null,
    sat25: null,
    sat75: null,
    satMath25: null,
    satMath75: null,
    satReading25: null,
    satReading75: null,
    actAvg: null,
    act25: null,
    act75: null,
    studentCount: null,
    graduationRate: null,
    isPrivate: false,
    nicheSafetyGrade: null,
    nicheLifeGrade: null,
    nicheFoodGrade: null,
    nicheOverallGrade: null,
    aliases: [],
    website: null,
    logoUrl: null,
    description: null,
    descriptionZh: null,
    metadata: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  });

  const mockSchoolA = createMockSchool({
    id: 'school-a',
    name: 'Alpha University',
    usNewsRank: 1,
    acceptanceRate: new Prisma.Decimal(5.0),
    tuition: 55000,
    avgSalary: 120000,
  });

  const mockSchoolB = createMockSchool({
    id: 'school-b',
    name: 'Beta College',
    usNewsRank: 25,
    acceptanceRate: new Prisma.Decimal(15.0),
    tuition: 40000,
    avgSalary: 90000,
  });

  const mockSchoolC = createMockSchool({
    id: 'school-c',
    name: 'Charlie Institute',
    usNewsRank: 50,
    acceptanceRate: new Prisma.Decimal(30.0),
    tuition: 30000,
    avgSalary: 70000,
  });

  const mockCustomRanking = {
    id: mockRankingId,
    userId: mockUserId,
    name: 'My Custom Ranking',
    weights: {
      usNewsRank: 40,
      acceptanceRate: 20,
      tuition: 20,
      avgSalary: 20,
      ...ZERO_NICHE_WEIGHTS,
    },
    isPublic: false,
    createdAt: new Date('2025-06-01'),
    updatedAt: new Date('2025-06-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingService,
        {
          provide: PrismaService,
          useValue: {
            customRanking: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: SchoolService,
          useValue: {
            findAllWithMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RankingService>(RankingService);
    prisma = module.get<PrismaService>(PrismaService);
    schoolService = module.get<SchoolService>(SchoolService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // calculateRanking
  // ============================================

  describe('calculateRanking', () => {
    it('should return scored and ranked schools with valid weights', async () => {
      (schoolService.findAllWithMetrics as jest.Mock).mockResolvedValue([
        mockSchoolA,
        mockSchoolB,
        mockSchoolC,
      ]);

      const weights: RankingWeights = {
        usNewsRank: 40,
        acceptanceRate: 20,
        tuition: 20,
        avgSalary: 20,
        ...ZERO_NICHE_WEIGHTS,
      };

      const result = await service.calculateRanking(weights);

      expect(result).toHaveLength(3);
      // Each result should have score and rank
      result.forEach((school) => {
        expect(school).toHaveProperty('score');
        expect(school).toHaveProperty('rank');
        expect(typeof school.score).toBe('number');
        expect(typeof school.rank).toBe('number');
      });
      // Results should be sorted by score descending
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
      expect(result[1].score).toBeGreaterThanOrEqual(result[2].score);
      // Ranks should be sequential
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
      // Top school should have score of 100 (rescaled)
      expect(result[0].score).toBe(100);
      // School A (rank 1, lowest acceptance rate, highest salary) should rank first
      // given heavy usNewsRank weighting
      expect(result[0].id).toBe('school-a');
    });

    it('should return zero scores when all weights are zero', async () => {
      (schoolService.findAllWithMetrics as jest.Mock).mockResolvedValue([
        mockSchoolA,
        mockSchoolB,
      ]);

      const weights: RankingWeights = {
        usNewsRank: 0,
        acceptanceRate: 0,
        tuition: 0,
        avgSalary: 0,
        ...ZERO_NICHE_WEIGHTS,
      };

      const result = await service.calculateRanking(weights);

      expect(result).toHaveLength(2);
      result.forEach((school) => {
        expect(school.score).toBe(0);
      });
      // Ranks should still be assigned sequentially
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });

    it('should normalize weights correctly so they sum to 100', async () => {
      (schoolService.findAllWithMetrics as jest.Mock).mockResolvedValue([
        mockSchoolA,
        mockSchoolB,
      ]);

      // Weights that do not sum to 100
      const weights: RankingWeights = {
        usNewsRank: 10,
        acceptanceRate: 10,
        tuition: 10,
        avgSalary: 10,
        ...ZERO_NICHE_WEIGHTS,
      };

      const result = await service.calculateRanking(weights);

      // Should still produce valid rankings
      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      // Top school should still be normalized to score 100
      expect(result[0].score).toBe(100);
    });

    it('should handle single weight dimension', async () => {
      (schoolService.findAllWithMetrics as jest.Mock).mockResolvedValue([
        mockSchoolA,
        mockSchoolB,
        mockSchoolC,
      ]);

      // Only salary weight - higher salary is better
      const weights: RankingWeights = {
        usNewsRank: 0,
        acceptanceRate: 0,
        tuition: 0,
        avgSalary: 100,
        ...ZERO_NICHE_WEIGHTS,
      };

      const result = await service.calculateRanking(weights);

      expect(result).toHaveLength(3);
      // School A has highest salary (120000), so should rank first
      expect(result[0].id).toBe('school-a');
      expect(result[0].score).toBe(100);
    });

    it('should handle NaN or invalid weights by treating them as 0', async () => {
      (schoolService.findAllWithMetrics as jest.Mock).mockResolvedValue([
        mockSchoolA,
        mockSchoolB,
      ]);

      const weights = {
        usNewsRank: NaN,
        acceptanceRate: undefined,
        tuition: 50,
        avgSalary: 50,
      } as unknown as RankingWeights;

      const result = await service.calculateRanking(weights);

      expect(result).toHaveLength(2);
      // Should not throw, invalid weights treated as 0
      result.forEach((school) => {
        expect(typeof school.score).toBe('number');
        expect(school.score).not.toBeNaN();
      });
    });

    it('should handle schools with null fields gracefully', async () => {
      const schoolWithNulls = createMockSchool({
        id: 'school-nulls',
        name: 'Null University',
        usNewsRank: null,
        acceptanceRate: null,
        tuition: null,
        avgSalary: null,
      });

      (schoolService.findAllWithMetrics as jest.Mock).mockResolvedValue([
        mockSchoolA,
        schoolWithNulls,
      ]);

      const weights: RankingWeights = {
        usNewsRank: 25,
        acceptanceRate: 25,
        tuition: 25,
        avgSalary: 25,
        ...ZERO_NICHE_WEIGHTS,
      };

      const result = await service.calculateRanking(weights);

      expect(result).toHaveLength(2);
      // School with null fields should still get a score (0 for null dimensions)
      result.forEach((school) => {
        expect(typeof school.score).toBe('number');
        expect(school.score).not.toBeNaN();
      });
    });

    it('should return empty array when no schools exist', async () => {
      (schoolService.findAllWithMetrics as jest.Mock).mockResolvedValue([]);

      const weights: RankingWeights = {
        usNewsRank: 25,
        acceptanceRate: 25,
        tuition: 25,
        avgSalary: 25,
        ...ZERO_NICHE_WEIGHTS,
      };

      const result = await service.calculateRanking(weights);

      expect(result).toHaveLength(0);
    });

    it('should handle a single school correctly', async () => {
      (schoolService.findAllWithMetrics as jest.Mock).mockResolvedValue([
        mockSchoolA,
      ]);

      const weights: RankingWeights = {
        usNewsRank: 50,
        acceptanceRate: 50,
        tuition: 0,
        avgSalary: 0,
        ...ZERO_NICHE_WEIGHTS,
      };

      const result = await service.calculateRanking(weights);

      expect(result).toHaveLength(1);
      expect(result[0].rank).toBe(1);
      expect(result[0].id).toBe('school-a');
    });

    it('should rank by Niche grades when only niche weights are set', async () => {
      // School with A+ overall outranks school with C overall when overall niche is the sole factor.
      const aPlus = createMockSchool({
        id: 'school-aplus',
        name: 'A+ School',
        usNewsRank: 100,
        nicheOverallGrade: 'A+',
        nicheSafetyGrade: 'A',
        nicheLifeGrade: 'A',
        nicheFoodGrade: 'A',
      });
      const cSchool = createMockSchool({
        id: 'school-c-niche',
        name: 'C School',
        usNewsRank: 1,
        nicheOverallGrade: 'C',
        nicheSafetyGrade: 'C',
        nicheLifeGrade: 'C',
        nicheFoodGrade: 'C',
      });
      (schoolService.findAllWithMetrics as jest.Mock).mockResolvedValue([
        aPlus,
        cSchool,
      ]);

      const weights: RankingWeights = {
        usNewsRank: 0,
        acceptanceRate: 0,
        tuition: 0,
        avgSalary: 0,
        nicheOverall: 50,
        safetyGrade: 20,
        studentLifeGrade: 15,
        campusFoodGrade: 15,
      };

      const result = await service.calculateRanking(weights);

      expect(result).toHaveLength(2);
      // A+ school should rank first despite worse usNewsRank
      expect(result[0].id).toBe('school-aplus');
      expect(result[0].score).toBe(100);
    });

    it('should ignore Niche weights when grade is null', async () => {
      // School with null niche grades + zero numeric weights → score 0
      const noNiche = createMockSchool({
        id: 'school-no-niche',
        nicheOverallGrade: null,
        nicheSafetyGrade: null,
        nicheLifeGrade: null,
        nicheFoodGrade: null,
      });
      (schoolService.findAllWithMetrics as jest.Mock).mockResolvedValue([
        noNiche,
      ]);

      const weights: RankingWeights = {
        usNewsRank: 0,
        acceptanceRate: 0,
        tuition: 0,
        avgSalary: 0,
        nicheOverall: 100,
        safetyGrade: 0,
        studentLifeGrade: 0,
        campusFoodGrade: 0,
      };

      const result = await service.calculateRanking(weights);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(0);
    });
  });

  // ============================================
  // saveRanking
  // ============================================

  describe('saveRanking', () => {
    it('should create a new custom ranking', async () => {
      const weights: RankingWeights = {
        usNewsRank: 40,
        acceptanceRate: 20,
        tuition: 20,
        avgSalary: 20,
        ...ZERO_NICHE_WEIGHTS,
      };

      (prisma.customRanking.create as jest.Mock).mockResolvedValue(
        mockCustomRanking,
      );

      const result = await service.saveRanking(
        mockUserId,
        'My Custom Ranking',
        weights,
        false,
      );

      expect(result).toEqual(mockCustomRanking);
      expect(prisma.customRanking.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          name: 'My Custom Ranking',
          weights: weights,
          isPublic: false,
        },
      });
    });

    it('should create a public ranking when isPublic is true', async () => {
      const weights: RankingWeights = {
        usNewsRank: 25,
        acceptanceRate: 25,
        tuition: 25,
        avgSalary: 25,
        ...ZERO_NICHE_WEIGHTS,
      };

      const publicRanking = { ...mockCustomRanking, isPublic: true };
      (prisma.customRanking.create as jest.Mock).mockResolvedValue(
        publicRanking,
      );

      const result = await service.saveRanking(
        mockUserId,
        'Public Ranking',
        weights,
        true,
      );

      expect(result.isPublic).toBe(true);
      expect(prisma.customRanking.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          name: 'Public Ranking',
          weights: weights,
          isPublic: true,
        },
      });
    });
  });

  // ============================================
  // getUserRankings
  // ============================================

  describe('getUserRankings', () => {
    it("should return the user's rankings ordered by createdAt desc", async () => {
      const mockRankings = [
        {
          ...mockCustomRanking,
          id: 'ranking-2',
          createdAt: new Date('2025-07-01'),
        },
        {
          ...mockCustomRanking,
          id: 'ranking-1',
          createdAt: new Date('2025-06-01'),
        },
      ];

      (prisma.customRanking.findMany as jest.Mock).mockResolvedValue(
        mockRankings,
      );

      const result = await service.getUserRankings(mockUserId);

      expect(result).toEqual(mockRankings);
      expect(result).toHaveLength(2);
      expect(prisma.customRanking.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no rankings', async () => {
      (prisma.customRanking.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getUserRankings('user-no-rankings');

      expect(result).toEqual([]);
      expect(prisma.customRanking.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-no-rankings' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ============================================
  // getPublicRankings
  // ============================================

  describe('getPublicRankings', () => {
    it('should return public rankings with limit of 50', async () => {
      const mockPublicRankings = [{ ...mockCustomRanking, isPublic: true }];

      (prisma.customRanking.findMany as jest.Mock).mockResolvedValue(
        mockPublicRankings,
      );

      const result = await service.getPublicRankings();

      expect(result).toEqual(mockPublicRankings);
      expect(prisma.customRanking.findMany).toHaveBeenCalledWith({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should return empty array when no public rankings exist', async () => {
      (prisma.customRanking.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getPublicRankings();

      expect(result).toEqual([]);
      expect(prisma.customRanking.findMany).toHaveBeenCalledWith({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  // ============================================
  // findById
  // ============================================

  describe('findById', () => {
    it('should return the ranking when found', async () => {
      (prisma.customRanking.findUnique as jest.Mock).mockResolvedValue({
        ...mockCustomRanking,
        isPublic: true,
      });

      const result = await service.findById(mockRankingId);

      expect(result).toEqual({ ...mockCustomRanking, isPublic: true });
      expect(prisma.customRanking.findUnique).toHaveBeenCalledWith({
        where: { id: mockRankingId },
      });
    });

    // GET /rankings/:id is @Public(). This had no visibility check at all,
    // and CustomRanking.isPublic defaults to FALSE — so every ranking anyone
    // had ever saved was readable by an anonymous caller holding an id.

    it('hides a private ranking from an anonymous caller', async () => {
      (prisma.customRanking.findUnique as jest.Mock).mockResolvedValue({
        ...mockCustomRanking,
        isPublic: false,
      });

      await expect(service.findById(mockRankingId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('hides a private ranking from a different signed-in user', async () => {
      (prisma.customRanking.findUnique as jest.Mock).mockResolvedValue({
        ...mockCustomRanking,
        isPublic: false,
      });

      await expect(
        service.findById(mockRankingId, 'some-other-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('still returns a private ranking to its owner', async () => {
      const own = { ...mockCustomRanking, isPublic: false };
      (prisma.customRanking.findUnique as jest.Mock).mockResolvedValue(own);

      await expect(
        service.findById(mockRankingId, mockUserId),
      ).resolves.toEqual(own);
    });

    it('should throw NotFoundException when ranking is not found', async () => {
      (prisma.customRanking.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.customRanking.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent' },
      });
    });
  });

  // ============================================
  // deleteRanking
  // ============================================

  describe('deleteRanking', () => {
    it('should delete a ranking owned by the user', async () => {
      (prisma.customRanking.findUnique as jest.Mock).mockResolvedValue(
        mockCustomRanking,
      );
      (prisma.customRanking.delete as jest.Mock).mockResolvedValue(
        mockCustomRanking,
      );

      await service.deleteRanking(mockRankingId, mockUserId);

      expect(prisma.customRanking.findUnique).toHaveBeenCalledWith({
        where: { id: mockRankingId },
      });
      expect(prisma.customRanking.delete).toHaveBeenCalledWith({
        where: { id: mockRankingId },
      });
    });

    it('should throw NotFoundException when userId does not match ranking owner', async () => {
      (prisma.customRanking.findUnique as jest.Mock).mockResolvedValue(
        mockCustomRanking,
      );

      await expect(
        service.deleteRanking(mockRankingId, 'other-user-id'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.customRanking.findUnique).toHaveBeenCalledWith({
        where: { id: mockRankingId },
      });
      // delete should NOT have been called
      expect(prisma.customRanking.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when ranking does not exist', async () => {
      (prisma.customRanking.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteRanking('nonexistent', mockUserId),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.customRanking.delete).not.toHaveBeenCalled();
    });
  });
});
