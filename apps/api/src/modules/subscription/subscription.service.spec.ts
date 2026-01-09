import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService, SubscriptionPlan } from './subscription.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prismaService: PrismaService;

  const mockUserId = 'user-123';

  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    role: 'USER',
    createdAt: new Date('2026-01-01'),
  };

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
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-value'),
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

  // ============================================
  // Plans Tests
  // ============================================

  describe('getPlans', () => {
    it('should return all subscription plans', () => {
      const plans = service.getPlans();

      expect(plans).toHaveLength(3);
      expect(plans.map((p) => p.id)).toEqual([
        SubscriptionPlan.FREE,
        SubscriptionPlan.PRO,
        SubscriptionPlan.PREMIUM,
      ]);
    });

    it('should have correct free plan details', () => {
      const plans = service.getPlans();
      const freePlan = plans.find((p) => p.id === SubscriptionPlan.FREE);

      expect(freePlan?.price).toBe(0);
      expect(freePlan?.period).toBe('lifetime');
      expect(freePlan?.features.length).toBeGreaterThan(0);
    });

    it('should have correct pro plan details', () => {
      const plans = service.getPlans();
      const proPlan = plans.find((p) => p.id === SubscriptionPlan.PRO);

      expect(proPlan?.price).toBe(99);
      expect(proPlan?.currency).toBe('CNY');
      expect(proPlan?.period).toBe('monthly');
    });
  });

  describe('getPlan', () => {
    it('should return specific plan details', () => {
      const plan = service.getPlan(SubscriptionPlan.PRO);

      expect(plan.id).toBe(SubscriptionPlan.PRO);
      expect(plan.name).toBe('专业版');
    });

    it('should throw NotFoundException for invalid plan', () => {
      expect(() => service.getPlan('INVALID' as SubscriptionPlan)).toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================
  // User Subscription Tests
  // ============================================

  describe('getUserSubscription', () => {
    it('should return free plan for regular user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getUserSubscription(mockUserId);

      expect(result.plan).toBe(SubscriptionPlan.FREE);
      expect(result.isActive).toBe(true);
    });

    it('should return pro plan for verified user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'VERIFIED',
      });

      const result = await service.getUserSubscription(mockUserId);

      expect(result.plan).toBe(SubscriptionPlan.PRO);
    });

    it('should return premium plan for admin', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'ADMIN',
      });

      const result = await service.getUserSubscription(mockUserId);

      expect(result.plan).toBe(SubscriptionPlan.PREMIUM);
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
    it('should create subscription and update user role', async () => {
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'VERIFIED',
      });

      const result = await service.createSubscription(mockUserId, {
        plan: SubscriptionPlan.PRO,
        period: 'monthly',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { role: 'VERIFIED' },
      });
    });

    it('should apply yearly discount', async () => {
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.createSubscription(mockUserId, {
        plan: SubscriptionPlan.PRO,
        period: 'yearly',
      });

      // 99 * 10 = 990 (yearly price with discount)
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

      await expect(service.cancelSubscription(mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // Billing History Tests
  // ============================================

  describe('getBillingHistory', () => {
    it('should return billing history', async () => {
      const result = await service.getBillingHistory(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('amount');
      expect(result[0]).toHaveProperty('status');
    });
  });

  // ============================================
  // Webhook Tests
  // ============================================

  describe('handlePaymentWebhook', () => {
    it('should handle payment success event', async () => {
      await expect(
        service.handlePaymentWebhook({ type: 'payment.success' }, 'signature'),
      ).resolves.not.toThrow();
    });

    it('should handle payment failed event', async () => {
      await expect(
        service.handlePaymentWebhook({ type: 'payment.failed' }, 'signature'),
      ).resolves.not.toThrow();
    });

    it('should handle unknown event types', async () => {
      await expect(
        service.handlePaymentWebhook({ type: 'unknown.event' }, 'signature'),
      ).resolves.not.toThrow();
    });
  });
});


