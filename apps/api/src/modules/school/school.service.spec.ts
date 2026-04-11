import { Test, TestingModule } from '@nestjs/testing';
import { SchoolService } from './school.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SchoolCommunityRatingService } from './school-community-rating.service';

describe('SchoolService', () => {
  let service: SchoolService;
  let prismaService: PrismaService;

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
      ],
    }).compile();

    service = module.get<SchoolService>(SchoolService);
    prismaService = module.get<PrismaService>(PrismaService);
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
        tier: 'verified',
        source: 'COLLEGE_SCORECARD',
        updatedAt: '2026-04-01T00:00:00.000Z',
      });
      expect(result.items[0].fieldSources.usNewsRank).toEqual({
        tier: 'supplemental',
        source: 'SEED',
        updatedAt: '2026-04-01T00:00:00.000Z',
      });
      expect(result.items[0].communityRatingSummary).toEqual({
        count: 5,
        safetyAvg: 4.2,
        lifeAvg: 4.4,
        foodAvg: 3.9,
        isPublic: true,
      });
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

      const result = await service.findAll({ page: 3, pageSize: 10 });

      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
      expect(result.totalPages).toBe(10);
    });

    it('should filter by school type and boolean flags', async () => {
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
            testOptional: true,
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
      expect(result.nicheSafetyGrade).toBeNull();
      expect(result.fieldSources.acceptanceRate?.tier).toBe('verified');
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
        tier: 'supplemental',
        source: 'APPILY',
        updatedAt: '2026-04-02T00:00:00.000Z',
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
      (prismaService.school.create as jest.Mock).mockResolvedValue({
        id: 'new-school',
        ...createData,
        nameNorm: 'new university',
      });

      const result = await service.create(createData);

      expect(result.name).toBe('New University');
      expect(prismaService.school.create).toHaveBeenCalledWith({
        data: {
          ...createData,
          nameNorm: 'new university',
        },
      });
    });

    it('should throw ConflictException on duplicate name', async () => {
      const createData = {
        name: 'Harvard University',
        country: 'USA',
      };
      (prismaService.school.create as jest.Mock).mockRejectedValue(
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
      (prismaService.school.update as jest.Mock).mockResolvedValue({
        ...mockSchool,
        usNewsRank: 5,
      });

      const result = await service.update('school-123', updateData);

      expect(result.usNewsRank).toBe(5);
      expect(prismaService.school.update).toHaveBeenCalledWith({
        where: { id: 'school-123' },
        data: updateData,
      });
    });

    it('should keep nameNorm in sync when updating name', async () => {
      (prismaService.school.update as jest.Mock).mockResolvedValue({
        ...mockSchool,
        name: 'Renamed University',
      });

      await service.update('school-123', { name: 'Renamed University' });

      expect(prismaService.school.update).toHaveBeenCalledWith({
        where: { id: 'school-123' },
        data: {
          name: 'Renamed University',
          nameNorm: 'renamed university',
        },
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
});
