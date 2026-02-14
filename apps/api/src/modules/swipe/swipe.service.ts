import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Visibility, MemoryType } from '@prisma/client';
import {
  SwipeActionDto,
  SwipeCaseDto,
  SwipeResultDto,
  SwipeStatsDto,
  SwipeBatchResultDto,
  LeaderboardDto,
  LeaderboardEntryDto,
  SwipePrediction,
  SwipeBadge,
} from './dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import {
  CaseIncentiveService,
  PointAction,
} from '../case/case-incentive.service';
import { PointsConfigService } from '../case/points-config.service';

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

// Streak bonus multiplier
const POINTS_STREAK_BONUS = 2;
const MAX_POINTS_PER_SWIPE = 20;

// Prisma include 类型定义 — 含学校 + 用户档案 (活动、奖项、成绩)
const SWIPE_CASE_INCLUDE = {
  school: true,
  user: {
    select: {
      profile: {
        select: {
          grade: true,
          currentSchoolType: true,
          activities: {
            select: { category: true },
          },
          awards: {
            select: { level: true },
          },
          testScores: {
            select: { type: true, score: true },
          },
        },
      },
    },
  },
} as const;

type AdmissionCaseWithDetails = Prisma.AdmissionCaseGetPayload<{
  include: typeof SWIPE_CASE_INCLUDE;
}>;

