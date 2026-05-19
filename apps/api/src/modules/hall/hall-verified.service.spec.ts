import { Test, TestingModule } from '@nestjs/testing';
import { HallVerifiedService } from './hall-verified.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RankingFilter } from './dto';

describe('HallVerifiedService', () => {
  let service: HallVerifiedService;

  const mockPrisma = {
    admissionCase: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HallVerifiedService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<HallVerifiedService>(HallVerifiedService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // getVerifiedRanking
  // ============================================

  describe('getVerifiedRanking', () => {
    const mockCases = [
      {
        id: 'case-1',
        userId: 'user-1',
        isVerified: true,
        result: 'ADMITTED',
        year: 2026,
        round: 'ED',
        major: 'CS',
        gpaRange: '3.8-4.0',
        satRange: '1500-1600',
        actRange: null,
        toeflRange: '110-120',
        verifiedAt: new Date('2026-01-15'),
        school: {
          name: 'MIT',
          nameZh: 'MIT',
          usNewsRank: 1,
        },
        user: {
          id: 'user-1',
          profile: { realName: 'John Doe' },
        },
      },
    ];

    beforeEach(() => {
      // Mock getVerifiedStats counts
      mockPrisma.admissionCase.count
        .mockResolvedValueOnce(50) // total from main query
        .mockResolvedValueOnce(100) // totalVerified
        .mockResolvedValueOnce(80) // totalAdmitted
        .mockResolvedValueOnce(30) // topSchoolsCount
        .mockResolvedValueOnce(15); // ivyCount
    });

    it('should return verified ranking with stats', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue(mockCases);

      const result = await service.getVerifiedRanking({
        filter: RankingFilter.ALL,
      });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].rank).toBe(1);
      expect(result.users[0].schoolName).toBe('MIT');
      // 2026-05 Hall Plan C (security B4): realName must NEVER reach this
      // public surface — the user is shown as a masked label only.
      expect(result.users[0].userName).not.toBe('John Doe');
      expect(result.users[0].userName).toMatch(/^用户/);
      expect(result.stats.totalVerified).toBe(100);
      expect(result.stats.totalAdmitted).toBe(80);
      expect(result.total).toBe(50);
    });

    it('should filter by ADMITTED result', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);

      await service.getVerifiedRanking({ filter: RankingFilter.ADMITTED });

      expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            result: 'ADMITTED',
          }),
        }),
      );
    });

    it('should filter by TOP20 schools', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);

      await service.getVerifiedRanking({ filter: RankingFilter.TOP20 });

      expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            school: { usNewsRank: { lte: 20 } },
          }),
        }),
      );
    });

    it('should filter by IVY schools', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);

      await service.getVerifiedRanking({ filter: RankingFilter.IVY });

      expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            school: {
              name: {
                in: expect.arrayContaining([
                  'Harvard University',
                  'Yale University',
                ]),
              },
            },
          }),
        }),
      );
    });

    it('should filter by year when provided', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);

      await service.getVerifiedRanking({ year: 2026 });

      expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2026,
          }),
        }),
      );
    });

    it('should handle pagination with offset and limit', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue(mockCases);

      const result = await service.getVerifiedRanking({
        offset: 10,
        limit: 5,
      });

      expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
      expect(result.users[0].rank).toBe(11); // offset + index + 1
    });

    it('should compute hasMore correctly', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue(mockCases);
      // Override the main query count to 50
      mockPrisma.admissionCase.count
        .mockReset()
        .mockResolvedValueOnce(50) // main query count
        .mockResolvedValueOnce(100) // totalVerified
        .mockResolvedValueOnce(80) // totalAdmitted
        .mockResolvedValueOnce(30) // topSchoolsCount
        .mockResolvedValueOnce(15); // ivyCount

      const result = await service.getVerifiedRanking({ offset: 0, limit: 10 });

      expect(result.hasMore).toBe(true); // 0 + 10 < 50
    });

    it('should use fallback username when realName is null', async () => {
      const caseNoName = {
        ...mockCases[0],
        user: { id: 'user-1', profile: { realName: null } },
      };
      mockPrisma.admissionCase.findMany.mockResolvedValue([caseNoName]);

      const result = await service.getVerifiedRanking({});

      expect(result.users[0].userName).toMatch(/^用户/);
    });
  });

  // ============================================
  // getAvailableYears
  // ============================================

  describe('getAvailableYears', () => {
    it('should return distinct years in descending order', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([
        { year: 2026 },
        { year: 2025 },
        { year: 2024 },
      ]);

      const result = await service.getAvailableYears();

      expect(result).toEqual([2026, 2025, 2024]);
    });

    it('should return empty array when no verified cases', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);

      const result = await service.getAvailableYears();

      expect(result).toEqual([]);
    });
  });
});
