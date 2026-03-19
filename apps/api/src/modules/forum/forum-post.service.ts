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
import { Prisma, Role } from '@prisma/client';
import {
  CreatePostDto,
  UpdatePostDto,
  PostQueryDto,
  PostSortBy,
  PostDto,
  PostDetailResponseDto,
  PostListResponseDto,
  CommentDto,
} from './dto';
import { FORUM_AUTHOR_SELECT, mapForumAuthor } from './forum.constants';

@Injectable()
export class ForumPostService {
  private readonly logger = new Logger(ForumPostService.name);

  constructor(
    private prisma: PrismaService,
    private auth: AuthorizationService,
    private moderation: ForumModerationService,
    private forumMemory: ForumMemoryService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Get paginated posts with filtering and sorting. Pinned posts always appear first.
   *
   * @param userId - Current user ID, or null for anonymous access
   * @param query - Filtering (category, team, tag, search) and sorting (latest/popular/comments/recommended) options
   * @returns Paginated post list with total count and hasMore flag
   */
  async getPosts(
    userId: string | null,
    query: PostQueryDto,
  ): Promise<PostListResponseDto> {
    const {
      categoryId,
      isTeamPost,
      postTag,
      search,
      sortBy,
      limit = 20,
      offset = 0,
    } = query;

    const where: Prisma.ForumPostWhereInput = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isTeamPost !== undefined) {
      where.isTeamPost = isTeamPost;
    }

    // 标签筛选
    if (postTag) {
      where.postTag = postTag as any;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }

    // 排序
    let orderBy:
      | Prisma.ForumPostOrderByWithRelationInput
      | Prisma.ForumPostOrderByWithRelationInput[] = {};
    switch (sortBy) {
      case PostSortBy.POPULAR:
        orderBy = { likeCount: 'desc' };
        break;
      case PostSortBy.COMMENTS:
        orderBy = { commentCount: 'desc' };
        break;
      case PostSortBy.RECOMMENDED:
        // 推荐排序: 综合考虑点赞数、评论数、浏览量、认证用户优先
        orderBy = [
          { author: { role: 'desc' } }, // 认证用户优先
          { likeCount: 'desc' },
          { commentCount: 'desc' },
          { createdAt: 'desc' },
        ];
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    // 构建最终排序 (置顶帖子始终优先)
    const finalOrderBy = Array.isArray(orderBy)
      ? [{ isPinned: 'desc' as const }, ...orderBy]
      : [{ isPinned: 'desc' as const }, orderBy];

    const [posts, total] = await Promise.all([
      this.prisma.forumPost.findMany({
        where,
        orderBy: finalOrderBy,
        skip: offset,
        take: limit,
        include: {
          category: true,
          author: {
            select: FORUM_AUTHOR_SELECT,
          },
          likes: userId ? { where: { userId }, select: { id: true } } : false,
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.forumPost.count({ where }),
    ]);

    const formattedPosts: PostDto[] = posts.map((post) => ({
      id: post.id,
      categoryId: post.categoryId,
      category: {
        id: post.category.id,
        name: post.category.name,
        nameZh: post.category.nameZh,
        description: post.category.description || undefined,
        descriptionZh: post.category.descriptionZh || undefined,
        icon: post.category.icon || undefined,
        color: post.category.color || undefined,
        postCount: 0,
      },
      author: mapForumAuthor(post.author),
      title: post.title,
      content: post.content,
      tags: post.tags,
      isTeamPost: post.isTeamPost,
      teamSize: post.teamSize || undefined,
      currentSize: post.currentSize || undefined,
      requirements: post.requirements || undefined,
      teamDeadline: post.teamDeadline || undefined,
      teamStatus: post.teamStatus || undefined,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      commentCount: post._count.comments,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      isLiked: userId ? (post.likes as any[]).length > 0 : false,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));

    return {
      posts: formattedPosts,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get post detail with comments, team members, and applications. Increments view count.
   *
   * @param postId - Post ID
   * @param userId - Current user ID, or null for anonymous access
   * @returns Full post detail including comments, team members, and applications
   * @throws {NotFoundException} When the post does not exist
   */
  async getPostById(
    postId: string,
    userId: string | null,
  ): Promise<PostDetailResponseDto> {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      include: {
        category: true,
        author: {
          select: FORUM_AUTHOR_SELECT,
        },
        likes: userId ? { where: { userId }, select: { id: true } } : false,
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: FORUM_AUTHOR_SELECT,
            },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: FORUM_AUTHOR_SELECT,
                },
              },
            },
          },
        },
        teamMembers: {
          include: {
            user: {
              select: FORUM_AUTHOR_SELECT,
            },
          },
        },
        teamApplications:
          userId === null
            ? false
            : ({
                where: {
                  OR: [{ applicantId: userId }, { post: { authorId: userId } }],
                },
                include: {
                  applicant: {
                    select: FORUM_AUTHOR_SELECT,
                  },
                  resume: { select: { id: true, title: true } },
                },
              } as any),
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    // Conditional includes (likes, teamApplications) prevent TS from inferring relation types
    const postData = post as any;

    // 增加浏览量
    await this.prisma.forumPost.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });

    // 记录浏览行为到记忆系统
    if (userId) {
      fireAndForget(
        this.forumMemory.recordViewToMemory(userId, post),
        this.logger,
        'Failed to record view to memory',
      );
    }

    const formatComment = (comment: any): CommentDto => ({
      id: comment.id,
      author: mapForumAuthor(comment.author),
      content: comment.content,
      parentId: comment.parentId || undefined,
      likeCount: comment.likeCount,
      replies: comment.replies?.map(formatComment),
      createdAt: comment.createdAt,
    });

    return {
      id: post.id,
      categoryId: post.categoryId,
      category: {
        id: postData.category.id,
        name: postData.category.name,
        nameZh: postData.category.nameZh,
        description: postData.category.description || undefined,
        descriptionZh: postData.category.descriptionZh || undefined,
        icon: postData.category.icon || undefined,
        color: postData.category.color || undefined,
        postCount: 0,
      },
      author: mapForumAuthor(postData.author),
      title: post.title,
      content: post.content,
      tags: post.tags,
      isTeamPost: post.isTeamPost,
      teamSize: post.teamSize || undefined,
      currentSize: post.currentSize || undefined,
      requirements: post.requirements || undefined,
      teamDeadline: post.teamDeadline || undefined,
      teamStatus: post.teamStatus || undefined,
      viewCount: post.viewCount + 1,
      likeCount: post.likeCount,
      commentCount: postData.comments.length,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      isLiked: userId ? postData.likes?.length > 0 : false,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      comments: postData.comments.map(formatComment),
      teamMembers: postData.teamMembers?.map((tm: any) => ({
        id: tm.id,
        user: mapForumAuthor(tm.user),
        role: tm.role,
        joinedAt: tm.joinedAt,
      })),
      teamApplications: postData.teamApplications?.map((ta: any) => ({
        id: ta.id,
        applicant: mapForumAuthor(ta.applicant),
        message: ta.message || undefined,
        status: ta.status,
        createdAt: ta.createdAt,
      })),
    };
  }

