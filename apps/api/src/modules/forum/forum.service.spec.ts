import { Test, TestingModule } from '@nestjs/testing';
import { ForumService } from './forum.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { ForumModerationService } from './moderation.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

// 本地定义团队状态（Prisma schema 中未定义）
enum TeamStatus {
  RECRUITING = 'RECRUITING',
  FULL = 'FULL',
  CLOSED = 'CLOSED',
}

enum TeamAppStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

describe('ForumService', () => {
  let service: ForumService;
  let prismaService: PrismaService;
  let authService: AuthorizationService;

  const mockUserId = 'user-123';
  const mockPostId = 'post-123';
  const mockCommentId = 'comment-123';

  const mockCategory = {
    id: 'category-1',
    name: 'General',
    nameZh: '综合讨论',
    description: 'General discussion',
    descriptionZh: '综合讨论区',
    icon: '💬',
    color: '#3B82F6',
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
  };

  const mockAuthor = {
    id: mockUserId,
    role: Role.USER,
    profile: { realName: 'Test User' },
  };

  const mockPost = {
    id: mockPostId,
    categoryId: mockCategory.id,
    authorId: mockUserId,
    title: 'Test Post',
    content: 'Test content',
    tags: ['test'],
    isTeamPost: false,
    teamSize: null,
    currentSize: null,
    requirements: null,
    teamDeadline: null,
    teamStatus: TeamStatus.RECRUITING,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    isPinned: false,
    isLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: mockCategory,
    author: mockAuthor,
  };

  const mockComment = {
    id: mockCommentId,
    postId: mockPostId,
    authorId: mockUserId,
    content: 'Test comment',
    parentId: null,
    likeCount: 0,
    createdAt: new Date(),
    author: mockAuthor,
    replies: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue({ role: 'USER' }),
            },
            forumCategory: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn(),
            },
            forumPost: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            forumComment: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
            forumLike: {
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
            teamMember: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            teamApplication: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn((ops) => Promise.all(ops)),
          },
        },
        {
          provide: AuthorizationService,
          useValue: {
            verifyOwnership: jest
              .fn()
              .mockImplementation((entity, userId, options) => {
                if (!entity) {
                  throw new NotFoundException(
                    `${options?.entityName || 'Resource'} not found`,
                  );
                }
                const ownerField = options?.ownerField || 'userId';
                const actualOwnerId = entity[ownerField];
                if (actualOwnerId !== userId) {
                  throw new ForbiddenException(
                    `You don't have access to this ${options?.entityName || 'Resource'}`,
                  );
                }
                return entity;
              }),
          },
        },
        {
          provide: ForumModerationService,
          useValue: {
            moderateContent: jest.fn().mockResolvedValue({ approved: true }),
            validateContent: jest.fn().mockResolvedValue(undefined),
            validateMultiple: jest.fn().mockResolvedValue(undefined),
            checkSpam: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: MemoryManagerService,
          useValue: {
            remember: jest.fn().mockResolvedValue(undefined),
            recall: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<ForumService>(ForumService);
    prismaService = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthorizationService>(AuthorizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Categories Tests
  // ============================================

  describe('getCategories', () => {
    it('should return all active categories', async () => {
      const mockCategories = [{ ...mockCategory, _count: { posts: 10 } }];
      (prismaService.forumCategory.findMany as jest.Mock).mockResolvedValue(
        mockCategories,
      );

      const result = await service.getCategories();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('General');
      expect(result[0].postCount).toBe(10);
    });
  });

  describe('createCategory', () => {
    it('should create a new category', async () => {
      (prismaService.forumCategory.create as jest.Mock).mockResolvedValue(
        mockCategory,
      );

      const result = await service.createCategory({
        name: 'General',
        nameZh: '综合讨论',
      });

      expect(result.name).toBe('General');
      expect(prismaService.forumCategory.create).toHaveBeenCalled();
    });
  });

  // ============================================
  // Posts Tests
  // ============================================

  describe('getPosts', () => {
    it('should return paginated posts', async () => {
      const mockPosts = [{ ...mockPost, _count: { comments: 5 }, likes: [] }];
      (prismaService.forumPost.findMany as jest.Mock).mockResolvedValue(
        mockPosts,
      );
      (prismaService.forumPost.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPosts(mockUserId, {
        limit: 20,
        offset: 0,
      });

      expect(result.posts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by category', async () => {
      (prismaService.forumPost.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.forumPost.count as jest.Mock).mockResolvedValue(0);

      await service.getPosts(null, {
        categoryId: 'category-1',
        limit: 20,
        offset: 0,
      });

      expect(prismaService.forumPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'category-1' }),
        }),
      );
    });

    it('should filter by team posts', async () => {
      (prismaService.forumPost.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.forumPost.count as jest.Mock).mockResolvedValue(0);

      await service.getPosts(null, { isTeamPost: true, limit: 20, offset: 0 });

      expect(prismaService.forumPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isTeamPost: true }),
        }),
      );
    });
  });

  describe('getPostById', () => {
    it('should return post with details and increment view count', async () => {
      const fullPost = {
        ...mockPost,
        likes: [],
        comments: [],
        teamMembers: [],
        teamApplications: [],
      };
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(
        fullPost,
      );
      (prismaService.forumPost.update as jest.Mock).mockResolvedValue(fullPost);

      const result = await service.getPostById(mockPostId, mockUserId);

      expect(result.id).toBe(mockPostId);
      expect(result.viewCount).toBe(1); // incremented
      expect(prismaService.forumPost.update).toHaveBeenCalledWith({
        where: { id: mockPostId },
        data: { viewCount: { increment: 1 } },
      });
    });

    it('should throw NotFoundException if post not found', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getPostById('nonexistent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPost', () => {
    it('should create a regular post', async () => {
      (prismaService.forumCategory.findUnique as jest.Mock).mockResolvedValue(
        mockCategory,
      );
      (prismaService.forumPost.create as jest.Mock).mockResolvedValue({
        ...mockPost,
        author: mockAuthor,
        category: mockCategory,
      });

      const result = await service.createPost(mockUserId, {
        categoryId: mockCategory.id,
        title: 'Test Post',
        content: 'Test content',
      });

      expect(result.title).toBe('Test Post');
      expect(prismaService.teamMember.create).not.toHaveBeenCalled();
    });

    it('should create team post and add owner as member', async () => {
      // Team posts require verified user
      (prismaService.user.findUnique as jest.Mock).mockResolvedValueOnce({
        role: Role.VERIFIED,
      });
      (prismaService.forumCategory.findUnique as jest.Mock).mockResolvedValue(
        mockCategory,
      );
      (prismaService.forumPost.create as jest.Mock).mockResolvedValue({
        ...mockPost,
        isTeamPost: true,
        teamSize: 4,
        author: mockAuthor,
        category: mockCategory,
      });
      (prismaService.teamMember.create as jest.Mock).mockResolvedValue({});

      const result = await service.createPost(mockUserId, {
        categoryId: mockCategory.id,
        title: 'Team Post',
        content: 'Looking for teammates',
        isTeamPost: true,
        teamSize: 4,
      });

      expect(result.isTeamPost).toBe(true);
      expect(prismaService.teamMember.create).toHaveBeenCalledWith({
        data: {
          postId: mockPostId,
          userId: mockUserId,
          role: 'owner',
        },
      });
    });

    it('should throw BadRequestException for invalid category', async () => {
      (prismaService.forumCategory.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.createPost(mockUserId, {
          categoryId: 'invalid',
          title: 'Test',
          content: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePost', () => {
    it('should update post if owner', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(
        mockPost,
      );
      (authService.verifyOwnership as jest.Mock).mockReturnValue(mockPost);
      (prismaService.forumPost.update as jest.Mock).mockResolvedValue({
        ...mockPost,
        title: 'Updated Title',
        _count: { comments: 0 },
      });

      const result = await service.updatePost(mockPostId, mockUserId, {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw ForbiddenException if post is locked', async () => {
      const lockedPost = { ...mockPost, isLocked: true };
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(
        lockedPost,
      );
      (authService.verifyOwnership as jest.Mock).mockReturnValue(lockedPost);

      await expect(
        service.updatePost(mockPostId, mockUserId, { title: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deletePost', () => {
    it('should delete post if owner', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(
        mockPost,
      );
      (authService.verifyOwnership as jest.Mock).mockReturnValue(mockPost);
      (prismaService.forumPost.delete as jest.Mock).mockResolvedValue(mockPost);

      await service.deletePost(mockPostId, mockUserId);

      expect(prismaService.forumPost.delete).toHaveBeenCalledWith({
        where: { id: mockPostId },
      });
    });
  });

  describe('likePost', () => {
    it('should like post if not already liked', async () => {
      (prismaService.forumLike.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.likePost(mockPostId, mockUserId);

      expect(result.liked).toBe(true);
    });

    it('should unlike post if already liked', async () => {
      (prismaService.forumLike.findUnique as jest.Mock).mockResolvedValue({
        id: 'like-1',
        postId: mockPostId,
        userId: mockUserId,
      });

      const result = await service.likePost(mockPostId, mockUserId);

      expect(result.liked).toBe(false);
    });
  });

  // ============================================
  // Comments Tests
  // ============================================

  describe('createComment', () => {
    it('should create a comment', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(
        mockPost,
      );
      (prismaService.forumComment.create as jest.Mock).mockResolvedValue(
        mockComment,
      );
      (prismaService.forumPost.update as jest.Mock).mockResolvedValue(mockPost);

      const result = await service.createComment(mockPostId, mockUserId, {
        content: 'Test comment',
      });

      expect(result.content).toBe('Test comment');
    });

    it('should throw NotFoundException if post not found', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createComment('nonexistent', mockUserId, { content: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if post is locked', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue({
        ...mockPost,
        isLocked: true,
      });

      await expect(
        service.createComment(mockPostId, mockUserId, { content: 'Test' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should validate parent comment exists for replies', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(
        mockPost,
      );
      (prismaService.forumComment.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.createComment(mockPostId, mockUserId, {
          content: 'Reply',
          parentId: 'invalid-parent',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteComment', () => {
    it('should delete comment and update post count', async () => {
      (prismaService.forumComment.findUnique as jest.Mock).mockResolvedValue(
        mockComment,
      );
      (authService.verifyOwnership as jest.Mock).mockReturnValue(mockComment);
      (prismaService.forumComment.findMany as jest.Mock).mockResolvedValue([]);

      await service.deleteComment(mockCommentId, mockUserId);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================
  // Team Application Tests
  // ============================================

  describe('applyToTeam', () => {
    const teamPost = {
      ...mockPost,
      isTeamPost: true,
      teamSize: 4,
      teamStatus: TeamStatus.RECRUITING,
      teamMembers: [],
    };

    it('should create team application', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(
        teamPost,
      );
      (prismaService.teamApplication.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prismaService.teamApplication.create as jest.Mock).mockResolvedValue({});

      const result = await service.applyToTeam(mockPostId, 'other-user', {
        message: 'I want to join',
      });

      expect(result.applied).toBe(true);
    });

    it('should throw if not a team post', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(
        mockPost,
      );

      await expect(
        service.applyToTeam(mockPostId, 'other-user', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if applying to own team', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue(
        teamPost,
      );

      await expect(
        service.applyToTeam(mockPostId, mockUserId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if team is not recruiting', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue({
        ...teamPost,
        teamStatus: TeamStatus.FULL,
      });

      await expect(
        service.applyToTeam(mockPostId, 'other-user', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if already a member', async () => {
      (prismaService.forumPost.findUnique as jest.Mock).mockResolvedValue({
        ...teamPost,
        teamMembers: [{ userId: 'other-user' }],
      });

      await expect(
        service.applyToTeam(mockPostId, 'other-user', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reviewApplication', () => {
    const mockApplication = {
      id: 'app-1',
      postId: mockPostId,
      applicantId: 'applicant-1',
      status: TeamAppStatus.PENDING,
      post: { ...mockPost, authorId: mockUserId, teamSize: 4 },
    };

    it('should accept application and add member', async () => {
      (prismaService.teamApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication,
      );
      (prismaService.teamApplication.update as jest.Mock).mockResolvedValue({});
      (prismaService.teamMember.create as jest.Mock).mockResolvedValue({});
      (prismaService.teamMember.count as jest.Mock).mockResolvedValue(2);
      (prismaService.forumPost.update as jest.Mock).mockResolvedValue({});

      await service.reviewApplication('app-1', mockUserId, {
        status: 'ACCEPTED',
      });

      expect(prismaService.teamMember.create).toHaveBeenCalled();
      expect(prismaService.forumPost.update).toHaveBeenCalled();
    });

    it('should reject application', async () => {
      (prismaService.teamApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication,
      );
      (prismaService.teamApplication.update as jest.Mock).mockResolvedValue({});

      await service.reviewApplication('app-1', mockUserId, {
        status: 'REJECTED',
      });

      expect(prismaService.teamMember.create).not.toHaveBeenCalled();
    });

    it('should throw if not team owner', async () => {
      (prismaService.teamApplication.findUnique as jest.Mock).mockResolvedValue(
        {
          ...mockApplication,
          post: { authorId: 'other-user' },
        },
      );

      await expect(
        service.reviewApplication('app-1', mockUserId, { status: 'ACCEPTED' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('leaveTeam', () => {
    it('should allow member to leave', async () => {
      (prismaService.teamMember.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-1',
        role: 'member',
        post: mockPost,
      });
      (prismaService.teamMember.delete as jest.Mock).mockResolvedValue({});
      (prismaService.teamMember.count as jest.Mock).mockResolvedValue(1);
      (prismaService.forumPost.update as jest.Mock).mockResolvedValue({});

      await service.leaveTeam(mockPostId, 'member-user');

      expect(prismaService.teamMember.delete).toHaveBeenCalled();
    });

    it('should throw if not a member', async () => {
      (prismaService.teamMember.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.leaveTeam(mockPostId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if owner tries to leave', async () => {
      (prismaService.teamMember.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-1',
        role: 'owner',
        post: mockPost,
      });

      await expect(service.leaveTeam(mockPostId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
