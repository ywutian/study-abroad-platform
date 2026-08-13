import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../common/redis/redis.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseBatchService } from './case-batch.service';

describe('CaseBatchService', () => {
  let service: CaseBatchService;

  const mockPrisma: any = {
    admissionCase: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    school: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((cb: any) =>
      typeof cb === 'function' ? cb(mockPrisma) : Promise.resolve(cb),
    ),
  };

  const mockAuditLog = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseBatchService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<CaseBatchService>(CaseBatchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reviewCaseEssay', () => {
    it('should approve a case essay', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue({ id: 'case-1' });
      mockPrisma.admissionCase.update.mockResolvedValue({
        id: 'case-1',
        isVerified: true,
      });

      const result = await service.reviewCaseEssay('case-1', {
        action: 'APPROVE',
      });

      expect(result.isVerified).toBe(true);
    });

    it('should reject a case essay', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue({ id: 'case-1' });
      mockPrisma.admissionCase.update.mockResolvedValue({
        id: 'case-1',
        visibility: 'PRIVATE',
      });

      const result = await service.reviewCaseEssay('case-1', {
        action: 'REJECT',
        reason: 'Low quality',
      });

      expect(result.visibility).toBe('PRIVATE');
    });

    it('should throw NotFoundException when case not found', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewCaseEssay('nonexistent', { action: 'APPROVE' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPendingEssays', () => {
    it('should return paginated pending essays', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([{ id: 'c1' }]);
      mockPrisma.admissionCase.count.mockResolvedValue(1);

      const result = await service.getPendingEssays(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getImportProgress', () => {
    it('should return not_found when no progress data', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getImportProgress('batch-1');

      expect(result.status).toBe('not_found');
    });

    it('should return progress data from Redis', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ processed: 50, total: 100 }),
      );

      const result = await service.getImportProgress('batch-1');

      expect(result.status).toBe('in_progress');
    });
  });
});
