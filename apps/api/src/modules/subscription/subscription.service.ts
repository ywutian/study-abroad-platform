import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  SubscriptionPlan,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLAN_LIST,
  YEARLY_DISCOUNT_MULTIPLIER,
} from '@study-abroad/shared';
import { SettingsService, SETTING_KEYS } from '../settings/settings.service';
import type { CreateSubscriptionDto } from './dto/create-subscription.dto';

// Re-export so existing imports from './subscription.service' still work
export { SubscriptionPlan } from '@study-abroad/shared';

// 后端 API 响应专用的中文映射
const PLAN_NAMES_ZH: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  premium: '尊享版',
};

const PLAN_FEATURES_ZH: Record<string, string[]> = {
  free: ['所有产品功能已开放', '无需付费订阅', '不受积分限制'],
  pro: [
    '免费版所有功能',
    '无限 AI 对话',
    '录取概率预测',
    '文书评估与润色',
    '详细案例数据',
    '优先客服支持',
  ],
  premium: [
    '专业版所有功能',
    '专属留学顾问',
    '申请策略规划',
    '文书深度修改',
    '模拟面试指导',
    'VIP 专属社群',
  ],
};

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  price: number;
  currency: string;
  period: 'monthly' | 'yearly' | 'lifetime';
  features: string[];
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  message?: string;
}

export interface BillingHistoryItem {
  id: string;
  transactionId: string;
  plan: string;
  period: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  description: string | null;
  failureReason: string | null;
  date: Date;
  processedAt: Date | null;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Paid subscriptions are retired. The simulator is retained solely so
   * explicit local fixtures can exercise the legacy ledger; it is impossible
   * to enable in production and is never selected by default.
   */
  private paymentsEnabled(): boolean {
    return (
      this.configService.get<string>('PAYMENTS_ENABLED') === 'true' &&
      this.configService.get<string>('PAYMENT_PROVIDER') === 'simulator' &&
      this.configService.get<string>('NODE_ENV') !== 'production'
    );
  }

  private assertPaymentsEnabled(): void {
    if (!this.paymentsEnabled()) {
      throw new ServiceUnavailableException(
        'Paid subscriptions are retired; all product features are open.',
      );
    }
  }

  /**
   * Get dynamic price for a plan from SystemSetting (admin-configurable)
   */
  private async getDynamicPrice(planId: SubscriptionPlan): Promise<number> {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (planId === SubscriptionPlan.PRO) {
      return this.settingsService.getTyped(
        SETTING_KEYS.SUBSCRIPTION_PRO_PRICE,
        plan.price,
      );
    }
    if (planId === SubscriptionPlan.PREMIUM) {
      return this.settingsService.getTyped(
        SETTING_KEYS.SUBSCRIPTION_PREMIUM_PRICE,
        plan.price,
      );
    }
    return plan.price;
  }

  private async getDynamicYearlyDiscount(): Promise<number> {
    return this.settingsService.getTyped(
      SETTING_KEYS.SUBSCRIPTION_YEARLY_DISCOUNT,
      YEARLY_DISCOUNT_MULTIPLIER,
    );
  }

  private async toPlanDetailsAsync(
    planId: SubscriptionPlan,
  ): Promise<PlanDetails> {
    const plan = SUBSCRIPTION_PLANS[planId];
    const price = await this.getDynamicPrice(planId);
    return {
      id: plan.id,
      name: PLAN_NAMES_ZH[plan.key] ?? plan.key,
      price,
      currency: plan.currency,
      period: plan.period,
      features: PLAN_FEATURES_ZH[plan.key] ?? [],
    };
  }

  // Keep sync version for internal use (uses static defaults)
  private toPlanDetails(planId: SubscriptionPlan): PlanDetails {
    const plan = SUBSCRIPTION_PLANS[planId];
    return {
      id: plan.id,
      name: PLAN_NAMES_ZH[plan.key] ?? plan.key,
      price: plan.price,
      currency: plan.currency,
      period: plan.period,
      features: PLAN_FEATURES_ZH[plan.key] ?? [],
    };
  }

