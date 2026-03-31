import { Test, TestingModule } from '@nestjs/testing';
import { ForumCommentService } from './forum-comment.service';
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

describe('ForumCommentService', () => {
  let service: ForumCommentService;
  let prisma: PrismaService;
  let auth: AuthorizationService;

  const mockAuthor = {
    id: 'user-1',
    role: 'USER',
    profile: { realName: 'Test User', avatarUrl: null },
  };

  const mockPost = {
    id: 'post-1',
    authorId: 'user-2',
    isLocked: false,
  };

  const mockComment = {
    id: 'comment-1',
    postId: 'post-1',
    authorId: 'user-1',
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
        ForumCommentService,
        {
          provide: PrismaService,
          useFactory: () => {
            const prismaValue: any = {
              forumPost: {
                findUnique: jest.fn(),
                update: jest.fn(),
              },
              forumComment: {
                findUnique: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                create: jest.fn(),
                delete: jest.fn(),
                deleteMany: jest.fn(),
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
          },
        },
        {
          provide: ForumMemoryService,
          useValue: {
            recordCommentToMemory: jest.fn().mockResolvedValue(undefined),
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

    service = module.get<ForumCommentService>(ForumCommentService);
    prisma = module.get<PrismaService>(PrismaService);
    auth = module.get<AuthorizationService>(AuthorizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createComment', () => {
    it('should create a top-level comment successfully', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prisma.forumComment.create as jest.Mock).mockResolvedValue(mockComment);

      const result = await service.createComment('post-1', 'user-1', {
        content: 'Test comment',
      });

      expect(result.id).toBe('comment-1');
      expect(result.content).toBe('Test comment');
      expect(prisma.forumPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: { commentCount: { increment: 1 } },
        }),
      );
    });

    it('should throw NotFoundException when post does not exist', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createComment('nonexistent', 'user-1', {
          content: 'comment',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when post is locked', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
        ...mockPost,
        isLocked: true,
      });

      await expect(
        service.createComment('post-1', 'user-1', {
          content: 'comment',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a reply when valid parentId is provided', async () => {
      const parentComment = {
        id: 'parent-1',
        postId: 'post-1',
      };
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue(
        parentComment,
      );
      (prisma.forumComment.create as jest.Mock).mockResolvedValue({
        ...mockComment,
        parentId: 'parent-1',
      });

      const result = await service.createComment('post-1', 'user-1', {
        content: 'Reply',
        parentId: 'parent-1',
      });

      expect(result.parentId).toBe('parent-1');
    });

    it('should throw BadRequestException for invalid parent comment', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createComment('post-1', 'user-1', {
          content: 'Reply',
          parentId: 'invalid-parent',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when parent belongs to a different post', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({
        id: 'parent-1',
        postId: 'other-post',
      });

      await expect(
        service.createComment('post-1', 'user-1', {
          content: 'Reply',
          parentId: 'parent-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteComment', () => {
    it('should delete comment and update post comment count', async () => {
      (auth.verifyOwnership as jest.Mock).mockReturnValue({
        ...mockComment,
        postId: 'post-1',
      });

      await service.deleteComment('comment-1', 'user-1');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      (auth.verifyOwnership as jest.Mock).mockImplementation(() => {
        throw new NotFoundException('Comment not found');
      });

      await expect(
        service.deleteComment('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('countAllReplies', () => {
    it('should return 0 when comment has no replies', async () => {
      (prisma.forumComment.findMany as jest.Mock).mockResolvedValue([]);

      const count = await service.countAllReplies('comment-1');

      expect(count).toBe(0);
    });

    it('should recursively count nested replies', async () => {
      (prisma.forumComment.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: 'reply-1' }, { id: 'reply-2' }]) // direct replies
        .mockResolvedValueOnce([{ id: 'nested-1' }]) // reply-1's replies
        .mockResolvedValueOnce([]); // reply-2's replies (none)
      // nested-1's replies (none) - called for nested-1
      (prisma.forumComment.findMany as jest.Mock).mockResolvedValueOnce([]);

      const count = await service.countAllReplies('comment-1');

      expect(count).toBe(3); // 2 direct + 1 nested
    });
  });
});
