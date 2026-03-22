import { Test, TestingModule } from '@nestjs/testing';
import { CaseService } from './case.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { RedisService } from '../../common/redis/redis.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataReviewStatus, Role, Visibility } from '@prisma/client';

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
    reviewStatus: DataReviewStatus.AUTO_APPROVED,
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
              groupBy: jest.fn().mockResolvedValue([]),
            },
            education: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MemoryManagerService,
          useValue: {
            remember: jest.fn().mockResolvedValue(undefined),
            recall: jest.fn().mockResolvedValue([]),
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
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mockCase,
      ]);
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
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mockCase,
      ]);
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
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mockCase,
      ]);
      (prismaService.admissionCase.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(
        { page: 1, pageSize: 20 },
        {},
        'user-id',
        Role.USER,
      );

      expect(prismaService.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: [
                  { visibility: Visibility.ANONYMOUS },
                  { userId: 'user-id' },
                ],
              }),
            ]),
          }),
        }),
      );
    });

    it('should allow verified users to see VERIFIED_ONLY cases', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mockCase,
      ]);
      (prismaService.admissionCase.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(
        { page: 1, pageSize: 20 },
        {},
        'verified-id',
        Role.VERIFIED,
      );

      expect(prismaService.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: [
                  { visibility: Visibility.ANONYMOUS },
                  { visibility: Visibility.VERIFIED_ONLY },
                  { userId: 'verified-id' },
                ],
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return case for owner', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );

      const result = await service.findById(
        'case-123',
        'user-123',
        Role.USER,
        'zh',
      );

      expect(result.id).toBe('case-123');
    });

    it('should return case for admin regardless of visibility', async () => {
      const privateCase = { ...mockCase, visibility: Visibility.PRIVATE };
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        privateCase,
      );

      const result = await service.findById(
        'case-123',
        'admin-id',
        Role.ADMIN,
        'zh',
      );

      expect(result.id).toBe('case-123');
    });

    it('should throw NotFoundException when case not found', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.findById('nonexistent', 'user-id', Role.USER, 'zh'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for private case', async () => {
      const privateCase = { ...mockCase, visibility: Visibility.PRIVATE };
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        privateCase,
      );

      await expect(
        service.findById('case-123', 'other-user', Role.USER, 'zh'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for VERIFIED_ONLY case when user is not verified', async () => {
      const verifiedOnlyCase = {
        ...mockCase,
        visibility: Visibility.VERIFIED_ONLY,
      };
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        verifiedOnlyCase,
      );

      await expect(
        service.findById('case-123', 'other-user', Role.USER, 'zh'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should create a new case', async () => {
      const createData = {
        schoolId: 'school-123',
        year: 2024,
        result: 'ADMITTED',
        visibility: 'ANONYMOUS' as const,
      };
      (prismaService.admissionCase.create as jest.Mock).mockResolvedValue({
        id: 'new-case',
        userId: 'user-123',
        schoolId: 'school-123',
        year: 2024,
        result: 'ADMITTED',
        visibility: 'ANONYMOUS',
      });

      const result = await service.create('user-123', createData);

      expect(result.id).toBe('new-case');
      expect(prismaService.admissionCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            year: 2024,
            result: 'ADMITTED',
            visibility: 'ANONYMOUS',
            user: { connect: { id: 'user-123' } },
            school: { connect: { id: 'school-123' } },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update case for owner', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );
      (prismaService.admissionCase.update as jest.Mock).mockResolvedValue({
        ...mockCase,
        gpaRange: '3.9-4.0',
      });

      const result = await service.update('case-123', 'user-123', {
        gpaRange: '3.9-4.0',
      });

      expect(result.gpaRange).toBe('3.9-4.0');
    });

    it('should throw NotFoundException when updating non-owned case', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );

      await expect(
        service.update('case-123', 'other-user', { gpaRange: '3.9-4.0' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete case for owner', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );
      (prismaService.admissionCase.delete as jest.Mock).mockResolvedValue(
        mockCase,
      );

      await service.delete('case-123', 'user-123');

      expect(prismaService.admissionCase.delete).toHaveBeenCalledWith({
        where: { id: 'case-123' },
      });
    });

    it('should throw NotFoundException when deleting non-owned case', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );

      await expect(service.delete('case-123', 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyCases', () => {
    it('should return all cases for user', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mockCase,
      ]);

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

  // ====== Phase 1.2: Admin methods ======

  describe('findAll (additional)', () => {
    it('should only show ANONYMOUS cases for unauthenticated users', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.admissionCase.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(
        { page: 1, pageSize: 20 },
        {},
        undefined,
        undefined,
      );

      expect(prismaService.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visibility: Visibility.ANONYMOUS,
          }),
        }),
      );
    });

    it('should build search OR conditions', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.admissionCase.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(
        { page: 1, pageSize: 20 },
        { search: 'MIT' },
        'admin-id',
        Role.ADMIN,
      );

      expect(prismaService.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                major: { contains: 'MIT', mode: 'insensitive' },
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('getAdminStats', () => {
    it('should return aggregated stats', async () => {
      (prismaService.admissionCase.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(10);

      const result = await service.getAdminStats();

      expect(result).toEqual({
        total: 100,
        withEssay: 40,
        verified: 30,
        pendingEssays: 10,
      });
      expect(prismaService.admissionCase.count).toHaveBeenCalledTimes(4);
    });
  });

  describe('getPendingEssays', () => {
    it('should return paginated pending essays', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mockCase,
      ]);
      (prismaService.admissionCase.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPendingEssays(1, 20);

      expect(result).toEqual({
        data: [mockCase],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });

    it('should apply correct pagination offset', async () => {
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.admissionCase.count as jest.Mock).mockResolvedValue(0);

      await service.getPendingEssays(3, 10);

      expect(prismaService.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });
  });

  describe('reviewCaseEssay', () => {
    it('should approve a case essay', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );
      (prismaService.admissionCase.update as jest.Mock).mockResolvedValue({
        ...mockCase,
        isVerified: true,
        verifiedAt: new Date(),
      });

      await service.reviewCaseEssay('case-123', {
        action: 'APPROVE',
      });

      expect(prismaService.admissionCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-123' },
          data: expect.objectContaining({
            isVerified: true,
            verifiedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should reject a case essay by setting visibility to PRIVATE', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );
      (prismaService.admissionCase.update as jest.Mock).mockResolvedValue({
        ...mockCase,
        visibility: Visibility.PRIVATE,
      });

      await service.reviewCaseEssay('case-123', {
        action: 'REJECT',
        reason: 'Inappropriate content',
      });

      expect(prismaService.admissionCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-123' },
          data: expect.objectContaining({
            visibility: Visibility.PRIVATE,
          }),
        }),
      );
    });

    it('should throw NotFoundException if case does not exist', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.reviewCaseEssay('nonexistent', { action: 'APPROVE' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('batchVerifyCases', () => {
    it('should batch approve multiple cases', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );
      (prismaService.admissionCase.update as jest.Mock).mockResolvedValue({
        ...mockCase,
        isVerified: true,
      });

      const result = await service.batchVerifyCases({
        ids: ['case-1', 'case-2'],
        action: 'APPROVE',
      });

      expect(result.success).toBe(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should capture failures in batch verify', async () => {
      (prismaService.admissionCase.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockCase)
        .mockResolvedValueOnce(null);
      (prismaService.admissionCase.update as jest.Mock).mockResolvedValue({
        ...mockCase,
        isVerified: true,
      });

      const result = await service.batchVerifyCases({
        ids: ['case-1', 'case-not-found'],
        action: 'APPROVE',
      });

      expect(result.success).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toHaveProperty('error');
    });
  });

  describe('batchImport', () => {
    const mockImportUser = {
      id: 'import-user-id',
      email: 'import@system.local',
    };
    const mockSchool = { id: 'school-mit', name: 'MIT', nameZh: 'MIT' };

    beforeEach(() => {
      // Mock user lookup/creation
      (prismaService as any).user = {
        findFirst: jest.fn().mockResolvedValue(mockImportUser),
        create: jest.fn().mockResolvedValue(mockImportUser),
      };
      // Mock school lookup
      (prismaService as any).school = {
        findFirst: jest.fn().mockResolvedValue(mockSchool),
      };
      // Mock $transaction to execute the callback directly
      (prismaService as any).$transaction = jest
        .fn()
        .mockImplementation(async (cb: any) => cb(prismaService));
      // Mock findMany for dedup check
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([]);
      // Mock create for each case
      (prismaService.admissionCase.create as jest.Mock).mockResolvedValue({
        ...mockCase,
        source: 'csv_import',
      });
    });

    it('should import valid cases successfully', async () => {
      const dto = {
        items: [
          { school: 'MIT', year: 2025, result: 'ADMITTED', major: 'CS' },
          { school: 'MIT', year: 2025, result: 'REJECTED', major: 'EE' },
        ],
      };

      const result = await service.batchImport(dto as any, 'admin-id');

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.importBatchId).toBeDefined();
    });

    it('should skip items with unresolved schools', async () => {
      (prismaService as any).school.findFirst = jest
        .fn()
        .mockResolvedValue(null);

      const dto = {
        items: [
          { school: 'Unknown University', year: 2025, result: 'ADMITTED' },
        ],
      };

      const result = await service.batchImport(dto as any, 'admin-id');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].message).toContain('School not found');
    });

    it('should return early if all schools fail to resolve', async () => {
      (prismaService as any).school.findFirst = jest
        .fn()
        .mockResolvedValue(null);

      const dto = {
        items: [
          { school: 'Unknown1', year: 2025, result: 'ADMITTED' },
          { school: 'Unknown2', year: 2025, result: 'REJECTED' },
        ],
      };

      const result = await service.batchImport(dto as any, 'admin-id');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(2);
      expect((prismaService as any).$transaction).not.toHaveBeenCalled();
    });

    it('should skip duplicate cases within the same batch', async () => {
      const dto = {
        items: [
          { school: 'MIT', year: 2025, result: 'ADMITTED', major: 'CS' },
          { school: 'MIT', year: 2025, result: 'ADMITTED', major: 'CS' }, // duplicate
        ],
      };

      const result = await service.batchImport(dto as any, 'admin-id');

      expect(result.imported).toBe(1);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Duplicate'),
          }),
        ]),
      );
    });

    it('should skip cases already in database', async () => {
      // Simulate existing case in DB
      (prismaService.admissionCase.findMany as jest.Mock).mockResolvedValue([
        { schoolId: 'school-mit', year: 2025, result: 'ADMITTED', major: 'CS' },
      ]);

      const dto = {
        items: [{ school: 'MIT', year: 2025, result: 'ADMITTED', major: 'CS' }],
      };

      const result = await service.batchImport(dto as any, 'admin-id');

      expect(result.imported).toBe(0);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Duplicate'),
          }),
        ]),
      );
    });

    it('should use PENDING_REVIEW when autoVerify is false', async () => {
      const dto = {
        items: [{ school: 'MIT', year: 2025, result: 'ADMITTED' }],
        autoVerify: false,
      };

      await service.batchImport(dto as any, 'admin-id');

      expect(prismaService.admissionCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewStatus: DataReviewStatus.PENDING_REVIEW,
            isVerified: false,
          }),
        }),
      );
    });
  });
});
