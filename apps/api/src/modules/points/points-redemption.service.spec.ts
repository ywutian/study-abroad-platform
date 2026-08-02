import { BadRequestException } from '@nestjs/common';
import { RedemptionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from './incentive.service';
import { PointsConfigService } from './points-config.service';
import { PointsRedemptionService } from './points-redemption.service';

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
});
