import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';
import { fireAndForget } from '../../common/utils/async.util';
import { Review, MemoryType } from '@prisma/client';
import { createPaginatedResponse } from '../../common/dto/pagination.dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { HALL_REVIEWER_SELECT } from './hall.constants';

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

@Injectable()
export class HallReviewService {
  private readonly logger = new Logger(HallReviewService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    @Optional() private memoryManager?: MemoryManagerService,
  ) {}

  async createReview(
    reviewerId: string,
    data: CreateReviewDto,
  ): Promise<Review> {
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
        fireAndForget(
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
            ),
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
    const reviews = await this.prisma.review.findMany({
      where: { profileUserId, status: 'PUBLISHED' },
    });

    if (reviews.length === 0) return null;

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

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

      fireAndForget(
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
          ),
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
}
