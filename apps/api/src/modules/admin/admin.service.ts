import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, ReportStatus, Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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

  async updateReportStatus(reportId: string, status: ReportStatus, resolution?: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        resolution,
        ...(status === ReportStatus.RESOLVED && { resolvedAt: new Date() }),
      },
    });
  }

  async deleteReport(reportId: string) {
    await this.prisma.report.delete({ where: { id: reportId } });
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

  async updateUserRole(userId: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
      },
    });
  }

  async deleteUser(userId: string) {
    // Soft delete
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
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
}

