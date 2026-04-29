import { Test, TestingModule } from '@nestjs/testing';
import { ForumPostService } from './forum-post.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { ForumModerationService } from './moderation.service';
import { ForumMemoryService } from './forum-memory.service';
import { NotificationService } from '../notification/notification.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PostSortBy } from './dto';

describe('ForumPostService', () => {
  let service: ForumPostService;
  let prisma: PrismaService;
  let auth: AuthorizationService;
  let moderation: ForumModerationService;

  const mockAuthor = {
    id: 'user-1',
    role: 'USER',
    profile: { realName: 'Test User', avatarUrl: null },
  };

  const mockCategory = {
    id: 'cat-1',
    name: 'General',
    nameZh: '综合',
    description: null,
    descriptionZh: null,
    icon: null,
    color: null,
    isActive: true,
  };

  const mockCommunity = {
    id: 'community-1',
    slug: 'general',
    name: 'General',
    description: null,
    postCount: 1,
    followerCount: 0,
    isOfficial: true,
    isActive: true,
    createdAt: new Date(),
    followers: [],
  };

  const mockPost = {
    id: 'post-1',
    categoryId: 'cat-1',
    communityId: 'community-1',
    authorId: 'user-1',
    title: 'Test Post',
    content: 'Test content',
    tags: ['tag1'],
    isTeamPost: false,
    teamSize: null,
    currentSize: null,
    requirements: null,
    teamDeadline: null,
    teamStatus: null,
    viewCount: 10,
    likeCount: 5,
    commentCount: 2,
    isPinned: false,
    isLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: mockCategory,
    community: mockCommunity,
    author: mockAuthor,
    images: [],
    likes: [],
    _count: { comments: 2 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumPostService,
        {
          provide: PrismaService,
          useFactory: () => {
            const prismaValue: any = {
              forumPost: {
                findMany: jest.fn().mockResolvedValue([mockPost]),
                findUnique: jest.fn().mockResolvedValue(mockPost),
                count: jest.fn().mockResolvedValue(1),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
              },
              forumCategory: {
                findUnique: jest.fn(),
              },
              forumCommunity: {
                findUnique: jest.fn(),
                update: jest.fn(),
              },
              forumCommunityFollow: {
                findMany: jest.fn().mockResolvedValue([]),
              },
              forumLike: {
                findUnique: jest.fn(),
                create: jest.fn(),
                delete: jest.fn(),
              },
              teamMember: {
                create: jest.fn(),
              },
              user: {
                findUnique: jest.fn(),
              },
              $transaction: jest.fn((ops: any[]) => Promise.resolve(ops)),
            };
            return prismaValue;
          },
        },
        {
          provide: AuthorizationService,
          useValue: {
            verifyOwnership: jest.fn(),
          },
        },
        {
          provide: ForumModerationService,
          useValue: {
            validateContent: jest.fn().mockResolvedValue(undefined),
            validateMultiple: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ForumMemoryService,
          useValue: {
            savePostToMemory: jest.fn().mockResolvedValue(undefined),
            recordViewToMemory: jest.fn().mockResolvedValue(undefined),
            recordLikeToMemory: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            createNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ForumPostService>(ForumPostService);
    prisma = module.get<PrismaService>(PrismaService);
    auth = module.get<AuthorizationService>(AuthorizationService);
    moderation = module.get<ForumModerationService>(ForumModerationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPosts', () => {
    it('should return paginated posts with default sorting', async () => {
      const result = await service.getPosts('user-1', { limit: 20, offset: 0 });

      expect(result.posts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.posts[0].title).toBe('Test Post');
    });

    it('should apply category filter when categoryId is provided', async () => {
      await service.getPosts('user-1', { categoryId: 'cat-1' });

      expect(prisma.forumPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'cat-1' }),
        }),
      );
    });

    it('should apply search filter across title, content, and tags', async () => {
      await service.getPosts('user-1', { search: 'keyword' });

      expect(prisma.forumPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'keyword', mode: 'insensitive' } },
              { content: { contains: 'keyword', mode: 'insensitive' } },
              { tags: { hasSome: ['keyword'] } },
            ]),
          }),
        }),
      );
    });

    it('should sort by likeCount when sortBy is POPULAR', async () => {
      await service.getPosts('user-1', { sortBy: PostSortBy.POPULAR });

      expect(prisma.forumPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([{ likeCount: 'desc' }]),
        }),
      );
    });

    it('should set hasMore=true when more posts exist', async () => {
      (prisma.forumPost.count as jest.Mock).mockResolvedValue(50);

      const result = await service.getPosts('user-1', {
        limit: 20,
        offset: 0,
      });

      expect(result.hasMore).toBe(true);
    });

    it('should mark isLiked=false for anonymous access', async () => {
      const result = await service.getPosts(null, { limit: 20, offset: 0 });

      expect(result.posts[0].isLiked).toBe(false);
    });
  });

  describe('getPostById', () => {
    it('should return post detail and increment view count', async () => {
      const detailPost = {
        ...mockPost,
        comments: [],
        teamMembers: [],
        teamApplications: [],
      };
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(detailPost);

      const result = await service.getPostById('post-1', 'user-1');

      expect(result.id).toBe('post-1');
      expect(result.viewCount).toBe(11); // viewCount + 1
      expect(prisma.forumPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: { viewCount: { increment: 1 } },
        }),
      );
    });

    it('should throw NotFoundException when post does not exist', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getPostById('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPost', () => {
    const createDto = {
      categoryId: 'cat-1',
      communityId: 'community-1',
      title: 'New Post',
      content: 'New content',
      tags: ['test'],
      isTeamPost: false,
    };

    it('should create a post successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'USER',
      });
      (prisma.forumCategory.findUnique as jest.Mock).mockResolvedValue(
        mockCategory,
      );
      (prisma.forumCommunity.findUnique as jest.Mock).mockResolvedValue(
        mockCommunity,
      );
      (prisma.forumPost.create as jest.Mock).mockResolvedValue({
        ...mockPost,
        ...createDto,
      });

      const result = await service.createPost('user-1', createDto);

      expect(result.title).toBe('New Post');
      expect(moderation.validateMultiple).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when unverified user creates team post', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'USER',
      });

      await expect(
        service.createPost('user-1', { ...createDto, isTeamPost: true }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for invalid/inactive category', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'VERIFIED',
      });
      (prisma.forumCategory.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createPost('user-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should add author as team owner when creating a team post', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'VERIFIED',
      });
      (prisma.forumCategory.findUnique as jest.Mock).mockResolvedValue(
        mockCategory,
      );
      (prisma.forumCommunity.findUnique as jest.Mock).mockResolvedValue(
        mockCommunity,
      );
      (prisma.forumPost.create as jest.Mock).mockResolvedValue({
        ...mockPost,
        isTeamPost: true,
      });

      await service.createPost('user-1', { ...createDto, isTeamPost: true });

      expect(prisma.teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            role: 'owner',
          }),
        }),
      );
    });
  });

  describe('updatePost', () => {
    it('should update post when user is owner', async () => {
      (auth.verifyOwnership as jest.Mock).mockReturnValue({
        ...mockPost,
        isLocked: false,
      });
      (prisma.forumPost.update as jest.Mock).mockResolvedValue({
        ...mockPost,
        title: 'Updated',
        _count: { comments: 2 },
      });

      const result = await service.updatePost('post-1', 'user-1', {
        title: 'Updated',
      });

      expect(result.title).toBe('Updated');
    });

    it('should throw ForbiddenException when post is locked', async () => {
      (auth.verifyOwnership as jest.Mock).mockReturnValue({
        ...mockPost,
        isLocked: true,
      });

      await expect(
        service.updatePost('post-1', 'user-1', { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deletePost', () => {
    it('should delete post after verifying ownership', async () => {
      (auth.verifyOwnership as jest.Mock).mockReturnValue(mockPost);

      await service.deletePost('post-1', 'user-1');

      expect(prisma.forumPost.delete).toHaveBeenCalledWith({
        where: { id: 'post-1' },
      });
    });

    it('should throw NotFoundException when post does not exist', async () => {
      (auth.verifyOwnership as jest.Mock).mockImplementation(() => {
        throw new NotFoundException('Post not found');
      });

      await expect(service.deletePost('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('likePost', () => {
    it('should like a post when not already liked', async () => {
      (prisma.forumLike.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.likePost('post-1', 'user-1');

      expect(result.liked).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should unlike a post when already liked', async () => {
      (prisma.forumLike.findUnique as jest.Mock).mockResolvedValue({
        id: 'like-1',
        postId: 'post-1',
        userId: 'user-1',
      });

      const result = await service.likePost('post-1', 'user-1');

      expect(result.liked).toBe(false);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
