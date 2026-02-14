import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionPlan } from '@study-abroad/shared';
import {
  RefundPaymentDto,
  UpdateSubscriptionDto,
} from './dto/payment-admin.dto';

@ApiTags('admin/payments')
@ApiBearerAuth()
@Controller('admin/payments')
@Roles(Role.ADMIN)
export class PaymentAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '查看所有支付记录' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'plan', required: false })
  async getPayments(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('plan') plan?: string,
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;
    const where: Prisma.PaymentWhereInput = {};

    const normalizedStatus = this.parsePaymentStatus(status);
    if (normalizedStatus) where.status = normalizedStatus;
    if (userId) where.userId = userId;
    if (plan) where.plan = plan;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, role: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: '支付统计' })
  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalPayments,
      successfulPayments,
      failedPayments,
      refundedPayments,
      pendingPayments,
      totalRevenueResult,
      monthlyRevenueResult,
      byPlan,
    ] = await Promise.all([
      this.prisma.payment.count(),
      this.prisma.payment.count({ where: { status: PaymentStatus.SUCCESS } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.REFUNDED } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCESS },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.SUCCESS,
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['plan'],
        where: { status: PaymentStatus.SUCCESS },
        _count: { plan: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalPayments,
      byStatus: {
        SUCCESS: successfulPayments,
        FAILED: failedPayments,
        REFUNDED: refundedPayments,
        PENDING: pendingPayments,
      },
      totalRevenue: totalRevenueResult._sum.amount || 0,
      monthlyRevenue: monthlyRevenueResult._sum.amount || 0,
      byPlan: byPlan.map((p) => ({
        plan: p.plan,
        count: p._count.plan,
        revenue: p._sum.amount || 0,
      })),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '支付详情' })
  async getPayment(@Param('id') id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  @Post(':id/refund')
  @ApiOperation({ summary: '手动退款' })
  async refundPayment(@Param('id') id: string, @Body() dto: RefundPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { user: { select: { id: true, role: true } } },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Only successful payments can be refunded');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const refundedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.REFUNDED,
          processedAt: new Date(),
          metadata: {
            ...(payment.metadata as any),
            refundReason: dto.reason,
            refundedAt: new Date().toISOString(),
          },
        },
      });

      if (payment.user.role !== Role.ADMIN) {
        const remainingSuccessfulPayments = await tx.payment.count({
          where: {
            userId: payment.userId,
            status: PaymentStatus.SUCCESS,
            id: { not: id },
          },
        });

        const targetRole =
          remainingSuccessfulPayments > 0 ? Role.VERIFIED : Role.USER;
        await tx.user.update({
          where: { id: payment.userId },
          data: { role: targetRole },
        });
      }

      return refundedPayment;
    });

    return updated;
  }

  @Put('users/:userId/subscription')
  @ApiOperation({ summary: '手动调整用户订阅等级' })
  async updateSubscription(
    @Param('userId') userId: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const targetRole = this.resolveTargetRole(dto);
    if (!targetRole) {
      throw new BadRequestException('Either plan or role must be provided');
    }
    if (targetRole === Role.ADMIN && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Promoting users to ADMIN is not allowed in payment admin endpoint',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: targetRole },
      select: { id: true, email: true, role: true },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'UPDATE_USER_ROLE',
        resource: 'subscription',
        resourceId: userId,
        metadata: {
          oldRole: user.role,
          newRole: targetRole,
          requestedPlan: dto.plan ?? null,
          reason: dto.reason,
          method: 'manual_subscription_override',
        } as any,
      },
    });

    return updated;
  }

  private parsePaymentStatus(status?: string): PaymentStatus | undefined {
    if (!status) return undefined;
    const normalized = status.toUpperCase();
    return (
      (PaymentStatus as Record<string, PaymentStatus>)[normalized] || undefined
    );
  }

  private resolveTargetRole(dto: UpdateSubscriptionDto): Role | undefined {
    if (dto.role) return dto.role;
    if (!dto.plan) return undefined;

    if (dto.plan === SubscriptionPlan.FREE) return Role.USER;
    if (
      dto.plan === SubscriptionPlan.PRO ||
      dto.plan === SubscriptionPlan.PREMIUM
    ) {
      return Role.VERIFIED;
    }
    return undefined;
  }
}
