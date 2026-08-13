import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../../common/services/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PredictionHistoricalService } from '../prediction/prediction-historical.service';
import { AdminReviewService } from './admin-review.service';

describe('AdminReviewService', () => {
  let service: AdminReviewService;

  const mockPrisma: any = {
    dataImportStaging: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    admissionCase: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
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

  const mockNotification = {
    createNotification: jest.fn().mockResolvedValue(undefined),
  };

  const mockPredictionHistorical = {
    invalidateSchoolCache: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminReviewService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: NotificationService, useValue: mockNotification },
        {
          provide: PredictionHistoricalService,
          useValue: mockPredictionHistorical,
        },
      ],
    }).compile();

    service = module.get<AdminReviewService>(AdminReviewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReviewQueue', () => {
    it('should return paginated staging items', async () => {
      mockPrisma.dataImportStaging.findMany.mockResolvedValue([
        { id: 'item-1' },
      ]);
      mockPrisma.dataImportStaging.count.mockResolvedValue(1);

      const result = await service.getReviewQueue({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('approvePendingCase', () => {
    it('should approve a pending case', async () => {
      mockPrisma.admissionCase.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.admissionCase.findUnique.mockResolvedValue({
        userId: 'user-1',
        schoolId: 'school-1',
      });

      await service.approvePendingCase('case-1', 'reviewer-1');

      expect(mockPrisma.admissionCase.updateMany).toHaveBeenCalled();
      expect(mockAuditLog.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException when case not found', async () => {
      mockPrisma.admissionCase.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.admissionCase.findUnique.mockResolvedValue(null);

      await expect(
        service.approvePendingCase('nonexistent', 'reviewer-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when already reviewed', async () => {
      mockPrisma.admissionCase.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.admissionCase.findUnique.mockResolvedValue({
        id: 'case-1',
        reviewStatus: 'APPROVED',
      });

      await expect(
        service.approvePendingCase('case-1', 'reviewer-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getReviewStats', () => {
    it('should return aggregate review stats', async () => {
      mockPrisma.dataImportStaging.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(10);
      mockPrisma.admissionCase.count.mockResolvedValue(8);

      const result = await service.getReviewStats();

      expect(result.pendingStaging).toBe(5);
      expect(result.pendingCases).toBe(8);
      expect(result.totalPending).toBe(13);
    });
  });
});
