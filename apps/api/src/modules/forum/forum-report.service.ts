import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ForumReportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Report a post. Checks for self-reports and duplicate reports.
   *
   * @param reporterId - Reporter's user ID
   * @param postId - Post ID to report
   * @param reason - Report reason
   * @param detail - Optional additional detail
   * @returns The created report
   * @throws {NotFoundException} When the post does not exist
   * @throws {BadRequestException} When reporting own post or duplicate report
   */
  async reportPost(
    reporterId: string,
    postId: string,
    reason: string,
    detail?: string,
  ) {
    // 验证帖子存在
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      select: { id: true, title: true, content: true, authorId: true },
    });

    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    // 不能举报自己的帖子
    if (post.authorId === reporterId) {
      throw new BadRequestException('不能举报自己的帖子');
    }

    // 检查是否已举报过
    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: 'POST',
        targetId: postId,
        status: { not: 'RESOLVED' },
      },
    });

    if (existingReport) {
      throw new BadRequestException('您已举报过该帖子');
    }

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: 'POST',
        targetId: postId,
        reason,
        detail,
        context: {
          postTitle: post.title,
          postContent: post.content.substring(0, 500),
          authorId: post.authorId,
        },
      },
    });
  }

  /**
   * Report a comment. Checks for self-reports and duplicate reports.
   *
   * @param reporterId - Reporter's user ID
   * @param commentId - Comment ID to report
   * @param reason - Report reason
   * @param detail - Optional additional detail
   * @returns The created report
   * @throws {NotFoundException} When the comment does not exist
   * @throws {BadRequestException} When reporting own comment or duplicate report
   */
  async reportComment(
    reporterId: string,
    commentId: string,
    reason: string,
    detail?: string,
  ) {
    // 验证评论存在
    const comment = await this.prisma.forumComment.findUnique({
      where: { id: commentId },
      select: { id: true, content: true, authorId: true, postId: true },
    });

    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    // 不能举报自己的评论
    if (comment.authorId === reporterId) {
      throw new BadRequestException('不能举报自己的评论');
    }

    // 检查是否已举报过
    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: 'COMMENT',
        targetId: commentId,
        status: { not: 'RESOLVED' },
      },
    });

    if (existingReport) {
      throw new BadRequestException('您已举报过该评论');
    }

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: 'COMMENT',
        targetId: commentId,
        reason,
        detail,
        context: {
          commentContent: comment.content,
          authorId: comment.authorId,
          postId: comment.postId,
        },
      },
    });
  }
}
