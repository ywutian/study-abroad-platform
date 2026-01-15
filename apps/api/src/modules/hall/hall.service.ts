import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Optional,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Review,
  UserList,
  Prisma,
  Profile,
  AdmissionResult,
  MemoryType,
  EntityType,
} from '@prisma/client';
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import {
  VerifiedRankingQueryDto,
  VerifiedRankingResponseDto,
  VerifiedUserDto,
  RankingFilter,
} from './dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { AiService } from '../ai/ai.service';
import {
  extractProfileMetrics,
  extractSchoolMetrics,
  calculateScoreBreakdown,
  calculateOverallScore,
  type ScoreBreakdown,
} from '../../common/utils/scoring';

interface CreateReviewDto {
  profileUserId: string;
  academicScore: number;
  testScore: number;
  activityScore: number;
  awardScore: number;
  overallScore: number;
  comment?: string;
  academicComment?: string;
  testComment?: string;
  activityComment?: string;
  awardComment?: string;
  tags?: string[];
  status?: 'DRAFT' | 'PUBLISHED';
}

interface CreateUserListDto {
  title: string;
  description?: string;
  category?: string;
  items: unknown[];
  isPublic?: boolean;
}

export interface PublicProfileResponse {
  id: string;
  userId: string;
  grade?: string | null;
  gpa?: number;
  gpaScale?: number;
  targetMajor?: string | null;
  visibility: string;
  _count: {
    testScores: number;
    activities: number;
    awards: number;
  };
}

export interface PercentileBands {
  p25: number;
  p50: number;
  p75: number;
}

export interface RankingResult {
  schoolId: string;
  schoolName: string;
  totalApplicants: number;
  yourRank: number;
  yourScore: number;
  percentile: number;
  breakdown: ScoreBreakdown;
  percentiles: {
    academic: number;
    activity: number;
    award: number;
  };
  /** 竞争者分数分布（p25/p50/p75） */
  scoreDistribution: {
    overall: PercentileBands;
    academic: PercentileBands;
    activity: PercentileBands;
    award: PercentileBands;
  };
  /** 竞争者汇总统计 */
  competitorStats: {
    avgScore: number;
    medianScore: number;
    totalCount: number;
  };
  /** 竞争力定位 */
  competitivePosition: 'strong' | 'moderate' | 'challenging';
}

@Injectable()
export class HallService {
  private readonly logger = new Logger(HallService.name);

