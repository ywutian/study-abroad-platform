import { Injectable, Logger } from '@nestjs/common';
import type { HallOverviewPayload } from '@study-abroad/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/incentive.service';
import { PointsConfigService } from '../points/points-config.service';

// Re-export the shared contract so other backend consumers can import it from
// this module without learning about the shared package. The single source of
// truth lives in `packages/shared/src/types/hall.ts`.
export type { HallOverviewPayload };

/**
 * Hall refactor Phase 1 — BFF aggregation endpoint.
 *
 * Returns a single payload powering the Points Center:
 *   - points balance + today's earnings
 *   - recent activity (last 20 PointHistory rows)
 *
 * 2026-05 Hall Plan C (C3): de-gamified. The swipe (badge/streak) and daily
 * challenge sections were removed — the path tab no longer has a casino
 * layer. Hall §7 Decision B: the `reviewer` block was removed when the
 * peer-review subsystem was retired. The remaining `points` block exists
 * only for the Points Center.
 *
 * Cache via React Query staleTime, not BFF side, so admin tuning of point
 * values is reflected promptly.
 */
@Injectable()
export class HallOverviewService {
  private readonly logger = new Logger(HallOverviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly pointsConfig: PointsConfigService,
  ) {}

  async getOverview(userId: string): Promise<HallOverviewPayload> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Run independent reads in parallel — Postgres handles this fine and we
    // halve perceived latency on the client.
    const [user, pointsEnabled] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      this.pointsConfig.isEnabled(),
    ]);

    if (!user) {
      // User must exist to call this endpoint (guarded by JwtAuth upstream),
      // but be defensive: return a stable empty payload rather than throw.
      this.logger.warn(`HallOverview requested for missing user ${userId}`);
      return EMPTY_PAYLOAD;
    }
    if (!pointsEnabled) return EMPTY_PAYLOAD;

    const [balance, recentActivity, todayPointSum] = await Promise.all([
      this.pointsService.getUserPoints(userId),
      this.pointsService.getPointHistory(userId, 20),
      this.prisma.pointHistory.aggregate({
        where: { userId, createdAt: { gte: todayStart } },
        _sum: { points: true },
      }),
    ]);

    return {
      points: {
        balance,
        todayEarned: todayPointSum._sum.points ?? 0,
      },
      recentActivity: recentActivity.map((row) => ({
        action: row.action,
        points: row.points,
        metadata: (row.metadata ?? null) as Record<string, unknown> | null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}

const EMPTY_PAYLOAD: HallOverviewPayload = {
  points: { balance: 0, todayEarned: 0 },
  recentActivity: [],
};
