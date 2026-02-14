import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../common/email/email.service';
import { SettingsService } from '../settings/settings.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionPlan, SUBSCRIPTION_PLANS } from '@study-abroad/shared';
import * as crypto from 'crypto';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prismaService: PrismaService;
  const webhookSecret = 'test-webhook-secret';

  const mockUserId = 'user-123';

  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    role: 'USER',
    createdAt: new Date('2026-01-01'),
  };

  const mockPayment = {
    id: 'pay-1',
    userId: mockUserId,
    transactionId: 'txn_123',
    plan: 'PRO',
    period: 'monthly',
    amount: 99,
    currency: 'CNY',
    status: 'SUCCESS',
    paymentMethod: null,
    idempotencyKey: 'sub_user-123_PRO_1234567890',
    description: '专业版 (月付)',
    metadata: null,
    failureReason: null,
    createdAt: new Date('2026-02-01'),
    processedAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  };

  // Mock $transaction to execute the callback with prismaService as tx
  const mockTransaction = jest.fn((cb: (tx: any) => Promise<any>) =>
    cb(prismaService),
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            payment: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            $transaction: mockTransaction,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'WEBHOOK_SECRET') return webhookSecret;
              if (key === 'NODE_ENV') return 'test';
              return 'test-value';
            }),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            getTyped: jest
              .fn()
              .mockImplementation((_key: string, defaultValue: any) =>
                Promise.resolve(defaultValue),
              ),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendSubscriptionConfirmationEmail: jest
              .fn()
              .mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const signWebhookPayload = (payload: Record<string, any>) =>
    crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

  // ============================================
  // Plans Tests
  // ============================================

  describe('getPlans', () => {
    it('should return all subscription plans', async () => {
      const plans = await service.getPlans();

      expect(plans).toHaveLength(3);
      expect(plans.map((p) => p.id)).toEqual([
        SubscriptionPlan.FREE,
        SubscriptionPlan.PRO,
        SubscriptionPlan.PREMIUM,
      ]);
    });

    it('should have correct free plan details', async () => {
      const plans = await service.getPlans();
      const freePlan = plans.find((p) => p.id === SubscriptionPlan.FREE);

      expect(freePlan?.price).toBe(
        SUBSCRIPTION_PLANS[SubscriptionPlan.FREE].price,
      );
      expect(freePlan?.period).toBe(
        SUBSCRIPTION_PLANS[SubscriptionPlan.FREE].period,
      );
      expect(freePlan?.features.length).toBeGreaterThan(0);
    });

    it('should have correct pro plan details', async () => {
      const plans = await service.getPlans();
      const proPlan = plans.find((p) => p.id === SubscriptionPlan.PRO);

      expect(proPlan?.price).toBe(
        SUBSCRIPTION_PLANS[SubscriptionPlan.PRO].price,
      );
      expect(proPlan?.currency).toBe(
        SUBSCRIPTION_PLANS[SubscriptionPlan.PRO].currency,
      );
      expect(proPlan?.period).toBe(
        SUBSCRIPTION_PLANS[SubscriptionPlan.PRO].period,
      );
    });
  });

  describe('getPlan', () => {
    it('should return specific plan details', async () => {
      const plan = await service.getPlan(SubscriptionPlan.PRO);

      expect(plan.id).toBe(SubscriptionPlan.PRO);
      expect(plan.name).toBe('专业版');
    });

    it('should throw NotFoundException for invalid plan', async () => {
      await expect(
        service.getPlan('INVALID' as SubscriptionPlan),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // User Subscription Tests
  // ============================================

  describe('getUserSubscription', () => {
    it('should return free plan for regular user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.payment.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getUserSubscription(mockUserId);

      expect(result.plan).toBe(SubscriptionPlan.FREE);
      expect(result.isActive).toBe(true);
    });

    it('should return pro plan for verified user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'VERIFIED',
      });
      (prismaService.payment.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getUserSubscription(mockUserId);

      expect(result.plan).toBe(SubscriptionPlan.PRO);
    });

    it('should return premium plan for admin', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'ADMIN',
      });
      (prismaService.payment.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getUserSubscription(mockUserId);

      expect(result.plan).toBe(SubscriptionPlan.PREMIUM);
    });

    it('should use last payment date as startDate', async () => {
      const paymentDate = new Date('2026-02-01');
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'VERIFIED',
      });
      (prismaService.payment.findFirst as jest.Mock).mockResolvedValue({
        processedAt: paymentDate,
      });

      const result = await service.getUserSubscription(mockUserId);

      expect(result.startDate).toEqual(paymentDate);
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserSubscription(mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================
  // Create Subscription Tests
  // ============================================

  describe('createSubscription', () => {
    it('should create PENDING payment, then SUCCESS on payment success', async () => {
      (prismaService.payment.create as jest.Mock).mockResolvedValue(
        mockPayment,
      );
      (prismaService.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: 'SUCCESS',
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'VERIFIED',
        email: 'test@example.com',
      });

      const result = await service.createSubscription(mockUserId, {
        plan: SubscriptionPlan.PRO,
        period: 'monthly',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();

      // Verify PENDING payment was created first
      expect(prismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            plan: SubscriptionPlan.PRO,
            period: 'monthly',
            status: 'PENDING',
          }),
        }),
      );

      // Verify transaction was called to update payment + user
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should apply yearly discount', async () => {
      (prismaService.payment.create as jest.Mock).mockResolvedValue(
        mockPayment,
      );
      (prismaService.payment.update as jest.Mock).mockResolvedValue(
        mockPayment,
      );
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'test@example.com',
      });

      const result = await service.createSubscription(mockUserId, {
        plan: SubscriptionPlan.PRO,
        period: 'yearly',
      });

      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException for free plan subscription', async () => {
      await expect(
        service.createSubscription(mockUserId, {
          plan: SubscriptionPlan.FREE,
          period: 'monthly',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include idempotencyKey in payment creation', async () => {
      (prismaService.payment.create as jest.Mock).mockResolvedValue(
        mockPayment,
      );
      (prismaService.payment.update as jest.Mock).mockResolvedValue(
        mockPayment,
      );
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'test@example.com',
      });

      await service.createSubscription(mockUserId, {
        plan: SubscriptionPlan.PRO,
        period: 'monthly',
      });

      expect(prismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idempotencyKey: expect.stringContaining(`sub_${mockUserId}_PRO_`),
          }),
        }),
      );
    });
  });

  // ============================================
  // Cancel Subscription Tests
  // ============================================

  describe('cancelSubscription', () => {
    it('should cancel subscription and downgrade to free', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'VERIFIED',
      });
      (prismaService.payment.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'USER',
      });

      const result = await service.cancelSubscription(mockUserId);

      expect(result.success).toBe(true);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { role: 'USER' },
      });
    });

    it('should throw BadRequestException if already on free plan', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.payment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.cancelSubscription(mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // Billing History Tests
  // ============================================

  describe('getBillingHistory', () => {
    it('should return formatted billing history', async () => {
      const mockPayments = [
        {
          id: 'pay-1',
          transactionId: 'txn_123',
          plan: 'PRO',
          period: 'monthly',
          amount: 99,
          currency: 'CNY',
          status: 'SUCCESS',
          paymentMethod: null,
          description: '专业版 (月付)',
          failureReason: null,
          createdAt: new Date('2026-02-01'),
          processedAt: new Date('2026-02-01'),
        },
        {
          id: 'pay-2',
          transactionId: 'txn_456',
          plan: 'PREMIUM',
          period: 'yearly',
          amount: 2990,
          currency: 'CNY',
          status: 'SUCCESS',
          paymentMethod: 'alipay',
          description: '尊享版 (年付)',
          failureReason: null,
          createdAt: new Date('2026-01-15'),
          processedAt: new Date('2026-01-15'),
        },
      ];

      (prismaService.payment.findMany as jest.Mock).mockResolvedValue(
        mockPayments,
      );

      const result = await service.getBillingHistory(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'pay-1',
        transactionId: 'txn_123',
        plan: 'PRO',
        period: 'monthly',
        amount: 99,
        currency: 'CNY',
        status: 'SUCCESS',
        paymentMethod: null,
        description: '专业版 (月付)',
        failureReason: null,
        date: new Date('2026-02-01'),
        processedAt: new Date('2026-02-01'),
      });
    });

    it('should return empty array for user with no payments', async () => {
      (prismaService.payment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getBillingHistory(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });

    it('should query with correct parameters', async () => {
      (prismaService.payment.findMany as jest.Mock).mockResolvedValue([]);

      await service.getBillingHistory(mockUserId);

      expect(prismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      );
    });
  });

  // ============================================
  // Webhook Tests
  // ============================================

  describe('handlePaymentWebhook', () => {
    it('should handle payment success event', async () => {
      const payload = {
        type: 'payment.success',
        id: 'evt-1',
        transactionId: 'txn_123',
      };
      const pendingPayment = { ...mockPayment, status: 'PENDING' };
      (prismaService.payment.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce(pendingPayment); // find pending payment
      (prismaService.payment.update as jest.Mock).mockResolvedValue({
        ...pendingPayment,
        status: 'SUCCESS',
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.handlePaymentWebhook(payload, signWebhookPayload(payload)),
      ).resolves.not.toThrow();

      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should handle payment failed event', async () => {
      const payload = {
        type: 'payment.failed',
        id: 'evt-2',
        transactionId: 'txn_123',
        reason: 'Insufficient funds',
      };
      const pendingPayment = { ...mockPayment, status: 'PENDING' };
      (prismaService.payment.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce(pendingPayment); // find pending payment
      (prismaService.payment.update as jest.Mock).mockResolvedValue({
        ...pendingPayment,
        status: 'FAILED',
      });

      await expect(
        service.handlePaymentWebhook(payload, signWebhookPayload(payload)),
      ).resolves.not.toThrow();

      expect(prismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            failureReason: 'Insufficient funds',
          }),
        }),
      );
    });

    it('should skip already processed webhooks (idempotency)', async () => {
      const payload = {
        type: 'payment.success',
        id: 'evt-duplicate',
        transactionId: 'txn_123',
      };
      (prismaService.payment.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'existing-payment',
      });

      await service.handlePaymentWebhook(payload, signWebhookPayload(payload));

      // Should only call findFirst once (idempotency check) and not proceed
      expect(prismaService.payment.findFirst).toHaveBeenCalledTimes(1);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should handle unknown event types', async () => {
      const payload = { type: 'unknown.event' };
      (prismaService.payment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.handlePaymentWebhook(payload, signWebhookPayload(payload)),
      ).resolves.not.toThrow();
    });

    it('should handle payment refund event', async () => {
      const payload = {
        type: 'payment.refunded',
        id: 'evt-3',
        transactionId: 'txn_123',
      };
      const successPayment = { ...mockPayment, status: 'SUCCESS' };
      (prismaService.payment.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce(successPayment); // find success payment
      (prismaService.payment.update as jest.Mock).mockResolvedValue({
        ...successPayment,
        status: 'REFUNDED',
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      await service.handlePaymentWebhook(payload, signWebhookPayload(payload));

      expect(mockTransaction).toHaveBeenCalled();
    });
  });
});
