import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export enum SubscriptionPlan {
  FREE = 'FREE',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM',
}

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  price: number;
  currency: string;
  period: 'monthly' | 'yearly' | 'lifetime';
  features: string[];
}

export interface CreateSubscriptionDto {
  plan: SubscriptionPlan;
  period: 'monthly' | 'yearly';
  paymentMethod?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  message?: string;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  // 计划配置
  private readonly plans: Record<SubscriptionPlan, PlanDetails> = {
    [SubscriptionPlan.FREE]: {
      id: SubscriptionPlan.FREE,
      name: '免费版',
      price: 0,
      currency: 'CNY',
      period: 'lifetime',
      features: [
        '浏览学校信息',
        '查看公开案例',
        '基础 AI 对话 (每日5次)',
        '档案管理',
      ],
    },
    [SubscriptionPlan.PRO]: {
      id: SubscriptionPlan.PRO,
      name: '专业版',
      price: 99,
      currency: 'CNY',
      period: 'monthly',
      features: [
        '免费版所有功能',
        '无限 AI 对话',
        '录取概率预测',
        '文书评估与润色',
        '详细案例数据',
        '优先客服支持',
      ],
    },
    [SubscriptionPlan.PREMIUM]: {
      id: SubscriptionPlan.PREMIUM,
      name: '尊享版',
      price: 299,
      currency: 'CNY',
      period: 'monthly',
      features: [
        '专业版所有功能',
        '专属留学顾问',
        '申请策略规划',
        '文书深度修改',
        '模拟面试指导',
        'VIP 专属社群',
      ],
    },
  };

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  // 获取所有计划
  getPlans(): PlanDetails[] {
    return Object.values(this.plans);
  }

  // 获取单个计划详情
  getPlan(planId: SubscriptionPlan): PlanDetails {
    const plan = this.plans[planId];
    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }
    return plan;
  }

  // 获取用户当前订阅
  async getUserSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 从用户 metadata 或单独表获取订阅信息
    // 这里简化处理，根据 role 判断
    const currentPlan =
      user.role === 'ADMIN'
        ? SubscriptionPlan.PREMIUM
        : user.role === 'VERIFIED'
          ? SubscriptionPlan.PRO
          : SubscriptionPlan.FREE;

    return {
      userId: user.id,
      plan: currentPlan,
      planDetails: this.plans[currentPlan],
      startDate: user.createdAt,
      endDate: null, // 永久有效或根据实际订阅期限
      isActive: true,
      autoRenew: false,
    };
  }

  // 创建订阅（升级）
  async createSubscription(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<PaymentResult> {
    const plan = this.getPlan(dto.plan);

    if (plan.id === SubscriptionPlan.FREE) {
      throw new BadRequestException('Cannot subscribe to free plan');
    }

    // 计算价格
    const price = dto.period === 'yearly' ? plan.price * 10 : plan.price; // 年付优惠

    this.logger.log(
      `Creating subscription for user ${userId}: ${plan.name} (${dto.period})`,
    );

    // 模拟支付处理
    const paymentResult = await this.processPayment(
      userId,
      price,
      plan.currency,
    );

    if (paymentResult.success) {
      // 更新用户角色
      const newRole =
        dto.plan === SubscriptionPlan.PREMIUM ? 'VERIFIED' : 'VERIFIED';
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: newRole },
      });

      // 记录订阅历史（如果有相关表）
      this.logger.log(`Subscription created: ${paymentResult.transactionId}`);
    }

    return paymentResult;
  }

  // 取消订阅
  async cancelSubscription(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const subscription = await this.getUserSubscription(userId);

    if (subscription.plan === SubscriptionPlan.FREE) {
      throw new BadRequestException('No active subscription to cancel');
    }

    // 降级到免费版
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'USER' },
    });

    this.logger.log(`Subscription cancelled for user ${userId}`);

    return {
      success: true,
      message: '订阅已取消，您已降级至免费版',
    };
  }

  // 获取账单历史
  async getBillingHistory(userId: string) {
    // 实际项目中应该从支付记录表获取
    // 这里返回模拟数据
    return [
      {
        id: 'inv_001',
        date: new Date('2026-01-15'),
        amount: 99,
        currency: 'CNY',
        plan: '专业版',
        status: 'paid',
        invoiceUrl: null,
      },
      {
        id: 'inv_002',
        date: new Date('2025-12-15'),
        amount: 99,
        currency: 'CNY',
        plan: '专业版',
        status: 'paid',
        invoiceUrl: null,
      },
    ];
  }

  // 模拟支付处理
  private async processPayment(
    userId: string,
    amount: number,
    currency: string,
  ): Promise<PaymentResult> {
    // 在实际项目中，这里会调用支付网关 API（如 Stripe、支付宝、微信支付）
    // 例如:
    // const stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
    // const paymentIntent = await stripe.paymentIntents.create({...});

    this.logger.log(
      `Processing payment: ${amount} ${currency} for user ${userId}`,
    );

    // 模拟支付延迟
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 模拟成功支付
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      transactionId,
      message: '支付成功',
    };
  }

  // Webhook 处理（用于接收支付网关回调）
  async handlePaymentWebhook(payload: any, signature: string): Promise<void> {
    // 验证 webhook 签名
    // const isValid = this.verifyWebhookSignature(payload, signature);

    this.logger.log('Received payment webhook');

    // 根据事件类型处理
    const eventType = payload.type;

    switch (eventType) {
      case 'payment.success':
        // 处理支付成功
        break;
      case 'payment.failed':
        // 处理支付失败
        break;
      case 'subscription.cancelled':
        // 处理订阅取消
        break;
      default:
        this.logger.warn(`Unhandled webhook event: ${eventType}`);
    }
  }
}
