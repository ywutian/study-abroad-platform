import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { fireAndForget } from '../../common/utils/async.util';
import { clampPercentRate } from '../../common/utils/percent.util';
import { Prisma, Visibility, MemoryType } from '@prisma/client';
import { CASE_REVIEW_APPROVED_WHERE } from '../../common/constants/prisma-selects';
import { ERR } from '../../common/constants/error-messages';
import {
  SwipeActionDto,
  SwipeCaseDto,
  SwipeResultDto,
  SwipeStatsDto,
  SwipeBatchResultDto,
  SwipePrediction,
} from './swipe-dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

// Prisma include 类型定义 — 含学校 + 用户档案 (活动、奖项、成绩)
/**
 * Which cases the swipe game may deal — and, just as importantly, may grade.
 *
 * `submitSwipe` used to filter on `CASE_REVIEW_APPROVED_WHERE` alone. Review
 * status says a human checked the data; it says nothing about who may read it,
 * and `AdmissionCase.visibility` defaults to PRIVATE. Since the response
 * reports whether your guess was right, and the outcome has three values, that
 * turned any approved case id into a two-request oracle for its result —
 * PRIVATE rows included. Dealing and grading now read the same predicate, so a
 * card that cannot be dealt cannot be graded either.
 *
 * Deliberately NOT `caseVisibilityWhereForRole`: this set includes
 * VERIFIED_ONLY without checking the caller's role, which is wider than the
 * REST routes grant a plain USER. That is pre-existing and is a product
 * question about what the game is for — narrowing it here would silently shrink
 * every non-verified user's deck. Recorded rather than changed.
 */
const SWIPE_ELIGIBLE_CASE_WHERE = {
  visibility: { in: [Visibility.ANONYMOUS, Visibility.VERIFIED_ONLY] },
  ...CASE_REVIEW_APPROVED_WHERE,
};

const SWIPE_CASE_INCLUDE = {
  school: true,
  user: {
    select: {
      profile: {
        select: {
          grade: true,
          currentSchoolType: true,
          targetMajor: true,
          activities: {
            select: { category: true },
          },
          awards: {
            select: { level: true },
          },
          // 2026-05 Hall Plan C (security B3): `nationality` and the raw
          // test `score` are NOT selected. Swipe is a public surface; it
          // only needs coarse aggregate signal (counts by type/level),
          // never an applicant's precise score or nationality.
          testScores: {
            select: { type: true },
          },
        },
      },
    },
  },
} as const;

// 奖项等级排序 (从高到低)
const AWARD_LEVEL_ORDER = [
  'INTERNATIONAL',
  'NATIONAL',
  'STATE',
  'REGIONAL',
  'SCHOOL',
];

type AdmissionCaseWithDetails = Prisma.AdmissionCaseGetPayload<{
  include: typeof SWIPE_CASE_INCLUDE;
}>;

@Injectable()
export class SwipeService {
  private readonly logger = new Logger(SwipeService.name);

