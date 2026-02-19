import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let subscriptionService: jest.Mocked<SubscriptionService>;

  const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };

  const mockPlans = [
    { id: 'free', name: 'Free', price: 0 },
    { id: 'pro', name: 'Pro', price: 29 },
    { id: 'premium', name: 'Premium', price: 99 },
  ];

  const mockSubscription = {
    id: 'sub-1',
    userId: 'user-1',
    plan: 'pro',
    status: 'ACTIVE',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-02-01'),
  };

  const mockBillingHistory = [
    { id: 'bill-1', amount: 29, date: new Date('2025-01-01'), status: 'PAID' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        {
          provide: SubscriptionService,
          useValue: {
            getPlans: jest.fn().mockReturnValue(mockPlans),
            getPlan: jest.fn().mockReturnValue(mockPlans[1]),
            getUserSubscription: jest.fn().mockResolvedValue(mockSubscription),
            createSubscription: jest.fn().mockResolvedValue(mockSubscription),
            cancelSubscription: jest
              .fn()
              .mockResolvedValue({ id: 'sub-1', status: 'CANCELLED' }),
            getBillingHistory: jest.fn().mockResolvedValue(mockBillingHistory),
            handlePaymentWebhook: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<SubscriptionController>(SubscriptionController);
    subscriptionService = module.get(SubscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlans', () => {
    it('should return all subscription plans', () => {
      const result = controller.getPlans();

      expect(subscriptionService.getPlans).toHaveBeenCalled();
      expect(result).toEqual(mockPlans);
    });
  });

  describe('getPlan', () => {
    it('should return a specific plan by id', () => {
      const result = controller.getPlan('pro' as any);

      expect(subscriptionService.getPlan).toHaveBeenCalledWith('pro');
      expect(result).toEqual(mockPlans[1]);
    });
  });

  describe('getCurrentSubscription', () => {
    it('should return the current user subscription', async () => {
      const result = await controller.getCurrentSubscription(mockUser as any);

      expect(subscriptionService.getUserSubscription).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('subscribe', () => {
    it('should create a subscription with the given plan and period', async () => {
      const dto = { plan: 'pro' as any, period: 'monthly' as const };
      const result = await controller.subscribe(mockUser as any, dto);

      expect(subscriptionService.createSubscription).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(mockSubscription);
    });

    it('should support yearly period with payment method', async () => {
      const dto = {
        plan: 'premium' as any,
        period: 'yearly' as const,
        paymentMethod: 'alipay',
      };
      await controller.subscribe(mockUser as any, dto);

      expect(subscriptionService.createSubscription).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel the current user subscription', async () => {
      const result = await controller.cancelSubscription(mockUser as any);

      expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual({ id: 'sub-1', status: 'CANCELLED' });
    });
  });

  describe('getBillingHistory', () => {
    it('should return billing history for current user', async () => {
      const result = await controller.getBillingHistory(mockUser as any);

      expect(subscriptionService.getBillingHistory).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(mockBillingHistory);
    });
  });

  describe('handleWebhook', () => {
    it('should process webhook payload and return received confirmation', async () => {
      const mockReq = {
        body: { event: 'payment.success', subscriptionId: 'sub-1' },
        rawBody: Buffer.from('raw'),
      } as any;
      const signature = 'sig_abc123';

      const result = await controller.handleWebhook(mockReq, signature);

      expect(subscriptionService.handlePaymentWebhook).toHaveBeenCalledWith(
        mockReq.body,
        'sig_abc123',
      );
      expect(result).toEqual({ received: true });
    });
  });
});