  // 获取所有计划（动态定价）
  async getPlans(): Promise<PlanDetails[]> {
    if (!this.paymentsEnabled()) {
      return [await this.toPlanDetailsAsync(SubscriptionPlan.FREE)];
    }
    const plans: PlanDetails[] = [];
    for (const plan of SUBSCRIPTION_PLAN_LIST) {
      plans.push(await this.toPlanDetailsAsync(plan.id));
    }
    return plans;
  }

  // 获取单个计划详情（动态定价）
  async getPlan(planId: SubscriptionPlan): Promise<PlanDetails> {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }
    if (planId !== SubscriptionPlan.FREE) {
      this.assertPaymentsEnabled();
    }
    return this.toPlanDetailsAsync(planId);
  }

  // 获取用户当前订阅
  async getUserSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      plan: SubscriptionPlan.FREE,
      planDetails: this.toPlanDetails(SubscriptionPlan.FREE),
      startDate: user.createdAt,
      endDate: null,
      isActive: true,
      autoRenew: false,
      state: 'retired' as const,
      featuresOpen: true,
      paymentsEnabled: false,
    };
  }

  // 创建订阅（升级）
  async createSubscription(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<PaymentResult> {
    this.assertPaymentsEnabled();

    const planConfig = SUBSCRIPTION_PLANS[dto.plan];

    if (!planConfig || planConfig.id === SubscriptionPlan.FREE) {
      throw new BadRequestException('Cannot subscribe to free plan');
    }

    // 计算价格（从管理员配置动态读取）
    const dynamicPrice = await this.getDynamicPrice(dto.plan);
    const yearlyDiscount = await this.getDynamicYearlyDiscount();
    const price =
      dto.period === 'yearly' ? dynamicPrice * yearlyDiscount : dynamicPrice;

    const planName = PLAN_NAMES_ZH[planConfig.key] || planConfig.key;
    const periodLabel = dto.period === 'yearly' ? '年付' : '月付';

    this.logger.log(
      `Creating subscription for user ${userId}: ${planName} (${dto.period})`,
    );

    // 生成幂等性 key 和交易 ID
    const idempotencyKey = `sub_${userId}_${dto.plan}_${Date.now()}`;
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 1. 先创建 PENDING 状态的 Payment 记录
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        transactionId,
        plan: dto.plan,
        period: dto.period,
        amount: price,
        currency: planConfig.currency,
        status: 'PENDING',
        paymentMethod: dto.paymentMethod || null,
        idempotencyKey,
        description: `${planName} (${periodLabel})`,
      },
    });

    // 2. 调用支付网关
    const gatewayResult = await this.processPayment(
      userId,
      price,
      planConfig.currency,
    );

    if (gatewayResult.success) {
      // 3. Simulator success updates the legacy ledger only. Identity roles
      // must never be used as subscription entitlements.
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCESS',
            processedAt: new Date(),
          },
        });
      });

      this.logger.log(`Subscription created: ${transactionId}`);

      return {
        success: true,
        transactionId,
        message: '支付成功',
      };
    } else {
      // 5. 支付失败：记录失败原因
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: gatewayResult.message || 'Payment processing failed',
          processedAt: new Date(),
        },
      });

      this.logger.warn(
        `Payment failed for user ${userId}: ${gatewayResult.message}`,
      );

      return {
        success: false,
        transactionId,
        message: gatewayResult.message || '支付失败，请稍后重试',
      };
    }
  }

  // 取消订阅
  cancelSubscription(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    void userId;
    throw new ServiceUnavailableException(
      'Paid subscriptions are retired; there is no subscription to cancel.',
    );
  }

  // 获取账单历史
  async getBillingHistory(userId: string): Promise<BillingHistoryItem[]> {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        transactionId: true,
        plan: true,
        period: true,
        amount: true,
        currency: true,
        status: true,
        paymentMethod: true,
        description: true,
        failureReason: true,
        createdAt: true,
        processedAt: true,
      },
    });

    return payments.map((p) => ({
      id: p.id,
      transactionId: p.transactionId,
      plan: p.plan,
      period: p.period,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      paymentMethod: p.paymentMethod,
      description: p.description,
      failureReason: p.failureReason,
      date: p.createdAt,
      processedAt: p.processedAt,
    }));
  }

  // 模拟支付处理（生产环境应对接 Stripe/支付宝/微信支付）
  private async processPayment(
    userId: string,
    amount: number,
    currency: string,
  ): Promise<PaymentResult> {
    this.logger.log(
      `Processing payment: ${amount} ${currency} for user ${userId}`,
    );

    // 模拟支付延迟
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 模拟成功支付
    const transactionId = `gw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      transactionId,
      message: '支付成功',
    };
  }

  // Webhook 处理（用于接收支付网关回调）
  async handlePaymentWebhook(payload: any, signature: string): Promise<void> {
    this.assertPaymentsEnabled();
    // Verify webhook signature (HMAC-SHA256)
    const webhookSecret = this.configService.get<string>('WEBHOOK_SECRET');
    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      // Constant-time comparison: a plain `!==` leaks timing that can let an
      // attacker recover the expected HMAC byte-by-byte over many requests.
      // timingSafeEqual throws on length mismatch, so guard the length first
      // (a wrong-length signature is trivially invalid anyway).
      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);
      if (
        signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
      ) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } else if (this.configService.get('NODE_ENV') === 'production') {
      throw new InternalServerErrorException(
        'WEBHOOK_SECRET must be set in production',
      );
    } else {
      this.logger.warn(
        'WEBHOOK_SECRET not set — skipping signature verification (dev only)',
      );
    }

    this.logger.log('Received payment webhook', { type: payload.type });

    const eventType = payload.type;
    const gatewayId = payload.id || payload.transactionId;

    // 幂等性检查：防止重复处理同一 webhook
    if (gatewayId) {
      const existing = await this.prisma.payment.findFirst({
        where: {
          metadata: { path: ['webhookEventId'], equals: gatewayId },
        },
      });
      if (existing) {
        this.logger.log(`Webhook already processed: ${gatewayId}`);
        return;
      }
    }

    switch (eventType) {
      case 'payment.success': {
        const payment = await this.prisma.payment.findFirst({
          where: { transactionId: payload.transactionId, status: 'PENDING' },
        });
        if (payment) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'SUCCESS',
              processedAt: new Date(),
              metadata: { webhookEventId: gatewayId, payload },
            },
          });
          this.logger.log(
            `Payment confirmed via webhook: ${payment.transactionId}`,
          );
        }
        break;
      }

      case 'payment.failed': {
        const payment = await this.prisma.payment.findFirst({
          where: { transactionId: payload.transactionId, status: 'PENDING' },
        });
        if (payment) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'FAILED',
              failureReason: payload.reason || 'Payment failed via webhook',
              processedAt: new Date(),
              metadata: { webhookEventId: gatewayId, payload },
            },
          });
          this.logger.warn(
            `Payment failed via webhook: ${payment.transactionId}`,
          );
        }
        break;
      }

      case 'payment.refunded': {
        const payment = await this.prisma.payment.findFirst({
          where: { transactionId: payload.transactionId, status: 'SUCCESS' },
        });
        if (payment) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'REFUNDED',
              metadata: { webhookEventId: gatewayId, payload },
            },
          });
          this.logger.log(
            `Payment refunded via webhook: ${payment.transactionId}`,
          );
        }
        break;
      }

      case 'subscription.cancelled': {
        this.logger.log('Legacy subscription cancellation recorded as a no-op');
        break;
      }

      default:
        this.logger.warn(`Unhandled webhook event: ${eventType}`);
    }
  }
}