  constructor(
    private prisma: PrismaService,
    @Optional()
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
        ...SWIPE_ELIGIBLE_CASE_WHERE,
        userId: { not: userId }, // 不显示自己的案例
        swipes: { none: { userId } }, // 未被该用户滑动过
        // 2026-05 Hall Plan C (C3): exclude `deferred` cases from the
        // guess-the-outcome deck. Deferred (early round → moved to RD,
        // still pending) is NOT admit/reject/waitlist — there is no
        // correct swipe for it, and mapping it to waitlist mis-grades
        // the user and corrupts the calibration stat.
        result: { in: ['ADMITTED', 'REJECTED', 'WAITLISTED'] },
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
          ...SWIPE_ELIGIBLE_CASE_WHERE,
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
    // 检查案例是否存在、已审核通过，且是这个游戏本来就会发出的牌。
    // See SWIPE_ELIGIBLE_CASE_WHERE: filtering on review status alone made the
    // `isCorrect` in this response an oracle for any approved case's outcome.
    const admissionCase = await this.prisma.admissionCase.findFirst({
      where: { id: dto.caseId, ...SWIPE_ELIGIBLE_CASE_WHERE },
    });

    if (!admissionCase) {
      throw new NotFoundException(ERR.NOT_FOUND.case());
    }

    // 判断是否正确
    const actualResult = admissionCase.result.toLowerCase();
    const isCorrect = this.checkPrediction(dto.prediction, actualResult);

    // 获取或创建统计（upsert 消除竞态条件）
    // 2026-05 Hall Plan C (C3): de-gamified. We keep only the private
    // calibration counters (totalSwipes / correctCount) — no streak, no
    // badge, no daily challenge, no points award.
    await this.prisma.swipeStats.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

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
        // 更新统计（仅累加 totalSwipes / correctCount）
        this.prisma.swipeStats.update({
          where: { userId },
          data: {
            totalSwipes: { increment: 1 },
            correctCount: isCorrect ? { increment: 1 } : undefined,
          },
        }),
      ]);
    } catch (error) {
      // P2002: 唯一约束冲突 — 用户已对此案例提交过预测
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(ERR.BAD_REQUEST.alreadyPredicted());
      }
      throw error;
    }

    const result: SwipeResultDto = {
      caseId: dto.caseId,
      prediction: dto.prediction,
      actualResult,
      isCorrect,
    };

    // 记录到记忆系统（异步，不阻塞响应）
    fireAndForget(
      this.saveSwipeToMemory(
        userId,
        admissionCase,
        dto.prediction,
        actualResult,
        isCorrect,
      ),
      this.logger,
      'Failed to save swipe to memory',
    );

    return result;
  }

  // ============ 统计 ============

  /**
   * 获取用户统计
   *
   * 2026-05 Hall Plan C (C3): de-gamified. Returns only the private,
   * self-only calibration accuracy (total / correct / accuracy). This stat
   * is visible to the user alone and is never aggregated into a leaderboard.
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

    return {
      totalSwipes: stats.totalSwipes,
      correctCount: stats.correctCount,
      accuracy,
    };
  }

  // ============ 记忆系统集成 ============

  /**
   * 保存滑动预测到记忆系统
   *
   * 2026-05 Hall Plan C (C3): de-gamified. Only the substantive learning
   * signal — a wrong guess — is recorded, to help the AI agent understand
   * where the user mis-calibrates. No streak / achievement memory writes.
   */
  private async saveSwipeToMemory(
    userId: string,
    admissionCase: { id: string; result: string; major?: string | null },
    prediction: SwipePrediction,
    actualResult: string,
    isCorrect: boolean,
  ): Promise<void> {
    if (!this.memoryManager) return;
    if (isCorrect) return;

    const predictionText =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      prediction === 'admit'
        ? '录取'
        : // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
          prediction === 'reject'
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
      content: `案例预测：预测为${predictionText}，实际${actualText}。${admissionCase.major ? `专业：${admissionCase.major}` : ''}`,
      importance: 0.6,
      metadata: {
        caseId: admissionCase.id,
        prediction,
        actualResult,
        isCorrect,
        source: 'swipe_service',
      },
    });
  }

  // ============ Helper Methods ============

  /**
   * 从用户档案聚合匿名化信息 (活动、奖项、AP/IB)。
   * 供 mapCaseToDto() 和 getChallengeCase() 共用，避免逻辑重复。
   */
  private aggregateProfileInfo(
    profile: AdmissionCaseWithDetails['user']['profile'],
  ) {
    const activityCount = profile?.activities?.length ?? 0;
    const awardCount = profile?.awards?.length ?? 0;

    const activityHighlights = profile?.activities
      ? [...new Set(profile.activities.map((a) => a.category))].slice(0, 3)
      : [];

    const highestAwardLevel = profile?.awards?.length
      ? AWARD_LEVEL_ORDER.find((lvl) =>
          profile.awards.some((a) => a.level === lvl),
        ) || undefined
      : undefined;

    const apCount =
      profile?.testScores?.filter((ts) => ts.type === 'AP' || ts.type === 'IB')
        ?.length ?? 0;

    return {
      activityCount,
      activityHighlights,
      awardCount,
      highestAwardLevel,
      apCount: apCount || undefined,
    };
  }

  /** 将 AdmissionCase (含 school + user profile) 映射为 SwipeCaseDto */
  private mapCaseToDto(c: AdmissionCaseWithDetails): SwipeCaseDto {
    const profile = c.user?.profile;
    const aggregated = this.aggregateProfileInfo(profile);

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
      acceptanceRate: clampPercentRate(c.school.acceptanceRate),
      // 扩展学校信息
      schoolState: c.school.state || undefined,
      schoolCity: c.school.city || undefined,
      graduationRate: clampPercentRate(c.school.graduationRate),
      totalEnrollment: c.school.totalEnrollment || undefined,
      tuition: c.school.tuition || undefined,
      essayType: c.essayType || undefined,
      isPrivateSchool: c.school.isPrivate ?? undefined,
      // 申请者档案聚合信息 (匿名化)
      applicantGrade: profile?.grade || undefined,
      applicantSchoolType: profile?.currentSchoolType || undefined,
      ...aggregated,
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

  private checkPrediction(
    prediction: SwipePrediction,
    actualResult: string,
  ): boolean {
    // 2026-05 Hall Plan C (C3): `deferred` is intentionally NOT mapped.
    // Deferred ≠ waitlisted — they are distinct admission states. Deferred
    // cases are excluded from the deck (see getNextCases / getChallengeCase),
    // so this map only ever sees the three real, guessable outcomes.
    const resultMap: Record<string, SwipePrediction> = {
      admitted: SwipePrediction.ADMIT,
      rejected: SwipePrediction.REJECT,
      waitlisted: SwipePrediction.WAITLIST,
    };

    return resultMap[actualResult] === prediction;
  }

  // ============ Community Challenge ============

  /**
   * Get a challenge: an applicant who applied to multiple schools.
   * Groups AdmissionCases by userId to find applicants with 3+ cases.
   */
  async getChallengeCase(userId: string) {
    const applicantsWithMultiple = await this.prisma.admissionCase.groupBy({
      by: ['userId'],
      where: {
        ...SWIPE_ELIGIBLE_CASE_WHERE,
        userId: { not: userId },
      },
      _count: { id: true },
      having: { id: { _count: { gte: 3 } } },
    });

    if (applicantsWithMultiple.length === 0) return null;

    const randomApplicant =
      applicantsWithMultiple[
        Math.floor(Math.random() * applicantsWithMultiple.length)
      ];

    const cases = await this.prisma.admissionCase.findMany({
      where: {
        userId: randomApplicant.userId,
        ...SWIPE_ELIGIBLE_CASE_WHERE,
        // 2026-05 Hall Plan C (C3): no `deferred` cases in the challenge
        // deck — deferred is not a guessable admit/reject/waitlist outcome.
        result: { in: ['ADMITTED', 'REJECTED', 'WAITLISTED'] },
      },
      include: SWIPE_CASE_INCLUDE,
      take: 10,
    });

    if (cases.length < 3) return null;

    const profile = cases[0]?.user?.profile;
    const aggregated = this.aggregateProfileInfo(profile);

    return {
      applicantProfile: {
        grade: profile?.grade,
        schoolType: profile?.currentSchoolType,
        gpa: cases[0]?.gpaRange,
        sat: cases[0]?.satRange,
        toefl: cases[0]?.toeflRange,
        // 2026-05 Hall Plan C (security B3): nationality removed — never
        // surfaced on the public swipe/challenge surface.
        targetMajor: profile?.targetMajor || undefined,
        ...aggregated,
      },
      schools: cases.map((c) => ({
        caseId: c.id,
        schoolId: c.school?.id,
        schoolName: c.school?.name,
        schoolNameZh: c.school?.nameZh,
        usNewsRank: c.school?.usNewsRank,
        acceptanceRate: clampPercentRate(c.school?.acceptanceRate),
        major: c.major,
        round: c.round,
      })),
    };
  }

  /**
   * Submit challenge guesses and reveal results.
   */
  async submitChallenge(userId: string, guesses: Record<string, string>) {
    const caseIds = Object.keys(guesses);
    const cases = await this.prisma.admissionCase.findMany({
      where: { id: { in: caseIds }, ...CASE_REVIEW_APPROVED_WHERE },
      select: {
        id: true,
        result: true,
        userId: true, // Hall refactor Phase 1: needed for ChallengeAttempt.applicantUserId
        school: { select: { name: true } },
      },
    });

    let correct = 0;
    const results = cases.map((c) => {
      const guess = guesses[c.id];
      const actual = c.result;
      const isCorrect = guess === actual;
      if (isCorrect) correct++;
      return {
        caseId: c.id,
        schoolName: c.school?.name,
        guess,
        actual,
        isCorrect,
      };
    });

    const accuracy =
      cases.length > 0 ? Math.round((correct / cases.length) * 100) : 0;

    // ============================================================
    // 2026-05 Hall Plan C (C3): de-gamified. The attempt is still
    // persisted (full per-school debrief history is genuinely useful),
    // but no points are awarded — `submitChallenge` no longer reads or
    // writes PointHistory / PointsService.
    // ============================================================
    let attemptId: string | null = null;
    const applicantUserId = cases[0]?.userId;
    if (applicantUserId && cases.length > 0) {
      const attempt = await this.prisma.challengeAttempt.create({
        data: {
          userId,
          applicantUserId,
          caseIds: cases.map((c) => c.id),
          guesses: guesses,
          correctCount: correct,
          totalCount: cases.length,
          accuracy,
        },
      });
      attemptId = attempt.id;
    }

    // Shape matches shared `ChallengeAttemptResult` so web/mobile can rely
    // on `attemptId` for deep-links.
    return {
      attemptId,
      results,
      correct,
      total: cases.length,
      accuracy,
    };
  }
}