@Injectable()
export class SwipeService {
  private readonly logger = new Logger(SwipeService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => CaseIncentiveService))
    private caseIncentiveService: CaseIncentiveService,
    @Inject(forwardRef(() => PointsConfigService))
    private pointsConfig: PointsConfigService,
    @Optional()
    @Inject(forwardRef(() => MemoryManagerService))
    private memoryManager?: MemoryManagerService,
  ) {}

  // ============ 案例获取 ============

  /**
   * 批量获取案例（用于预加载）
   *
   * 使用 Prisma 关联过滤 `swipes: { none: { userId } }` 替代 notIn 数组，
   * 避免大数据量下 SQL IN 子句膨胀（P0 性能优化）
   */
  async getNextCases(
    userId: string,
    count: number = 5,
  ): Promise<SwipeBatchResultDto> {
    // 利用 CaseSwipe 关联做 NOT EXISTS 子查询，O(log N) 复杂度
    const cases = await this.prisma.admissionCase.findMany({
      where: {
        visibility: { in: [Visibility.ANONYMOUS, Visibility.VERIFIED_ONLY] },
        userId: { not: userId }, // 不显示自己的案例
        swipes: { none: { userId } }, // 未被该用户滑动过
      },
      include: SWIPE_CASE_INCLUDE,
      take: count * 2, // 多取一些用于随机打乱
    });

    // Fisher-Yates 均匀洗牌
    const shuffled = this.shuffleArray(cases).slice(0, count);

    // 查询 meta 信息用于前端区分空状态
    const [totalAvailable, totalSwiped] = await Promise.all([
      this.prisma.admissionCase.count({
        where: {
          visibility: { in: [Visibility.ANONYMOUS, Visibility.VERIFIED_ONLY] },
          userId: { not: userId },
        },
      }),
      this.prisma.caseSwipe.count({
        where: { userId },
      }),
    ]);

    return {
      cases: shuffled.map((c) => this.mapCaseToDto(c)),
      meta: {
        totalAvailable,
        totalSwiped,
        hasMore: cases.length > 0,
      },
    };
  }

  // ============ 预测提交 ============

  /**
   * 提交滑动结果
   *
   * 使用 try-catch P2002 替代 find-then-create，消除竞态条件（P0 修复）
   * 遵循 ADR-0006: P2002 -> 409 DUPLICATE_ENTRY
   */
  async submitSwipe(
    userId: string,
    dto: SwipeActionDto,
  ): Promise<SwipeResultDto> {
    // 检查案例是否存在
    const admissionCase = await this.prisma.admissionCase.findUnique({
      where: { id: dto.caseId },
    });

    if (!admissionCase) {
      throw new NotFoundException('案例不存在');
    }

    // 判断是否正确
    const actualResult = admissionCase.result.toLowerCase();
    const isCorrect = this.checkPrediction(dto.prediction, actualResult);

    // 获取或创建统计（upsert 消除竞态条件）
    const stats = await this.prisma.swipeStats.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    // 计算更新值
    const today = this.getUtcDateString();
    const statsToday = stats.dailyChallengeDate
      ? this.getUtcDateString(stats.dailyChallengeDate)
      : null;
    const isNewDay = statsToday !== today;

    const newStreak = isCorrect ? stats.streak + 1 : 0;
    const newBestStreak = Math.max(stats.bestStreak, newStreak);
    const newCorrectCount = stats.correctCount + (isCorrect ? 1 : 0);
    const newBadge = this.calculateBadge(newCorrectCount);
    const badgeUpgraded = newBadge !== stats.badge;

    // 计算积分 (base value from config)
    const baseSwipePoints = await this.pointsConfig.getPointValue(
      PointAction.SWIPE_CORRECT,
    );
    let pointsEarned = 0;
    if (isCorrect) {
      pointsEarned =
        baseSwipePoints +
        (newStreak > 1 ? POINTS_STREAK_BONUS * (newStreak - 1) : 0);
      pointsEarned = Math.min(pointsEarned, MAX_POINTS_PER_SWIPE);
    }

    // 事务更新（直接 create，用 P2002 catch 处理重复提交）
    try {
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
      ]);

      // Award points outside transaction via centralized service
      if (pointsEarned > 0) {
        await this.caseIncentiveService
          .adjustPoints(
            userId,
            PointAction.SWIPE_CORRECT,
            {
              caseId: dto.caseId,
              streak: newStreak,
            },
            pointsEarned,
          )
          .catch((err) => {
            this.logger.error('Failed to award swipe points', err);
          });
      }
    } catch (error) {
      // P2002: 唯一约束冲突 — 用户已对此案例提交过预测
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('已经对此案例进行过预测');
      }
      throw error;
    }

    const result: SwipeResultDto = {
      caseId: dto.caseId,
      prediction: dto.prediction,
      actualResult,
      isCorrect,
      currentStreak: newStreak,
      pointsEarned,
      badgeUpgraded,
      currentBadge: newBadge as SwipeBadge,
    };

    // 记录到记忆系统（异步，不阻塞响应）
    this.saveSwipeToMemory(
      userId,
      admissionCase,
      dto.prediction,
      actualResult,
      isCorrect,
      newStreak,
    ).catch((err) => {
      this.logger.warn('Failed to save swipe to memory', err);
    });

    return result;
  }

  // ============ 统计 ============

  /**
   * 获取用户统计
   *
   * 使用 upsert 替代 find-then-create，消除竞态条件
   */
  async getStats(userId: string): Promise<SwipeStatsDto> {
    const stats = await this.prisma.swipeStats.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const accuracy =
      stats.totalSwipes > 0
        ? Math.round((stats.correctCount / stats.totalSwipes) * 100)
        : 0;

    const toNextBadge = this.getToNextBadge(stats.correctCount, stats.badge);

    // 检查今日挑战（使用 UTC 日期，避免时区问题）
    const today = this.getUtcDateString();
    const dailyCount =
      stats.dailyChallengeDate &&
      this.getUtcDateString(stats.dailyChallengeDate) === today
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

  // ============ 排行榜 ============

  /**
   * 获取排行榜
   *
   * 隐私保护: userId 脱敏，userName 仅显示首字符 + **
   */
  async getLeaderboard(
    userId: string,
    limit: number = 20,
  ): Promise<LeaderboardDto> {
    const topUsers = await this.prisma.swipeStats.findMany({
      where: { totalSwipes: { gte: 10 } }, // 至少 10 次滑动才能上榜
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

    const entries: LeaderboardEntryDto[] = topUsers.map((stats, index) => {
      const isCurrentUser = stats.userId === userId;
      return {
        rank: index + 1,
        userId: isCurrentUser ? stats.userId : this.maskUserId(stats.userId),
        userName: isCurrentUser
          ? stats.user.profile?.realName || `用户${stats.userId.slice(-4)}`
          : this.maskUserName(stats.user.profile?.realName, stats.userId),
        accuracy:
          stats.totalSwipes > 0
            ? Math.round((stats.correctCount / stats.totalSwipes) * 100)
            : 0,
        totalSwipes: stats.totalSwipes,
        correctCount: stats.correctCount,
        badge: stats.badge as SwipeBadge,
        isCurrentUser,
      };
    });

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
          userName:
            userStats.user.profile?.realName || `用户${userId.slice(-4)}`,
          accuracy:
            userStats.totalSwipes > 0
              ? Math.round(
                  (userStats.correctCount / userStats.totalSwipes) * 100,
                )
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

  // ============ 记忆系统集成 ============

  /**
   * 保存滑动预测到记忆系统
   */
  private async saveSwipeToMemory(
    userId: string,
    admissionCase: { id: string; result: string; major?: string | null },
    prediction: SwipePrediction,
    actualResult: string,
    isCorrect: boolean,
    streak: number,
  ): Promise<void> {
    if (!this.memoryManager) return;

    // 记录用户的判断决策（仅在连胜达到一定程度或判断错误时记录）
    if (!isCorrect || streak >= 5) {
      const predictionText =
        prediction === 'admit'
          ? '录取'
          : prediction === 'reject'
            ? '拒绝'
            : '候补';
      const actualText =
        actualResult === 'admitted'
          ? '录取'
          : actualResult === 'rejected'
            ? '拒绝'
            : '候补';

      await this.memoryManager.remember(userId, {
        type: MemoryType.DECISION,
        category: 'swipe_prediction',
        content: isCorrect
          ? `案例预测游戏：连续正确 ${streak} 次！用户对录取判断能力较强`
          : `案例预测游戏：预测为${predictionText}，实际${actualText}。${admissionCase.major ? `专业：${admissionCase.major}` : ''}`,
        importance: isCorrect ? 0.5 : 0.6,
        metadata: {
          caseId: admissionCase.id,
          prediction,
          actualResult,
          isCorrect,
          streak,
          source: 'swipe_service',
        },
      });
    }

    // 徽章升级时记录
    if (streak > 0 && streak % 10 === 0) {
      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'achievement',
        content: `案例预测游戏达成 ${streak} 连胜成就`,
        importance: 0.4,
        metadata: { streak, source: 'swipe_service' },
      });
    }
  }

  // ============ Helper Methods ============

  /** 将 AdmissionCase (含 school + user profile) 映射为 SwipeCaseDto */
  private mapCaseToDto(c: AdmissionCaseWithDetails): SwipeCaseDto {
    const profile = c.user?.profile;

    // 从用户档案聚合匿名化信息
    const activityCount = profile?.activities?.length ?? 0;
    const awardCount = profile?.awards?.length ?? 0;

    // 活动类别去重取前 3
    const activityHighlights = profile?.activities
      ? [...new Set(profile.activities.map((a) => a.category))].slice(0, 3)
      : [];

    // 奖项最高等级
    const AWARD_LEVEL_ORDER = [
      'INTERNATIONAL',
      'NATIONAL',
      'STATE',
      'REGIONAL',
      'SCHOOL',
    ];
    const highestAwardLevel = profile?.awards?.length
      ? AWARD_LEVEL_ORDER.find((lvl) =>
          profile.awards.some((a) => a.level === lvl),
        ) || undefined
      : undefined;

    // AP/IB 门数
    const apScores =
      profile?.testScores?.filter(
        (ts) => ts.type === 'AP' || ts.type === 'IB',
      ) ?? [];

    return {
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
      // 扩展学校信息
      schoolState: c.school.state || undefined,
      schoolCity: c.school.city || undefined,
      graduationRate: c.school.graduationRate
        ? Number(c.school.graduationRate)
        : undefined,
      totalEnrollment: c.school.totalEnrollment || undefined,
      tuition: c.school.tuition || undefined,
      essayType: c.essayType || undefined,
      isPrivateSchool: c.school.isPrivate ?? undefined,
      // 申请者档案聚合信息 (匿名化)
      applicantGrade: profile?.grade || undefined,
      applicantSchoolType: profile?.currentSchoolType || undefined,
      activityCount,
      activityHighlights,
      awardCount,
      highestAwardLevel,
      apCount: apScores.length || undefined,
    };
  }

  /** Fisher-Yates 均匀洗牌算法 */
  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** 获取 UTC 日期字符串 (YYYY-MM-DD)，避免时区问题 */
  private getUtcDateString(date?: Date): string {
    const d = date ?? new Date();
    return d.toISOString().split('T')[0];
  }

  /** 脱敏用户 ID: 仅保留最后 4 位 */
  private maskUserId(userId: string): string {
    return `****${userId.slice(-4)}`;
  }

  /** 脱敏用户名: 首字符 + ** */
  private maskUserName(
    realName: string | null | undefined,
    userId: string,
  ): string {
    if (realName && realName.length > 0) {
      return `${realName.charAt(0)}**`;
    }
    return `用户${userId.slice(-4)}`;
  }

  private checkPrediction(
    prediction: SwipePrediction,
    actualResult: string,
  ): boolean {
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
    return (
      BADGE_THRESHOLDS[nextBadge as keyof typeof BADGE_THRESHOLDS] -
      correctCount
    );
  }
}
