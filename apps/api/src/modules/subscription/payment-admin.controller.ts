import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles, CurrentUser, RequirePermission } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { Permission } from '../../common/constants/permissions';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RefundPaymentDto,
  UpdateSubscriptionDto,
} from './dto/payment-admin.dto';

@ApiTags('admin/payments')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/payments')
@Roles(Role.OPERATOR)
export class PaymentAdminController {
  constructor(private readonly prisma: PrismaService) {}

  private assertPaymentWritesEnabled(): never {
    throw new ServiceUnavailableException(
      'Payment administration is read-only while paid subscriptions are retired.',
    );
  }

  @Get()
  @RequirePermission(Permission.PAYMENT_VIEW)
  @ApiOperation({ summary: 'View all payment records' })
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
  @RequirePermission(Permission.PAYMENT_VIEW)
  @ApiOperation({ summary: 'Payment statistics' })
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
      // governance: admin-scope — controller is @Roles(Role.OPERATOR) with @RequirePermission(PAYMENT_VIEW) on each route; the surface is read-only since the refund/adjust actions were removed
      this.prisma.payment.count(),
      // governance: admin-scope — controller is @Roles(Role.OPERATOR) with @RequirePermission(PAYMENT_VIEW) on each route; the surface is read-only since the refund/adjust actions were removed
      this.prisma.payment.count({ where: { status: PaymentStatus.SUCCESS } }),
      // governance: admin-scope — controller is @Roles(Role.OPERATOR) with @RequirePermission(PAYMENT_VIEW) on each route; the surface is read-only since the refund/adjust actions were removed
      this.prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
      // governance: admin-scope — controller is @Roles(Role.OPERATOR) with @RequirePermission(PAYMENT_VIEW) on each route; the surface is read-only since the refund/adjust actions were removed
      this.prisma.payment.count({ where: { status: PaymentStatus.REFUNDED } }),
      // governance: admin-scope — controller is @Roles(Role.OPERATOR) with @RequirePermission(PAYMENT_VIEW) on each route; the surface is read-only since the refund/adjust actions were removed
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      // governance: admin-scope — controller is @Roles(Role.OPERATOR) with @RequirePermission(PAYMENT_VIEW) on each route; the surface is read-only since the refund/adjust actions were removed
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCESS },
        _sum: { amount: true },
      }),
      // governance: admin-scope — controller is @Roles(Role.OPERATOR) with @RequirePermission(PAYMENT_VIEW) on each route; the surface is read-only since the refund/adjust actions were removed
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
  @RequirePermission(Permission.PAYMENT_VIEW)
  @ApiOperation({ summary: 'Payment details' })
  async getPayment(@Param('id') id: string) {
    // governance: admin-scope — controller is @Roles(Role.OPERATOR) with @RequirePermission(PAYMENT_VIEW) on each route; the surface is read-only since the refund/adjust actions were removed
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
  @RequirePermission(Permission.PAYMENT_MANAGE)
  @ApiOperation({ summary: 'Manual refund' })
  refundPayment(@Param('id') id: string, @Body() dto: RefundPaymentDto) {
    void id;
    void dto;
    return this.assertPaymentWritesEnabled();
  }

  @Put('users/:userId/subscription')
  @RequirePermission(Permission.PAYMENT_MANAGE)
  @ApiOperation({ summary: 'Manually adjust user subscription tier' })
  updateSubscription(
    @Param('userId') userId: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    void userId;
    void dto;
    void admin;
    return this.assertPaymentWritesEnabled();
  }

  private parsePaymentStatus(status?: string): PaymentStatus | undefined {
    if (!status) return undefined;
    const normalized = status.toUpperCase();
    return (
      (PaymentStatus as Record<string, PaymentStatus>)[normalized] || undefined
    );
  }
}
