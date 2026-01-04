import { Test, TestingModule } from '@nestjs/testing';
import { CaseService } from './case.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role, Visibility } from '@prisma/client';

describe('CaseService', () => {
  let service: CaseService;
  let prismaService: PrismaService;

  const mockCase = {
    id: 'case-123',
    userId: 'user-123',
    schoolId: 'school-123',
    year: 2024,
    result: 'ADMITTED',
    visibility: Visibility.ANONYMOUS,
    gpa: 3.9,
    satScore: 1550,
    createdAt: new Date(),
    updatedAt: new Date(),
    school: { id: 'school-123', name: 'Harvard', nameZh: '哈佛' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseService,
        {
          provide: PrismaService,
          useValue: {
            admissionCase: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CaseService>(CaseService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated cases for admin', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([mockCase]);
      (prismaService.admissionCase.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, pageSize: 20 },
        {},
        'admin-id',
        Role.ADMIN,
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by schoolId', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([mockCase]);
      (prismaService.admissionCase.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(
        { page: 1, pageSize: 20 },
        { schoolId: 'school-123' },
        'user-id',
        Role.USER,
      );

      expect(prismaService.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ schoolId: 'school-123' }),
        }),
      );
    });

    it('should apply visibility filter for regular users', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([mockCase]);
      (prismaService.admissionCase.count as jest.Mock).mockResolvedValue(1);

      await service.findAll({ page: 1, pageSize: 20 }, {}, 'user-id', Role.USER);

      expect(prismaService.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { visibility: Visibility.ANONYMOUS },
              { userId: 'user-id' },
            ],
          }),
        }),
      );
    });

    it('should allow verified users to see VERIFIED_ONLY cases', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([mockCase]);
      (prismaService.admissionCase.count as jest.Mock).mockResolvedValue(1);

      await service.findAll({ page: 1, pageSize: 20 }, {}, 'verified-id', Role.VERIFIED);

      expect(prismaService.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { visibility: Visibility.ANONYMOUS },
              { visibility: Visibility.VERIFIED_ONLY },
              { userId: 'verified-id' },
            ],
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return case for owner', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const result = await service.findById('case-123', 'user-123', Role.USER);

      expect(result.id).toBe('case-123');
    });

    it('should return case for admin regardless of visibility', async () => {
      const privateCase = { ...mockCase, visibility: Visibility.PRIVATE };
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(privateCase);

      const result = await service.findById('case-123', 'admin-id', Role.ADMIN);

      expect(result.id).toBe('case-123');
    });

    it('should throw NotFoundException when case not found', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findById('nonexistent', 'user-id', Role.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for private case', async () => {
      const privateCase = { ...mockCase, visibility: Visibility.PRIVATE };
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(privateCase);

      await expect(
        service.findById('case-123', 'other-user', Role.USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for VERIFIED_ONLY case when user is not verified', async () => {
      const verifiedOnlyCase = { ...mockCase, visibility: Visibility.VERIFIED_ONLY };
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(verifiedOnlyCase);

      await expect(
        service.findById('case-123', 'other-user', Role.USER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should create a new case', async () => {
      const createData = {
        school: { connect: { id: 'school-123' } },
        year: 2024,
        result: 'ADMITTED' as const,
        visibility: Visibility.ANONYMOUS,
      };
      (prismaService.admissionCase.create as jest.Mock).mockResolvedValue({
        id: 'new-case',
        userId: 'user-123',
        ...createData,
      });

      const result = await service.create('user-123', createData);

      expect(result.id).toBe('new-case');
      expect(prismaService.admissionCase.create).toHaveBeenCalledWith({
        data: {
          ...createData,
          user: { connect: { id: 'user-123' } },
        },
      });
    });
  });

  describe('update', () => {
    it('should update case for owner', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prismaService.admissionCase.update as jest.Mock).mockResolvedValue({
        ...mockCase,
        gpa: 4.0,
      });

      const result = await service.update('case-123', 'user-123', { gpa: 4.0 });

      expect(result.gpa).toBe(4.0);
    });

    it('should throw NotFoundException when updating non-owned case', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(mockCase);

      await expect(
        service.update('case-123', 'other-user', { gpa: 4.0 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete case for owner', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prismaService.admissionCase.delete as jest.Mock).mockResolvedValue(mockCase);

      await service.delete('case-123', 'user-123');

      expect(prismaService.admissionCase.delete).toHaveBeenCalledWith({
        where: { id: 'case-123' },
      });
    });

    it('should throw NotFoundException when deleting non-owned case', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(mockCase);

      await expect(service.delete('case-123', 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyCases', () => {
    it('should return all cases for user', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([mockCase]);

      const result = await service.getMyCases('user-123');

      expect(result).toHaveLength(1);
      expect(prismaService.admissionCase.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          school: { select: { id: true, name: true, nameZh: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});

