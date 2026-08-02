import { ServiceUnavailableException } from '@nestjs/common';
import { PaymentAdminController } from './payment-admin.controller';

describe('PaymentAdminController retired write paths', () => {
  const prisma = {
    payment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  } as any;

  let controller: PaymentAdminController;

  beforeEach(() => {
    controller = new PaymentAdminController(prisma);
    jest.clearAllMocks();
  });

  it('keeps historical payment records readable', async () => {
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.payment.count.mockResolvedValue(0);

    await expect(controller.getPayments(1, 20)).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });

  it('keeps refunds read-only without changing the historical ledger', () => {
    expect(() =>
      controller.refundPayment('payment-1', { reason: 'requested' }),
    ).toThrow(ServiceUnavailableException);

    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it('does not use identity roles as manual subscription entitlements', () => {
    expect(() =>
      controller.updateSubscription('user-1', { plan: 'PRO' as any }, {
        id: 'admin-1',
      } as any),
    ).toThrow(ServiceUnavailableException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