  /**
   * Create a post. Only verified users can create team posts. Runs content moderation
   * and auto-adds the author as team owner for team posts.
   *
   * @param userId - Author's user ID
   * @param data - Post creation data
   * @returns The created post
   * @throws {ForbiddenException} When an unverified user attempts to create a team post
   * @throws {BadRequestException} When the category is invalid or content fails moderation
   */
  async createPost(
    userId: string,
    data: CreatePostDto,
    locale = 'zh',
  ): Promise<PostDto> {
    // 获取用户角色
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    // 组队帖子仅认证用户可发布
    if (data.isTeamPost && user?.role === Role.USER) {
      throw new ForbiddenException(
        '仅认证用户可发布组队帖子 / Only verified users can create team posts',
      );
    }

    // 内容审核
    await this.moderation.validateMultiple([
      { content: data.title, context: '标题' },
      { content: data.content, context: '内容' },
      ...(data.requirements
        ? [{ content: data.requirements, context: '队友要求' }]
        : []),
    ]);

    // 验证分类存在
    const category = await this.prisma.forumCategory.findUnique({
      where: { id: data.categoryId },
    });

    if (!category || !category.isActive) {
      throw new BadRequestException('Invalid category');
    }

    const post = await this.prisma.forumPost.create({
      data: {
        categoryId: data.categoryId,
        authorId: userId,
        title: data.title,
        content: data.content,
        tags: data.tags || [],
        isTeamPost: data.isTeamPost || false,
        teamSize: data.teamSize,
        requirements: data.requirements,
        teamDeadline: data.teamDeadline
          ? new Date(data.teamDeadline)
          : undefined,
      },
      include: {
        category: true,
        author: {
          select: FORUM_AUTHOR_SELECT,
        },
      },
    });

    // 如果是组队帖子，自动将发帖人添加为团队 owner
    if (data.isTeamPost) {
      await this.prisma.teamMember.create({
        data: {
          postId: post.id,
          userId,
          role: 'owner',
        },
      });
    }

    const result: PostDto = {
      id: post.id,
      categoryId: post.categoryId,
      category: {
        id: post.category.id,
        name: post.category.name,
        nameZh: post.category.nameZh,
        postCount: 0,
      },
      author: mapForumAuthor(post.author),
      title: post.title,
      content: post.content,
      tags: post.tags,
      isTeamPost: post.isTeamPost,
      teamSize: post.teamSize || undefined,
      currentSize: 1,
      requirements: post.requirements || undefined,
      teamDeadline: post.teamDeadline || undefined,
      teamStatus: post.teamStatus,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      isPinned: false,
      isLocked: false,
      isLiked: false,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };

    // 记录到记忆系统
    await this.forumMemory.savePostToMemory(
      userId,
      locale === 'zh'
        ? post.category.nameZh || post.category.name
        : post.category.name || post.category.nameZh,
      data,
    );

    return result;
  }

