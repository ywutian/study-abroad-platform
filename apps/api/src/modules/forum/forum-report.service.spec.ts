import { Test, TestingModule } from '@nestjs/testing';
import { ForumReportService } from './forum-report.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ForumReportService', () => {
  let service: ForumReportService;
  let prisma: PrismaService;

  const mockPost = {
    id: 'post-1',
    title: 'Test Post',
    content: 'Test content that is long enough to matter',
    authorId: 'author-1',
  };

  const mockComment = {
    id: 'comment-1',
    content: 'Test comment',
    authorId: 'author-1',
    postId: 'post-1',
  };

  const mockReport = {
    id: 'report-1',
    reporterId: 'user-1',
    targetType: 'POST',
    targetId: 'post-1',
    reason: 'spam',
    priority: 'LOW',
    status: 'PENDING',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumReportService,
        {
          provide: PrismaService,
          useValue: {
            forumPost: {
              findUnique: jest.fn(),
            },
            forumComment: {
              findUnique: jest.fn(),
            },
            report: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ForumReportService>(ForumReportService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reportPost', () => {
    it('should create a post report successfully', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.report.create as jest.Mock).mockResolvedValue(mockReport);

      const result = await service.reportPost('user-1', 'post-1', 'spam');

      expect(result.id).toBe('report-1');
      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reporterId: 'user-1',
            targetType: 'POST',
            targetId: 'post-1',
            reason: 'spam',
            priority: 'LOW',
          }),
        }),
      );
    });

    it('should include post context in the report', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.report.create as jest.Mock).mockResolvedValue(mockReport);

      await service.reportPost('user-1', 'post-1', 'spam', 'extra detail');

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            detail: 'extra detail',
            context: expect.objectContaining({
              postTitle: 'Test Post',
              authorId: 'author-1',
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException when post does not exist', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.reportPost('user-1', 'nonexistent', 'spam'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when reporting own post', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);

      await expect(
        service.reportPost('author-1', 'post-1', 'spam'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate report', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prisma.report.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-report',
      });

      await expect(
        service.reportPost('user-1', 'post-1', 'spam'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should truncate long post content in context to 500 chars', async () => {
      const longContent = 'A'.repeat(1000);
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
        ...mockPost,
        content: longContent,
      });
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.report.create as jest.Mock).mockResolvedValue(mockReport);

      await service.reportPost('user-1', 'post-1', 'spam');

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: expect.objectContaining({
              postContent: 'A'.repeat(500),
            }),
          }),
        }),
      );
    });
  });

  describe('reportComment', () => {
    it('should create a comment report successfully', async () => {
      (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue(
        mockComment,
      );
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.report.create as jest.Mock).mockResolvedValue({
        ...mockReport,
        targetType: 'COMMENT',
        targetId: 'comment-1',
      });

      const result = await service.reportComment(
        'user-1',
        'comment-1',
        'harassment',
      );

      expect(result.targetType).toBe('COMMENT');
      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetType: 'COMMENT',
            targetId: 'comment-1',
            context: expect.objectContaining({
              commentContent: 'Test comment',
              postId: 'post-1',
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.reportComment('user-1', 'nonexistent', 'spam'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when reporting own comment', async () => {
      (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue(
        mockComment,
      );

      await expect(
        service.reportComment('author-1', 'comment-1', 'spam'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate comment report', async () => {
      (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue(
        mockComment,
      );
      (prisma.report.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.reportComment('user-1', 'comment-1', 'spam'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include optional detail in the report', async () => {
      (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue(
        mockComment,
      );
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.report.create as jest.Mock).mockResolvedValue(mockReport);

      await service.reportComment(
        'user-1',
        'comment-1',
        'harassment',
        'Additional context about the issue',
      );

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            detail: 'Additional context about the issue',
          }),
        }),
      );
    });
  });
});
