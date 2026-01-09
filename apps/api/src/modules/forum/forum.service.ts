import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { Prisma, TeamStatus, TeamAppStatus, Role } from '@prisma/client';
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

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(
    private prisma: PrismaService,
    private auth: AuthorizationService,
  ) {}

  // ============================================
  // Categories
  // ============================================

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

  async createCategory(data: CreateCategoryDto): Promise<CategoryDto> {
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

  async getPosts(userId: string | null, query: PostQueryDto): Promise<PostListResponseDto> {
    const { categoryId, isTeamPost, search, sortBy, limit = 20, offset = 0 } = query;

    const where: Prisma.ForumPostWhereInput = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isTeamPost !== undefined) {
      where.isTeamPost = isTeamPost;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }

    // 排序
    let orderBy: Prisma.ForumPostOrderByWithRelationInput = {};
    switch (sortBy) {
      case PostSortBy.POPULAR:
        orderBy = { likeCount: 'desc' };
        break;
      case PostSortBy.COMMENTS:
        orderBy = { commentCount: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [posts, total] = await Promise.all([
      this.prisma.forumPost.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, orderBy],
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
        isVerified: post.author.role === Role.VERIFIED || post.author.role === Role.ADMIN,
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

  async getPostById(postId: string, userId: string | null): Promise<PostDetailResponseDto> {
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
        teamApplications: userId === null ? false : {
          where: { OR: [{ applicantId: userId }, { post: { authorId: userId } }] },
          include: {
            applicant: {
              select: {
                id: true,
                role: true,
                profile: { select: { realName: true } },
              },
            },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // 增加浏览量
    await this.prisma.forumPost.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });

    const formatComment = (comment: any): CommentDto => ({
      id: comment.id,
      author: {
        id: comment.author.id,
        name: comment.author.profile?.realName || undefined,
        avatar: undefined,
        isVerified: comment.author.role === Role.VERIFIED || comment.author.role === Role.ADMIN,
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
        isVerified: post.author.role === Role.VERIFIED || post.author.role === Role.ADMIN,
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
      commentCount: post.comments.length,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      isLiked: userId ? (post.likes as any[]).length > 0 : false,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      comments: post.comments.map(formatComment),
      teamMembers: post.teamMembers?.map((tm) => ({
        id: tm.id,
        user: {
          id: tm.user.id,
          name: tm.user.profile?.realName || undefined,
          avatar: undefined,
          isVerified: tm.user.role === Role.VERIFIED || tm.user.role === Role.ADMIN,
        },
        role: tm.role,
        joinedAt: tm.joinedAt,
      })),
      teamApplications: (post.teamApplications as any[])?.map((ta) => ({
        id: ta.id,
        applicant: {
          id: ta.applicant.id,
          name: ta.applicant.profile?.realName || undefined,
          avatar: undefined,
          isVerified: ta.applicant.role === Role.VERIFIED || ta.applicant.role === Role.ADMIN,
        },
        message: ta.message || undefined,
        status: ta.status,
        createdAt: ta.createdAt,
      })),
    };
  }

  async createPost(userId: string, data: CreatePostDto): Promise<PostDto> {
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
        teamDeadline: data.teamDeadline ? new Date(data.teamDeadline) : undefined,
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

    return {
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
        isVerified: post.author.role === Role.VERIFIED || post.author.role === Role.ADMIN,
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
  }

  async updatePost(postId: string, userId: string, data: UpdatePostDto): Promise<PostDto> {
    const post = this.auth.verifyOwnership(
      await this.prisma.forumPost.findUnique({ where: { id: postId } }),
      userId,
      { entityName: 'Post', ownerField: 'authorId' }
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
        teamDeadline: data.teamDeadline ? new Date(data.teamDeadline) : undefined,
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
        isVerified: updated.author.role === Role.VERIFIED || updated.author.role === Role.ADMIN,
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

  async deletePost(postId: string, userId: string): Promise<void> {
    this.auth.verifyOwnership(
      await this.prisma.forumPost.findUnique({ where: { id: postId } }),
      userId,
      { entityName: 'Post', ownerField: 'authorId' }
    );

    await this.prisma.forumPost.delete({ where: { id: postId } });
  }

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
      return { liked: true };
    }
  }

  // ============================================
  // Comments
  // ============================================

  async createComment(postId: string, userId: string, data: CreateCommentDto): Promise<CommentDto> {
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

    return {
      id: comment.id,
      author: {
        id: comment.author.id,
        name: comment.author.profile?.realName || undefined,
        avatar: undefined,
        isVerified: comment.author.role === Role.VERIFIED || comment.author.role === Role.ADMIN,
      },
      content: comment.content,
      parentId: comment.parentId || undefined,
      likeCount: 0,
      createdAt: comment.createdAt,
    };
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
      { entityName: 'Comment', ownerField: 'authorId' }
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
          ]
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

  async applyToTeam(postId: string, userId: string, data: TeamApplicationDto): Promise<{ applied: boolean }> {
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

    return { applied: true };
  }

  async reviewApplication(applicationId: string, userId: string, data: ReviewApplicationDto): Promise<void> {
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

    const newStatus = data.status === 'ACCEPTED' ? TeamAppStatus.ACCEPTED : TeamAppStatus.REJECTED;

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
      if (application.post.teamSize && memberCount >= application.post.teamSize) {
        updateData.teamStatus = TeamStatus.FULL;
      }

      await this.prisma.forumPost.update({
        where: { id: application.postId },
        data: updateData,
      });
    }
  }

  async cancelApplication(applicationId: string, userId: string): Promise<void> {
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

  async leaveTeam(postId: string, userId: string): Promise<void> {
    const member = await this.prisma.teamMember.findUnique({
      where: { postId_userId: { postId, userId } },
      include: { post: true },
    });

    if (!member) {
      throw new NotFoundException('You are not a team member');
    }

    if (member.role === 'owner') {
      throw new BadRequestException('Team owner cannot leave. Delete the post instead.');
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
        isVerified: m.post.author.role === Role.VERIFIED || m.post.author.role === Role.ADMIN,
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
}

