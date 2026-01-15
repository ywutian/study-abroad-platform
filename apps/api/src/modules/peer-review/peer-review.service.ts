import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, PeerReviewStatus } from '@prisma/client';
import {
  CreatePeerReviewDto,
  SubmitReviewDto,
  PeerReviewDto,
  UserRatingDto,
  PeerReviewListDto,
  UserBasicDto,
} from './dto';

@Injectable()
export class PeerReviewService {
  constructor(private prisma: PrismaService) {}

  /**
   * 发起互评请求
   */
  async requestReview(
    reviewerId: string,
    revieweeId: string,
    data: CreatePeerReviewDto,
  ): Promise<PeerReviewDto> {
    // 不能给自己发起互评
    if (reviewerId === revieweeId) {
      throw new BadRequestException('不能对自己发起互评');
    }

    // 验证双方都是认证用户
    const [reviewer, reviewee] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: reviewerId },
        select: {
          id: true,
          role: true,
          profile: { select: { realName: true, avatar: true } },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: revieweeId },
        select: {
          id: true,
          role: true,
          profile: { select: { realName: true, avatar: true } },
        },
      }),
    ]);

    if (!reviewer || !reviewee) {
      throw new NotFoundException('用户不存在');
    }

    if (reviewer.role === Role.USER) {
      throw new ForbiddenException('只有认证用户才能发起互评');
    }

    if (reviewee.role === Role.USER) {
      throw new ForbiddenException('只能对认证用户发起互评');
    }

    // 检查是否有互动历史 (互关)
    const mutualFollow = await this.checkMutualFollow(reviewerId, revieweeId);
    if (!mutualFollow) {
      throw new BadRequestException('需要互相关注后才能发起互评');
    }

    // 检查是否已有未完成的互评
    const existingReview = await this.prisma.peerReview.findFirst({
      where: {
        OR: [
          { reviewerId, revieweeId },
          { reviewerId: revieweeId, revieweeId: reviewerId },
        ],
        status: { not: PeerReviewStatus.COMPLETED },
      },
    });

    if (existingReview) {
      throw new BadRequestException('已有进行中的互评请求');
    }

    // 创建互评记录
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天过期

    const review = await this.prisma.peerReview.create({
      data: {
        reviewerId,
        revieweeId,
        isAnonymous: data.isAnonymous || false,
        expiresAt,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true, avatar: true } },
          },
        },
        reviewee: {
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true, avatar: true } },
          },
        },
      },
    });

    return this.formatReview(review);
  }

  /**
   * 提交评价
   */
  async submitReview(
    userId: string,
    reviewId: string,
    data: SubmitReviewDto,
  ): Promise<PeerReviewDto> {
    const review = await this.prisma.peerReview.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: {
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true, avatar: true } },
          },
        },
        reviewee: {
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true, avatar: true } },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('互评不存在');
    }

    if (review.status === PeerReviewStatus.COMPLETED) {
      throw new BadRequestException('互评已完成');
    }

    if (
      review.status === PeerReviewStatus.EXPIRED ||
      new Date() > review.expiresAt
    ) {
      throw new BadRequestException('互评已过期');
    }

    const isReviewer = review.reviewerId === userId;
    const isReviewee = review.revieweeId === userId;

    if (!isReviewer && !isReviewee) {
      throw new ForbiddenException('无权操作此互评');
    }

    // 检查是否已经评价过
    if (isReviewer && review.overallScore !== null) {
      throw new BadRequestException('您已经提交过评价');
    }
    if (isReviewee && review.reverseOverallScore !== null) {
      throw new BadRequestException('您已经提交过评价');
    }

    // 更新评分
    const updateData = isReviewer
      ? {
          profileScore: data.profileScore,
          helpfulScore: data.helpfulScore,
          responseScore: data.responseScore,
          overallScore: data.overallScore,
          comment: data.comment,
        }
      : {
          reverseProfileScore: data.profileScore,
          reverseHelpfulScore: data.helpfulScore,
          reverseResponseScore: data.responseScore,
          reverseOverallScore: data.overallScore,
          reverseComment: data.comment,
        };

    // 检查是否双方都已评价
    const otherSideCompleted = isReviewer
      ? review.reverseOverallScore !== null
      : review.overallScore !== null;

    const updatedReview = await this.prisma.peerReview.update({
      where: { id: reviewId },
      data: {
        ...updateData,
        ...(otherSideCompleted
          ? {
              status: PeerReviewStatus.COMPLETED,
              completedAt: new Date(),
            }
          : {}),
      },
      include: {
        reviewer: {
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true, avatar: true } },
          },
        },
        reviewee: {
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true, avatar: true } },
          },
        },
      },
    });

    // 如果完成，更新双方的平均评分
    if (updatedReview.status === PeerReviewStatus.COMPLETED) {
      await Promise.all([
        this.updateUserRating(review.revieweeId),
        this.updateUserRating(review.reviewerId),
      ]);
    }

    return this.formatReview(updatedReview);
  }

  /**
   * 获取我的互评记录
   */
  async getMyReviews(userId: string): Promise<PeerReviewListDto> {
    const reviews = await this.prisma.peerReview.findMany({
      where: {
        OR: [{ reviewerId: userId }, { revieweeId: userId }],
      },
      include: {
        reviewer: {
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true, avatar: true } },
          },
        },
        reviewee: {
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      reviews: reviews.map((r) => this.formatReview(r)),
      total: reviews.length,
    };
  }

  /**
   * 获取用户评分
   */
  async getUserRating(userId: string): Promise<UserRatingDto> {
    const reviews = await this.prisma.peerReview.findMany({
      where: {
        revieweeId: userId,
        status: PeerReviewStatus.COMPLETED,
        overallScore: { not: null },
      },
      select: {
        overallScore: true,
        profileScore: true,
        helpfulScore: true,
        responseScore: true,
      },
    });

    // 同时获取作为发起方收到的反向评价
    const reverseReviews = await this.prisma.peerReview.findMany({
      where: {
        reviewerId: userId,
        status: PeerReviewStatus.COMPLETED,
        reverseOverallScore: { not: null },
      },
      select: {
        reverseOverallScore: true,
        reverseProfileScore: true,
        reverseHelpfulScore: true,
        reverseResponseScore: true,
      },
    });

    const allScores = [
      ...reviews.map((r) => ({
        overall: r.overallScore,
        profile: r.profileScore,
        helpful: r.helpfulScore,
        response: r.responseScore,
      })),
      ...reverseReviews.map((r) => ({
        overall: r.reverseOverallScore,
        profile: r.reverseProfileScore,
        helpful: r.reverseHelpfulScore,
        response: r.reverseResponseScore,
      })),
    ];

    if (allScores.length === 0) {
      return { userId, count: 0 };
    }

    const avg = (arr: (number | null)[]) => {
      const valid = arr.filter((n): n is number => n !== null);
      return valid.length > 0
        ? valid.reduce((a, b) => a + b, 0) / valid.length
        : undefined;
    };

    return {
      userId,
      overall: avg(allScores.map((s) => s.overall)),
      profile: avg(allScores.map((s) => s.profile)),
      helpful: avg(allScores.map((s) => s.helpful)),
      response: avg(allScores.map((s) => s.response)),
      count: allScores.length,
    };
  }

  /**
   * 获取用户收到的评价列表 (公开)
   */
  async getUserReviews(userId: string): Promise<PeerReviewListDto> {
    const reviews = await this.prisma.peerReview.findMany({
      where: {
        OR: [
          {
            revieweeId: userId,
            status: PeerReviewStatus.COMPLETED,
            overallScore: { not: null },
          },
          {
            reviewerId: userId,
            status: PeerReviewStatus.COMPLETED,
            reverseOverallScore: { not: null },
          },
        ],
      },
      include: {
        reviewer: {
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true, avatar: true } },
          },
        },
        reviewee: {
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true, avatar: true } },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    return {
      reviews: reviews.map((r) => this.formatReview(r)),
      total: reviews.length,
    };
  }

  // ============ Private Methods ============

  private async checkMutualFollow(
    userId1: string,
    userId2: string,
  ): Promise<boolean> {
    const follows = await this.prisma.follow.findMany({
      where: {
        OR: [
          { followerId: userId1, followingId: userId2 },
          { followerId: userId2, followingId: userId1 },
        ],
      },
    });

    return follows.length === 2;
  }

  private async updateUserRating(userId: string): Promise<void> {
    const rating = await this.getUserRating(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        avgRating: rating.overall,
        reviewCount: rating.count,
      },
    });
  }

  private formatReview(review: any): PeerReviewDto {
    const formatUser = (user: any): UserBasicDto => ({
      id: user.id,
      name: user.profile?.realName || undefined,
      avatar: user.profile?.avatar || undefined,
      isVerified: user.role === Role.VERIFIED || user.role === Role.ADMIN,
    });

    return {
      id: review.id,
      reviewer: review.isAnonymous
        ? { id: '', isVerified: true }
        : formatUser(review.reviewer),
      reviewee: formatUser(review.reviewee),
      profileScore: review.profileScore ?? undefined,
      helpfulScore: review.helpfulScore ?? undefined,
      responseScore: review.responseScore ?? undefined,
      overallScore: review.overallScore ?? undefined,
      comment: review.comment ?? undefined,
      reverseProfileScore: review.reverseProfileScore ?? undefined,
      reverseHelpfulScore: review.reverseHelpfulScore ?? undefined,
      reverseResponseScore: review.reverseResponseScore ?? undefined,
      reverseOverallScore: review.reverseOverallScore ?? undefined,
      reverseComment: review.reverseComment ?? undefined,
      isAnonymous: review.isAnonymous,
      status: review.status,
      expiresAt: review.expiresAt,
      completedAt: review.completedAt ?? undefined,
      createdAt: review.createdAt,
    };
  }
}
