import { Test, TestingModule } from '@nestjs/testing';
import { VerificationService } from './verification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { CaseIncentiveService } from '../points/incentive.service';
import { NotificationService } from '../notification/notification.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { VerificationStatus, Role } from '@prisma/client';
import { ReviewAction } from './dto/review-verification.dto';

describe('VerificationService', () => {
  let service: VerificationService;
  let prisma: PrismaService;
  let storage: StorageService;
  let caseIncentive: CaseIncentiveService;

  const mockCase = {
    id: 'case-1',
    userId: 'user-1',
    isVerified: false,
    schoolId: 'school-1',
  };

  const mockVerificationRequest = {
    id: 'vr-1',
    userId: 'user-1',
    caseId: 'case-1',
    proofType: 'OFFER_LETTER',
    proofData: null,
    proofUrl: 'https://storage.example.com/proof.pdf',
    status: VerificationStatus.PENDING,
    reviewerId: null,
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date(),
    case: { ...mockCase, school: { id: 'school-1', name: 'MIT' } },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: PrismaService,
          useValue: {
            admissionCase: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            verificationRequest: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            user: {
              update: jest.fn(),
            },
            $transaction: jest.fn((fn) =>
              fn({
                verificationRequest: {
                  update: jest.fn().mockResolvedValue(mockVerificationRequest),
                },
                admissionCase: { update: jest.fn() },
                user: { update: jest.fn() },
              }),
            ),
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadVerificationFile: jest.fn().mockResolvedValue({
              url: 'https://storage.example.com/proof.pdf',
              key: 'verification/user-1/abc123.pdf',
            }),
          },
        },
        {
          provide: CaseIncentiveService,
          useValue: {
            reward: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationService,
          useValue: { createNotification: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get<StorageService>(StorageService);
    caseIncentive = module.get<CaseIncentiveService>(CaseIncentiveService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadProofFile', () => {
    const mockFile = {
      originalname: 'proof.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.alloc(1024),
      size: 1024,
    };

    it('should upload a valid file successfully', async () => {
      const result = await service.uploadProofFile('user-1', mockFile as any);

      expect(result.url).toBeDefined();
      expect(result.key).toBeDefined();
      expect(storage.uploadVerificationFile).toHaveBeenCalledWith(
        'user-1',
        mockFile,
      );
    });

    it('should accept JPEG files', async () => {
      const jpegFile = { ...mockFile, mimetype: 'image/jpeg' };
      await expect(
        service.uploadProofFile('user-1', jpegFile as any),
      ).resolves.toBeDefined();
    });

    it('should accept PNG files', async () => {
      const pngFile = { ...mockFile, mimetype: 'image/png' };
      await expect(
        service.uploadProofFile('user-1', pngFile as any),
      ).resolves.toBeDefined();
    });

    it('should accept WebP files', async () => {
      const webpFile = { ...mockFile, mimetype: 'image/webp' };
      await expect(
        service.uploadProofFile('user-1', webpFile as any),
      ).resolves.toBeDefined();
    });

    it('should reject unsupported file types', async () => {
      const badFile = { ...mockFile, mimetype: 'application/zip' };
      await expect(
        service.uploadProofFile('user-1', badFile as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files larger than 10MB', async () => {
      const largeFile = {
        ...mockFile,
        buffer: Buffer.alloc(11 * 1024 * 1024),
      };
      await expect(
        service.uploadProofFile('user-1', largeFile as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitVerification', () => {
    const dto = {
      caseId: 'case-1',
      proofType: 'OFFER_LETTER' as any,
      proofUrl: 'https://storage.example.com/proof.pdf',
    };

    it('should submit verification successfully', async () => {
      (prisma.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );
      (prisma.verificationRequest.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.verificationRequest.create as jest.Mock).mockResolvedValue(
        mockVerificationRequest,
      );

      const result = await service.submitVerification('user-1', dto);
      expect(result).toBeDefined();
      expect(prisma.verificationRequest.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if case does not exist', async () => {
      (prisma.admissionCase.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.submitVerification('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if case belongs to another user', async () => {
      (prisma.admissionCase.findUnique as jest.Mock).mockResolvedValue({
        ...mockCase,
        userId: 'other-user',
      });

      await expect(service.submitVerification('user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if case is already verified', async () => {
      (prisma.admissionCase.findUnique as jest.Mock).mockResolvedValue({
        ...mockCase,
        isVerified: true,
      });

      await expect(service.submitVerification('user-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if a pending request exists', async () => {
      (prisma.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );
      (prisma.verificationRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-vr',
      });

      await expect(service.submitVerification('user-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if no proof material provided', async () => {
      (prisma.admissionCase.findUnique as jest.Mock).mockResolvedValue(
        mockCase,
      );
      (prisma.verificationRequest.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.submitVerification('user-1', {
          caseId: 'case-1',
          proofType: 'OFFER_LETTER' as any,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyVerifications', () => {
    it('should return user verification requests', async () => {
      (prisma.verificationRequest.findMany as jest.Mock).mockResolvedValue([
        mockVerificationRequest,
      ]);

      const result = await service.getMyVerifications('user-1');
      expect(result).toHaveLength(1);
      expect(prisma.verificationRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('getPendingVerifications', () => {
    it('should return paginated pending verifications', async () => {
      (prisma.verificationRequest.findMany as jest.Mock).mockResolvedValue([
        mockVerificationRequest,
      ]);
      (prisma.verificationRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPendingVerifications(1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should calculate totalPages correctly', async () => {
      (prisma.verificationRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.verificationRequest.count as jest.Mock).mockResolvedValue(45);

      const result = await service.getPendingVerifications(1, 20);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('reviewVerification', () => {
    it('should approve verification and update case + user in transaction', async () => {
      const pendingRequest = {
        ...mockVerificationRequest,
        status: VerificationStatus.PENDING,
      };
      (prisma.verificationRequest.findUnique as jest.Mock).mockResolvedValue(
        pendingRequest,
      );

      const txMock = {
        verificationRequest: {
          update: jest.fn().mockResolvedValue({
            ...pendingRequest,
            status: VerificationStatus.APPROVED,
          }),
        },
        admissionCase: { update: jest.fn() },
        user: { update: jest.fn() },
      };
      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(txMock));

      const _result = await service.reviewVerification('vr-1', 'admin-1', {
        action: ReviewAction.APPROVE,
      });

      expect(txMock.admissionCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: expect.objectContaining({ isVerified: true }),
        }),
      );
      expect(txMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { role: Role.VERIFIED },
        }),
      );
      expect(caseIncentive.reward).toHaveBeenCalled();
    });

    it('should reject verification without updating case or user', async () => {
      const pendingRequest = {
        ...mockVerificationRequest,
        status: VerificationStatus.PENDING,
      };
      (prisma.verificationRequest.findUnique as jest.Mock).mockResolvedValue(
        pendingRequest,
      );

      const txMock = {
        verificationRequest: {
          update: jest.fn().mockResolvedValue({
            ...pendingRequest,
            status: VerificationStatus.REJECTED,
          }),
        },
        admissionCase: { update: jest.fn() },
        user: { update: jest.fn() },
      };
      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(txMock));

      await service.reviewVerification('vr-1', 'admin-1', {
        action: ReviewAction.REJECT,
      });

      expect(txMock.admissionCase.update).not.toHaveBeenCalled();
      expect(txMock.user.update).not.toHaveBeenCalled();
      expect(caseIncentive.reward).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if request does not exist', async () => {
      (prisma.verificationRequest.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.reviewVerification('vr-999', 'admin-1', {
          action: ReviewAction.APPROVE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if request already processed', async () => {
      (prisma.verificationRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockVerificationRequest,
        status: VerificationStatus.APPROVED,
      });

      await expect(
        service.reviewVerification('vr-1', 'admin-1', {
          action: ReviewAction.APPROVE,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should not fail if reward points throws', async () => {
      const pendingRequest = {
        ...mockVerificationRequest,
        status: VerificationStatus.PENDING,
      };
      (prisma.verificationRequest.findUnique as jest.Mock).mockResolvedValue(
        pendingRequest,
      );

      const txMock = {
        verificationRequest: {
          update: jest.fn().mockResolvedValue({
            ...pendingRequest,
            status: VerificationStatus.APPROVED,
          }),
        },
        admissionCase: { update: jest.fn() },
        user: { update: jest.fn() },
      };
      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(txMock));
      (caseIncentive.reward as jest.Mock).mockRejectedValue(
        new Error('Points error'),
      );

      // Should not throw — points error is caught
      await expect(
        service.reviewVerification('vr-1', 'admin-1', {
          action: ReviewAction.APPROVE,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('getVerificationDetail', () => {
    it('should return verification detail with user and case info', async () => {
      (prisma.verificationRequest.findUnique as jest.Mock).mockResolvedValue(
        mockVerificationRequest,
      );

      const result = await service.getVerificationDetail('vr-1');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.verificationRequest.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.getVerificationDetail('vr-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getVerificationStats', () => {
    it('should return aggregated stats', async () => {
      (prisma.verificationRequest.count as jest.Mock)
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(20) // approved
        .mockResolvedValueOnce(3) // rejected
        .mockResolvedValueOnce(28); // total

      const result = await service.getVerificationStats();

      expect(result).toEqual({
        pending: 5,
        approved: 20,
        rejected: 3,
        total: 28,
      });
    });
  });
});
