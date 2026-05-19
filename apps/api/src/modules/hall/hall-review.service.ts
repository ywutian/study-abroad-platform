import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { deriveAge } from '../../common/utils/age.util';

/**
 * 2026-05 Hall Plan C (C2): peer review is gated below this age. Because
 * `User.acceptPeerReview` defaults to `true` (opt-out), the toggle does
 * NOT protect existing minors — this hard age floor does.
 */
const MIN_REVIEWABLE_AGE = 16;
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';
import { fireAndForget } from '../../common/utils/async.util';
import { Review, MemoryType, ReviewMethod, Prisma } from '@prisma/client';
import { createPaginatedResponse } from '../../common/dto/pagination.dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { PointsService, PointAction } from '../points/incentive.service';
import {
  ContentModerationService,
  ModerationAction,
} from '../ai-agent/security/content-moderation.service';
import { HALL_REVIEWER_SELECT } from './hall.constants';
// Use the validated DTO class (with class-validator decorators + @MaxLength) instead of a duplicate inline interface.
import { CreateReviewDto } from './dto';

@Injectable()
export class HallReviewService {
  private readonly logger = new Logger(HallReviewService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private pointsService: PointsService,
    @Optional() private moderation?: ContentModerationService,
    @Optional() private memoryManager?: MemoryManagerService,
  ) {}

