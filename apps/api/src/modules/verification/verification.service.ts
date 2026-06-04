import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  StorageService,
  StorageFile,
} from '../../common/storage/storage.service';
import { VerificationStatus, Role, DataReviewStatus } from '@prisma/client';
import { CreateVerificationDto } from './dto/create-verification.dto';
import {
  ReviewVerificationDto,
  ReviewAction,
} from './dto/review-verification.dto';
import { PointsService, PointAction } from '../points/incentive.service';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';
import { fireAndForget } from '../../common/utils/async.util';
import { ERR } from '../../common/constants/error-messages';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private pointsService: PointsService,
    private notificationService: NotificationService,
  ) {}

  /**
   * 上传验证材料文件
   *
   * 安全特性：
   * - 文件存储到云端（S3）或本地（开发环境）
   * - 文件名使用随机哈希，防止路径遍历攻击
   * - 支持的文件类型：图片、PDF
   */
  async uploadProofFile(
    userId: string,
    file: StorageFile,
  ): Promise<{ url: string; key: string }> {
    // 验证文件类型
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(ERR.BAD_REQUEST.unsupportedFileType());
    }

    // 验证文件大小（最大 10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.buffer.length > maxSize) {
      throw new BadRequestException(ERR.BAD_REQUEST.fileTooLarge());
    }

    const result = await this.storage.uploadVerificationFile(userId, file);
    this.logger.log(
      `Verification file uploaded: ${result.key} for user ${userId}`,
    );

    return { url: result.url, key: result.key };
  }

  /**
   * 提交认证申请
   */
  async submitVerification(userId: string, dto: CreateVerificationDto) {
    // 验证案例存在且属于该用户
    const admissionCase = await this.prisma.admissionCase.findUnique({
      where: { id: dto.caseId },
    });

    if (!admissionCase) {
      throw new NotFoundException(ERR.NOT_FOUND.case());
    }

    if (admissionCase.userId !== userId) {
      throw new ForbiddenException(ERR.FORBIDDEN.selfOnly());
    }

    if (admissionCase.isVerified) {
      throw new ConflictException(ERR.CONFLICT.alreadyVerified());
    }

    // 检查是否有待处理的认证请求
    const pendingRequest = await this.prisma.verificationRequest.findFirst({
      where: {
        caseId: dto.caseId,
        status: VerificationStatus.PENDING,
      },
    });

    if (pendingRequest) {
      throw new ConflictException(ERR.CONFLICT.pendingVerification());
    }

    // 验证必须提供证明材料
    if (!dto.proofData && !dto.proofUrl) {
      throw new BadRequestException(ERR.BAD_REQUEST.uploadProof());
    }

    // 创建认证请求
    return this.prisma.verificationRequest.create({
      data: {
        userId,
        caseId: dto.caseId,
        proofType: dto.proofType,
        proofData: dto.proofData,
        proofUrl: dto.proofUrl,
        status: VerificationStatus.PENDING,
      },
      include: {
        case: {
          include: {
            school: true,
          },
        },
      },
    });
  }

  /**
   * 获取用户的认证请求
   */
  async getMyVerifications(userId: string) {
    return this.prisma.verificationRequest.findMany({
      where: { userId },
      include: {
        case: {
          include: {
            school: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lightweight verification status for the current user (mobile profile pills).
   * `emailVerified` comes from the User record; `identityVerified` is true when
   * the user has at least one APPROVED verification request.
   */
  async getVerificationStatus(userId: string) {
    const [user, approvedCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerified: true },
      }),
      this.prisma.verificationRequest.count({
        where: { userId, status: VerificationStatus.APPROVED },
      }),
    ]);

    return {
      emailVerified: user?.emailVerified ?? false,
      identityVerified: approvedCount > 0,
    };
  }

  /**
   * 获取待审核的认证请求（管理员）
   */
  async getPendingVerifications(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.verificationRequest.findMany({
        where: { status: VerificationStatus.PENDING },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          case: {
            include: {
              school: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.verificationRequest.count({
        where: { status: VerificationStatus.PENDING },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 审核认证请求（管理员）
   */
  async reviewVerification(
    requestId: string,
    reviewerId: string,
    dto: ReviewVerificationDto,
  ) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      include: { case: true },
    });

    if (!request) {
      throw new NotFoundException(ERR.NOT_FOUND.verification());
    }

    if (request.status !== VerificationStatus.PENDING) {
      throw new ConflictException(ERR.CONFLICT.alreadyProcessed());
    }

    const isApproved = dto.action === ReviewAction.APPROVE;
    const newStatus = isApproved
      ? VerificationStatus.APPROVED
      : VerificationStatus.REJECTED;

    // 使用事务更新
    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      // 更新认证请求
      const updated = await tx.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          reviewerId,
          reviewNote: dto.note,
          reviewedAt: new Date(),
        },
      });

      // 如果通过，更新案例和用户状态
      if (isApproved) {
        // 更新案例认证状态
        await tx.admissionCase.update({
          where: { id: request.caseId },
          data: {
            isVerified: true,
            verifiedAt: new Date(),
            reviewStatus: DataReviewStatus.APPROVED,
          },
        });

        // 更新用户角色为 VERIFIED
        await tx.user.update({
          where: { id: request.userId },
          data: { role: Role.VERIFIED },
        });
      }

      return updated;
    });

    // 通知用户审核结果
    fireAndForget(
      this.notificationService.createNotification(
        request.userId,
        isApproved
          ? NotificationType.VERIFICATION_APPROVED
          : NotificationType.VERIFICATION_REJECTED,
        {
          relatedId: request.caseId,
          relatedType: 'admission_case',
        },
      ),
      this.logger,
      'Failed to send verification notification',
    );

    // 奖励积分 (outside transaction, handled by centralized service)
    if (dto.action === ReviewAction.APPROVE) {
      await this.pointsService
        .reward(request.userId, PointAction.VERIFICATION_APPROVED, {
          caseId: request.caseId,
        })
        .catch((err) => {
          this.logger.error('Failed to award verification points', err);
        });
    }

    return updatedRequest;
  }

  /**
   * 获取认证详情（管理员）
   */
  async getVerificationDetail(requestId: string) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: {
                realName: true,
                currentSchool: true,
              },
            },
          },
        },
        case: {
          include: {
            school: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(ERR.NOT_FOUND.verification());
    }

    return request;
  }

  /**
   * 获取认证统计（管理员）
   */
  async getVerificationStats() {
    const [pending, approved, rejected, total] = await Promise.all([
      this.prisma.verificationRequest.count({
        where: { status: VerificationStatus.PENDING },
      }),
      this.prisma.verificationRequest.count({
        where: { status: VerificationStatus.APPROVED },
      }),
      this.prisma.verificationRequest.count({
        where: { status: VerificationStatus.REJECTED },
      }),
      this.prisma.verificationRequest.count(),
    ]);

    return { pending, approved, rejected, total };
  }
}
