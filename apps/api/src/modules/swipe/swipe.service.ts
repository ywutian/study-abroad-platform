import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Visibility, AdmissionResult } from '@prisma/client';
import {
  SwipeActionDto,
  SwipeCaseDto,
  SwipeResultDto,
  SwipeStatsDto,
  LeaderboardDto,
  LeaderboardEntryDto,
  SwipePrediction,
  SwipeBadge,
} from './dto';

// 徽章升级阈值
const BADGE_THRESHOLDS = {
  bronze: 0,
  silver: 20,
  gold: 50,
  platinum: 100,
  diamond: 200,
};

// 每日挑战目标
const DAILY_CHALLENGE_TARGET = 10;

// 积分奖励
const POINTS_CORRECT = 5;
const POINTS_STREAK_BONUS = 2; // 每连胜额外奖励

@Injectable()
export class SwipeService {
  private readonly logger = new Logger(SwipeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 获取下一个待滑动的案例
   */
  async getNextCase(userId: string): Promise<SwipeCaseDto | null> {
    // 获取用户已滑动过的案例ID
    const swipedCaseIds = await this.prisma.caseSwipe.findMany({
      where: { userId },
      select: { caseId: true },
    });

    const swipedIds = swipedCaseIds.map((s) => s.caseId);

    // 随机获取一个未滑动的公开案例
    const cases = await this.prisma.admissionCase.findMany({
      where: {
        id: { notIn: swipedIds },
        visibility: { in: [Visibility.ANONYMOUS, Visibility.VERIFIED_ONLY] },
        userId: { not: userId }, // 不显示自己的案例
      },
      include: {
        school: true,
      },
      take: 10, // 取多个然后随机选一个
    });

    if (cases.length === 0) {
      return null;
    }

    // 随机选择一个
    const randomCase = cases[Math.floor(Math.random() * cases.length)];

    return {
      id: randomCase.id,
      schoolName: randomCase.school.name,
      schoolNameZh: randomCase.school.nameZh || undefined,
      year: randomCase.year,
      round: randomCase.round || undefined,
      major: randomCase.major || undefined,
      gpaRange: randomCase.gpaRange || undefined,
      satRange: randomCase.satRange || undefined,
      actRange: randomCase.actRange || undefined,
      toeflRange: randomCase.toeflRange || undefined,
      tags: randomCase.tags,
      isVerified: randomCase.isVerified,
      usNewsRank: randomCase.school.usNewsRank || undefined,
      acceptanceRate: randomCase.school.acceptanceRate
        ? Number(randomCase.school.acceptanceRate)
        : undefined,
    };
  }

  /**
   * 批量获取案例（用于预加载）
   */
  async getNextCases(userId: string, count: number = 5): Promise<SwipeCaseDto[]> {
    const swipedCaseIds = await this.prisma.caseSwipe.findMany({
      where: { userId },
      select: { caseId: true },
    });

    const swipedIds = swipedCaseIds.map((s) => s.caseId);

    const cases = await this.prisma.admissionCase.findMany({
      where: {
        id: { notIn: swipedIds },
        visibility: { in: [Visibility.ANONYMOUS, Visibility.VERIFIED_ONLY] },
        userId: { not: userId },
      },
      include: {
        school: true,
      },
      take: count * 2,
    });

    // 随机打乱并取指定数量
    const shuffled = cases.sort(() => Math.random() - 0.5).slice(0, count);

    return shuffled.map((c) => ({
      id: c.id,
      schoolName: c.school.name,
      schoolNameZh: c.school.nameZh || undefined,
      year: c.year,
      round: c.round || undefined,
      major: c.major || undefined,
      gpaRange: c.gpaRange || undefined,
      satRange: c.satRange || undefined,
      actRange: c.actRange || undefined,
      toeflRange: c.toeflRange || undefined,
      tags: c.tags,
      isVerified: c.isVerified,
      usNewsRank: c.school.usNewsRank || undefined,
      acceptanceRate: c.school.acceptanceRate
        ? Number(c.school.acceptanceRate)
        : undefined,
    }));
  }

  /**
   * 提交滑动结果
   */
  async submitSwipe(userId: string, dto: SwipeActionDto): Promise<SwipeResultDto> {
    // 检查案例是否存在
    const admissionCase = await this.prisma.admissionCase.findUnique({
      where: { id: dto.caseId },
    });

    if (!admissionCase) {
      throw new NotFoundException('案例不存在');
    }

    // 检查是否已经滑动过
    const existing = await this.prisma.caseSwipe.findUnique({
      where: {
        userId_caseId: {
          userId,
          caseId: dto.caseId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('已经对此案例进行过预测');
    }

    // 判断是否正确
    const actualResult = admissionCase.result.toLowerCase();
    const isCorrect = this.checkPrediction(dto.prediction, actualResult);

    // 获取或创建统计
    let stats = await this.prisma.swipeStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      stats = await this.prisma.swipeStats.create({
        data: { userId },
      });
    }

    // 更新统计
    const today = new Date().toDateString();
    const statsToday = stats.dailyChallengeDate?.toDateString();
    const isNewDay = statsToday !== today;

    const newStreak = isCorrect ? stats.streak + 1 : 0;
    const newBestStreak = Math.max(stats.bestStreak, newStreak);
    const newCorrectCount = stats.correctCount + (isCorrect ? 1 : 0);
    const newBadge = this.calculateBadge(newCorrectCount);
    const badgeUpgraded = newBadge !== stats.badge;

    // 计算积分
    let pointsEarned = 0;
    if (isCorrect) {
      pointsEarned = POINTS_CORRECT + (newStreak > 1 ? POINTS_STREAK_BONUS * (newStreak - 1) : 0);
      pointsEarned = Math.min(pointsEarned, 20); // 最多20分
    }

    // 事务更新
    await this.prisma.$transaction([
      // 创建滑动记录
      this.prisma.caseSwipe.create({
        data: {
          userId,
          caseId: dto.caseId,
          prediction: dto.prediction,
          actualResult,
          isCorrect,
        },
      }),
      // 更新统计
      this.prisma.swipeStats.update({
        where: { userId },
        data: {
          totalSwipes: { increment: 1 },
          correctCount: newCorrectCount,
          streak: newStreak,
          bestStreak: newBestStreak,
          badge: newBadge,
          dailyChallengeDate: new Date(),
          dailyChallengeCount: isNewDay ? 1 : { increment: 1 },
        },
      }),
      // 更新用户积分
      ...(pointsEarned > 0
        ? [
            this.prisma.user.update({
              where: { id: userId },
              data: { points: { increment: pointsEarned } },
            }),
            this.prisma.pointHistory.create({
              data: {
                userId,
                action: 'SWIPE_CORRECT',
                points: pointsEarned,
                metadata: { caseId: dto.caseId, streak: newStreak },
              },
            }),
          ]
        : []),
    ]);

    return {
      caseId: dto.caseId,
      prediction: dto.prediction,
      actualResult,
      isCorrect,
      currentStreak: newStreak,
      pointsEarned,
      badgeUpgraded,
      currentBadge: newBadge as SwipeBadge,
    };
  }

  /**
   * 获取用户统计
   */
  async getStats(userId: string): Promise<SwipeStatsDto> {
    let stats = await this.prisma.swipeStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      stats = await this.prisma.swipeStats.create({
        data: { userId },
      });
    }

    const accuracy = stats.totalSwipes > 0
      ? Math.round((stats.correctCount / stats.totalSwipes) * 100)
      : 0;

    const toNextBadge = this.getToNextBadge(stats.correctCount, stats.badge);

    // 检查今日挑战
    const today = new Date().toDateString();
    const dailyCount = stats.dailyChallengeDate?.toDateString() === today
      ? stats.dailyChallengeCount
      : 0;

    return {
      totalSwipes: stats.totalSwipes,
      correctCount: stats.correctCount,
      accuracy,
      currentStreak: stats.streak,
      bestStreak: stats.bestStreak,
      badge: stats.badge as SwipeBadge,
      toNextBadge,
      dailyChallengeCount: dailyCount,
      dailyChallengeTarget: DAILY_CHALLENGE_TARGET,
    };
  }

  /**
   * 获取排行榜
   */
  async getLeaderboard(userId: string, limit: number = 20): Promise<LeaderboardDto> {
    const topUsers = await this.prisma.swipeStats.findMany({
      where: { totalSwipes: { gte: 10 } }, // 至少10次滑动才能上榜
      orderBy: [
        { correctCount: 'desc' },
        { totalSwipes: 'asc' }, // 同正确数时，滑动次数少的优先
      ],
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            profile: {
              select: { realName: true },
            },
          },
        },
      },
    });

