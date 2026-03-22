import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ERR } from '../../common/constants/error-messages';
import {
  Role,
  ReportStatus,
  Prisma,
  GlobalEventCategory,
  DataReviewStatus,
  StagingStatus,
} from '@prisma/client';
import {
  CreateSchoolDeadlineDto,
  UpdateSchoolDeadlineDto,
} from './dto/school-deadline.dto';
import {
  CreateGlobalEventDto,
  UpdateGlobalEventDto,
} from './dto/global-event.dto';
import {
  CreateSchoolCalibrationDto,
  UpdateSchoolCalibrationDto,
} from './dto/school-calibration.dto';

/**
 * 审计日志操作类型
 */
type AuditAction =
  | 'UPDATE_USER_ROLE'
  | 'DELETE_USER'
  | 'UPDATE_REPORT_STATUS'
  | 'DELETE_REPORT'
  | 'VERIFY_USER'
  | 'BAN_USER'
  | 'UNBAN_USER'
  | 'CREATE_CALIBRATION'
  | 'UPDATE_CALIBRATION'
  | 'DELETE_CALIBRATION';

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
          isBanned: true,
          bannedAt: true,
          bannedUntil: true,
          banReason: true,
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

  // ============================================
  // User Ban/Unban
  // ============================================

  async banUser(
    adminId: string,
    userId: string,
    reason: string,
    durationHours?: number,
    permanent?: boolean,
    adminRole?: Role,
  ) {
    if (adminId === userId) {
      throw new ForbiddenException('Cannot ban your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isBanned: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot ban a super admin user');
    }

    if (user.role === Role.ADMIN && adminRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can ban admin users');
    }

    if (
      user.role === Role.OPERATOR &&
      adminRole !== Role.SUPER_ADMIN &&
      adminRole !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'Only admin or super admin can ban operator users',
      );
    }

    if (user.isBanned) {
      throw new ConflictException('User is already banned');
    }

    const bannedUntil =
      permanent || !durationHours
        ? null
        : new Date(Date.now() + durationHours * 60 * 60 * 1000);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedUntil,
        banReason: reason,
      },
      select: {
        id: true,
        email: true,
        isBanned: true,
        bannedAt: true,
        bannedUntil: true,
        banReason: true,
      },
    });

    await this.logAudit(adminId, 'BAN_USER', 'user', userId, {
      userEmail: user.email,
      reason,
      durationHours: durationHours || 'permanent',
      bannedUntil,
    });

    return updated;
  }

  async unbanUser(adminId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isBanned: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isBanned) {
      throw new ConflictException('User is not banned');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
      },
      select: {
        id: true,
        email: true,
        isBanned: true,
      },
    });

    await this.logAudit(adminId, 'UNBAN_USER', 'user', userId, {
      userEmail: user.email,
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
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      verifiedUsers,
      totalCases,
      pendingReports,
      totalReviews,
      newUsersToday,
      newUsersThisWeek,
      activeUsersToday,
      bannedUsers,
      totalForumPosts,
      totalConversations,
      totalMessages,
      pendingVerifications,
      freeUsers,
      proUsers,
      adminUsers,
      totalRevenueResult,
      monthlyRevenueResult,
      pendingPayments,
      pendingStagingCount,
      pendingCasesCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { emailVerified: true, deletedAt: null },
      }),
      this.prisma.admissionCase.count(),
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.review.count(),
      // New metrics
      this.prisma.user.count({
        where: { createdAt: { gte: todayStart }, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: weekAgo }, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { lastLoginAt: { gte: todayStart }, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { isBanned: true, deletedAt: null },
      }),
      this.prisma.forumPost.count(),
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.verificationRequest.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.user.count({
        where: { role: Role.USER, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { role: Role.VERIFIED, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { role: Role.ADMIN, deletedAt: null },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'SUCCESS',
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.dataImportStaging.count({
        where: { status: StagingStatus.PENDING },
      }),
      this.prisma.admissionCase.count({
        where: { reviewStatus: DataReviewStatus.PENDING_REVIEW },
      }),
    ]);

    return {
      // Existing
      totalUsers,
      verifiedUsers,
      totalCases,
      pendingReports,
      totalReviews,
      // Users
      newUsersToday,
      newUsersThisWeek,
      activeUsersToday,
      bannedUsers,
      // Revenue
      totalRevenue: totalRevenueResult._sum.amount || 0,
      monthlyRevenue: monthlyRevenueResult._sum.amount || 0,
      pendingPayments,
      // Content
      totalForumPosts,
      totalConversations,
      totalMessages,
      // Moderation
      pendingVerifications,
      // Subscription distribution
      freeUsers,
      proUsers,
      premiumUsers: adminUsers, // ADMIN role maps to premium
      // Data review
      pendingReview: pendingStagingCount + pendingCasesCount,
    };
  }

  /**
   * Get 30-day trends for key metrics
   */
  async getTrends() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch raw data and aggregate by day in-memory
    const [newUsers, payments, posts] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: 'SUCCESS',
        },
        select: { createdAt: true, amount: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.forumPost.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Aggregate by day
    const days: Record<
      string,
      {
        date: string;
        newUsers: number;
        payments: number;
        revenue: number;
        posts: number;
      }
    > = {};

    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
      const key = date.toISOString().split('T')[0];
      days[key] = { date: key, newUsers: 0, payments: 0, revenue: 0, posts: 0 };
    }

    for (const u of newUsers) {
      const key = u.createdAt.toISOString().split('T')[0];
      if (days[key]) days[key].newUsers++;
    }

    for (const p of payments) {
      const key = p.createdAt.toISOString().split('T')[0];
      if (days[key]) {
        days[key].payments++;
        days[key].revenue += Number(p.amount) || 0;
      }
    }

    for (const p of posts) {
      const key = p.createdAt.toISOString().split('T')[0];
      if (days[key]) days[key].posts++;
    }

    return Object.values(days);
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
    if (!school) throw new NotFoundException(ERR.NOT_FOUND.school());

    const existing = await this.prisma.schoolDeadline.findUnique({
      where: {
        schoolId_year_round: {
          schoolId: dto.schoolId,
          year: dto.year,
          round: dto.round,
        },
      },
    });
    if (existing) throw new ConflictException(ERR.CONFLICT.duplicateDeadline());

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
    if (!deadline) throw new NotFoundException(ERR.NOT_FOUND.deadline());

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
    if (!deadline) throw new NotFoundException(ERR.NOT_FOUND.deadline());
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
    if (!event) throw new NotFoundException(ERR.NOT_FOUND.globalEvent());

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
    if (!event) throw new NotFoundException(ERR.NOT_FOUND.globalEvent());
    await this.prisma.globalEvent.delete({ where: { id } });
  }

  // ============================================
  // School Calibration Management
  // ============================================

  async getCalibrations() {
    return this.prisma.schoolCalibration.findMany({
      include: {
        school: {
          select: { id: true, name: true, nameZh: true, usNewsRank: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createCalibration(adminId: string, dto: CreateSchoolCalibrationDto) {
    const school = await this.prisma.school.findUnique({
      where: { id: dto.schoolId },
      select: { id: true, name: true },
    });
    if (!school) throw new NotFoundException('School not found');

    try {
      const calibration = await this.prisma.schoolCalibration.create({
        data: {
          schoolId: dto.schoolId,
          multiplier: dto.multiplier,
          reason: dto.reason,
        },
        include: {
          school: {
            select: { id: true, name: true, nameZh: true, usNewsRank: true },
          },
        },
      });

      await this.logAudit(
        adminId,
        'CREATE_CALIBRATION',
        'schoolCalibration',
        calibration.id,
        {
          schoolId: dto.schoolId,
          schoolName: school.name,
          multiplier: dto.multiplier,
          reason: dto.reason,
        },
      );

      return calibration;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Calibration already exists for this school',
        );
      }
      throw e;
    }
  }

  async updateCalibration(
    adminId: string,
    id: string,
    dto: UpdateSchoolCalibrationDto,
  ) {
    const existing = await this.prisma.schoolCalibration.findUnique({
      where: { id },
      include: { school: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundException('Calibration not found');

    const updated = await this.prisma.schoolCalibration.update({
      where: { id },
      data: {
        multiplier: dto.multiplier,
        reason: dto.reason,
      },
      include: {
        school: {
          select: { id: true, name: true, nameZh: true, usNewsRank: true },
        },
      },
    });

    await this.logAudit(
      adminId,
      'UPDATE_CALIBRATION',
      'schoolCalibration',
      id,
      {
        before: {
          multiplier: Number(existing.multiplier),
          reason: existing.reason,
        },
        after: { multiplier: dto.multiplier, reason: dto.reason },
        schoolName: existing.school.name,
      },
    );

    return updated;
  }

  async deleteCalibration(adminId: string, id: string) {
    const existing = await this.prisma.schoolCalibration.findUnique({
      where: { id },
      include: { school: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundException('Calibration not found');

    await this.prisma.schoolCalibration.delete({ where: { id } });

    await this.logAudit(
      adminId,
      'DELETE_CALIBRATION',
      'schoolCalibration',
      id,
      {
        schoolName: existing.school.name,
        multiplier: Number(existing.multiplier),
      },
    );
  }

  async bulkCreateCalibrations(
    adminId: string,
    items: CreateSchoolCalibrationDto[],
  ): Promise<{ created: number; updated: number; failed: number }> {
    let created = 0;
    let updated = 0;
    let failed = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        try {
          const school = await tx.school.findUnique({
            where: { id: item.schoolId },
            select: { name: true },
          });
          if (!school) {
            failed++;
            continue;
          }

          const existing = await tx.schoolCalibration.findUnique({
            where: { schoolId: item.schoolId },
          });

          await tx.schoolCalibration.upsert({
            where: { schoolId: item.schoolId },
            create: {
              schoolId: item.schoolId,
              multiplier: item.multiplier,
              reason: item.reason,
            },
            update: {
              multiplier: item.multiplier,
              reason: item.reason,
            },
          });

          if (existing) {
            updated++;
          } else {
            created++;
          }

          await this.logAudit(
            adminId,
            existing ? 'UPDATE_CALIBRATION' : 'CREATE_CALIBRATION',
            'schoolCalibration',
            item.schoolId,
            {
              schoolName: school.name,
              multiplier: item.multiplier,
              reason: item.reason,
              bulk: true,
            },
          );
        } catch {
          failed++;
        }
      }
    });

    return { created, updated, failed };
  }
}