  /**
   * Update a post. Verifies ownership and locked status.
   *
   * @param postId - Post ID
   * @param userId - Current user ID
   * @param data - Fields to update
   * @returns The updated post
   * @throws {NotFoundException} When the post does not exist
   * @throws {ForbiddenException} When the user is not the author or the post is locked
   */
  async updatePost(
    postId: string,
    userId: string,
    data: UpdatePostDto,
  ): Promise<PostDto> {
    const post = this.auth.verifyOwnership(
      await this.prisma.forumPost.findUnique({ where: { id: postId } }),
      userId,
      { entityName: 'Post', ownerField: 'authorId' },
    );

    if (post.isLocked) {
      throw new ForbiddenException('Post is locked');
    }

    const updated = await this.prisma.forumPost.update({
      where: { id: postId },
      data: {
        title: data.title,
        content: data.content,
        tags: data.tags,
        requirements: data.requirements,
        teamDeadline: data.teamDeadline
          ? new Date(data.teamDeadline)
          : undefined,
      },
      include: {
        category: true,
        author: {
          select: FORUM_AUTHOR_SELECT,
        },
        _count: { select: { comments: true } },
      },
    });

    return {
      id: updated.id,
      categoryId: updated.categoryId,
      author: mapForumAuthor(updated.author),
      title: updated.title,
      content: updated.content,
      tags: updated.tags,
      isTeamPost: updated.isTeamPost,
      teamSize: updated.teamSize || undefined,
      currentSize: updated.currentSize || undefined,
      viewCount: updated.viewCount,
      likeCount: updated.likeCount,
      commentCount: updated._count.comments,
      isPinned: updated.isPinned,
      isLocked: updated.isLocked,
      isLiked: false,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Delete a post. Verifies ownership.
   *
   * @param postId - Post ID
   * @param userId - Current user ID
   * @throws {NotFoundException} When the post does not exist
   * @throws {ForbiddenException} When the user is not the author
   */
  async deletePost(postId: string, userId: string): Promise<void> {
    this.auth.verifyOwnership(
      await this.prisma.forumPost.findUnique({ where: { id: postId } }),
      userId,
      { entityName: 'Post', ownerField: 'authorId' },
    );

    await this.prisma.forumPost.delete({ where: { id: postId } });
  }

  /**
   * Toggle like/unlike on a post. Uses a transaction for atomicity.
   *
   * @param postId - Post ID
   * @param userId - Current user ID
   * @returns Whether the post is now liked
   */
  async likePost(postId: string, userId: string): Promise<{ liked: boolean }> {
    const existing = await this.prisma.forumLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      // Unlike
      await this.prisma.$transaction([
        this.prisma.forumLike.delete({ where: { id: existing.id } }),
        this.prisma.forumPost.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);
      return { liked: false };
    } else {
      // Like
      await this.prisma.$transaction([
        this.prisma.forumLike.create({ data: { postId, userId } }),
        this.prisma.forumPost.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);

      // 记录点赞行为（只记录点赞，不记录取消点赞）
      fireAndForget(
        this.forumMemory.recordLikeToMemory(userId, postId),
        this.logger,
        'Failed to record like to memory',
      );

      // 通知帖子作者被点赞（不通知自己）
      fireAndForget(
        this.prisma.forumPost
          .findUnique({ where: { id: postId }, select: { authorId: true } })
          .then((post) => {
            if (post && post.authorId !== userId) {
              return this.notificationService.createNotification(
                post.authorId,
                NotificationType.POST_LIKE,
                {
                  actorId: userId,
                  relatedId: postId,
                  relatedType: 'forum_post',
                },
              );
            }
          }),
        this.logger,
        'Failed to send like notification',
      );

      return { liked: true };
    }
  }
}