    const entries: LeaderboardEntryDto[] = topUsers.map((stats, index) => ({
      rank: index + 1,
      userId: stats.userId,
      userName: stats.user.profile?.realName || `用户${stats.userId.slice(-4)}`,
      accuracy: stats.totalSwipes > 0
        ? Math.round((stats.correctCount / stats.totalSwipes) * 100)
        : 0,
      totalSwipes: stats.totalSwipes,
      correctCount: stats.correctCount,
      badge: stats.badge as SwipeBadge,
      isCurrentUser: stats.userId === userId,
    }));

    // 获取当前用户排名
    let currentUserEntry: LeaderboardEntryDto | undefined;
    const currentUserInTop = entries.find((e) => e.isCurrentUser);

    if (!currentUserInTop) {
      const userStats = await this.prisma.swipeStats.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              profile: { select: { realName: true } },
            },
          },
        },
      });

      if (userStats && userStats.totalSwipes >= 10) {
        // 计算用户排名
        const rankAbove = await this.prisma.swipeStats.count({
          where: {
            OR: [
              { correctCount: { gt: userStats.correctCount } },
              {
                correctCount: userStats.correctCount,
                totalSwipes: { lt: userStats.totalSwipes },
              },
            ],
            totalSwipes: { gte: 10 },
          },
        });

        currentUserEntry = {
          rank: rankAbove + 1,
          userId,
          userName: userStats.user.profile?.realName || `用户${userId.slice(-4)}`,
          accuracy: userStats.totalSwipes > 0
            ? Math.round((userStats.correctCount / userStats.totalSwipes) * 100)
            : 0,
          totalSwipes: userStats.totalSwipes,
          correctCount: userStats.correctCount,
          badge: userStats.badge as SwipeBadge,
          isCurrentUser: true,
        };
      }
    }

    return {
      entries,
      currentUserEntry: currentUserInTop || currentUserEntry,
    };
  }

  // ============ Helper Methods ============

  private checkPrediction(prediction: SwipePrediction, actualResult: string): boolean {
    const resultMap: Record<string, SwipePrediction> = {
      admitted: SwipePrediction.ADMIT,
      rejected: SwipePrediction.REJECT,
      waitlisted: SwipePrediction.WAITLIST,
      deferred: SwipePrediction.WAITLIST, // 延期算候补
    };

    return resultMap[actualResult] === prediction;
  }

  private calculateBadge(correctCount: number): string {
    if (correctCount >= BADGE_THRESHOLDS.diamond) return 'diamond';
    if (correctCount >= BADGE_THRESHOLDS.platinum) return 'platinum';
    if (correctCount >= BADGE_THRESHOLDS.gold) return 'gold';
    if (correctCount >= BADGE_THRESHOLDS.silver) return 'silver';
    return 'bronze';
  }

  private getToNextBadge(correctCount: number, currentBadge: string): number {
    const badgeOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const currentIndex = badgeOrder.indexOf(currentBadge);

    if (currentIndex === badgeOrder.length - 1) return 0;

    const nextBadge = badgeOrder[currentIndex + 1];
    return BADGE_THRESHOLDS[nextBadge as keyof typeof BADGE_THRESHOLDS] - correctCount;
  }
}



