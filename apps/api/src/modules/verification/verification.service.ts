import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService, StorageFile } from '../../common/storage/storage.service';
import { VerificationStatus, Role } from '@prisma/client';
import { CreateVerificationDto, ProofType } from './dto/create-verification.dto';
import { ReviewVerificationDto, ReviewAction } from './dto/review-verification.dto';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  /**
   * 上传验证材料文件
   * 
   * 安全特性：
   * - 文件存储到云端（S3）或本地（开发环境）
   * - 文件名使用随机哈希，防止路径遍历攻击
   * - 支持的文件类型：图片、PDF
   */
  async uploadProofFile(userId: string, file: StorageFile): Promise<{ url: string; key: string }> {
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('不支持的文件类型。支持：JPEG, PNG, WebP, PDF');
    }

    // 验证文件大小（最大 10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.buffer.length > maxSize) {
      throw new BadRequestException('文件大小不能超过 10MB');
    }

    const result = await this.storage.uploadVerificationFile(userId, file);
    this.logger.log(`Verification file uploaded: ${result.key} for user ${userId}`);

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
      throw new NotFoundException('案例不存在');
    }

    if (admissionCase.userId !== userId) {
      throw new ForbiddenException('只能认证自己的案例');
    }

    if (admissionCase.isVerified) {
      throw new ConflictException('该案例已认证');
    }

    // 检查是否有待处理的认证请求
    const pendingRequest = await this.prisma.verificationRequest.findFirst({
      where: {
        caseId: dto.caseId,
        status: VerificationStatus.PENDING,
      },
    });

    if (pendingRequest) {
      throw new ConflictException('已有待处理的认证请求');
    }

    // 验证必须提供证明材料
    if (!dto.proofData && !dto.proofUrl) {
      throw new BadRequestException('请上传证明材料');
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
    dto: ReviewVerificationDto
  ) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      include: { case: true },
    });

    if (!request) {
      throw new NotFoundException('认证请求不存在');
    }

    if (request.status !== VerificationStatus.PENDING) {
      throw new ConflictException('该请求已被处理');
    }

    const isApproved = dto.action === ReviewAction.APPROVE;
    const newStatus = isApproved
      ? VerificationStatus.APPROVED
      : VerificationStatus.REJECTED;

    // 使用事务更新
    return this.prisma.$transaction(async (tx) => {
      // 更新认证请求
      const updatedRequest = await tx.verificationRequest.update({
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
          },
        });

        // 更新用户角色为 VERIFIED
        await tx.user.update({
          where: { id: request.userId },
          data: { role: Role.VERIFIED },
        });

        // 奖励积分
        await tx.user.update({
          where: { id: request.userId },
          data: { points: { increment: 100 } },
        });

        await tx.pointHistory.create({
          data: {
            userId: request.userId,
            action: 'VERIFICATION_APPROVED',
            points: 100,
            metadata: { caseId: request.caseId },
          },
        });
      }

      return updatedRequest;
    });
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
      throw new NotFoundException('认证请求不存在');
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