  constructor(
    private prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => MemoryManagerService))
    private memoryManager?: MemoryManagerService,
    @Optional()
    @Inject(forwardRef(() => AiService))
    private aiService?: AiService,
  ) {}

  /**
   * 计算百分位分布 (p25/p50/p75)
   */
  private calcBands(values: number[]): PercentileBands {
    if (values.length === 0) return { p25: 0, p50: 0, p75: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const at = (p: number) =>
      Math.round(
        (sorted[Math.floor(sorted.length * p)] ?? sorted[sorted.length - 1]) *
          10,
      ) / 10;
    return { p25: at(0.25), p50: at(0.5), p75: at(0.75) };
  }

  // ============================================
  // Public Profiles (公开档案)
  // ============================================

  async getPublicProfiles(
    search?: string,
  ): Promise<{ data: PublicProfileResponse[] }> {
    const where: Prisma.ProfileWhereInput = {
      visibility: { in: ['ANONYMOUS', 'VERIFIED_ONLY'] },
    };

    if (search) {
      where.targetMajor = { contains: search, mode: 'insensitive' };
    }

    const profiles = await this.prisma.profile.findMany({
      where,
      select: {
        id: true,
        userId: true,
        grade: true,
        gpa: true,
        gpaScale: true,
        targetMajor: true,
        visibility: true,
        _count: {
          select: {
            testScores: true,
            activities: true,
            awards: true,
          },
        },
      },
      take: 50,
      orderBy: { updatedAt: 'desc' },
    });

    // Anonymize userId for ANONYMOUS profiles
    const result = profiles.map((p) => ({
      ...p,
      userId:
        p.visibility === 'ANONYMOUS' ? `anon-${p.id.slice(0, 8)}` : p.userId,
      gpa: p.gpa ? Number(p.gpa) : undefined,
      gpaScale: p.gpaScale ? Number(p.gpaScale) : undefined,
    }));

    return { data: result };
  }

  // ============================================
  // Batch Ranking (批量排名)
  // ============================================

  async getBatchRanking(
    userId: string,
    schoolIds: string[],
  ): Promise<{ rankings: RankingResult[] }> {
    if (!schoolIds.length) {
      return { rankings: [] };
    }

    // Get schools info
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });

    // Get user's profile
    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    if (!userProfile) {
      return { rankings: [] };
    }

    const rankings: RankingResult[] = [];

    for (const school of schools) {
      const schoolMetrics = extractSchoolMetrics(school);

      // 查找同校竞争者：选择了该学校的可见用户 (通过 SchoolListItem)
      const competitors = await this.prisma.profile.findMany({
        where: {
          visibility: { not: 'PRIVATE' },
          user: {
            schoolListItems: {
              some: { schoolId: school.id },
            },
          },
        },
        include: {
          testScores: true,
          activities: true,
          awards: { include: { competition: true } },
        },
      });

      // 确保包含当前用户
      const allProfiles = competitors.find((p) => p.userId === userId)
        ? competitors
        : [...competitors, userProfile];

      // 使用统一评分计算所有人的分数
      const scored = allProfiles.map((p) => ({
        userId: p.userId,
        breakdown: calculateScoreBreakdown(
          extractProfileMetrics(p),
          schoolMetrics,
        ),
      }));

      // 按总分排序
      scored.sort((a, b) => b.breakdown.overall - a.breakdown.overall);

      const userIndex = scored.findIndex((p) => p.userId === userId);
      const userBreakdown = scored[userIndex]?.breakdown || {
        academic: 0,
        activity: 0,
        award: 0,
        overall: 0,
      };

      // 计算各维度百分位
      const calcPercentile = (category: 'academic' | 'activity' | 'award') => {
        const sorted = [...scored].sort(
          (a, b) => b.breakdown[category] - a.breakdown[category],
        );
        const rank = sorted.findIndex((p) => p.userId === userId) + 1;
        return scored.length > 1
          ? Math.round((1 - rank / sorted.length) * 100)
          : 100;
      };

      // 计算竞争者分布统计
      const overallScores = scored.map((s) => s.breakdown.overall);
      const academicScores = scored.map((s) => s.breakdown.academic);
      const activityScores = scored.map((s) => s.breakdown.activity);
      const awardScores = scored.map((s) => s.breakdown.award);

      const avgScore =
        overallScores.length > 0
          ? Math.round(
              (overallScores.reduce((a, b) => a + b, 0) /
                overallScores.length) *
                10,
            ) / 10
          : 0;

      const userPercentile =
        allProfiles.length > 1
          ? Math.round((1 - (userIndex + 1) / allProfiles.length) * 100)
          : 100;

      const competitivePosition: 'strong' | 'moderate' | 'challenging' =
        userPercentile >= 70
          ? 'strong'
          : userPercentile >= 40
            ? 'moderate'
            : 'challenging';

      rankings.push({
        schoolId: school.id,
        schoolName: school.nameZh || school.name,
        totalApplicants: allProfiles.length,
        yourRank: userIndex + 1,
        yourScore: Math.round(userBreakdown.overall * 10) / 10,
        percentile: userPercentile,
        breakdown: userBreakdown,
        percentiles: {
          academic: calcPercentile('academic'),
          activity: calcPercentile('activity'),
          award: calcPercentile('award'),
        },
        scoreDistribution: {
          overall: this.calcBands(overallScores),
          academic: this.calcBands(academicScores),
          activity: this.calcBands(activityScores),
          award: this.calcBands(awardScores),
        },
        competitorStats: {
          avgScore,
          medianScore: this.calcBands(overallScores).p50,
          totalCount: allProfiles.length,
        },
        competitivePosition,
      });
    }

    // 记录用户关注的学校到记忆系统
    await this.saveSchoolInterestToMemory(userId, schools, rankings);

    return { rankings };
  }

  /**
   * 保存学校关注到记忆系统
   */
  private async saveSchoolInterestToMemory(
    userId: string,
    schools: Array<{
      id: string;
      name: string;
      nameZh?: string | null;
      usNewsRank?: number | null;
    }>,
    rankings: RankingResult[],
  ): Promise<void> {
    if (!this.memoryManager || schools.length === 0) return;

    try {
      // 记录学校实体
      for (const school of schools.slice(0, 3)) {
        // 最多记录3所
        const ranking = rankings.find((r) => r.schoolId === school.id);
        await this.memoryManager.recordEntity(userId, {
          type: EntityType.SCHOOL,
          name: school.nameZh || school.name,
          description: `US News 排名 #${school.usNewsRank || '未知'}`,
          attributes: {
            interestLevel: 'high',
            addedAt: new Date().toISOString(),
          },
        });

        // 记录排名信息（含竞争力洞察）
        if (ranking) {
          const dims = ['academic', 'activity', 'award'] as const;
          const strongest = dims.reduce((a, b) =>
            ranking.percentiles[a] >= ranking.percentiles[b] ? a : b,
          );
          const weakest = dims.reduce((a, b) =>
            ranking.percentiles[a] <= ranking.percentiles[b] ? a : b,
          );
          const positionLabel =
            ranking.competitivePosition === 'strong'
              ? '强'
              : ranking.competitivePosition === 'moderate'
                ? '中等'
                : '待提升';

          await this.memoryManager.remember(userId, {
            type: MemoryType.FACT,
            category: 'ranking',
            content: `用户在 ${school.nameZh || school.name} 排名第${ranking.yourRank}/${ranking.totalApplicants}（前${ranking.percentile}%），竞争力${positionLabel}。最强维度: ${strongest}，待提升: ${weakest}`,
            importance: 0.7,
            metadata: {
              schoolId: school.id,
              schoolName: school.name,
              rank: ranking.yourRank,
              percentile: ranking.percentile,
              competitivePosition: ranking.competitivePosition,
              breakdown: ranking.breakdown,
              strongestDim: strongest,
              weakestDim: weakest,
              source: 'hall_service',
            },
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
          });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to save school interest to memory', error);
    }
  }

  /**
   * 记录评分行为到记忆系统
   */
  private async recordReviewToMemory(
    reviewerId: string,
    data: CreateReviewDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const tagStr = data.tags?.length ? `，标签：${data.tags.join('、')}` : '';
      await this.memoryManager.remember(reviewerId, {
        type: MemoryType.DECISION,
        category: 'review_activity',
        content: `用户对他人档案进行了锐评：学术${data.academicScore}分、标化${data.testScore}分、活动${data.activityScore}分、奖项${data.awardScore}分、综合${data.overallScore}分${tagStr}`,
        importance: 0.6,
        metadata: {
          profileUserId: data.profileUserId,
          scores: {
            academic: data.academicScore,
            test: data.testScore,
            activity: data.activityScore,
            award: data.awardScore,
            overall: data.overallScore,
          },
          tags: data.tags,
          source: 'hall_review',
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record review to memory', error);
    }
  }

  /**
   * 记录创建榜单到记忆系统
   */
  private async recordCreateListToMemory(
    userId: string,
    data: CreateUserListDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      await this.memoryManager.remember(userId, {
        type: MemoryType.DECISION,
        category: 'list_creation',
        content: `用户创建了榜单：${data.title}${data.category ? `（分类：${data.category}）` : ''}`,
        importance: 0.5,
        metadata: {
          title: data.title,
          category: data.category,
          isPublic: data.isPublic,
          itemCount: data.items?.length || 0,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record create list to memory', error);
    }
  }

  /**
   * 记录投票到记忆系统
   */
  private async recordVoteToMemory(
    userId: string,
    listTitle: string,
    category?: string | null,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      await this.memoryManager.remember(userId, {
        type: MemoryType.PREFERENCE,
        category: 'list_interest',
        content: `用户点赞了榜单：${listTitle}${category ? `（分类：${category}）` : ''}`,
        importance: 0.3,
        metadata: {
          listTitle,
          category,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record vote to memory', error);
    }
  }

  // ============================================
  // Reviews (锐评模式)
  // ============================================

  async createReview(
    reviewerId: string,
    data: CreateReviewDto,
  ): Promise<Review> {
    // 不能评审自己
    if (reviewerId === data.profileUserId) {
      throw new BadRequestException('Cannot review yourself');
    }

    const reviewData = {
      academicScore: data.academicScore,
      testScore: data.testScore,
      activityScore: data.activityScore,
      awardScore: data.awardScore,
      overallScore: data.overallScore,
      comment: data.comment,
      academicComment: data.academicComment,
      testComment: data.testComment,
      activityComment: data.activityComment,
      awardComment: data.awardComment,
      tags: data.tags || [],
      status:
        data.status === 'DRAFT' ? ('DRAFT' as const) : ('PUBLISHED' as const),
    };

    // 已存在则更新
    const existing = await this.prisma.review.findUnique({
      where: {
        reviewerId_profileUserId: {
          reviewerId,
          profileUserId: data.profileUserId,
        },
      },
    });

    let review: Review;

    if (existing) {
      review = await this.prisma.review.update({
        where: { id: existing.id },
        data: reviewData,
      });
    } else {
      review = await this.prisma.review.create({
        data: {
          reviewerId,
          profileUserId: data.profileUserId,
          ...reviewData,
        },
      });
    }

    // 仅 PUBLISHED 状态触发记忆记录和积分
    if (reviewData.status === 'PUBLISHED') {
      this.recordReviewToMemory(reviewerId, data).catch((err) => {
        this.logger.warn('Failed to record review to memory', err);
      });

      // 积分奖励: 新建评审 +20
      if (!existing) {
        this.prisma.pointHistory
          .create({
            data: {
              userId: reviewerId,
              action: 'SUBMIT_REVIEW',
              points: 20,
              metadata: { profileUserId: data.profileUserId },
            },
          })
          .then(() =>
            this.prisma.user.update({
              where: { id: reviewerId },
              data: { points: { increment: 20 } },
            }),
          )
          .catch((err) =>
            this.logger.warn('Failed to award review points', err),
          );
      }
    }

    return review;
  }

  async updateReview(
    reviewId: string,
    reviewerId: string,
    data: Partial<CreateReviewDto>,
  ): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review || review.reviewerId !== reviewerId) {
      throw new NotFoundException('Review not found');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(data.academicScore !== undefined && {
          academicScore: data.academicScore,
        }),
        ...(data.testScore !== undefined && { testScore: data.testScore }),
        ...(data.activityScore !== undefined && {
          activityScore: data.activityScore,
        }),
        ...(data.awardScore !== undefined && { awardScore: data.awardScore }),
        ...(data.overallScore !== undefined && {
          overallScore: data.overallScore,
        }),
        ...(data.comment !== undefined && { comment: data.comment }),
        ...(data.academicComment !== undefined && {
          academicComment: data.academicComment,
        }),
        ...(data.testComment !== undefined && {
          testComment: data.testComment,
        }),
        ...(data.activityComment !== undefined && {
          activityComment: data.activityComment,
        }),
        ...(data.awardComment !== undefined && {
          awardComment: data.awardComment,
        }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  async deleteReview(reviewId: string, reviewerId: string): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review || review.reviewerId !== reviewerId) {
      throw new NotFoundException('Review not found');
    }

    await this.prisma.review.delete({ where: { id: reviewId } });
  }

  async getReviewsForUser(
    profileUserId: string,
    options?: {
      page?: number;
      pageSize?: number;
      sortBy?: 'createdAt' | 'overallScore' | 'helpfulCount';
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options || {};
    const skip = (page - 1) * pageSize;

    const where = { profileUserId, status: 'PUBLISHED' as const };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          reviewer: {
            select: { id: true, email: true, role: true },
          },
          _count: { select: { reactions: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return createPaginatedResponse(reviews, total, page, pageSize);
  }

  async getReviewStats(profileUserId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { profileUserId, status: 'PUBLISHED' },
    });

    if (reviews.length === 0) return null;

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    // 收集所有标签并统计频次
    const tagCount: Record<string, number> = {};
    for (const r of reviews) {
      for (const tag of r.tags) {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    return {
      averages: {
        academic:
          Math.round(avg(reviews.map((r) => r.academicScore)) * 10) / 10,
        test: Math.round(avg(reviews.map((r) => r.testScore)) * 10) / 10,
        activity:
          Math.round(avg(reviews.map((r) => r.activityScore)) * 10) / 10,
        award: Math.round(avg(reviews.map((r) => r.awardScore)) * 10) / 10,
        overall: Math.round(avg(reviews.map((r) => r.overallScore)) * 10) / 10,
      },
      reviewCount: reviews.length,
      topTags,
    };
  }

  async reactToReview(reviewId: string, userId: string, type: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) throw new NotFoundException('Review not found');
    if (review.reviewerId === userId) {
      throw new BadRequestException('Cannot react to your own review');
    }

    // upsert 反应
    await this.prisma.reviewReaction.upsert({
      where: {
        reviewId_userId_type: { reviewId, userId, type },
      },
      update: {},
      create: { reviewId, userId, type },
    });

    // 更新缓存计数
    const count = await this.prisma.reviewReaction.count({
      where: { reviewId, type: 'helpful' },
    });
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: count },
    });

    // helpful 反应奖励评审者 +10 积分
    if (type === 'helpful') {
      this.prisma.pointHistory
        .create({
          data: {
            userId: review.reviewerId,
            action: 'REVIEW_HELPFUL',
            points: 10,
            metadata: { reviewId, reactedBy: userId },
          },
        })
        .then(() =>
          this.prisma.user.update({
            where: { id: review.reviewerId },
            data: { points: { increment: 10 } },
          }),
        )
        .catch((err) =>
          this.logger.warn('Failed to award helpful points', err),
        );
    }

    return { success: true };
  }

  async removeReaction(reviewId: string, userId: string, type: string) {
    await this.prisma.reviewReaction.deleteMany({
      where: { reviewId, userId, type },
    });

    // 更新缓存计数
    const count = await this.prisma.reviewReaction.count({
      where: { reviewId, type: 'helpful' },
    });
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: count },
    });

    return { success: true };
  }

  async getReviewsForUserLegacy(profileUserId: string): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: { profileUserId, status: 'PUBLISHED' },
      include: {
        reviewer: {
          select: { id: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyReviews(reviewerId: string): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: { reviewerId },
      include: {
        profileUser: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * @deprecated 使用 getReviewStats 替代
   */
  async getAverageScores(profileUserId: string) {
    return this.getReviewStats(profileUserId);
  }

  // ============================================
  // Ranking (排名对比)
  // ============================================

  async getProfileRanking(userId: string, schoolId: string) {
    // 获取学校信息
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    const schoolMetrics = school ? extractSchoolMetrics(school) : {};

    // 查找同校竞争者（选择了该学校的可见用户）
    const competitors = await this.prisma.profile.findMany({
      where: {
        visibility: { not: 'PRIVATE' },
        user: {
          schoolListItems: {
            some: { schoolId },
          },
        },
      },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    // 获取当前用户档案
    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    if (!userProfile) {
      return {
        rank: null,
        total: competitors.length,
        message: 'Complete your profile first',
      };
    }

    // 确保包含当前用户
    const allProfiles = competitors.find((p) => p.userId === userId)
      ? competitors
      : [...competitors, userProfile];

    // 使用统一评分
    const scoredProfiles = allProfiles.map((p) => ({
      userId: p.userId,
      score: calculateOverallScore(extractProfileMetrics(p), schoolMetrics),
    }));

    scoredProfiles.sort((a, b) => b.score - a.score);

    const userRank = scoredProfiles.findIndex((p) => p.userId === userId) + 1;
    const userScore =
      scoredProfiles.find((p) => p.userId === userId)?.score || 0;

    return {
      rank: userRank,
      total: scoredProfiles.length,
      score: Math.round(userScore * 10) / 10,
      percentile:
        scoredProfiles.length > 1
          ? Math.round((1 - userRank / scoredProfiles.length) * 100)
          : 100,
    };
  }

  /**
   * 获取用户所有目标学校的排名（自动读取 SchoolListItem）
   *
   * 返回用户在每个目标学校中与同校竞争者的排名信息。
   */
  async getTargetSchoolRanking(userId: string): Promise<{
    rankings: RankingResult[];
    totalTargetSchools: number;
  }> {
    // 获取用户的目标学校列表
    const schoolListItems = await this.prisma.schoolListItem.findMany({
      where: { userId },
      include: {
        school: true,
      },
    });

    if (!schoolListItems.length) {
      return { rankings: [], totalTargetSchools: 0 };
    }

    const schoolIds = schoolListItems.map((item) => item.schoolId);
    const rankings = await this.getBatchRanking(userId, schoolIds);

    return {
      rankings: rankings.rankings,
      totalTargetSchools: schoolListItems.length,
    };
  }

  /**
   * AI 分析排名结果
   *
   * 基于确定性评分结果，让 AI 提供补充分析和建议。
   */
  async getRankingAnalysis(
    userId: string,
    schoolId: string,
  ): Promise<{
    analysis: string;
    strengths: string[];
    improvements: string[];
    competitivePosition: string;
  }> {
    if (!this.aiService) {
      return {
        analysis: 'AI 分析服务暂时不可用。',
        strengths: [],
        improvements: [],
        competitivePosition: 'unknown',
      };
    }

    // 获取用户档案
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    if (!profile) {
      return {
        analysis: '请先完善你的档案信息。',
        strengths: [],
        improvements: [],
        competitivePosition: 'unknown',
      };
    }

    // 获取学校信息
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return {
        analysis: '未找到该学校信息。',
        strengths: [],
        improvements: [],
        competitivePosition: 'unknown',
      };
    }

    // 获取排名数据
    const rankingData = await this.getProfileRanking(userId, schoolId);

    // 计算详细分解
    const metrics = extractProfileMetrics(profile);
    const schoolMetrics = extractSchoolMetrics(school);
    const breakdown = calculateScoreBreakdown(metrics, schoolMetrics);

    const prompt = `你是一位资深美本申请顾问。请根据以下数据，用中文分析该学生在 ${school.nameZh || school.name} 的竞争力。

## 学生数据
- GPA: ${metrics.gpa || '未填写'}${metrics.gpaScale ? `/${metrics.gpaScale}` : ''}
- SAT: ${metrics.satScore || '未填写'}
- ACT: ${metrics.actScore || '未填写'}
- TOEFL: ${metrics.toeflScore || '未填写'}
- 活动数量: ${metrics.activityCount}
- 奖项数量: ${metrics.awardCount}（国家级${metrics.nationalAwardCount}，国际级${metrics.internationalAwardCount}）

## 评分结果
- 学术分: ${breakdown.academic.toFixed(1)}/100
- 活动分: ${breakdown.activity.toFixed(1)}/100
- 奖项分: ${breakdown.award.toFixed(1)}/100
- 综合分: ${breakdown.overall.toFixed(1)}/100

## 排名
- 排名: ${rankingData.rank}/${rankingData.total}
- 百分位: 前${rankingData.percentile}%

## 学校信息
- US News 排名: #${school.usNewsRank || '未知'}
- 录取率: ${school.acceptanceRate ? Number(school.acceptanceRate) + '%' : '未知'}

请输出 JSON 格式：
{
  "analysis": "综合分析（2-3句话）",
  "strengths": ["优势1", "优势2"],
  "improvements": ["改进建议1", "改进建议2"],
  "competitivePosition": "strong|moderate|challenging"
}

只输出 JSON，不要其他内容。`;

    try {
      const response = await this.aiService.chat([
        { role: 'user', content: prompt },
      ]);

      // 解析 AI 返回的 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          analysis: parsed.analysis || '',
          strengths: parsed.strengths || [],
          improvements: parsed.improvements || [],
          competitivePosition: parsed.competitivePosition || 'unknown',
        };
      }
    } catch (error) {
      this.logger.warn('AI ranking analysis failed', error);
    }

    return {
      analysis: 'AI 分析暂时不可用，请稍后再试。',
      strengths: [],
      improvements: [],
      competitivePosition: 'unknown',
    };
  }

  // ============================================
  // User Lists (用户创建榜单)
  // ============================================

  async createList(userId: string, data: CreateUserListDto): Promise<UserList> {
    const list = await this.prisma.userList.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        category: data.category,
        items: data.items as object,
        isPublic: data.isPublic ?? true,
      },
    });

    // 记录创建榜单到记忆系统
    this.recordCreateListToMemory(userId, data).catch((err) => {
      this.logger.warn('Failed to record create list to memory', err);
    });

    return list;
  }

  async updateList(
    listId: string,
    userId: string,
    data: Partial<CreateUserListDto>,
  ): Promise<UserList> {
    const list = await this.prisma.userList.findUnique({
      where: { id: listId },
    });

    if (!list || list.userId !== userId) {
      throw new NotFoundException('List not found');
    }

    return this.prisma.userList.update({
      where: { id: listId },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        items: data.items as object | undefined,
        isPublic: data.isPublic,
      },
    });
  }

  async deleteList(listId: string, userId: string): Promise<void> {
    const list = await this.prisma.userList.findUnique({
      where: { id: listId },
    });

    if (!list || list.userId !== userId) {
      throw new NotFoundException('List not found');
    }

    await this.prisma.userList.delete({ where: { id: listId } });
  }

  async getPublicLists(
    pagination: PaginationDto,
    category?: string,
  ): Promise<PaginatedResponseDto<UserList>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserListWhereInput = { isPublic: true };
    if (category) {
      where.category = category;
    }

    const [lists, total] = await Promise.all([
      this.prisma.userList.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true } },
          _count: { select: { votes: true } },
        },
      }),
      this.prisma.userList.count({ where }),
    ]);

    return createPaginatedResponse(lists, total, page, pageSize);
  }

  async getMyLists(userId: string): Promise<UserList[]> {
    return this.prisma.userList.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { votes: true } },
      },
    });
  }

  async getListById(listId: string): Promise<UserList> {
    const list = await this.prisma.userList.findUnique({
      where: { id: listId },
      include: {
        user: { select: { id: true, email: true } },
        _count: { select: { votes: true } },
      },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    return list;
  }

  async voteList(listId: string, userId: string, value: 1 | -1) {
    // Check if list exists and is public
    const list = await this.prisma.userList.findUnique({
      where: { id: listId },
    });
    if (!list || !list.isPublic) {
      throw new NotFoundException('List not found');
    }

    // Can't vote on own list
    if (list.userId === userId) {
      throw new BadRequestException('Cannot vote on your own list');
    }

    const vote = await this.prisma.userListVote.upsert({
      where: { listId_userId: { listId, userId } },
      update: { value },
      create: { listId, userId, value },
    });

    // 只记录点赞行为（value=1）
    if (value === 1) {
      this.recordVoteToMemory(userId, list.title, list.category).catch(
        (err) => {
          this.logger.warn('Failed to record vote to memory', err);
        },
      );
    }

    return vote;
  }

  async removeVote(listId: string, userId: string) {
    await this.prisma.userListVote.deleteMany({
      where: { listId, userId },
    });
  }

  async getListVoteCount(listId: string): Promise<number> {
    const result = await this.prisma.userListVote.aggregate({
      where: { listId },
      _sum: { value: true },
    });
    return result._sum.value || 0;
  }

  // ============================================
  // Verified User Ranking (认证用户排行榜)
  // ============================================

  // 藤校列表
  private readonly IVY_PLUS_SCHOOLS = [
    'Harvard University',
    'Yale University',
    'Princeton University',
    'Columbia University',
    'University of Pennsylvania',
    'Brown University',
    'Dartmouth College',
    'Cornell University',
    'Stanford University',
    'MIT',
    'Massachusetts Institute of Technology',
    'Duke University',
    'University of Chicago',
  ];

  async getVerifiedRanking(
    query: VerifiedRankingQueryDto,
  ): Promise<VerifiedRankingResponseDto> {
    const {
      filter = RankingFilter.ALL,
      year,
      schoolId,
      limit = 50,
      offset = 0,
    } = query;

    // 构建查询条件
    const where: Prisma.AdmissionCaseWhereInput = {
      isVerified: true,
    };

    // 按年份筛选
    if (year) {
      where.year = year;
    }

    // 按学校筛选
    if (schoolId) {
      where.schoolId = schoolId;
    }

    // 按结果筛选
    if (filter === RankingFilter.ADMITTED) {
      where.result = AdmissionResult.ADMITTED;
    }

    // 按学校排名筛选
    if (filter === RankingFilter.TOP20) {
      where.school = {
        usNewsRank: { lte: 20 },
      };
    }

    // 按藤校筛选
    if (filter === RankingFilter.IVY) {
      where.school = {
        name: { in: this.IVY_PLUS_SCHOOLS },
      };
    }

    // 获取案例
    const [cases, total] = await Promise.all([
      this.prisma.admissionCase.findMany({
        where,
        include: {
          school: true,
          user: {
            select: {
              id: true,
              profile: {
                select: {
                  realName: true,
                },
              },
            },
          },
        },
        orderBy: [{ school: { usNewsRank: 'asc' } }, { verifiedAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.admissionCase.count({ where }),
    ]);

    // 计算统计数据
    const stats = await this.getVerifiedStats();

    // 格式化返回数据
    const users: VerifiedUserDto[] = cases.map((c, index) => ({
      rank: offset + index + 1,
      caseId: c.id,
      userId: c.userId,
      userName: c.user.profile?.realName || `用户${c.userId.slice(-4)}`,
      gpaRange: c.gpaRange || undefined,
      satRange: c.satRange || undefined,
      actRange: c.actRange || undefined,
      toeflRange: c.toeflRange || undefined,
      schoolName: c.school.name,
      schoolNameZh: c.school.nameZh || undefined,
      schoolRank: c.school.usNewsRank || undefined,
      result: c.result,
      year: c.year,
      round: c.round || undefined,
      major: c.major || undefined,
      isVerified: c.isVerified,
      verifiedAt: c.verifiedAt || undefined,
    }));

    return {
      users,
      stats,
      total,
      hasMore: offset + limit < total,
    };
  }

  private async getVerifiedStats() {
    const [totalVerified, totalAdmitted, topSchoolsCount, ivyCount] =
      await Promise.all([
        this.prisma.admissionCase.count({ where: { isVerified: true } }),
        this.prisma.admissionCase.count({
          where: { isVerified: true, result: AdmissionResult.ADMITTED },
        }),
        this.prisma.admissionCase.count({
          where: {
            isVerified: true,
            result: AdmissionResult.ADMITTED,
            school: { usNewsRank: { lte: 20 } },
          },
        }),
        this.prisma.admissionCase.count({
          where: {
            isVerified: true,
            result: AdmissionResult.ADMITTED,
            school: { name: { in: this.IVY_PLUS_SCHOOLS } },
          },
        }),
      ]);

    return {
      totalVerified,
      totalAdmitted,
      topSchoolsCount,
      ivyCount,
    };
  }

  async getAvailableYears(): Promise<number[]> {
    const cases = await this.prisma.admissionCase.findMany({
      where: { isVerified: true },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    });

    return cases.map((c) => c.year);
  }
}
