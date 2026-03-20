import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminOperatorService {
  private readonly logger = new Logger(AdminOperatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate an invite link for a new operator
   */
  async createInvite(createdBy: string, email?: string, role?: Role) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await this.prisma.operatorInvite.create({
      data: {
        token,
        email,
        role: role ?? Role.OPERATOR,
        createdBy,
        expiresAt,
      },
    });

    this.logger.log(
      `Invite created by ${createdBy} for role ${invite.role} (token: ${token.slice(0, 8)}...)`,
    );

    return {
      id: invite.id,
      token: invite.token,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * Validate and consume an invite token during registration
   */
  async consumeInvite(token: string, userId: string) {
    const invite = await this.prisma.operatorInvite.findUnique({
      where: { token },
    });

    if (!invite) throw new NotFoundException('Invalid invite token');
    if (invite.usedBy) throw new BadRequestException('Invite already used');
    if (invite.expiresAt < new Date())
      throw new BadRequestException('Invite expired');

    // Mark invite as used and set user role
    await this.prisma.$transaction([
      this.prisma.operatorInvite.update({
        where: { id: invite.id },
        data: { usedBy: userId, usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: invite.role },
      }),
    ]);

    this.logger.log(
      `Invite ${token.slice(0, 8)}... consumed by user ${userId}`,
    );
    return { role: invite.role };
  }

  /**
   * List all invites
   */
  async listInvites() {
    const invites = await this.prisma.operatorInvite.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const now = new Date();
    return invites.map((inv) => ({
      ...inv,
      status: inv.usedBy
        ? 'ACCEPTED'
        : inv.expiresAt < now
          ? 'EXPIRED'
          : 'PENDING',
    }));
  }

  /**
   * Get operator work stats
   */
  async getOperatorStats(operatorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: operatorId },
      select: { id: true, role: true },
    });
    if (!user || (user.role !== Role.OPERATOR && user.role !== Role.ADMIN)) {
      throw new NotFoundException('Operator not found');
    }

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayCases,
      weekCases,
      monthCases,
      todayReviews,
      weekReviews,
      monthReviews,
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          userId: operatorId,
          action: 'CASE_CREATED',
          createdAt: { gte: todayStart },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          userId: operatorId,
          action: 'CASE_CREATED',
          createdAt: { gte: weekStart },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          userId: operatorId,
          action: 'CASE_CREATED',
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          userId: operatorId,
          action: {
            in: [
              'REVIEW_APPROVED',
              'REVIEW_REJECTED',
              'REVIEW_EDITED_AND_APPROVED',
            ],
          },
          createdAt: { gte: todayStart },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          userId: operatorId,
          action: {
            in: [
              'REVIEW_APPROVED',
              'REVIEW_REJECTED',
              'REVIEW_EDITED_AND_APPROVED',
            ],
          },
          createdAt: { gte: weekStart },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          userId: operatorId,
          action: {
            in: [
              'REVIEW_APPROVED',
              'REVIEW_REJECTED',
              'REVIEW_EDITED_AND_APPROVED',
            ],
          },
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    return {
      casesCreated: { today: todayCases, week: weekCases, month: monthCases },
      reviews: { today: todayReviews, week: weekReviews, month: monthReviews },
    };
  }
}
