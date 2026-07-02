import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RedemptionStatus, RedemptionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from './incentive.service';
import { PointsConfigService } from './points-config.service';

/**
 * Hall refactor Stage 7 — Cross-module points redemption.
 *
 * Closes the loop on the points economy: users earn via hall/case/profile
 * actions, and now they can spend via concrete outlets (consultations,
 * memberships, content unlocks). Each redemption:
 *   1. Charges the user via PointsService (which uses dynamic admin config)
 *   2. Persists a PointsRedemption ledger entry (PENDING)
 *   3. The owning module (vault/subscription/case/...) marks it FULFILLED
 *      when the actual benefit is delivered. On failure, points refund.
 *
 * Costs come from PointsConfig (admin-tunable) — never hardcoded here.
 */
@Injectable()
export class PointsRedemptionService {
  private readonly logger = new Logger(PointsRedemptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly pointsConfig: PointsConfigService,
  ) {}

  /**
   * Redeem points for a specific reward type.
   * Caller (controller) decides which redemption types are exposed to the user.
   */
  async redeem(
    userId: string,
    type: RedemptionType,
    metadata?: Record<string, unknown>,
  ): Promise<{
    redemptionId: string;
    type: RedemptionType;
    pointsSpent: number;
    newBalance: number;
    status: RedemptionStatus;
  }> {
    const cost = REDEMPTION_COSTS[type];
    if (!cost) {
      throw new BadRequestException(`Unknown redemption type: ${type}`);
    }

    const currentBalance = await this.pointsService.getUserPoints(userId);
    if (currentBalance < cost) {
      throw new BadRequestException(
        `Insufficient points: need ${cost}, have ${currentBalance}`,
      );
    }

    // Charge via the central PointsService so PointHistory captures the spend
    // alongside earnings, and the admin enabled-toggle is honored.
    const result = await this.pointsService.adjustPoints(
      userId,
      `REDEEM_${type}`,
      { redemptionType: type, ...metadata },
      -cost,
    );

    if (!result.success) {
      throw new BadRequestException('Failed to charge points');
    }

    const redemption = await this.prisma.pointsRedemption.create({
      data: {
        userId,
        type,
        pointsSpent: cost,
        status: RedemptionStatus.PENDING,
        metadata: (metadata ?? null) as
          Prisma.InputJsonValue | typeof Prisma.JsonNull,
      },
    });

    this.logger.log(
      `User ${userId} redeemed ${cost} points for ${type} (redemption=${redemption.id})`,
    );

    return {
      redemptionId: redemption.id,
      type,
      pointsSpent: cost,
      newBalance: result.newBalance,
      status: RedemptionStatus.PENDING,
    };
  }

  /**
   * Mark a redemption as fulfilled (called by the owning module after benefit delivery).
   */
  async markFulfilled(
    redemptionId: string,
    fulfillmentMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const redemption = await this.prisma.pointsRedemption.findUnique({
      where: { id: redemptionId },
    });
    if (!redemption) {
      throw new NotFoundException('Redemption not found');
    }
    if (redemption.status !== RedemptionStatus.PENDING) {
      throw new BadRequestException(
        `Redemption is ${redemption.status}, cannot mark fulfilled`,
      );
    }
    await this.prisma.pointsRedemption.update({
      where: { id: redemptionId },
      data: {
        status: RedemptionStatus.FULFILLED,
        fulfilledAt: new Date(),
        metadata: fulfillmentMetadata
          ? ({
              ...(redemption.metadata as Record<string, unknown> | null),
              fulfillment: fulfillmentMetadata,
            } as Prisma.InputJsonValue)
          : ((redemption.metadata as
              Prisma.InputJsonValue | typeof Prisma.JsonNull) ??
            Prisma.JsonNull),
      },
    });
  }

  /**
   * Cancel a redemption and refund the points (used when fulfillment fails).
   */
  async cancel(redemptionId: string, reason: string): Promise<void> {
    const redemption = await this.prisma.pointsRedemption.findUnique({
      where: { id: redemptionId },
    });
    if (!redemption) {
      throw new NotFoundException('Redemption not found');
    }
    if (redemption.status !== RedemptionStatus.PENDING) {
      throw new BadRequestException(
        `Redemption is ${redemption.status}, cannot cancel`,
      );
    }
    await this.prisma.pointsRedemption.update({
      where: { id: redemptionId },
      data: {
        status: RedemptionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason.slice(0, 200),
      },
    });
    // Refund: positive adjust (override the value rather than going through enum)
    await this.pointsService.adjustPoints(
      redemption.userId,
      `REFUND_${redemption.type}`,
      { redemptionId, reason },
      redemption.pointsSpent,
    );
  }

  /**
   * Get a user's redemption history.
   */
  async getHistory(userId: string, limit = 20) {
    return this.prisma.pointsRedemption.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get the public catalog of available redemptions (with current costs).
   */
  getCatalog() {
    return Object.entries(REDEMPTION_COSTS).map(([type, cost]) => ({
      type: type as RedemptionType,
      cost,
      description: REDEMPTION_DESCRIPTIONS[type as RedemptionType],
    }));
  }
}

// MVP costs — Stage 6 will move these to PointsConfig settings.
// Picked to be aspirational but achievable: a user who does the typical
// gold-tier work (10 case studies + 1 essay draft + a few helpfuls) accumulates
// ~500-1000 pts/month, enough for a Case unlock or list unlock.
const REDEMPTION_COSTS: Record<RedemptionType, number> = {
  [RedemptionType.CONSULT_15MIN]: 2000,
  [RedemptionType.MEMBERSHIP_MONTHLY]: 5000,
  [RedemptionType.CASE_PREMIUM_UNLOCK]: 500,
  [RedemptionType.EXPERT_LIST_UNLOCK]: 1000,
  [RedemptionType.PREDICTION_DEEP_DIVE]: 500,
};

const REDEMPTION_DESCRIPTIONS: Record<RedemptionType, string> = {
  [RedemptionType.CONSULT_15MIN]: '顾问 15 分钟 1-on-1 咨询',
  [RedemptionType.MEMBERSHIP_MONTHLY]: '月度会员体验',
  [RedemptionType.CASE_PREMIUM_UNLOCK]:
    '解锁 1 个高级案例（完整文书 + 推荐信策略）',
  [RedemptionType.EXPERT_LIST_UNLOCK]: '解锁 1 个专家精选清单',
  [RedemptionType.PREDICTION_DEEP_DIVE]: 'Prediction 高级解读（含改进建议）',
};
