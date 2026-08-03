import { BadRequestException } from '@nestjs/common';
import { RedemptionStatus, RedemptionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from './incentive.service';
import { PointsConfigService } from './points-config.service';
import { PointsRedemptionService } from './points-redemption.service';

/**
 * A $transaction stub that runs the callback against `tx` and, if the callback
 * throws, reports that nothing was committed — enough to assert the two halves
 * of a spend travel together without standing up a real database.
 */
function txPrisma(tx: Record<string, unknown>) {
  const committed = { value: false };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (cb: (c: unknown) => Promise<unknown>) => {
      const out = await cb(tx);
      committed.value = true;
      return out;
    }),
  } as unknown as PrismaService;
  return { prisma, committed };
}

describe('PointsRedemptionService', () => {
  it('rejects a redemption before reading or mutating data while the points economy is disabled', async () => {
    const prisma = {
      pointsRedemption: { create: jest.fn() },
    } as unknown as PrismaService;
    const pointsService = {
      getUserPoints: jest.fn(),
      adjustPoints: jest.fn(),
    } as unknown as PointsService;
    const pointsConfig = {
      isEnabled: jest.fn().mockResolvedValue(false),
    } as unknown as PointsConfigService;
    const service = new PointsRedemptionService(
      prisma,
      pointsService,
      pointsConfig,
    );

    await expect(
      service.redeem('user-1', RedemptionType.CONSULT_15MIN),
    ).rejects.toThrow(BadRequestException);

    expect(pointsService.getUserPoints).not.toHaveBeenCalled();
    expect(pointsService.adjustPoints).not.toHaveBeenCalled();
    expect((prisma as any).pointsRedemption.create).not.toHaveBeenCalled();
  });

  it('returns no redemption catalog while the points economy is disabled', async () => {
    const service = new PointsRedemptionService(
      {} as PrismaService,
      {} as PointsService,
      {
        isEnabled: jest.fn().mockResolvedValue(false),
      } as unknown as PointsConfigService,
    );

    await expect(service.getCatalog()).resolves.toEqual([]);
  });

  // ── the spend must be atomic ────────────────────────────────────────────
  // Before this, redeem() charged the points and THEN created the ledger row.
  // A failure in between took the user's points and left no redemption to
  // fulfil or cancel — unrecoverable without a manual DB edit.

  const enabledConfig = () =>
    ({
      isEnabled: jest.fn().mockResolvedValue(true),
    }) as unknown as PointsConfigService;

  it('charges and records the redemption inside one transaction', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'r-1' });
    const txClient = { pointsRedemption: { create } };
    const { prisma, committed } = txPrisma(txClient);
    const adjustPoints = jest
      .fn()
      .mockResolvedValue({ success: true, newBalance: 3000 });
    const points = {
      getUserPoints: jest.fn().mockResolvedValue(5000),
      adjustPoints,
    } as unknown as PointsService;

    const service = new PointsRedemptionService(
      prisma,
      points,
      enabledConfig(),
    );
    const out = await service.redeem('user-1', RedemptionType.CONSULT_15MIN);

    expect(out.redemptionId).toBe('r-1');
    expect(committed.value).toBe(true);
    // the debit received the SAME transaction client the row was written with,
    // not the ambient prisma — that identity is the whole point of the fix
    expect(adjustPoints.mock.calls[0][4]).toBe(txClient);
    expect(create.mock.calls[0][0].data.pointsSpent).toBe(2000);
  });

  it('does not commit the debit when writing the redemption row fails', async () => {
    const { prisma, committed } = txPrisma({
      pointsRedemption: {
        create: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    const points = {
      getUserPoints: jest.fn().mockResolvedValue(5000),
      adjustPoints: jest
        .fn()
        .mockResolvedValue({ success: true, newBalance: 3000 }),
    } as unknown as PointsService;

    const service = new PointsRedemptionService(
      prisma,
      points,
      enabledConfig(),
    );

    await expect(
      service.redeem('user-1', RedemptionType.CONSULT_15MIN),
    ).rejects.toThrow('db down');
    expect(committed.value).toBe(false);
  });

  it('refuses a redemption the balance cannot cover, without charging', async () => {
    const adjustPoints = jest.fn();
    const { prisma } = txPrisma({ pointsRedemption: { create: jest.fn() } });
    const points = {
      getUserPoints: jest.fn().mockResolvedValue(10),
      adjustPoints,
    } as unknown as PointsService;

    const service = new PointsRedemptionService(
      prisma,
      points,
      enabledConfig(),
    );
    await expect(
      service.redeem('user-1', RedemptionType.CONSULT_15MIN),
    ).rejects.toThrow(BadRequestException);
    expect(adjustPoints).not.toHaveBeenCalled();
  });

  // ── the lifecycle must be closeable ─────────────────────────────────────
  // markFulfilled / cancel had zero callers before the admin routes existed.

  it('cancels and refunds in the same transaction', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const { prisma, committed } = txPrisma({
      pointsRedemption: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r-1',
          userId: 'user-1',
          type: RedemptionType.CONSULT_15MIN,
          pointsSpent: 2000,
          status: RedemptionStatus.PENDING,
        }),
        updateMany,
      },
    });
    const adjustPoints = jest
      .fn()
      .mockResolvedValue({ success: true, newBalance: 5000 });
    const points = { adjustPoints } as unknown as PointsService;

    const service = new PointsRedemptionService(
      prisma,
      points,
      enabledConfig(),
    );
    await service.cancel('r-1', 'counselor unavailable');

    expect(committed.value).toBe(true);
    expect(adjustPoints).toHaveBeenCalledWith(
      'user-1',
      'REFUND_CONSULT_15MIN',
      expect.objectContaining({ reason: 'counselor unavailable' }),
      2000, // positive — the refund
      expect.anything(), // the tx client
    );
  });

  it('does not refund twice when two cancels race', async () => {
    // Second caller: the conditional update matches nothing because the first
    // already moved the row out of PENDING.
    const adjustPoints = jest.fn();
    const { prisma } = txPrisma({
      pointsRedemption: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r-1',
          userId: 'user-1',
          type: RedemptionType.CONSULT_15MIN,
          pointsSpent: 2000,
          status: RedemptionStatus.PENDING, // stale read — the race
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    });
    const points = { adjustPoints } as unknown as PointsService;

    const service = new PointsRedemptionService(
      prisma,
      points,
      enabledConfig(),
    );
    await expect(service.cancel('r-1', 'dup')).rejects.toThrow(
      BadRequestException,
    );
    expect(adjustPoints).not.toHaveBeenCalled();
  });

  it('does not fulfil the same redemption twice', async () => {
    const prisma = {
      pointsRedemption: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r-1',
          status: RedemptionStatus.PENDING, // stale read — the race
          metadata: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;

    const service = new PointsRedemptionService(
      prisma,
      {} as PointsService,
      enabledConfig(),
    );
    await expect(service.markFulfilled('r-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  // ── the 15 minutes have to leave a trace ────────────────────────────────
  // FULFILLED only says a booking link went out. Without an outcome there is
  // no way to know whether people attend, whether they convert, or whether
  // 2000 points is the right threshold — the three numbers pricing needs.

  it('records a consultation outcome on a fulfilled redemption', async () => {
    const update = jest.fn().mockResolvedValue({});
    const { prisma } = txPrisma({
      pointsRedemption: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r-1',
          userId: 'user-1',
          type: RedemptionType.CONSULT_15MIN,
          status: RedemptionStatus.FULFILLED,
          metadata: { fulfillment: { bookingUrl: 'https://cal/x' } },
        }),
        update,
      },
    });
    const service = new PointsRedemptionService(
      prisma,
      {} as unknown as PointsService,
      enabledConfig(),
    );

    await service.recordConsultationOutcome('r-1', {
      attended: true,
      intent: 'HOT',
      quotedAmount: 8000,
      converted: true,
    });

    const written = update.mock.calls[0][0].data.metadata;
    expect(written.outcome).toMatchObject({
      attended: true,
      intent: 'HOT',
      converted: true,
    });
    // the fulfilment record survives — outcome is added beside it, not over it
    expect(written.fulfillment).toEqual({ bookingUrl: 'https://cal/x' });
  });

  it('refuses an outcome before the booking went out', async () => {
    const { prisma } = txPrisma({
      pointsRedemption: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r-1',
          status: RedemptionStatus.PENDING,
        }),
        update: jest.fn(),
      },
    });
    const service = new PointsRedemptionService(
      prisma,
      {} as unknown as PointsService,
      enabledConfig(),
    );

    await expect(
      service.recordConsultationOutcome('r-1', { attended: true }),
    ).rejects.toThrow(/only exists once it has been fulfilled/);
  });
});
