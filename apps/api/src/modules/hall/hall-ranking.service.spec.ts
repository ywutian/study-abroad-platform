import { Test, TestingModule } from '@nestjs/testing';
import { HallRankingService } from './hall-ranking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { PointsService } from '../points/incentive.service';

jest.mock('../../common/utils/scoring', () => ({
  extractProfileMetrics: jest.fn().mockReturnValue({
    gpa: 3.8,
    gpaScale: 4.0,
    satScore: 1500,
    actScore: null,
    toeflScore: 110,
    activityCount: 5,
    awardCount: 3,
    nationalAwardCount: 1,
    internationalAwardCount: 0,
  }),
  extractSchoolMetrics: jest.fn().mockReturnValue({}),
  calculateScoreBreakdown: jest.fn().mockReturnValue({
    academic: 80,
    activity: 70,
    award: 60,
    overall: 72,
  }),
  calculateOverallScore: jest.fn().mockReturnValue(72),
}));

describe('HallRankingService', () => {
  let service: HallRankingService;

  const mockPrisma = {
    profile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    school: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    schoolListItem: {
      findMany: jest.fn(),
    },
  };

  const mockMemoryManager = {
    remember: jest.fn().mockResolvedValue(undefined),
    recordEntity: jest.fn().mockResolvedValue(undefined),
  };

  const mockLLMService = {
    chatSimple: jest.fn(),
    chatSimpleGuarded: jest.fn(),
  };

  const mockPointsService = {
    adjustPoints: jest.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HallRankingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MemoryManagerService, useValue: mockMemoryManager },
        { provide: LLMService, useValue: mockLLMService },
        { provide: PointsService, useValue: mockPointsService },
      ],
    }).compile();

    service = module.get<HallRankingService>(HallRankingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // calcBands
  // ============================================

  describe('calcBands', () => {
    it('should return zeros for empty array', () => {
      const result = service.calcBands([]);
      expect(result).toEqual({ p25: 0, p50: 0, p75: 0 });
    });

    it('should return same value for single-element array', () => {
      const result = service.calcBands([50]);
      expect(result).toEqual({ p25: 50, p50: 50, p75: 50 });
    });

    it('should compute ordered percentile bands', () => {
      const result = service.calcBands([10, 20, 30, 40, 50, 60, 70, 80]);
      expect(result.p25).toBeGreaterThan(0);
      expect(result.p50).toBeGreaterThanOrEqual(result.p25);
      expect(result.p75).toBeGreaterThanOrEqual(result.p50);
    });
  });

  // ============================================
  // getProfileRanking
  // ============================================

  describe('getProfileRanking', () => {
    it('should return message when user has no profile', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
      });
      mockPrisma.profile.findMany.mockResolvedValue([]);
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getProfileRanking('user-1', 'school-1');

      expect(result.rank).toBeNull();
      expect(result.message).toBe('Complete your profile first');
    });

    it('should return rank 1 when user is the only profile', async () => {
      const userProfile = {
        userId: 'user-1',
        testScores: [],
        activities: [],
        awards: [],
      };
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
      });
      mockPrisma.profile.findMany.mockResolvedValue([userProfile]);
      mockPrisma.profile.findUnique.mockResolvedValue(userProfile);

      const result = await service.getProfileRanking('user-1', 'school-1');

      expect(result.rank).toBe(1);
      expect(result.total).toBe(1);
      expect(result.percentile).toBe(100);
    });

    it('should include user in competitor list if not already present', async () => {
      const competitor = {
        userId: 'comp-1',
        testScores: [],
        activities: [],
        awards: [],
      };
      const userProfile = {
        userId: 'user-1',
        testScores: [],
        activities: [],
        awards: [],
      };
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
      });
      mockPrisma.profile.findMany.mockResolvedValue([competitor]);
      mockPrisma.profile.findUnique.mockResolvedValue(userProfile);

      const result = await service.getProfileRanking('user-1', 'school-1');

      expect(result.total).toBe(2);
    });
  });

  // ============================================
  // getBatchRanking
  // ============================================

  describe('getBatchRanking', () => {
    it('should return empty rankings for empty schoolIds', async () => {
      const result = await service.getBatchRanking('user-1', []);
      expect(result.rankings).toEqual([]);
    });

    it('should return empty rankings when user has no profile', async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { id: 'school-1', name: 'MIT' },
      ]);
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getBatchRanking('user-1', ['school-1']);

      expect(result.rankings).toEqual([]);
    });

    it('should return rankings for multiple schools', async () => {
      const schools = [
        { id: 's-1', name: 'MIT', nameZh: 'MIT' },
        { id: 's-2', name: 'Stanford', nameZh: null },
      ];
      mockPrisma.school.findMany.mockResolvedValue(schools);
      mockPrisma.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        testScores: [],
        activities: [],
        awards: [],
      });
      mockPrisma.schoolListItem.findMany.mockResolvedValue([]);
      mockPrisma.profile.findMany.mockResolvedValue([]);

      const result = await service.getBatchRanking('user-1', ['s-1', 's-2']);

      expect(result.rankings).toHaveLength(2);
      expect(result.rankings[0].schoolId).toBe('s-1');
      expect(result.rankings[1].schoolId).toBe('s-2');
    });
  });

  // ============================================
  // getTargetSchoolRanking
  // ============================================

  describe('getTargetSchoolRanking', () => {
    it('should return empty when user has no school list items', async () => {
      mockPrisma.schoolListItem.findMany.mockResolvedValue([]);

      const result = await service.getTargetSchoolRanking('user-1');

      expect(result.rankings).toEqual([]);
      expect(result.totalTargetSchools).toBe(0);
    });
  });

  // ============================================
  // getRankingAnalysis
  // ============================================

  describe('getRankingAnalysis', () => {
    it('should return fallback when llmService returns error', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        testScores: [],
        activities: [],
        awards: [],
      });
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
        nameZh: 'MIT',
        usNewsRank: 1,
        acceptanceRate: 3.5,
      });
      mockPrisma.profile.findMany.mockResolvedValue([]);
      mockLLMService.chatSimpleGuarded.mockRejectedValue(
        new Error('LLM error'),
      );

      const result = await service.getRankingAnalysis(
        'user-1',
        'school-1',
        'en',
      );

      expect(result.strengths).toEqual([]);
      expect(result.improvements).toEqual([]);
    });

    it('should return profile-not-found message when no profile', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getRankingAnalysis(
        'user-1',
        'school-1',
        'en',
      );

      expect(result.analysis).toContain('profile');
    });

    it('should return school-not-found message when school does not exist', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        testScores: [],
        activities: [],
        awards: [],
      });
      mockPrisma.school.findUnique.mockResolvedValue(null);

      const result = await service.getRankingAnalysis(
        'user-1',
        'school-1',
        'en',
      );

      expect(result.analysis).toContain('not found');
    });
  });

  describe('getRankingAnalysis (no LLM service)', () => {
    let serviceNoLLM: HallRankingService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HallRankingService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: MemoryManagerService, useValue: null },
          { provide: LLMService, useValue: null },
          { provide: PointsService, useValue: mockPointsService },
        ],
      }).compile();

      serviceNoLLM = module.get<HallRankingService>(HallRankingService);
    });

    it('should return unavailable message when llmService is null', async () => {
      const result = await serviceNoLLM.getRankingAnalysis(
        'user-1',
        'school-1',
        'en',
      );

      expect(result.analysis).toContain('unavailable');
      expect(result.strengths).toEqual([]);
    });
  });
});
