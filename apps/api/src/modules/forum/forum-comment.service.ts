import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { ForumModerationService } from './moderation.service';
import { ForumMemoryService } from './forum-memory.service';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';
import { fireAndForget } from '../../common/utils/async.util';
import { CreateCommentDto, CommentDto } from './dto';
import { FORUM_AUTHOR_SELECT, mapForumAuthor } from './forum.constants';

@Injectable()
export class ForumCommentService {
  private readonly logger = new Logger(ForumCommentService.name);

  constructor(
    private prisma: PrismaService,
    private auth: AuthorizationService,
    private moderation: ForumModerationService,
    private forumMemory: ForumMemoryService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Create a comment or reply. Runs content moderation and checks post locked status.
   *
   * @param postId - Post ID to comment on
   * @param userId - Comment author's user ID
   * @param data - Comment content and optional parentId for replies
   * @returns The created comment
   * @throws {NotFoundException} When the post does not exist
   * @throws {ForbiddenException} When the post is locked
   * @throws {BadRequestException} When the parent comment is invalid or content fails moderation
   */
  async createComment(
    postId: string,
    userId: string,
    data: CreateCommentDto,
  ): Promise<CommentDto> {
    // 内容审核
    await this.moderation.validateContent(data.content, '评论');

    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.isLocked) {
      throw new ForbiddenException('Post is locked');
    }

    // 如果是回复，验证父评论存在
    if (data.parentId) {
      const parent = await this.prisma.forumComment.findUnique({
        where: { id: data.parentId },
      });
      if (!parent || parent.postId !== postId) {
        throw new BadRequestException('Invalid parent comment');
      }
    }

    const comment = await this.prisma.forumComment.create({
      data: {
        postId,
        authorId: userId,
        content: data.content,
        parentId: data.parentId,
      },
      include: {
        author: {
          select: FORUM_AUTHOR_SELECT,
        },
      },
    });

    // 更新帖子评论数
    await this.prisma.forumPost.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });

    const result = {
      id: comment.id,
      author: mapForumAuthor(comment.author),
      content: comment.content,
      parentId: comment.parentId || undefined,
      likeCount: 0,
      createdAt: comment.createdAt,
    };

    // 记录评论行为到记忆系统
    fireAndForget(
      this.forumMemory.recordCommentToMemory(userId, postId, data.content),
      this.logger,
      'Failed to record comment to memory',
    );

    // 通知帖子作者有新评论（不通知自己）
    if (post.authorId !== userId) {
      fireAndForget(
        this.notificationService.createNotification(
          post.authorId,
          NotificationType.POST_REPLY,
          {
            actorId: userId,
            actorName: comment.author.profile?.realName || undefined,
            relatedId: postId,
            relatedType: 'forum_post',
          },
        ),
        this.logger,
        'Failed to send comment notification',
      );
    }

    return result;
  }

  /**
   * 删除评论
   *
   * 业务逻辑：
   * - 只能删除自己的评论
   * - 删除时级联删除所有子回复
   * - 正确更新帖子评论计数
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = this.auth.verifyOwnership(
      await this.prisma.forumComment.findUnique({
        where: { id: commentId },
        include: { replies: { select: { id: true } } },
      }),
      userId,
      { entityName: 'Comment', ownerField: 'authorId' },
    );

    // 计算要删除的评论总数（本评论 + 所有子回复）
    const replyCount = await this.countAllReplies(commentId);
    const totalToDelete = 1 + replyCount;

    // 先删除所有子回复（递归），再删除本评论
    // 由于 schema 已配置 onDelete: Cascade，直接删除即可
    // 但为确保数据一致性，使用事务
    await this.prisma.$transaction([
      // 删除所有子回复（递归查询所有后代）
      this.prisma.forumComment.deleteMany({
        where: {
          OR: [
            { parentId: commentId },
            // 需要递归删除，但 Prisma 不支持递归查询，
            // 所以依赖 schema 的 onDelete: Cascade
          ],
        },
      }),
      // 删除本评论
      this.prisma.forumComment.delete({ where: { id: commentId } }),
      // 更新帖子评论数
      this.prisma.forumPost.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: totalToDelete } },
      }),
    ]);
  }

  /**
   * 递归计算所有子回复数量
   */
  async countAllReplies(commentId: string): Promise<number> {
    const directReplies = await this.prisma.forumComment.findMany({
      where: { parentId: commentId },
      select: { id: true },
    });

    let count = directReplies.length;

    for (const reply of directReplies) {
      count += await this.countAllReplies(reply.id);
    }

    return count;
  }
}
