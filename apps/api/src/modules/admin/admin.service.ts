import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Role,
  ReportStatus,
  Prisma,
  GlobalEventCategory,
} from '@prisma/client';
import {
  CreateSchoolDeadlineDto,
  UpdateSchoolDeadlineDto,
} from './dto/school-deadline.dto';
import {
  CreateGlobalEventDto,
  UpdateGlobalEventDto,
} from './dto/global-event.dto';

/**
 * 审计日志操作类型
 */
type AuditAction =
  | 'UPDATE_USER_ROLE'
  | 'DELETE_USER'
  | 'UPDATE_REPORT_STATUS'
  | 'DELETE_REPORT'
  | 'VERIFY_USER'
  | 'BAN_USER';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 记录审计日志
   *
   * 所有敏感管理员操作都会被记录，包括：
   * - 操作者 ID
   * - 操作类型
   * - 目标资源
   * - 变更前后的值
   * - 时间戳
   */
  private async logAudit(
    adminId: string,
    action: AuditAction,
    resource: string,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action,
          resource,
          resourceId,
          metadata: metadata as any,
        },
      });
      this.logger.log(
        `Audit: ${action} on ${resource}/${resourceId} by admin ${adminId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${action}`, error);
    }
  }

  // ============================================
  // Reports Management
  // ============================================

  async getReports(
    status?: ReportStatus,
    targetType?: string,
    page = 1,
    pageSize = 20,
  ) {
    const where: Prisma.ReportWhereInput = {};
    if (status) where.status = status;
    if (targetType) where.targetType = targetType as any;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: {
            select: { id: true, email: true, role: true },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateReportStatus(
    adminId: string,
    reportId: string,
    status: ReportStatus,
    resolution?: string,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const oldStatus = report.status;

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        resolution,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        ...(status === ReportStatus.RESOLVED && { resolvedAt: new Date() }),
      },
    });

    // 记录审计日志
    await this.logAudit(adminId, 'UPDATE_REPORT_STATUS', 'report', reportId, {
      oldStatus,
      newStatus: status,
      resolution,
      targetType: report.targetType,
      targetId: report.targetId,
    });

    return updated;
  }

  async deleteReport(adminId: string, reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    await this.prisma.report.delete({ where: { id: reportId } });

    // 记录审计日志
    await this.logAudit(adminId, 'DELETE_REPORT', 'report', reportId, {
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
    });
  }

  // ============================================
  // Users Management
  // ============================================

  async getUsers(search?: string, role?: Role, page = 1, pageSize = 20) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
          locale: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              admissionCases: true,
              reviewsGiven: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateUserRole(adminId: string, userId: string, role: Role) {
    if (adminId === userId) {
      throw new ForbiddenException('Cannot modify your own role');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldRole = user.role;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
      },
    });

    // 记录审计日志
    await this.logAudit(adminId, 'UPDATE_USER_ROLE', 'user', userId, {
      userEmail: user.email,
      oldRole,
      newRole: role,
    });

    return updated;
  }

  async deleteUser(adminId: string, userId: string) {
    if (adminId === userId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    // 记录审计日志
    await this.logAudit(adminId, 'DELETE_USER', 'user', userId, {
      userEmail: user.email,
      userRole: user.role,
    });
  }

  async getStats() {
    const [
      totalUsers,
      verifiedUsers,
      totalCases,
      pendingReports,
      totalReviews,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { emailVerified: true, deletedAt: null },
      }),
      this.prisma.admissionCase.count(),
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.review.count(),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      totalCases,
      pendingReports,
      totalReviews,
    };
  }

  /**
   * 获取审计日志
   */
  async getAuditLogs(
    page = 1,
    pageSize = 50,
    filters?: {
      adminId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters?.adminId) where.userId = filters.adminId;
    if (filters?.action) where.action = filters.action;
    if (filters?.resource) where.resource = filters.resource;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters?.startDate) where.createdAt.gte = filters.startDate;
      if (filters?.endDate) where.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ============================================
  // School Deadlines Management
  // ============================================

  async getSchoolDeadlines(
    schoolId?: string,
    year?: number,
    page = 1,
    pageSize = 50,
  ) {
    const where: Prisma.SchoolDeadlineWhereInput = {};
    if (schoolId) where.schoolId = schoolId;
    if (year) where.year = year;

    const [deadlines, total] = await Promise.all([
      this.prisma.schoolDeadline.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { applicationDeadline: 'asc' },
        include: { school: { select: { id: true, name: true, nameZh: true } } },
      }),
      this.prisma.schoolDeadline.count({ where }),
    ]);

    return {
      data: deadlines,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createSchoolDeadline(dto: CreateSchoolDeadlineDto) {
    const school = await this.prisma.school.findUnique({
      where: { id: dto.schoolId },
    });
    if (!school) throw new NotFoundException('学校不存在');

    const existing = await this.prisma.schoolDeadline.findUnique({
      where: {
        schoolId_year_round: {
          schoolId: dto.schoolId,
          year: dto.year,
          round: dto.round,
        },
      },
    });
    if (existing)
      throw new ConflictException('该学校此年度轮次的截止日期已存在');

    return this.prisma.schoolDeadline.create({
      data: {
        schoolId: dto.schoolId,
        year: dto.year,
        round: dto.round,
        applicationDeadline: new Date(dto.applicationDeadline),
        financialAidDeadline: dto.financialAidDeadline
          ? new Date(dto.financialAidDeadline)
          : undefined,
        decisionDate: dto.decisionDate ? new Date(dto.decisionDate) : undefined,
        essayPrompts: dto.essayPrompts,
        essayCount: dto.essayCount,
        interviewRequired: dto.interviewRequired,
        interviewDeadline: dto.interviewDeadline
          ? new Date(dto.interviewDeadline)
          : undefined,
        applicationFee: dto.applicationFee,
        notes: dto.notes,
        source: 'MANUAL',
      },
      include: { school: { select: { id: true, name: true, nameZh: true } } },
    });
  }

  async updateSchoolDeadline(id: string, dto: UpdateSchoolDeadlineDto) {
    const deadline = await this.prisma.schoolDeadline.findUnique({
      where: { id },
    });
    if (!deadline) throw new NotFoundException('截止日期记录不存在');

    return this.prisma.schoolDeadline.update({
      where: { id },
      data: {
        applicationDeadline: dto.applicationDeadline
          ? new Date(dto.applicationDeadline)
          : undefined,
        financialAidDeadline: dto.financialAidDeadline
          ? new Date(dto.financialAidDeadline)
          : undefined,
        decisionDate: dto.decisionDate ? new Date(dto.decisionDate) : undefined,
        essayPrompts: dto.essayPrompts,
        essayCount: dto.essayCount,
        interviewRequired: dto.interviewRequired,
        interviewDeadline: dto.interviewDeadline
          ? new Date(dto.interviewDeadline)
          : undefined,
        applicationFee: dto.applicationFee,
        notes: dto.notes,
      },
      include: { school: { select: { id: true, name: true, nameZh: true } } },
    });
  }

  async deleteSchoolDeadline(id: string) {
    const deadline = await this.prisma.schoolDeadline.findUnique({
      where: { id },
    });
    if (!deadline) throw new NotFoundException('截止日期记录不存在');
    await this.prisma.schoolDeadline.delete({ where: { id } });
  }

  // ============================================
  // Global Events Management
  // ============================================

  async getGlobalEvents(
    category?: GlobalEventCategory,
    year?: number,
    page = 1,
    pageSize = 50,
  ) {
    const where: Prisma.GlobalEventWhereInput = {};
    if (category) where.category = category;
    if (year) where.year = year;

    const [events, total] = await Promise.all([
      this.prisma.globalEvent.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { eventDate: 'asc' },
      }),
      this.prisma.globalEvent.count({ where }),
    ]);

    return {
      data: events,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createGlobalEvent(dto: CreateGlobalEventDto) {
    return this.prisma.globalEvent.create({
      data: {
        title: dto.title,
        titleZh: dto.titleZh,
        category: dto.category,
        eventDate: new Date(dto.eventDate),
        registrationDeadline: dto.registrationDeadline
          ? new Date(dto.registrationDeadline)
          : undefined,
        lateDeadline: dto.lateDeadline ? new Date(dto.lateDeadline) : undefined,
        resultDate: dto.resultDate ? new Date(dto.resultDate) : undefined,
        description: dto.description,
        descriptionZh: dto.descriptionZh,
        url: dto.url,
        year: dto.year,
        isRecurring: dto.isRecurring ?? true,
      },
    });
  }

  async updateGlobalEvent(id: string, dto: UpdateGlobalEventDto) {
    const event = await this.prisma.globalEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('全局事件不存在');

    return this.prisma.globalEvent.update({
      where: { id },
      data: {
        title: dto.title,
        titleZh: dto.titleZh,
        category: dto.category,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        registrationDeadline: dto.registrationDeadline
          ? new Date(dto.registrationDeadline)
          : undefined,
        lateDeadline: dto.lateDeadline ? new Date(dto.lateDeadline) : undefined,
        resultDate: dto.resultDate ? new Date(dto.resultDate) : undefined,
        description: dto.description,
        descriptionZh: dto.descriptionZh,
        url: dto.url,
        year: dto.year,
        isRecurring: dto.isRecurring,
        isActive: dto.isActive,
      },
    });
  }

  async deleteGlobalEvent(id: string) {
    const event = await this.prisma.globalEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('全局事件不存在');
    await this.prisma.globalEvent.delete({ where: { id } });
  }
}
