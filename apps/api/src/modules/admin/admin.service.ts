import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, ReportStatus, Prisma } from '@prisma/client';

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
      this.logger.log(`Audit: ${action} on ${resource}/${resourceId} by admin ${adminId}`);
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
    pageSize = 20
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
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
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
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
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

  async getUsers(
    search?: string,
    role?: Role,
    page = 1,
    pageSize = 20
  ) {
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
      this.prisma.user.count({ where: { emailVerified: true, deletedAt: null } }),
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
    }
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
}
