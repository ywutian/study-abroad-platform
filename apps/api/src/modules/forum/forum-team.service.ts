import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { ForumMemoryService } from './forum-memory.service';
import { fireAndForget } from '../../common/utils/async.util';
import { TeamStatus, TeamAppStatus, Role } from '@prisma/client';
import { TeamApplicationDto, ReviewApplicationDto, PostDto } from './dto';
import { FORUM_AUTHOR_SELECT, mapForumAuthor } from './forum.constants';

@Injectable()
export class ForumTeamService {
  private readonly logger = new Logger(ForumTeamService.name);

  constructor(
    private prisma: PrismaService,
    private auth: AuthorizationService,
    private forumMemory: ForumMemoryService,
  ) {}

  /**
   * Get team applications for a post. Only the post author or an admin may list applications.
   *
   * @param postId - Post ID
   * @param userId - Caller's user ID (required)
   * @param role - Caller's role (for ADMIN check)
   * @returns List of team applications with applicant info
   * @throws {NotFoundException} When the post does not exist
   * @throws {ForbiddenException} When the caller is not the post author or admin
   */
  async getApplicationsForPost(
    postId: string,
    userId: string,
    role: string,
  ): Promise<
    Array<{
      id: string;
      applicant: {
        id: string;
        name?: string;
        avatar?: string;
        isVerified: boolean;
      };
      message?: string;
      status: string;
      createdAt: Date;
    }>
  > {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    const isAuthor = post.authorId === userId;
    const isAdmin = role === Role.ADMIN;
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException(
        'Only the post author or an admin can view team applications',
      );
    }
    const list = await this.prisma.teamApplication.findMany({
      where: { postId },
      include: {
        applicant: {
          select: FORUM_AUTHOR_SELECT,
        },
        resume: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((ta) => ({
      id: ta.id,
      applicant: mapForumAuthor(ta.applicant),
      message: ta.message ?? undefined,
      resume: ta.resume
        ? { id: ta.resume.id, title: ta.resume.title }
        : undefined,
      status: ta.status,
      createdAt: ta.createdAt,
    }));
  }

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
        resumeId: data.resumeId || undefined,
      },
    });

    // 记录申请组队行为
    fireAndForget(
      this.forumMemory.recordTeamApplicationToMemory(
        userId,
        post.title,
        data.message,
      ),
      this.logger,
      'Failed to record team application to memory',
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
        // 重新开放招募 —— 但只撤销一个不再成立的 FULL。CLOSED 是发帖人
        // 主动结束招募，成员退出不构成推翻它的理由。
        ...(member.post.teamStatus === TeamStatus.FULL
          ? { teamStatus: TeamStatus.RECRUITING }
          : {}),
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
            community: true,
            images: { orderBy: { sortOrder: 'asc' } },
            author: {
              select: FORUM_AUTHOR_SELECT,
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
      category: {
        id: m.post.category.id,
        name: m.post.category.name,
        nameZh: m.post.category.nameZh,
        description: m.post.category.description || undefined,
        descriptionZh: m.post.category.descriptionZh || undefined,
        icon: m.post.category.icon || undefined,
        color: m.post.category.color || undefined,
        postCount: 0,
      },
      communityId: m.post.communityId || undefined,
      community: m.post.community
        ? {
            id: m.post.community.id,
            slug: m.post.community.slug,
            name: m.post.community.name,
            description: m.post.community.description || undefined,
            postCount: m.post.community.postCount,
            followerCount: m.post.community.followerCount,
            isOfficial: m.post.community.isOfficial,
            isFollowing: false,
            createdAt: m.post.community.createdAt,
          }
        : undefined,
      author: mapForumAuthor(m.post.author),
      title: m.post.title,
      content: m.post.content,
      tags: m.post.tags,
      images: m.post.images.map((image) => ({
        id: image.id,
        key: image.key,
        url: image.url,
        mimeType: image.mimeType,
        size: image.size,
        width: image.width || undefined,
        height: image.height || undefined,
        sortOrder: image.sortOrder,
      })),
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
