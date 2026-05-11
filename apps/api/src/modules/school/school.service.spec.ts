import { Test, TestingModule } from '@nestjs/testing';
import { SchoolService } from './school.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SchoolCommunityRatingService } from './school-community-rating.service';
import { SchoolWriteService } from './school-write.service';

describe('SchoolService', () => {
  let service: SchoolService;
  let prismaService: PrismaService;
  let redisService: RedisService;

  const mockSchool = {
    id: 'school-123',
    name: 'Harvard University',
    nameZh: '哈佛大学',
    country: 'USA',
    state: 'MA',
    city: 'Cambridge',
    usNewsRank: 1,
    qsRank: 5,
    acceptanceRate: 3.5,
    testingPolicy: 'OPTIONAL',
    testOptional: true,
    metadata: {
      provenance: {
        acceptanceRate: {
          source: 'COLLEGE_SCORECARD',
          at: '2026-04-01T00:00:00.000Z',
        },
        usNewsRank: {
          source: 'SEED',
          at: '2026-04-01T00:00:00.000Z',
        },
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSchools = [
    mockSchool,
    {
      ...mockSchool,
      id: 'school-456',
      name: 'MIT',
      nameZh: '麻省理工',
      usNewsRank: 2,
    },
    {
      ...mockSchool,
      id: 'school-789',
      name: 'Stanford',
      nameZh: '斯坦福',
      usNewsRank: 3,
    },
  ];
  const mockSchoolCommunityRatingService = {
    getSummariesForSchools: jest.fn().mockResolvedValue({
      'school-123': {
        count: 5,
        safetyAvg: 4.2,
        lifeAvg: 4.4,
        foodAvg: 3.9,
        isPublic: true,
      },
      'school-456': {
        count: 0,
        safetyAvg: null,
        lifeAvg: null,
        foodAvg: null,
        isPublic: false,
      },
      'school-789': {
        count: 0,
        safetyAvg: null,
        lifeAvg: null,
        foodAvg: null,
        isPublic: false,
      },
    }),
    getSummary: jest.fn().mockResolvedValue({
      count: 5,
      safetyAvg: 4.2,
      lifeAvg: 4.4,
      foodAvg: 3.9,
      isPublic: true,
    }),
  };
  const mockSchoolWriteService = {
    create: jest.fn(),
    update: jest.fn(),
    invalidateSchoolCaches: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolService,
        {
          provide: PrismaService,
          useValue: {
            school: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
              groupBy: jest.fn(),
            },
            schoolRanking: {
              groupBy: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1),
            getClient: jest.fn().mockReturnValue(null),
            getJSON: jest.fn().mockResolvedValue(null),
            setJSON: jest.fn().mockResolvedValue('OK'),
          },
        },
        {
          provide: SchoolCommunityRatingService,
          useValue: mockSchoolCommunityRatingService,
        },
        {
          provide: SchoolWriteService,
          useValue: mockSchoolWriteService,
        },
      ],
    }).compile();

    service = module.get<SchoolService>(SchoolService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated schools', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue(
        mockSchools,
      );
      (prismaService.school.count as jest.Mock).mockResolvedValue(3);

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.items[0].fieldSources.acceptanceRate).toEqual({
        tier: 'OFFICIAL',
        source: 'COLLEGE_SCORECARD',
        fetchedAt: '2026-04-01T00:00:00.000Z',
        staleness: expect.any(String),
        isVerified: true,
        predictionEligible: true,
      });
      expect(result.items[0].fieldSources.usNewsRank).toEqual({
        tier: 'SEED',
        source: 'SEED',
        fetchedAt: '2026-04-01T00:00:00.000Z',
        staleness: expect.any(String),
        isVerified: false,
        predictionEligible: true,
      });
      expect(result.items[0].communityRatingSummary).toEqual({
        count: 5,
        safetyAvg: 4.2,
        lifeAvg: 4.4,
        foodAvg: 3.9,
        isPublic: true,
      });
      expect(result.items[0].testingPolicy).toBe('OPTIONAL');
      expect(result.items[0].testOptional).toBe(true);
    });

    it('should continue from Postgres when Redis list cache is exhausted', async () => {
      (redisService.getJSON as jest.Mock).mockRejectedValueOnce(
        new Error('ERR max requests limit exceeded'),
      );
      (redisService.setJSON as jest.Mock).mockRejectedValueOnce(
        new Error('ERR max requests limit exceeded'),
      );
      (prismaService.school.findMany as jest.Mock).mockResolvedValue(
        mockSchools,
      );
      (prismaService.school.count as jest.Mock).mockResolvedValue(3);

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(3);
      expect(prismaService.school.findMany).toHaveBeenCalled();
    });

    it('should filter by country', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        mockSchool,
      ]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(1);

      await service.findAll({ page: 1, pageSize: 20 }, { country: 'USA' });

      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ country: 'USA' }),
        }),
      );
    });

    it('should filter by search term', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        mockSchool,
      ]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(1);

      await service.findAll({ page: 1, pageSize: 20 }, { search: 'Harvard' });

      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'Harvard', mode: 'insensitive' } },
              { nameZh: { contains: 'Harvard', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        mockSchool,
      ]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(100);

      const result = await service.findAll(
        { page: 3, pageSize: 10 },
        { sortBy: 'name' },
      );

      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
      expect(result.totalPages).toBe(10);
    });

    it('should sort catalog rank by comparable ranking lists before pagination', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockSchool,
          id: 'risd',
          name: 'Rhode Island School of Design',
          usNewsRank: 1,
          rankings: [],
        },
        {
          ...mockSchool,
          id: 'princeton',
          name: 'Princeton University',
          usNewsRank: 1,
          rankings: [],
        },
        {
          ...mockSchool,
          id: 'mit',
          name: 'Massachusetts Institute of Technology',
          usNewsRank: 2,
          rankings: [],
        },
      ]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(3);

      const result = await service.findAll({ page: 1, pageSize: 3 });

      expect(result.items.map((school) => school.name)).toEqual([
        'Princeton University',
        'Massachusetts Institute of Technology',
        'Rhode Island School of Design',
      ]);
      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({
          skip: expect.any(Number),
          take: expect.any(Number),
        }),
      );
    });

    it('should filter and sort within a selected Music ranking list', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockSchool,
          id: 'princeton',
          name: 'Princeton University',
          usNewsRank: 1,
          rankings: [
            {
              source: 'US_NEWS',
              list: 'NATIONAL_UNIVERSITY',
              rank: 1,
              year: 2025,
            },
          ],
        },
        {
          ...mockSchool,
          id: 'juilliard',
          name: 'The Juilliard School',
          usNewsRank: 1,
          rankings: [{ source: 'US_NEWS', list: 'MUSIC', rank: 1, year: 2025 }],
        },
      ]);

      const result = await service.findAll(
        { page: 1, pageSize: 10 },
        { rankingList: 'MUSIC' },
      );

      expect(result.total).toBe(1);
      expect(result.items.map((school) => school.name)).toEqual([
        'The Juilliard School',
      ]);
    });

    it('should apply rank range against the selected ranking list', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockSchool,
          id: 'juilliard',
          name: 'The Juilliard School',
          usNewsRank: 1,
          rankings: [{ source: 'US_NEWS', list: 'MUSIC', rank: 1, year: 2025 }],
        },
        {
          ...mockSchool,
          id: 'berklee',
          name: 'Berklee College of Music',
          usNewsRank: 12,
          rankings: [
            { source: 'US_NEWS', list: 'MUSIC', rank: 12, year: 2025 },
          ],
        },
      ]);

      const result = await service.findAll(
        { page: 1, pageSize: 10 },
        { rankingList: 'MUSIC', rankMax: 5 },
      );

      expect(result.items.map((school) => school.name)).toEqual([
        'The Juilliard School',
      ]);
    });

    it('should use the selected ranking list for weighted sorting', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockSchool,
          id: 'juilliard',
          name: 'The Juilliard School',
          usNewsRank: 1,
          acceptanceRate: 9,
          tuition: 55000,
          avgSalary: 80000,
          rankings: [{ source: 'US_NEWS', list: 'MUSIC', rank: 1, year: 2025 }],
        },
        {
          ...mockSchool,
          id: 'berklee',
          name: 'Berklee College of Music',
          usNewsRank: 2,
          acceptanceRate: 9,
          tuition: 55000,
          avgSalary: 80000,
          rankings: [{ source: 'US_NEWS', list: 'MUSIC', rank: 2, year: 2025 }],
        },
        {
          ...mockSchool,
          id: 'princeton',
          name: 'Princeton University',
          usNewsRank: 1,
          acceptanceRate: 9,
          tuition: 55000,
          avgSalary: 80000,
          rankings: [
            {
              source: 'US_NEWS',
              list: 'NATIONAL_UNIVERSITY',
              rank: 1,
              year: 2025,
            },
          ],
        },
      ]);

      const result = await service.findAll(
        { page: 1, pageSize: 10 },
        {
          sortBy: 'weighted',
          rankingList: 'MUSIC',
          weightRank: 100,
          weightAcceptance: 0,
          weightTuition: 0,
          weightSalary: 0,
        },
      );

      expect(result.total).toBe(2);
      expect(result.items.map((school) => school.name)).toEqual([
        'The Juilliard School',
        'Berklee College of Music',
      ]);
    });

    it('should map legacy testOptional filter to testingPolicy-compatible where clauses', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        mockSchool,
      ]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(
        { page: 1, pageSize: 20 },
        {
          schoolType: 'private',
          needBlind: true,
          hasEarlyDecision: true,
          testOptional: true,
        },
      );

      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPrivate: true,
            needBlindInternational: true,
            hasEarlyDecision: true,
            OR: expect.arrayContaining([
              { testingPolicy: 'OPTIONAL' },
              { testingPolicy: 'UNKNOWN', testOptional: true },
            ]),
          }),
        }),
      );
    });

    it('should let state filter take precedence over region', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        mockSchool,
      ]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(
        { page: 1, pageSize: 20 },
        { country: 'US', state: 'CA', region: 'west' },
      );

      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            state: 'CA',
          }),
        }),
      );
    });

    it('should only apply region expansion for US filters', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        mockSchool,
      ]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(
        { page: 1, pageSize: 20 },
        { country: 'UK', region: 'west' },
      );

      const findManyArgs = (prismaService.school.findMany as jest.Mock).mock
        .calls[0][0];

      expect(findManyArgs.where).toMatchObject({ country: 'UK' });
      expect(findManyArgs.where.state).toBeUndefined();
    });

    it('should filter and sort by post-graduation salary', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        { ...mockSchool, avgSalary: 95000 },
      ]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(
        { page: 1, pageSize: 20 },
        { salaryMin: 80000, salaryMax: 120000, sortBy: 'salary' },
      );

      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            avgSalary: { gte: 80000, lte: 120000 },
          }),
          orderBy: [{ avgSalary: 'desc' }, { usNewsRank: 'asc' }],
        }),
      );
    });

    it('should apply weighted sorting before pagination', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockSchool,
          id: 'lower-salary',
          name: 'Lower Salary University',
          usNewsRank: 1,
          acceptanceRate: 5,
          tuition: 50000,
          avgSalary: 70000,
        },
        {
          ...mockSchool,
          id: 'higher-salary',
          name: 'Higher Salary Institute',
          usNewsRank: 50,
          acceptanceRate: 30,
          tuition: 60000,
          avgSalary: 140000,
        },
      ]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findAll(
        { page: 1, pageSize: 1 },
        {
          sortBy: 'weighted',
          weightRank: 0,
          weightAcceptance: 0,
          weightTuition: 0,
          weightSalary: 100,
        },
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('higher-salary');
      expect((result.items[0] as any).fitScore).toBe(100);
      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({
          skip: expect.any(Number),
          take: expect.any(Number),
        }),
      );
    });
  });

  describe('getAvailableCountries', () => {
    it('should continue from Postgres when Redis country cache is exhausted', async () => {
      (redisService.getJSON as jest.Mock).mockRejectedValueOnce(
        new Error('ERR max requests limit exceeded'),
      );
      (redisService.setJSON as jest.Mock).mockRejectedValueOnce(
        new Error('ERR max requests limit exceeded'),
      );
      (prismaService.school.groupBy as jest.Mock).mockResolvedValue([
        { country: 'US', _count: { _all: 2 } },
        { country: 'UK', _count: { _all: 1 } },
      ]);

      await expect(service.getAvailableCountries()).resolves.toEqual([
        { code: 'US', count: 2 },
        { code: 'UK', count: 1 },
      ]);
    });
  });

  describe('getAvailableRankingLists', () => {
    it('should return core and non-empty US News ranking lists', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([
        {
          name: 'Princeton University',
          institutionType: 'RESEARCH_UNIVERSITY',
          usNewsRank: 1,
          rankings: [
            {
              source: 'US_NEWS',
              list: 'NATIONAL_UNIVERSITY',
              rank: 1,
              year: 2025,
            },
          ],
        },
        {
          name: 'Williams College',
          institutionType: 'LIBERAL_ARTS',
          usNewsRank: 1,
          rankings: [
            { source: 'US_NEWS', list: 'LIBERAL_ARTS', rank: 1, year: 2025 },
          ],
        },
        {
          name: 'The Juilliard School',
          institutionType: 'MUSIC_CONSERVATORY',
          usNewsRank: 1,
          rankings: [{ source: 'US_NEWS', list: 'MUSIC', rank: 1, year: 2025 }],
        },
        {
          name: 'Berklee College of Music',
          institutionType: 'MUSIC_CONSERVATORY',
          usNewsRank: 2,
          rankings: [],
        },
      ]);

      const result = await service.getAvailableRankingLists();

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            list: 'US_NEWS_CORE',
            count: 2,
            verifiedCount: 2,
            fallbackCount: 0,
            isDefault: true,
          }),
          expect.objectContaining({
            list: 'MUSIC',
            count: 2,
            verifiedCount: 1,
            fallbackCount: 1,
            isDefault: false,
          }),
        ]),
      );
      expect(result.some((item) => item.list === 'ART_DESIGN')).toBe(false);
    });
  });

  describe('findById', () => {
    it('should return school with metrics when found', async () => {
      (prismaService.school.findUnique as jest.Mock).mockResolvedValue({
        ...mockSchool,
        metrics: [],
        admissionCases: [],
        nicheSafetyGrade: 'A',
        nicheLifeGrade: 'B+',
        nicheFoodGrade: 'A-',
      });

      const result = await service.findById('school-123');

      expect(result.id).toBe('school-123');
      expect(result.communityRatingSummary).toEqual({
        count: 5,
        safetyAvg: 4.2,
        lifeAvg: 4.4,
        foodAvg: 3.9,
        isPublic: true,
      });
      expect(result.nicheSafetyGrade).toBe('A');
      expect(result.fieldSources.acceptanceRate?.tier).toBe('OFFICIAL');
      expect(prismaService.school.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'school-123' },
          include: expect.objectContaining({
            metrics: expect.any(Object),
          }),
        }),
      );
    });

    it('should keep sourced campus-life grades visible', async () => {
      (prismaService.school.findUnique as jest.Mock).mockResolvedValue({
        ...mockSchool,
        metadata: {
          provenance: {
            ...mockSchool.metadata.provenance,
            nicheSafetyGrade: {
              source: 'APPILY',
              at: '2026-04-02T00:00:00.000Z',
            },
          },
        },
        nicheSafetyGrade: 'A',
        metrics: [],
        admissionCases: [],
      });

      const result = await service.findById('school-123');

      expect(result.nicheSafetyGrade).toBe('A');
      expect(result.fieldSources.nicheSafetyGrade).toEqual({
        tier: 'SCRAPED',
        source: 'APPILY',
        fetchedAt: '2026-04-02T00:00:00.000Z',
        staleness: expect.any(String),
        isVerified: false,
        predictionEligible: true,
      });
    });

    it('should throw NotFoundException when school not found', async () => {
      (prismaService.school.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new school with nameNorm', async () => {
      const createData = {
        name: 'New University',
        nameZh: '新大学',
        country: 'USA',
      };
      mockSchoolWriteService.create.mockResolvedValue({
        id: 'new-school',
        ...createData,
        nameNorm: 'new university',
      });

      const result = await service.create(createData);

      expect(result.name).toBe('New University');
      expect(mockSchoolWriteService.create).toHaveBeenCalledWith({
        fields: {
          name: 'New University',
          nameZh: '新大学',
          country: 'USA',
        },
        metadataPatch: {},
        provenance: {},
      });
    });

    it('should throw ConflictException on duplicate name', async () => {
      const createData = {
        name: 'Harvard University',
        country: 'USA',
      };
      mockSchoolWriteService.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['nameNorm'] },
        }),
      );

      await expect(service.create(createData)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update school data', async () => {
      const updateData = { usNewsRank: 5 };
      mockSchoolWriteService.update.mockResolvedValue({
        ...mockSchool,
        usNewsRank: 5,
      });

      const result = await service.update('school-123', updateData);

      expect(result.usNewsRank).toBe(5);
      expect(mockSchoolWriteService.update).toHaveBeenCalledWith('school-123', {
        fields: updateData,
        metadataPatch: {},
        provenance: {},
      });
    });

    it('should keep nameNorm in sync when updating name', async () => {
      mockSchoolWriteService.update.mockResolvedValue({
        ...mockSchool,
        name: 'Renamed University',
      });

      await service.update('school-123', { name: 'Renamed University' });

      expect(mockSchoolWriteService.update).toHaveBeenCalledWith('school-123', {
        fields: {
          name: 'Renamed University',
        },
        metadataPatch: {},
        provenance: {},
      });
    });
  });

  describe('findAllWithMetrics', () => {
    it('should return schools with US News rank', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue(
        mockSchools,
      );

      const result = await service.findAllWithMetrics();

      expect(result).toHaveLength(3);
      expect(prismaService.school.findMany).toHaveBeenCalledWith({
        where: { usNewsRank: { not: null } },
        orderBy: { usNewsRank: 'asc' },
      });
    });
  });

  describe('getAvailableCountries', () => {
    it('returns countries that have at least one school, sorted by count', async () => {
      (prismaService.school.groupBy as jest.Mock).mockResolvedValue([
        { country: 'US', _count: { _all: 137 } },
        { country: 'UK', _count: { _all: 5 } },
      ]);

      const result = await service.getAvailableCountries();

      expect(result).toEqual([
        { code: 'US', count: 137 },
        { code: 'UK', count: 5 },
      ]);
      expect(prismaService.school.groupBy).toHaveBeenCalledWith({
        by: ['country'],
        _count: { _all: true },
        orderBy: { _count: { country: 'desc' } },
      });
    });

    it('returns empty array when no schools exist', async () => {
      (prismaService.school.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getAvailableCountries();

      expect(result).toEqual([]);
    });
  });
});
