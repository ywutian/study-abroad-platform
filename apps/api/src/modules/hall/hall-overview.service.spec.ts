import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/incentive.service';
import { PointsConfigService } from '../points/points-config.service';
import { HallOverviewService } from './hall-overview.service';

describe('HallOverviewService', () => {
  it('returns a neutral payload without reading the ledger while dormant', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      pointHistory: { aggregate: jest.fn() },
    } as unknown as PrismaService;
    const points = {
      getUserPoints: jest.fn(),
      getPointHistory: jest.fn(),
    } as unknown as PointsService;
    const service = new HallOverviewService(prisma, points, {
      isEnabled: jest.fn().mockResolvedValue(false),
    } as unknown as PointsConfigService);

    await expect(service.getOverview('user-1')).resolves.toEqual({
      points: { balance: 0, todayEarned: 0 },
      recentActivity: [],
    });
    expect(points.getUserPoints).not.toHaveBeenCalled();
    expect(points.getPointHistory).not.toHaveBeenCalled();
    expect(prisma.pointHistory.aggregate).not.toHaveBeenCalled();
  });

  it('returns the stored overview while enabled', async () => {
    const createdAt = new Date('2026-08-11T12:00:00.000Z');
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      pointHistory: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { points: 12 } }),
      },
    } as unknown as PrismaService;
    const points = {
      getUserPoints: jest.fn().mockResolvedValue(90),
      getPointHistory: jest.fn().mockResolvedValue([
        {
          action: 'SUBMIT_CASE',
          points: 50,
          metadata: { caseId: 'case-1' },
          createdAt,
        },
      ]),
    } as unknown as PointsService;
    const service = new HallOverviewService(prisma, points, {
      isEnabled: jest.fn().mockResolvedValue(true),
    } as unknown as PointsConfigService);

    await expect(service.getOverview('user-1')).resolves.toEqual({
      points: { balance: 90, todayEarned: 12 },
      recentActivity: [
        {
          action: 'SUBMIT_CASE',
          points: 50,
          metadata: { caseId: 'case-1' },
          createdAt: createdAt.toISOString(),
        },
      ],
    });
  });
});
