import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RedemptionStatus, RedemptionType } from '@prisma/client';
import { USER_SUMMARY_SELECT } from '../../common/constants/prisma-selects';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from './incentive.service';
import { PointsConfigService } from './points-config.service';

/**
 * Hall refactor Stage 7 — Cross-module points redemption.
 *
 * Closes the loop on the points economy: users earn via hall/case/profile
 * actions, and now they can spend via concrete outlets (consultations,
 * memberships, content unlocks). Each redemption:
 *   1. Charges the user AND writes the PointsRedemption ledger entry (PENDING)
 *      in one transaction — see redeem() for why they cannot be split
 *   2. An operator delivers the benefit and closes it out via
 *      `PATCH /admin/points/redemptions/:id/{fulfil,cancel}`. Cancelling
 *      refunds the points, in the same transaction as the status change.
 *
 * Step 2 used to read "the owning module (vault/subscription/case/…) marks it
 * FULFILLED". That module was never built: `markFulfilled` and `cancel` had
 * zero callers anywhere in the repo, so every redemption stayed PENDING for
 * good — points spent, nothing delivered, no refund path. Every value of
 * RedemptionType is delivered by a human (a counselor slot, a manual unlock),
 * so there is nothing to automate here; the fix is an operator route, not a
 * caller in another service. Do not re-describe this as automatic.
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
    if (!(await this.pointsConfig.isEnabled())) {
      throw new BadRequestException(
        'Points redemption is unavailable while the points economy is disabled',
      );
    }

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

    // The debit and the redemption row MUST land together. Charging first and
    // creating the row afterwards — as this did — means a failure in between
    // takes the user's points and leaves no redemption to fulfil or cancel:
    // the balance is gone and nothing records what it bought. The balance
    // re-check inside adjustPoints now also reads through `tx`, so two
    // concurrent redemptions cannot both pass a check against the same
    // pre-spend balance.
    const { result, redemption } = await this.prisma.$transaction(
      async (tx) => {
        // Charge via the central PointsService so PointHistory captures the
        // spend alongside earnings, and the admin enabled-toggle is honored.
        const charged = await this.pointsService.adjustPoints(
          userId,
          `REDEEM_${type}`,
          { redemptionType: type, ...metadata },
          -cost,
          tx,
        );

        if (!charged.success) {
          throw new BadRequestException(
            charged.message ?? 'Failed to charge points',
          );
        }

        const row = await tx.pointsRedemption.create({
          data: {
            userId,
            type,
            pointsSpent: cost,
            status: RedemptionStatus.PENDING,
            metadata: (metadata ?? null) as
              Prisma.InputJsonValue | typeof Prisma.JsonNull,
          },
        });

        return { result: charged, redemption: row };
      },
    );

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
   * Mark a redemption as fulfilled, once an operator has delivered the benefit.
   * Reached from `PATCH /admin/points/redemptions/:id/fulfil` — there is no
   * "owning module" that does this automatically; see the class doc.
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
    // Conditional update rather than update-by-id: the PENDING check above is
    // a separate read, so two operators clicking "fulfilled" at once would
    // both pass it. Narrowing the WHERE to PENDING makes the database settle
    // it, and a count of 0 means someone else already did.
    const claimed = await this.prisma.pointsRedemption.updateMany({
      where: { id: redemptionId, status: RedemptionStatus.PENDING },
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
    if (claimed.count === 0) {
      throw new BadRequestException(
        'Redemption is no longer pending, cannot mark fulfilled',
      );
    }
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
    // Status change and refund in one transaction. Cancelling first and
    // refunding after would, on a failure in between, leave the redemption
    // CANCELLED with the points still spent — the user loses them with no
    // pending row left to retry against. The status guard above is re-checked
    // inside the transaction so two concurrent cancels cannot both refund.
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.pointsRedemption.updateMany({
        where: { id: redemptionId, status: RedemptionStatus.PENDING },
        data: {
          status: RedemptionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason.slice(0, 200),
        },
      });
      if (claimed.count === 0) {
        throw new BadRequestException(
          'Redemption is no longer pending, cannot cancel',
        );
      }

      // Refund: positive adjust (override the value rather than going through enum)
      await this.pointsService.adjustPoints(
        redemption.userId,
        `REFUND_${redemption.type}`,
        { redemptionId, reason },
        redemption.pointsSpent,
        tx,
      );
    });
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
   * Admin queue: redemptions awaiting human fulfilment, oldest first.
   *
   * Every RedemptionType is delivered by a person, so this is the work list.
   * Oldest-first because the thing that matters operationally is the one a
   * user has been waiting longest for.
   */
  async listPending(limit = 50) {
    return this.prisma.pointsRedemption.findMany({
      where: { status: RedemptionStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: Math.min(200, Math.max(1, limit)),
      include: {
        // Shared shape plus email: fulfilling a CONSULT_15MIN means sending the
        // user a booking link, so the operator needs a way to reach them. This
        // route is ADMIN + SYSTEM_SETTINGS gated.
        user: { select: { ...USER_SUMMARY_SELECT, email: true } },
      },
    });
  }

  /**
   * Get the public catalog of available redemptions (with current costs).
   */
  async getCatalog() {
    if (!(await this.pointsConfig.isEnabled())) return [];
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
