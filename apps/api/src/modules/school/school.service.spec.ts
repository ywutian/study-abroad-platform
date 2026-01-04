import { Test, TestingModule } from '@nestjs/testing';
import { SchoolService } from './school.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

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
    acceptanceRate: 0.035,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSchools = [
    mockSchool,
    { ...mockSchool, id: 'school-456', name: 'MIT', nameZh: '麻省理工', usNewsRank: 2 },
    { ...mockSchool, id: 'school-789', name: 'Stanford', nameZh: '斯坦福', usNewsRank: 3 },
  ];

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
      (prismaService.school.findMany as jest.Mock).mockResolvedValue(mockSchools);
      (prismaService.school.count as jest.Mock).mockResolvedValue(3);

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });

    it('should filter by country', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([mockSchool]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(1);

      await service.findAll({ page: 1, pageSize: 20 }, { country: 'USA' });

      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ country: 'USA' }),
        }),
      );
    });

    it('should filter by search term', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([mockSchool]);
      (prismaService.school.count as jest.Mock).mockResolvedValue(1);

      await service.findAll({ page: 1, pageSize: 20 }, { search: 'Harvard' });

      expect(prismaService.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'Harvard', mode: 'insensitive' } },
              { nameZh: { contains: 'Harvard', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue([mockSchool]);
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
  });

  describe('findById', () => {
    it('should return school with metrics when found', async () => {
      (prismaService.school.findUnique as jest.Mock).mockResolvedValue({
        ...mockSchool,
        metrics: [],
      });

      const result = await service.findById('school-123');

      expect(result.id).toBe('school-123');
      expect(prismaService.school.findUnique).toHaveBeenCalledWith({
        where: { id: 'school-123' },
        include: {
          metrics: {
            orderBy: { year: 'desc' },
            take: 5,
          },
        },
      });
    });

    it('should throw NotFoundException when school not found', async () => {
      (prismaService.school.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new school', async () => {
      const createData = {
        name: 'New University',
        nameZh: '新大学',
        country: 'USA',
      };
      (prismaService.school.create as jest.Mock).mockResolvedValue({
        id: 'new-school',
        ...createData,
      });

      const result = await service.create(createData);

      expect(result.name).toBe('New University');
      expect(prismaService.school.create).toHaveBeenCalledWith({ data: createData });
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
    });
  });

  describe('findAllWithMetrics', () => {
    it('should return schools with US News rank', async () => {
      (prismaService.school.findMany as jest.Mock).mockResolvedValue(mockSchools);

      const result = await service.findAllWithMetrics();

      expect(result).toHaveLength(3);
      expect(prismaService.school.findMany).toHaveBeenCalledWith({
        where: { usNewsRank: { not: null } },
        orderBy: { usNewsRank: 'asc' },
      });
    });
  });
});

