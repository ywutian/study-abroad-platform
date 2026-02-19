import { Test, TestingModule } from '@nestjs/testing';
import { EssayPromptService } from './essay-prompt.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EssayStatus } from '@prisma/client';
import { resolveSchoolId } from '../../common/utils/import-normalizers';

jest.mock('../../common/utils/import-normalizers', () => ({
  resolveSchoolId: jest.fn(),
}));

const mockResolveSchoolId = resolveSchoolId as jest.MockedFunction<
  typeof resolveSchoolId
>;

describe('EssayPromptService', () => {
  let service: EssayPromptService;
  let prisma: PrismaService;

  const mockSchool = {
    id: 'school-1',
    name: 'Harvard University',
    nameZh: '哈佛大学',
    usNewsRank: 3,
  };

  const mockEssayPrompt = {
    id: 'ep-1',
    schoolId: 'school-1',
    year: 2025,
    type: 'SUPPLEMENTAL',
    prompt: 'Why Harvard?',
    promptZh: '为什么选择哈佛？',
    wordLimit: 250,
    isRequired: true,
    sortOrder: 0,
    status: EssayStatus.PENDING,
    isActive: true,
    verifiedBy: null,
    verifiedAt: null,
    rejectReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    school: { id: 'school-1', name: 'Harvard University', nameZh: '哈佛大学' },
    sources: [],
    auditLogs: [],
  };

  const mockAuditLog = {
    id: 'audit-1',
    essayPromptId: 'ep-1',
    action: 'CREATE',
    fromStatus: null,
    toStatus: EssayStatus.PENDING,
    operatorId: 'admin-1',
    operatorType: 'ADMIN',
    changes: null,
    reason: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayPromptService,
        {
          provide: PrismaService,
          useValue: {
            school: {
              findUnique: jest.fn(),
            },
            essayPrompt: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
              groupBy: jest.fn(),
            },
            essayPromptAudit: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EssayPromptService>(EssayPromptService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // create
  // ==========================================

  describe('create', () => {
    it('should create essay prompt with source', async () => {
      (prisma.school.findUnique as jest.Mock).mockResolvedValue(mockSchool);
      (prisma.essayPrompt.create as jest.Mock).mockResolvedValue({
        ...mockEssayPrompt,
        sources: [
          { sourceType: 'OFFICIAL', sourceUrl: 'https://harvard.edu/essays' },
        ],
      });
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const dto = {
        schoolId: 'school-1',
        year: 2025,
        type: 'SUPPLEMENTAL' as any,
        prompt: 'Why Harvard?',
        promptZh: '为什么选择哈佛？',
        wordLimit: 250,
        sourceType: 'OFFICIAL' as any,
        sourceUrl: 'https://harvard.edu/essays',
      };

      const result = await service.create(dto, 'admin-1');

      expect(result.id).toBe('ep-1');
      expect(prisma.school.findUnique).toHaveBeenCalledWith({
        where: { id: 'school-1' },
      });
      expect(prisma.essayPrompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: 'school-1',
            sources: {
              create: {
                sourceType: 'OFFICIAL',
                sourceUrl: 'https://harvard.edu/essays',
              },
            },
          }),
        }),
      );
      expect(prisma.essayPromptAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          essayPromptId: 'ep-1',
          action: 'CREATE',
          fromStatus: null,
          toStatus: EssayStatus.PENDING,
          operatorId: 'admin-1',
          operatorType: 'ADMIN',
        }),
      });
    });

    it('should create essay prompt without source', async () => {
      (prisma.school.findUnique as jest.Mock).mockResolvedValue(mockSchool);
      (prisma.essayPrompt.create as jest.Mock).mockResolvedValue(
        mockEssayPrompt,
      );
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const dto = {
        schoolId: 'school-1',
        year: 2025,
        type: 'SUPPLEMENTAL' as any,
        prompt: 'Why Harvard?',
      };

      const result = await service.create(dto, 'admin-1');

      expect(result.id).toBe('ep-1');
      expect(prisma.essayPrompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: 'school-1',
            sources: undefined,
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent school', async () => {
      (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);

      const dto = {
        schoolId: 'nonexistent',
        year: 2025,
        type: 'SUPPLEMENTAL' as any,
        prompt: 'Why School?',
      };

      await expect(service.create(dto, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.essayPrompt.create).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // findAll
  // ==========================================

  describe('findAll', () => {
    it('should return paginated results with default params', async () => {
      (prisma.essayPrompt.findMany as jest.Mock).mockResolvedValue([
        mockEssayPrompt,
      ]);
      (prisma.essayPrompt.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toEqual({
        data: [mockEssayPrompt],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      expect(prisma.essayPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should apply search filter with OR conditions', async () => {
      (prisma.essayPrompt.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.essayPrompt.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ search: 'Harvard' });

      expect(prisma.essayPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              { prompt: { contains: 'Harvard', mode: 'insensitive' } },
              { promptZh: { contains: 'Harvard', mode: 'insensitive' } },
              {
                school: {
                  name: { contains: 'Harvard', mode: 'insensitive' },
                },
              },
              {
                school: {
                  nameZh: { contains: 'Harvard', mode: 'insensitive' },
                },
              },
            ]),
          }),
        }),
      );
    });

    it('should apply schoolId, year, type, and status filters', async () => {
      (prisma.essayPrompt.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.essayPrompt.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({
        schoolId: 'school-1',
        year: 2025,
        type: 'SUPPLEMENTAL' as any,
        status: EssayStatus.VERIFIED as any,
        page: 2,
        pageSize: 10,
      });

      expect(prisma.essayPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            schoolId: 'school-1',
            year: 2025,
            type: 'SUPPLEMENTAL',
            status: EssayStatus.VERIFIED,
          }),
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  // ==========================================
  // findOne
  // ==========================================

  describe('findOne', () => {
    it('should return essay prompt when found', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(
        mockEssayPrompt,
      );

      const result = await service.findOne('ep-1');

      expect(result.id).toBe('ep-1');
      expect(prisma.essayPrompt.findUnique).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        include: {
          school: {
            select: {
              id: true,
              name: true,
              nameZh: true,
              usNewsRank: true,
            },
          },
          sources: true,
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================================
  // findBySchool
  // ==========================================

  describe('findBySchool', () => {
    it('should return verified prompts for a school', async () => {
      const verifiedPrompt = {
        ...mockEssayPrompt,
        status: EssayStatus.VERIFIED,
      };
      (prisma.essayPrompt.findMany as jest.Mock).mockResolvedValue([
        verifiedPrompt,
      ]);

      const result = await service.findBySchool('school-1');

      expect(result).toHaveLength(1);
      expect(prisma.essayPrompt.findMany).toHaveBeenCalledWith({
        where: {
          schoolId: 'school-1',
          isActive: true,
          status: EssayStatus.VERIFIED,
        },
        orderBy: [{ sortOrder: 'asc' }, { type: 'asc' }],
      });
    });

    it('should filter by year when provided', async () => {
      (prisma.essayPrompt.findMany as jest.Mock).mockResolvedValue([]);

      await service.findBySchool('school-1', 2025);

      expect(prisma.essayPrompt.findMany).toHaveBeenCalledWith({
        where: {
          schoolId: 'school-1',
          isActive: true,
          status: EssayStatus.VERIFIED,
          year: 2025,
        },
        orderBy: [{ sortOrder: 'asc' }, { type: 'asc' }],
      });
    });
  });

  // ==========================================
  // update
  // ==========================================

  describe('update', () => {
    it('should update prompt and create audit log', async () => {
      // findOne is called internally
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(
        mockEssayPrompt,
      );
      const updatedPrompt = {
        ...mockEssayPrompt,
        prompt: 'Updated prompt text',
        school: {
          id: 'school-1',
          name: 'Harvard University',
          nameZh: '哈佛大学',
        },
        sources: [],
      };
      (prisma.essayPrompt.update as jest.Mock).mockResolvedValue(updatedPrompt);
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const dto = { prompt: 'Updated prompt text' };
      const result = await service.update('ep-1', dto, 'admin-1');

      expect(result.prompt).toBe('Updated prompt text');
      expect(prisma.essayPrompt.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: dto,
        include: {
          school: { select: { id: true, name: true, nameZh: true } },
          sources: true,
        },
      });
      expect(prisma.essayPromptAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          essayPromptId: 'ep-1',
          action: 'UPDATE',
          fromStatus: EssayStatus.PENDING,
          toStatus: EssayStatus.PENDING,
          operatorId: 'admin-1',
          operatorType: 'ADMIN',
          changes: dto,
        }),
      });
    });

    it('should throw NotFoundException when updating non-existent prompt', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { prompt: 'test' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.essayPrompt.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // verify
  // ==========================================

  describe('verify', () => {
    it('should verify prompt successfully', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(
        mockEssayPrompt,
      );
      const verifiedPrompt = {
        ...mockEssayPrompt,
        status: EssayStatus.VERIFIED,
        verifiedBy: 'admin-1',
        verifiedAt: new Date(),
        school: {
          id: 'school-1',
          name: 'Harvard University',
          nameZh: '哈佛大学',
        },
      };
      (prisma.essayPrompt.update as jest.Mock).mockResolvedValue(
        verifiedPrompt,
      );
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const dto = { status: EssayStatus.VERIFIED as any };
      const result = await service.verify('ep-1', dto, 'admin-1');

      expect(result.status).toBe(EssayStatus.VERIFIED);
      expect(prisma.essayPrompt.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: expect.objectContaining({
          status: EssayStatus.VERIFIED,
          verifiedBy: 'admin-1',
          verifiedAt: expect.any(Date),
          rejectReason: null,
        }),
        include: {
          school: { select: { id: true, name: true, nameZh: true } },
        },
      });
      expect(prisma.essayPromptAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'VERIFY',
          fromStatus: EssayStatus.PENDING,
          toStatus: EssayStatus.VERIFIED,
        }),
      });
    });

    it('should reject prompt with reason', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(
        mockEssayPrompt,
      );
      const rejectedPrompt = {
        ...mockEssayPrompt,
        status: EssayStatus.REJECTED,
        rejectReason: 'Inaccurate prompt text',
        school: {
          id: 'school-1',
          name: 'Harvard University',
          nameZh: '哈佛大学',
        },
      };
      (prisma.essayPrompt.update as jest.Mock).mockResolvedValue(
        rejectedPrompt,
      );
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const dto = {
        status: EssayStatus.REJECTED as any,
        reason: 'Inaccurate prompt text',
      };
      const result = await service.verify('ep-1', dto, 'admin-1');

      expect(result.status).toBe(EssayStatus.REJECTED);
      expect(prisma.essayPrompt.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: expect.objectContaining({
          status: EssayStatus.REJECTED,
          rejectReason: 'Inaccurate prompt text',
        }),
        include: {
          school: { select: { id: true, name: true, nameZh: true } },
        },
      });
      expect(prisma.essayPromptAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'REJECT',
          fromStatus: EssayStatus.PENDING,
          toStatus: EssayStatus.REJECTED,
          reason: 'Inaccurate prompt text',
        }),
      });
    });

    it('should throw BadRequestException when rejecting without reason', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(
        mockEssayPrompt,
      );

      const dto = { status: EssayStatus.REJECTED as any };

      await expect(service.verify('ep-1', dto, 'admin-1')).rejects.toThrow(
        BadRequestException,
      );

      expect(prisma.essayPrompt.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when verifying non-existent prompt', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(null);

      const dto = { status: EssayStatus.VERIFIED as any };

      await expect(
        service.verify('nonexistent', dto, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  // batchVerify
  // ==========================================

  describe('batchVerify', () => {
    it('should process multiple prompts successfully', async () => {
      const mockPrompt2 = { ...mockEssayPrompt, id: 'ep-2' };

      // findOne calls findUnique; each verify calls findOne then update
      (prisma.essayPrompt.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockEssayPrompt) // findOne for ep-1
        .mockResolvedValueOnce(mockPrompt2); // findOne for ep-2

      (prisma.essayPrompt.update as jest.Mock).mockResolvedValue({
        ...mockEssayPrompt,
        status: EssayStatus.VERIFIED,
        school: {
          id: 'school-1',
          name: 'Harvard University',
          nameZh: '哈佛大学',
        },
      });
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const result = await service.batchVerify(
        ['ep-1', 'ep-2'],
        EssayStatus.VERIFIED,
        'admin-1',
      );

      expect(result.success).toBe(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should capture failures in batch verify', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockEssayPrompt) // ep-1 found
        .mockResolvedValueOnce(null); // ep-2 not found

      (prisma.essayPrompt.update as jest.Mock).mockResolvedValue({
        ...mockEssayPrompt,
        status: EssayStatus.VERIFIED,
        school: {
          id: 'school-1',
          name: 'Harvard University',
          nameZh: '哈佛大学',
        },
      });
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const result = await service.batchVerify(
        ['ep-1', 'ep-2'],
        EssayStatus.VERIFIED,
        'admin-1',
      );

      expect(result.success).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toHaveProperty('error');
    });

    it('should pass reason through when batch rejecting', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(
        mockEssayPrompt,
      );
      (prisma.essayPrompt.update as jest.Mock).mockResolvedValue({
        ...mockEssayPrompt,
        status: EssayStatus.REJECTED,
        school: {
          id: 'school-1',
          name: 'Harvard University',
          nameZh: '哈佛大学',
        },
      });
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const result = await service.batchVerify(
        ['ep-1'],
        EssayStatus.REJECTED,
        'admin-1',
        'Outdated prompts',
      );

      expect(result.success).toBe(1);
      expect(prisma.essayPrompt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EssayStatus.REJECTED,
            rejectReason: 'Outdated prompts',
          }),
        }),
      );
    });
  });

  // ==========================================
  // remove
  // ==========================================

  describe('remove', () => {
    it('should soft delete prompt and create audit log', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(
        mockEssayPrompt,
      );
      (prisma.essayPrompt.update as jest.Mock).mockResolvedValue({
        ...mockEssayPrompt,
        isActive: false,
      });
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const result = await service.remove('ep-1', 'admin-1');

      expect(result).toEqual({ message: '删除成功' });
      expect(prisma.essayPrompt.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: { isActive: false },
      });
      expect(prisma.essayPromptAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          essayPromptId: 'ep-1',
          action: 'ARCHIVE',
          fromStatus: EssayStatus.PENDING,
          toStatus: null,
          operatorId: 'admin-1',
        }),
      });
    });

    it('should throw NotFoundException when removing non-existent prompt', async () => {
      (prisma.essayPrompt.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.essayPrompt.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // getStats
  // ==========================================

  describe('getStats', () => {
    it('should return correct counts by status and type', async () => {
      (prisma.essayPrompt.count as jest.Mock)
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(50) // verified
        .mockResolvedValueOnce(5) // rejected
        .mockResolvedValueOnce(65); // total

      (prisma.essayPrompt.groupBy as jest.Mock).mockResolvedValue([
        { type: 'SUPPLEMENTAL', _count: 30 },
        { type: 'WHY_SCHOOL', _count: 15 },
        { type: 'SHORT_ANSWER', _count: 5 },
      ]);

      const result = await service.getStats();

      expect(result).toEqual({
        pending: 10,
        verified: 50,
        rejected: 5,
        total: 65,
        byType: {
          SUPPLEMENTAL: 30,
          WHY_SCHOOL: 15,
          SHORT_ANSWER: 5,
        },
      });
      expect(prisma.essayPrompt.count).toHaveBeenCalledTimes(4);
      expect(prisma.essayPrompt.groupBy).toHaveBeenCalledTimes(1);
    });

    it('should filter by year when provided', async () => {
      (prisma.essayPrompt.count as jest.Mock)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(27);
      (prisma.essayPrompt.groupBy as jest.Mock).mockResolvedValue([]);

      await service.getStats(2025);

      expect(prisma.essayPrompt.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isActive: true,
          year: 2025,
          status: EssayStatus.PENDING,
        }),
      });
    });

    it('should return empty byType when no verified prompts exist', async () => {
      (prisma.essayPrompt.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      (prisma.essayPrompt.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.byType).toEqual({});
      expect(result.total).toBe(0);
    });
  });

  // ==========================================
  // batchImport
  // ==========================================

  describe('batchImport', () => {
    it('should import items successfully', async () => {
      mockResolveSchoolId.mockResolvedValue({
        id: 'school-1',
        name: 'Harvard University',
      });
      // No duplicate found
      (prisma.essayPrompt.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.essayPrompt.create as jest.Mock).mockResolvedValue({
        ...mockEssayPrompt,
        id: 'ep-new',
      });
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const dto = {
        items: [
          {
            school: 'Harvard',
            year: 2025,
            type: 'SUPPLEMENTAL' as any,
            prompt: 'Why Harvard?',
          },
        ],
        autoVerify: false,
      };

      const result = await service.batchImport(dto, 'admin-1');

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(prisma.essayPrompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: 'school-1',
            year: 2025,
            type: 'SUPPLEMENTAL',
            prompt: 'Why Harvard?',
            status: EssayStatus.PENDING,
          }),
        }),
      );
    });

    it('should skip items when school is not found', async () => {
      mockResolveSchoolId.mockResolvedValue(null);

      const dto = {
        items: [
          {
            school: 'Unknown University',
            year: 2025,
            type: 'SUPPLEMENTAL' as any,
            prompt: 'Some prompt',
          },
        ],
        autoVerify: false,
      };

      const result = await service.batchImport(dto, 'admin-1');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          row: 1,
          school: 'Unknown University',
        }),
      );
    });

    it('should skip duplicate items', async () => {
      mockResolveSchoolId.mockResolvedValue({
        id: 'school-1',
        name: 'Harvard University',
      });
      // Duplicate found
      (prisma.essayPrompt.findFirst as jest.Mock).mockResolvedValue(
        mockEssayPrompt,
      );

      const dto = {
        items: [
          {
            school: 'Harvard',
            year: 2025,
            type: 'SUPPLEMENTAL' as any,
            prompt: 'Why Harvard?',
          },
        ],
        autoVerify: false,
      };

      const result = await service.batchImport(dto, 'admin-1');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].message).toContain('重复');
      expect(prisma.essayPrompt.create).not.toHaveBeenCalled();
    });

    it('should auto-verify when autoVerify is true', async () => {
      mockResolveSchoolId.mockResolvedValue({
        id: 'school-1',
        name: 'Harvard University',
      });
      (prisma.essayPrompt.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.essayPrompt.create as jest.Mock).mockResolvedValue({
        ...mockEssayPrompt,
        id: 'ep-new',
        status: EssayStatus.VERIFIED,
      });
      (prisma.essayPromptAudit.create as jest.Mock).mockResolvedValue(
        mockAuditLog,
      );

      const dto = {
        items: [
          {
            school: 'Harvard',
            year: 2025,
            type: 'SUPPLEMENTAL' as any,
            prompt: 'Why Harvard?',
          },
        ],
        autoVerify: true,
      };

      const result = await service.batchImport(dto, 'admin-1');

      expect(result.imported).toBe(1);
      expect(prisma.essayPrompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EssayStatus.VERIFIED,
            verifiedBy: 'admin-1',
            verifiedAt: expect.any(Date),
          }),
        }),
      );
    });
  });
});
