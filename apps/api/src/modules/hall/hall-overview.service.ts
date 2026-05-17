import { Injectable, Logger } from '@nestjs/common';
import { ReviewerLevel } from '@prisma/client';
import type { HallOverviewPayload } from '@study-abroad/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/incentive.service';

// Re-export the shared contract so other backend consumers can import it from
// this module without learning about the shared package. The single source of
// truth lives in `packages/shared/src/types/hall.ts`.
export type { HallOverviewPayload };

/**
 * Hall refactor Phase 1 — BFF aggregation endpoint.
 *
 * Returns a single payload powering the Hall top "task flow" hero bar:
 *   - points balance + today's earnings
 *   - swipe stats (badge, streak, accuracy)
 *   - daily challenge progress (X/10 + completed flag)
 *   - reviewer status (L1/L2/L3 + credit)
 *   - acceptPeerReview privacy flag
 *   - recent activity (last 20 PointHistory rows)
 *
 * Replaces 4+ parallel client requests with one round trip — a real win on
 * mobile/low-bandwidth networks. Cache via React Query staleTime, not BFF
 * side, so admin tuning of point values is reflected promptly.
 */
@Injectable()
export class HallOverviewService {
  private readonly logger = new Logger(HallOverviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
  ) {}

  async getOverview(userId: string): Promise<HallOverviewPayload> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Run independent reads in parallel — Postgres handles this fine and we
    // halve perceived latency on the client.
    const [user, swipeStats, balance, recentActivity, todayPointSum] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            reviewerLevel: true,
            reviewerCredit: true,
            acceptPeerReview: true,
            hallAvgRating: true,
            hallReviewCount: true,
          },
        }),
        this.prisma.swipeStats.findUnique({ where: { userId } }),
        this.pointsService.getUserPoints(userId),
        this.pointsService.getPointHistory(userId, 20),
        this.prisma.pointHistory.aggregate({
          where: { userId, createdAt: { gte: todayStart } },
          _sum: { points: true },
        }),
      ]);

    if (!user) {
      // User must exist to call this endpoint (guarded by JwtAuth upstream),
      // but be defensive: return a stable empty payload rather than throw.
      this.logger.warn(`HallOverview requested for missing user ${userId}`);
      return EMPTY_PAYLOAD;
    }

    const accuracy =
      swipeStats && swipeStats.totalSwipes > 0
        ? Math.round((swipeStats.correctCount / swipeStats.totalSwipes) * 100)
        : 0;

    const dailyChallengeDate = swipeStats?.dailyChallengeDate
      ? this.toUtcDate(swipeStats.dailyChallengeDate)
      : null;
    const today = this.toUtcDate(new Date());
    const dailyChallengeCount =
      dailyChallengeDate === today ? (swipeStats?.dailyChallengeCount ?? 0) : 0;

    return {
      points: {
        balance,
        todayEarned: todayPointSum._sum.points ?? 0,
      },
      swipe: {
        badge: swipeStats?.badge ?? 'bronze',
        totalSwipes: swipeStats?.totalSwipes ?? 0,
        correctCount: swipeStats?.correctCount ?? 0,
        accuracy,
        currentStreak: swipeStats?.streak ?? 0,
        bestStreak: swipeStats?.bestStreak ?? 0,
      },
      dailyChallenge: {
        count: dailyChallengeCount,
        target: DAILY_CHALLENGE_TARGET,
        completed: dailyChallengeCount >= DAILY_CHALLENGE_TARGET,
      },
      reviewer: {
        level: user.reviewerLevel,
        credit: user.reviewerCredit,
        acceptPeerReview: user.acceptPeerReview,
        hallAvgRating: user.hallAvgRating,
        hallReviewCount: user.hallReviewCount,
      },
      recentActivity: recentActivity.map((row) => ({
        action: row.action,
        points: row.points,
        metadata: (row.metadata ?? null) as Record<string, unknown> | null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private toUtcDate(date: Date): string {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }
}

const DAILY_CHALLENGE_TARGET = 10;

const EMPTY_PAYLOAD: HallOverviewPayload = {
  points: { balance: 0, todayEarned: 0 },
  swipe: {
    badge: 'bronze',
    totalSwipes: 0,
    correctCount: 0,
    accuracy: 0,
    currentStreak: 0,
    bestStreak: 0,
  },
  dailyChallenge: {
    count: 0,
    target: DAILY_CHALLENGE_TARGET,
    completed: false,
  },
  reviewer: {
    level: ReviewerLevel.L1,
    credit: 100,
    acceptPeerReview: true,
    hallAvgRating: null,
    hallReviewCount: 0,
  },
  recentActivity: [],
};
