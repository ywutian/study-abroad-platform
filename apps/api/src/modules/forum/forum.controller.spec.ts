import { Test, TestingModule } from '@nestjs/testing';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('ForumController', () => {
  let controller: ForumController;
  let forumService: ForumService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  const mockCategory = {
    id: 'cat-1',
    name: 'General',
    slug: 'general',
    description: 'General discussion',
  };

  const mockPost = {
    id: 'post-1',
    title: 'Test Post',
    content: 'Test content',
    authorId: 'user-1',
    categoryId: 'cat-1',
  };

  const mockPostListResponse = {
    items: [mockPost],
    total: 1,
    page: 1,
    pageSize: 10,
  };

  const mockPostDetail = {
    ...mockPost,
    comments: [],
    likeCount: 0,
    liked: false,
  };

  const mockComment = {
    id: 'comment-1',
    content: 'Nice post',
    postId: 'post-1',
    authorId: 'user-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForumController],
      providers: [
        {
          provide: ForumService,
          useValue: {
            getStats: jest.fn().mockResolvedValue({
              postCount: 100,
              userCount: 50,
              teamingCount: 10,
              activeToday: 25,
            }),
            getCategories: jest.fn().mockResolvedValue([mockCategory]),
            createCategory: jest.fn().mockResolvedValue(mockCategory),
            getPosts: jest.fn().mockResolvedValue(mockPostListResponse),
            getPostById: jest.fn().mockResolvedValue(mockPostDetail),
            createPost: jest.fn().mockResolvedValue(mockPost),
            updatePost: jest.fn().mockResolvedValue(mockPost),
            deletePost: jest.fn().mockResolvedValue(undefined),
            likePost: jest.fn().mockResolvedValue({ liked: true }),
            createComment: jest.fn().mockResolvedValue(mockComment),
            deleteComment: jest.fn().mockResolvedValue(undefined),
            applyToTeam: jest.fn().mockResolvedValue({ applied: true }),
            reviewApplication: jest.fn().mockResolvedValue(undefined),
            cancelApplication: jest.fn().mockResolvedValue(undefined),
            leaveTeam: jest.fn().mockResolvedValue(undefined),
            getMyTeams: jest.fn().mockResolvedValue([mockPost]),
            reportPost: jest.fn().mockResolvedValue(undefined),
            reportComment: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ForumController>(ForumController);
    forumService = module.get<ForumService>(ForumService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Stats
  // ============================================

  describe('getStats', () => {
    it('should return forum statistics', async () => {
      const result = await controller.getStats();

      expect(forumService.getStats).toHaveBeenCalled();
      expect(result).toEqual({
        postCount: 100,
        userCount: 50,
        teamingCount: 10,
        activeToday: 25,
      });
    });
  });

  // ============================================
  // Categories
  // ============================================

  describe('getCategories', () => {
    it('should return all categories', async () => {
      const result = await controller.getCategories();

      expect(forumService.getCategories).toHaveBeenCalled();
      expect(result).toEqual([mockCategory]);
    });
  });

  describe('createCategory', () => {
    it('should call forumService.createCategory with dto', async () => {
      const dto = { name: 'General', slug: 'general' } as any;

      const result = await controller.createCategory(dto);

      expect(forumService.createCategory).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCategory);
    });
  });

  // ============================================
  // Posts
  // ============================================

  describe('getPosts', () => {
    it('should call forumService.getPosts with userId and query', async () => {
      const query = { page: 1, pageSize: 10, categoryId: 'cat-1' } as any;

      const result = await controller.getPosts(mockUser as any, query);

      expect(forumService.getPosts).toHaveBeenCalledWith('user-1', query);
      expect(result).toEqual(mockPostListResponse);
    });

    it('should pass null userId when user is not authenticated', async () => {
      const query = { page: 1, pageSize: 10 } as any;

      await controller.getPosts(null, query);

      expect(forumService.getPosts).toHaveBeenCalledWith(null, query);
    });
  });

  describe('getPostById', () => {
    it('should call forumService.getPostById with id and userId', async () => {
      const result = await controller.getPostById('post-1', mockUser as any);

      expect(forumService.getPostById).toHaveBeenCalledWith('post-1', 'user-1');
      expect(result).toEqual(mockPostDetail);
    });

    it('should pass null userId when user is not authenticated', async () => {
      await controller.getPostById('post-1', null);

      expect(forumService.getPostById).toHaveBeenCalledWith('post-1', null);
    });
  });

  describe('createPost', () => {
    it('should call forumService.createPost with userId and dto', async () => {
      const dto = {
        title: 'Test Post',
        content: 'Content',
        categoryId: 'cat-1',
      } as any;

      const result = await controller.createPost(mockUser as any, dto);

      expect(forumService.createPost).toHaveBeenCalledWith('user-1', dto, 'zh');
      expect(result).toEqual(mockPost);
    });
  });

  describe('updatePost', () => {
    it('should call forumService.updatePost with id, userId and dto', async () => {
      const dto = { title: 'Updated Title' } as any;

      const result = await controller.updatePost(
        'post-1',
        mockUser as any,
        dto,
      );

      expect(forumService.updatePost).toHaveBeenCalledWith(
        'post-1',
        'user-1',
        dto,
      );
      expect(result).toEqual(mockPost);
    });
  });

  describe('deletePost', () => {
    it('should call forumService.deletePost and return success', async () => {
      const result = await controller.deletePost('post-1', mockUser as any);

      expect(forumService.deletePost).toHaveBeenCalledWith('post-1', 'user-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('likePost', () => {
    it('should call forumService.likePost with id and userId', async () => {
      const result = await controller.likePost('post-1', mockUser as any);

      expect(forumService.likePost).toHaveBeenCalledWith('post-1', 'user-1');
      expect(result).toEqual({ liked: true });
    });
  });

  // ============================================
  // Comments
  // ============================================

  describe('createComment', () => {
    it('should call forumService.createComment with postId, userId and dto', async () => {
      const dto = { content: 'Nice post' } as any;

      const result = await controller.createComment(
        'post-1',
        mockUser as any,
        dto,
      );

      expect(forumService.createComment).toHaveBeenCalledWith(
        'post-1',
        'user-1',
        dto,
      );
      expect(result).toEqual(mockComment);
    });
  });

  describe('deleteComment', () => {
    it('should call forumService.deleteComment and return success', async () => {
      const result = await controller.deleteComment(
        'comment-1',
        mockUser as any,
      );

      expect(forumService.deleteComment).toHaveBeenCalledWith(
        'comment-1',
        'user-1',
      );
      expect(result).toEqual({ success: true });
    });
  });

  // ============================================
  // Team Features
  // ============================================

  describe('applyToTeam', () => {
    it('should call forumService.applyToTeam with postId, userId and dto', async () => {
      const dto = { message: 'I want to join' } as any;

      const result = await controller.applyToTeam(
        'post-1',
        mockUser as any,
        dto,
      );

      expect(forumService.applyToTeam).toHaveBeenCalledWith(
        'post-1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ applied: true });
    });
  });

  describe('reviewApplication', () => {
    it('should call forumService.reviewApplication and return success', async () => {
      const dto = { status: 'APPROVED' } as any;

      const result = await controller.reviewApplication(
        'app-1',
        mockUser as any,
        dto,
      );

      expect(forumService.reviewApplication).toHaveBeenCalledWith(
        'app-1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('cancelApplication', () => {
    it('should call forumService.cancelApplication and return success', async () => {
      const result = await controller.cancelApplication(
        'app-1',
        mockUser as any,
      );

      expect(forumService.cancelApplication).toHaveBeenCalledWith(
        'app-1',
        'user-1',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('leaveTeam', () => {
    it('should call forumService.leaveTeam and return success', async () => {
      const result = await controller.leaveTeam('post-1', mockUser as any);

      expect(forumService.leaveTeam).toHaveBeenCalledWith('post-1', 'user-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getMyTeams', () => {
    it('should call forumService.getMyTeams with userId', async () => {
      const result = await controller.getMyTeams(mockUser as any);

      expect(forumService.getMyTeams).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockPost]);
    });
  });

  // ============================================
  // Reports
  // ============================================

  describe('reportPost', () => {
    it('should call forumService.reportPost and return success', async () => {
      const dto = { reason: 'SPAM', detail: 'This is spam' } as any;

      const result = await controller.reportPost(
        'post-1',
        mockUser as any,
        dto,
      );

      expect(forumService.reportPost).toHaveBeenCalledWith(
        'user-1',
        'post-1',
        'SPAM',
        'This is spam',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('reportComment', () => {
    it('should call forumService.reportComment and return success', async () => {
      const dto = { reason: 'OFFENSIVE', detail: 'Rude comment' } as any;

      const result = await controller.reportComment(
        'comment-1',
        mockUser as any,
        dto,
      );

      expect(forumService.reportComment).toHaveBeenCalledWith(
        'user-1',
        'comment-1',
        'OFFENSIVE',
        'Rude comment',
      );
      expect(result).toEqual({ success: true });
    });
  });
});