  async createReview(
    reviewerId: string,
    data: CreateReviewDto,
  ): Promise<Review> {
    if (reviewerId === data.profileUserId) {
      throw new BadRequestException('Cannot review yourself');
    }

    // 2026-05 Hall Plan C (C2 / security B1): a review may only be written
    // for a user who has opted in to peer review AND is not a minor.
    await this.assertCanReceiveReview(data.profileUserId);

    // Hall refactor Stage 2: content moderation gate.
    // Combine all user-supplied text and run through the @Global() ContentModerationService.
    // Optional because some test modules don't provide it; in production it's always present.
    if (this.moderation) {
      const combinedText = [
        data.comment,
        data.academicComment,
        data.testComment,
        data.activityComment,
        data.awardComment,
        ...(data.quickTags ?? []),
      ]
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .join(' ');

      if (combinedText.length > 0) {
        const result = await this.moderation.moderate(combinedText, {
          context: 'input',
        });
        if (result.action === ModerationAction.BLOCK) {
          throw new BadRequestException(
            'Your review contains content that violates the community guidelines. Please revise.',
          );
        }
        if (result.action === ModerationAction.WARN) {
          this.logger.warn(
            `Review by ${reviewerId} flagged WARN; severity=${result.severity}`,
          );
        }
      }
    }

    const reviewData = {
      // 2026-05 Hall Plan C (C2b): numeric scores are retired. The DTO
      // fields are now optional; default missing values to a neutral 5 so
      // the (still NOT NULL) Review columns write. Scores are no longer
      // surfaced anywhere — getReviewStats dropped `averages`, the UI
      // collects only qualitative feedback. The columns are dropped in C6.
      academicScore: data.academicScore ?? 5,
      testScore: data.testScore ?? 5,
      activityScore: data.activityScore ?? 5,
      awardScore: data.awardScore ?? 5,
      overallScore: data.overallScore ?? 5,
      comment: data.comment,
      academicComment: data.academicComment,
      testComment: data.testComment,
      activityComment: data.activityComment,
      awardComment: data.awardComment,
      tags: data.tags || [],
      status:
        data.status === 'DRAFT' ? ('DRAFT' as const) : ('PUBLISHED' as const),
      // Hall refactor Phase 1: Tinder swipe review fields (CLASSIC default for backward compat).
      // swipeData uses Prisma.JsonNull sentinel to write SQL NULL (not the JSON value `null`).
      reviewMethod: data.reviewMethod ?? ReviewMethod.CLASSIC,
      swipeData: data.swipeData
        ? (data.swipeData as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      reviewerConfidence: data.reviewerConfidence ?? null,
      quickTags: data.quickTags ?? [],
    };

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

    if (reviewData.status === 'PUBLISHED') {
      fireAndForget(
        this.recordReviewToMemory(reviewerId, data),
        this.logger,
        'Failed to record review to memory',
      );

      if (!existing) {
        // Route through PointsService (dynamic admin config, not hardcoded).
        // Pick the action based on review method: Tinder swipe reviews use the
        // new REVIEW_SWIPE_COMPLETE action; classic 4-dim slider reviews keep SUBMIT_REVIEW.
        const rewardAction =
          reviewData.reviewMethod === ReviewMethod.SWIPE
            ? PointAction.REVIEW_SWIPE_COMPLETE
            : PointAction.SUBMIT_REVIEW;
        fireAndForget(
          this.pointsService.adjustPoints(reviewerId, rewardAction, {
            profileUserId: data.profileUserId,
            reviewId: review.id,
            reviewMethod: reviewData.reviewMethod,
          }),
          this.logger,
          'Failed to award review points',
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

    // 2026-05 Hall Plan C (C2 / security B1): re-check consent + age when a
    // review is (re-)published — a target may have opted out since the
    // draft was written.
    if (data.status === 'PUBLISHED') {
      await this.assertCanReceiveReview(review.profileUserId);
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

    // 2026-05 Hall Plan C (C2 / security B2): never serve a user's reviews
    // once they have opted out of peer review. Return an empty page (not a
    // 403) so the endpoint is not an enumeration oracle.
    if (!(await this.isAcceptingReviews(profileUserId))) {
      return createPaginatedResponse([], 0, page, pageSize);
    }

    const where = { profileUserId, status: 'PUBLISHED' as const };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          reviewer: {
            select: HALL_REVIEWER_SELECT,
          },
          _count: { select: { reactions: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return createPaginatedResponse(reviews, total, page, pageSize);
  }

  async getReviewStats(profileUserId: string) {
    // 2026-05 Hall Plan C (C2 / security B2): opt-out users expose no stats.
    if (!(await this.isAcceptingReviews(profileUserId))) return null;

    const reviews = await this.prisma.review.findMany({
      where: { profileUserId, status: 'PUBLISHED' },
    });

    if (reviews.length === 0) return null;

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

    // 2026-05 Hall Plan C (C2b): `averages` removed. Untrained peers
    // numerically grading each other produced a second, unreliable
    // competitiveness authority that competed with prediction. The被评者
    // now sees only a count + qualitative tags, never a "6.2/10" verdict.
    return {
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

    await this.prisma.reviewReaction.upsert({
      where: {
        reviewId_userId_type: { reviewId, userId, type },
      },
      update: {},
      create: { reviewId, userId, type },
    });

    const count = await this.prisma.reviewReaction.count({
      where: { reviewId, type: 'helpful' },
    });
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: count },
    });

    if (type === 'helpful') {
      // 通知评审者其评论被标记为有帮助
      fireAndForget(
        this.notificationService.createNotification(
          review.reviewerId,
          NotificationType.CASE_HELPFUL,
          {
            actorId: userId,
            relatedId: reviewId,
            relatedType: 'review',
          },
        ),
        this.logger,
        'Failed to send helpful notification',
      );

      // Route through PointsService (see comment in createReview).
      // Choose action by review method so admin can tune Tinder vs classic helpful rewards separately.
      const helpfulAction =
        review.reviewMethod === ReviewMethod.SWIPE
          ? PointAction.REVIEW_HELPFUL_RECEIVED
          : PointAction.REVIEW_HELPFUL;
      fireAndForget(
        this.pointsService.adjustPoints(review.reviewerId, helpfulAction, {
          reviewId,
          reactedBy: userId,
          reviewMethod: review.reviewMethod,
        }),
        this.logger,
        'Failed to award helpful points',
      );
    }

    return { success: true };
  }

  async removeReaction(reviewId: string, userId: string, type: string) {
    await this.prisma.reviewReaction.deleteMany({
      where: { reviewId, userId, type },
    });

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
    // 2026-05 Hall Plan C (C2 / security B2): respect the opt-out here too.
    if (!(await this.isAcceptingReviews(profileUserId))) return [];

    return this.prisma.review.findMany({
      where: { profileUserId, status: 'PUBLISHED' },
      include: {
        reviewer: { select: HALL_REVIEWER_SELECT },
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

  /** @deprecated Use getReviewStats instead */
  async getAverageScores(profileUserId: string) {
    return this.getReviewStats(profileUserId);
  }

  /**
   * 2026-05 Hall Plan C (C2 / security B1): consent + age gate for the
   * WRITE path. A review may only target a user who has opted in to peer
   * review and is not a minor. Throws — callers are create/publish flows.
   */
  private async assertCanReceiveReview(profileUserId: string): Promise<void> {
    const target = await this.prisma.user.findUnique({
      where: { id: profileUserId },
      select: {
        acceptPeerReview: true,
        profile: { select: { birthday: true } },
      },
    });
    if (!target) {
      throw new NotFoundException('Target user not found');
    }
    if (!target.acceptPeerReview) {
      throw new ForbiddenException(
        'This user has not opted in to peer review.',
      );
    }
    const age = deriveAge(target.profile?.birthday ?? null);
    if (age !== null && age < MIN_REVIEWABLE_AGE) {
      throw new ForbiddenException(
        `Cannot review a user under ${MIN_REVIEWABLE_AGE}.`,
      );
    }
  }

  /**
   * 2026-05 Hall Plan C (C2 / security B2): consent check for the READ
   * path. Returns `true` only when the target still accepts peer review;
   * callers return an empty result (not a 403) when this is false.
   */
  private async isAcceptingReviews(profileUserId: string): Promise<boolean> {
    const target = await this.prisma.user.findUnique({
      where: { id: profileUserId },
      select: { acceptPeerReview: true },
    });
    return target?.acceptPeerReview === true;
  }

  private async recordReviewToMemory(
    reviewerId: string,
    data: CreateReviewDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const tagStr = data.tags?.length ? `，标签：${data.tags.join('、')}` : '';
      // 2026-05 Hall Plan C (C2b): record only that qualitative peer
      // feedback was given — no numeric scores (they are retired).
      await this.memoryManager.remember(reviewerId, {
        type: MemoryType.DECISION,
        category: 'review_activity',
        content: `用户对他人档案给出了同伴反馈${tagStr}`,
        importance: 0.6,
        metadata: {
          profileUserId: data.profileUserId,
          tags: data.tags,
          source: 'hall_review',
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record review to memory', error);
    }
  }
}
