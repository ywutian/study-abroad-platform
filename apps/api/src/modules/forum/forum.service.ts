import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { ForumModerationService } from './moderation.service';
import {
  Prisma,
  TeamStatus,
  TeamAppStatus,
  Role,
  MemoryType,
} from '@prisma/client';
import {
  CreateCategoryDto,
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
  PostQueryDto,
  TeamApplicationDto,
  ReviewApplicationDto,
  PostSortBy,
  CategoryDto,
  PostDto,
  PostDetailResponseDto,
  PostListResponseDto,
  CommentDto,
} from './dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(
    private prisma: PrismaService,
    private auth: AuthorizationService,
    private moderation: ForumModerationService,
    @Optional()
    @Inject(forwardRef(() => MemoryManagerService))
    private memoryManager?: MemoryManagerService,
  ) {}

  // ============================================
  // Stats
  // ============================================

  /**
   * Get forum statistics including post count, user count, active team count, and daily active users.
   *
   * @returns Forum statistics object
   */
  async getStats(): Promise<{
    postCount: number;
    userCount: number;
    teamingCount: number;
    activeToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [postCount, userCount, teamingCount, activeToday] = await Promise.all(
      [
        // 总帖子数
        this.prisma.forumPost.count(),
        // 发帖用户数
        this.prisma.forumPost
          .groupBy({
            by: ['authorId'],
          })
          .then((groups) => groups.length),
        // 正在组队的帖子数
        this.prisma.forumPost.count({
          where: {
            isTeamPost: true,
            teamStatus: 'RECRUITING',
          },
        }),
        // 今日活跃（今日发帖或评论的用户数）
        Promise.all([
          this.prisma.forumPost.findMany({
            where: { createdAt: { gte: today } },
            select: { authorId: true },
          }),
          this.prisma.forumComment.findMany({
            where: { createdAt: { gte: today } },
            select: { authorId: true },
          }),
        ]).then(([posts, comments]) => {
          const userIds = new Set([
            ...posts.map((p) => p.authorId),
            ...comments.map((c) => c.authorId),
          ]);
          return userIds.size;
        }),
      ],
    );

    return {
      postCount,
      userCount,
      teamingCount,
      activeToday,
    };
  }

  // ============================================
  // Categories
  // ============================================

  /**
   * Get all active categories with post counts, ordered by sortOrder.
   *
   * @returns Array of categories with post counts
   */
  async getCategories(): Promise<CategoryDto[]> {
    const categories = await this.prisma.forumCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { posts: true } },
      },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      nameZh: c.nameZh,
      description: c.description || undefined,
      descriptionZh: c.descriptionZh || undefined,
      icon: c.icon || undefined,
      color: c.color || undefined,
      postCount: c._count.posts,
    }));
  }

  /**
   * Create a new forum category. Checks for name uniqueness.
   *
   * @param data - Category creation data
   * @returns The created category
   * @throws {BadRequestException} When a category with the same name already exists
   */
  async createCategory(data: CreateCategoryDto): Promise<CategoryDto> {
    const existing = await this.prisma.forumCategory.findFirst({
      where: {
        OR: [{ name: data.name }, { nameZh: data.nameZh }],
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Category already exists: ${existing.name} / ${existing.nameZh}`,
      );
    }

    const category = await this.prisma.forumCategory.create({
      data: {
        name: data.name,
        nameZh: data.nameZh,
        description: data.description,
        descriptionZh: data.descriptionZh,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder || 0,
      },
    });

    return {
      id: category.id,
      name: category.name,
      nameZh: category.nameZh,
      description: category.description || undefined,
      descriptionZh: category.descriptionZh || undefined,
      icon: category.icon || undefined,
      color: category.color || undefined,
      postCount: 0,
    };
  }

  // ============================================
  // Posts
  // ============================================

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
            select: {
              id: true,
              role: true,
              profile: { select: { realName: true } },
            },
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
      author: {
        id: post.author.id,
        name: post.author.profile?.realName || undefined,
        avatar: undefined,
        isVerified:
          post.author.role === Role.VERIFIED || post.author.role === Role.ADMIN,
      },
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
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true } },
          },
        },
        likes: userId ? { where: { userId }, select: { id: true } } : false,
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                role: true,
                profile: { select: { realName: true } },
              },
            },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: {
                    id: true,
                    role: true,
                    profile: { select: { realName: true } },
                  },
                },
              },
            },
          },
        },
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                role: true,
                profile: { select: { realName: true } },
              },
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
                    select: {
                      id: true,
                      role: true,
                      profile: { select: { realName: true } },
                    },
                  },
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
      this.recordViewToMemory(userId, post).catch((err) => {
        this.logger.warn('Failed to record view to memory', err);
      });
    }

    const formatComment = (comment: any): CommentDto => ({
      id: comment.id,
      author: {
        id: comment.author.id,
        name: comment.author.profile?.realName || undefined,
        avatar: undefined,
        isVerified:
          comment.author.role === Role.VERIFIED ||
          comment.author.role === Role.ADMIN,
      },
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
      author: {
        id: postData.author.id,
        name: postData.author.profile?.realName || undefined,
        avatar: undefined,
        isVerified:
          postData.author.role === Role.VERIFIED ||
          postData.author.role === Role.ADMIN,
      },
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
        user: {
          id: tm.user.id,
          name: tm.user.profile?.realName || undefined,
          avatar: undefined,
          isVerified:
            tm.user.role === Role.VERIFIED || tm.user.role === Role.ADMIN,
        },
        role: tm.role,
        joinedAt: tm.joinedAt,
      })),
      teamApplications: postData.teamApplications?.map((ta: any) => ({
        id: ta.id,
        applicant: {
          id: ta.applicant.id,
          name: ta.applicant.profile?.realName || undefined,
          avatar: undefined,
          isVerified:
            ta.applicant.role === Role.VERIFIED ||
            ta.applicant.role === Role.ADMIN,
        },
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
  async createPost(userId: string, data: CreatePostDto): Promise<PostDto> {
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
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true } },
          },
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
      author: {
        id: post.author.id,
        name: post.author.profile?.realName || undefined,
        avatar: undefined,
        isVerified:
          post.author.role === Role.VERIFIED || post.author.role === Role.ADMIN,
      },
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
    await this.savePostToMemory(
      userId,
      post.category.nameZh || post.category.name,
      data,
    );

    return result;
  }

  /**
   * 保存帖子信息到记忆系统
   */
  private async savePostToMemory(
    userId: string,
    categoryName: string,
    data: CreatePostDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      if (data.isTeamPost) {
        // 组队帖记录为决策
        await this.memoryManager.remember(userId, {
          type: MemoryType.DECISION,
          category: 'team_post',
          content: `用户发起组队：${data.title}。要求：${data.requirements?.slice(0, 100) || '无'}。组队规模：${data.teamSize || '未限制'}人`,
          importance: 0.6,
          metadata: {
            postTitle: data.title,
            teamSize: data.teamSize,
            tags: data.tags,
            source: 'forum_service',
          },
        });
      } else {
        // 普通帖子记录感兴趣的话题
        await this.memoryManager.remember(userId, {
          type: MemoryType.PREFERENCE,
          category: 'forum_interest',
          content: `用户在论坛 ${categoryName} 板块发帖：${data.title}。标签：${data.tags?.join('、') || '无'}`,
          importance: 0.4,
          metadata: {
            categoryId: data.categoryId,
            tags: data.tags,
            source: 'forum_service',
          },
        });
      }
    } catch (error) {
      this.logger.warn('Failed to save forum post to memory', error);
    }
  }

  /**
   * 记录浏览帖子到记忆系统
   */
  private async recordViewToMemory(userId: string, post: any): Promise<void> {
    if (!this.memoryManager) return;

    try {
      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'forum_view',
        content: `用户浏览了论坛帖子：${post.title}${post.isTeamPost ? '（组队帖）' : ''}`,
        importance: 0.2,
        metadata: {
          postId: post.id,
          isTeamPost: post.isTeamPost,
          categoryId: post.categoryId,
          tags: post.tags,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record view to memory', error);
    }
  }

  /**
   * 记录点赞到记忆系统
   */
  private async recordLikeToMemory(
    userId: string,
    postId: string,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const post = await this.prisma.forumPost.findUnique({
        where: { id: postId },
        select: { title: true, tags: true, isTeamPost: true },
      });

      if (post) {
        await this.memoryManager.remember(userId, {
          type: MemoryType.PREFERENCE,
          category: 'forum_interest',
          content: `用户点赞了帖子：${post.title}。标签：${post.tags?.join('、') || '无'}`,
          importance: 0.3,
          metadata: {
            postId,
            tags: post.tags,
            isTeamPost: post.isTeamPost,
          },
        });
      }
    } catch (error) {
      this.logger.warn('Failed to record like to memory', error);
    }
  }

  /**
   * 记录评论到记忆系统
   */
  private async recordCommentToMemory(
    userId: string,
    postId: string,
    content: string,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const post = await this.prisma.forumPost.findUnique({
        where: { id: postId },
        select: { title: true, tags: true },
      });

      if (post) {
        await this.memoryManager.remember(userId, {
          type: MemoryType.FACT,
          category: 'forum_activity',
          content: `用户在帖子"${post.title}"下发表了评论`,
          importance: 0.3,
          metadata: {
            postId,
            commentPreview: content.slice(0, 100),
            tags: post.tags,
          },
        });
      }
    } catch (error) {
      this.logger.warn('Failed to record comment to memory', error);
    }
  }

  /**
   * 记录组队申请到记忆系统
   */
  private async recordTeamApplicationToMemory(
    userId: string,
    postTitle: string,
    message?: string,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      await this.memoryManager.remember(userId, {
        type: MemoryType.DECISION,
        category: 'team_application',
        content: `用户申请加入组队：${postTitle}${message ? `，留言：${message.slice(0, 50)}` : ''}`,
        importance: 0.6,
        metadata: {
          postTitle,
          message,
          source: 'forum_service',
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record team application to memory', error);
    }
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
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true } },
          },
        },
        _count: { select: { comments: true } },
      },
    });

    return {
      id: updated.id,
      categoryId: updated.categoryId,
      author: {
        id: updated.author.id,
        name: updated.author.profile?.realName || undefined,
        isVerified:
          updated.author.role === Role.VERIFIED ||
          updated.author.role === Role.ADMIN,
      },
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
      this.recordLikeToMemory(userId, postId).catch((err) => {
        this.logger.warn('Failed to record like to memory', err);
      });

      return { liked: true };
    }
  }

  // ============================================
  // Comments
  // ============================================

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
          select: {
            id: true,
            role: true,
            profile: { select: { realName: true } },
          },
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
      author: {
        id: comment.author.id,
        name: comment.author.profile?.realName || undefined,
        avatar: undefined,
        isVerified:
          comment.author.role === Role.VERIFIED ||
          comment.author.role === Role.ADMIN,
      },
      content: comment.content,
      parentId: comment.parentId || undefined,
      likeCount: 0,
      createdAt: comment.createdAt,
    };

    // 记录评论行为到记忆系统
    this.recordCommentToMemory(userId, postId, data.content).catch((err) => {
      this.logger.warn('Failed to record comment to memory', err);
    });

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
  private async countAllReplies(commentId: string): Promise<number> {
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

  // ============================================
  // Team Applications
  // ============================================

  /**
   * Apply to join a team post. Validates team status, membership, and duplicate applications.
   *
   * @param postId - Team post ID
   * @param userId - Applicant's user ID
   * @param data - Application message
   * @returns Whether the application was submitted
   * @throws {NotFoundException} When the post does not exist
   * @throws {BadRequestException} When the post is not a team post, team is not recruiting, user is already a member, or already applied
   */
  async applyToTeam(
    postId: string,
    userId: string,
    data: TeamApplicationDto,
  ): Promise<{ applied: boolean }> {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      include: { teamMembers: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (!post.isTeamPost) {
      throw new BadRequestException('This is not a team post');
    }

    if (post.authorId === userId) {
      throw new BadRequestException('You cannot apply to your own team');
    }

    if (post.teamStatus !== TeamStatus.RECRUITING) {
      throw new BadRequestException('Team is not recruiting');
    }

    // 检查是否已经是成员
    const isMember = post.teamMembers.some((tm) => tm.userId === userId);
    if (isMember) {
      throw new BadRequestException('You are already a team member');
    }

    // 检查是否已申请
    const existing = await this.prisma.teamApplication.findUnique({
      where: { postId_applicantId: { postId, applicantId: userId } },
    });

    if (existing) {
      throw new BadRequestException('You have already applied');
    }

    await this.prisma.teamApplication.create({
      data: {
        postId,
        applicantId: userId,
        message: data.message,
      },
    });

    // 记录申请组队行为
    this.recordTeamApplicationToMemory(userId, post.title, data.message).catch(
      (err) => {
        this.logger.warn('Failed to record team application to memory', err);
      },
    );

    return { applied: true };
  }

  /**
   * Accept or reject a team application. Only the post author can review.
   * If accepted, adds the applicant as a member and checks team capacity.
   *
   * @param applicationId - Application ID
   * @param userId - Reviewer's user ID (must be post author)
   * @param data - Review decision (accept/reject) and optional note
   * @throws {NotFoundException} When the application does not exist
   * @throws {ForbiddenException} When the user is not the team owner
   * @throws {BadRequestException} When the application is already reviewed
   */
  async reviewApplication(
    applicationId: string,
    userId: string,
    data: ReviewApplicationDto,
  ): Promise<void> {
    const application = await this.prisma.teamApplication.findUnique({
      where: { id: applicationId },
      include: { post: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.post.authorId !== userId) {
      throw new ForbiddenException('Only team owner can review applications');
    }

    if (application.status !== TeamAppStatus.PENDING) {
      throw new BadRequestException('Application already reviewed');
    }

    const newStatus =
      data.status === 'ACCEPTED'
        ? TeamAppStatus.ACCEPTED
        : TeamAppStatus.REJECTED;

    await this.prisma.teamApplication.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewNote: data.note,
      },
    });

    // 如果接受，添加为团队成员
    if (newStatus === TeamAppStatus.ACCEPTED) {
      await this.prisma.teamMember.create({
        data: {
          postId: application.postId,
          userId: application.applicantId,
          role: 'member',
        },
      });

      // 更新当前人数
      const memberCount = await this.prisma.teamMember.count({
        where: { postId: application.postId },
      });

      const updateData: any = { currentSize: memberCount };

      // 检查是否已满员
      if (
        application.post.teamSize &&
        memberCount >= application.post.teamSize
      ) {
        updateData.teamStatus = TeamStatus.FULL;
      }

      await this.prisma.forumPost.update({
        where: { id: application.postId },
        data: updateData,
      });
    }
  }

  /**
   * Cancel own pending team application.
   *
   * @param applicationId - Application ID
   * @param userId - Applicant's user ID
   * @throws {NotFoundException} When the application does not exist
   * @throws {ForbiddenException} When the user is not the applicant
   * @throws {BadRequestException} When the application is already reviewed
   */
  async cancelApplication(
    applicationId: string,
    userId: string,
  ): Promise<void> {
    const application = await this.prisma.teamApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.applicantId !== userId) {
      throw new ForbiddenException('You can only cancel your own application');
    }

    if (application.status !== TeamAppStatus.PENDING) {
      throw new BadRequestException('Cannot cancel a reviewed application');
    }

    await this.prisma.teamApplication.update({
      where: { id: applicationId },
      data: { status: TeamAppStatus.CANCELLED },
    });
  }

  /**
   * Leave a team. The owner cannot leave. Re-opens recruitment after departure.
   *
   * @param postId - Team post ID
   * @param userId - User ID of the member leaving
   * @throws {NotFoundException} When the user is not a team member
   * @throws {BadRequestException} When the team owner attempts to leave
   */
  async leaveTeam(postId: string, userId: string): Promise<void> {
    const member = await this.prisma.teamMember.findUnique({
      where: { postId_userId: { postId, userId } },
      include: { post: true },
    });

    if (!member) {
      throw new NotFoundException('You are not a team member');
    }

    if (member.role === 'owner') {
      throw new BadRequestException(
        'Team owner cannot leave. Delete the post instead.',
      );
    }

    await this.prisma.teamMember.delete({
      where: { id: member.id },
    });

    // 更新人数
    const memberCount = await this.prisma.teamMember.count({
      where: { postId },
    });

    await this.prisma.forumPost.update({
      where: { id: postId },
      data: {
        currentSize: memberCount,
        teamStatus: TeamStatus.RECRUITING, // 重新开放招募
      },
    });
  }

  /**
   * Get all teams the user is a member of.
   *
   * @param userId - User ID
   * @returns Array of team posts the user belongs to
   */
  async getMyTeams(userId: string): Promise<PostDto[]> {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            category: true,
            author: {
              select: {
                id: true,
                role: true,
                profile: { select: { realName: true } },
              },
            },
            _count: { select: { comments: true, teamMembers: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({
      id: m.post.id,
      categoryId: m.post.categoryId,
      author: {
        id: m.post.author.id,
        name: m.post.author.profile?.realName || undefined,
        isVerified:
          m.post.author.role === Role.VERIFIED ||
          m.post.author.role === Role.ADMIN,
      },
      title: m.post.title,
      content: m.post.content,
      tags: m.post.tags,
      isTeamPost: true,
      teamSize: m.post.teamSize || undefined,
      currentSize: m.post._count.teamMembers,
      teamStatus: m.post.teamStatus,
      viewCount: m.post.viewCount,
      likeCount: m.post.likeCount,
      commentCount: m.post._count.comments,
      isPinned: m.post.isPinned,
      isLocked: m.post.isLocked,
      isLiked: false,
      createdAt: m.post.createdAt,
      updatedAt: m.post.updatedAt,
    }));
  }

  // ============================================
  // Reports
  // ============================================

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
