import { Test, TestingModule } from '@nestjs/testing';
import { ForumCategoryService } from './forum-category.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('ForumCategoryService', () => {
  let service: ForumCategoryService;
  let prisma: PrismaService;

  const mockCategory = {
    id: 'cat-1',
    name: 'General',
    nameZh: '综合',
    description: 'General discussions',
    descriptionZh: '综合讨论',
    icon: 'chat',
    color: 'blue',
    isActive: true,
    sortOrder: 0,
    _count: { posts: 15 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumCategoryService,
        {
          provide: PrismaService,
          useValue: {
            forumPost: {
              count: jest.fn(),
              groupBy: jest.fn().mockResolvedValue([]),
              findMany: jest.fn().mockResolvedValue([]),
            },
            forumComment: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            forumCategory: {
              findMany: jest.fn().mockResolvedValue([mockCategory]),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ForumCategoryService>(ForumCategoryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return forum statistics', async () => {
      (prisma.forumPost.count as jest.Mock)
        .mockResolvedValueOnce(100) // postCount
        .mockResolvedValueOnce(5); // teamingCount
      (prisma.forumPost.groupBy as jest.Mock).mockResolvedValue(
        Array.from({ length: 25 }, (_, i) => ({ authorId: `user-${i}` })),
      );

      const result = await service.getStats();

      expect(result.postCount).toBe(100);
      expect(result.userCount).toBe(25);
      expect(result.teamingCount).toBe(5);
      expect(typeof result.activeToday).toBe('number');
    });

    it('should count unique daily active users from posts and comments', async () => {
      (prisma.forumPost.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2);
      (prisma.forumPost.groupBy as jest.Mock).mockResolvedValue([]);
      // Today's active users
      (prisma.forumPost.findMany as jest.Mock).mockResolvedValue([
        { authorId: 'user-1' },
        { authorId: 'user-2' },
      ]);
      (prisma.forumComment.findMany as jest.Mock).mockResolvedValue([
        { authorId: 'user-2' }, // duplicate, should be deduplicated
        { authorId: 'user-3' },
      ]);

      const result = await service.getStats();

      expect(result.activeToday).toBe(3); // user-1, user-2, user-3 (deduplicated)
    });
  });

  describe('getCategories', () => {
    it('should return active categories with post counts', async () => {
      const result = await service.getCategories();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cat-1');
      expect(result[0].name).toBe('General');
      expect(result[0].postCount).toBe(15);
      expect(prisma.forumCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        }),
      );
    });

    it('should convert null optional fields to undefined', async () => {
      (prisma.forumCategory.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cat-2',
          name: 'Test',
          nameZh: '测试',
          description: null,
          descriptionZh: null,
          icon: null,
          color: null,
          _count: { posts: 0 },
        },
      ]);

      const result = await service.getCategories();

      expect(result[0].description).toBeUndefined();
      expect(result[0].icon).toBeUndefined();
      expect(result[0].color).toBeUndefined();
    });

    it('should return empty array when no active categories exist', async () => {
      (prisma.forumCategory.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getCategories();

      expect(result).toEqual([]);
    });
  });

  describe('createCategory', () => {
    it('should create a category successfully', async () => {
      (prisma.forumCategory.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.forumCategory.create as jest.Mock).mockResolvedValue({
        id: 'cat-new',
        name: 'New Category',
        nameZh: '新分类',
        description: null,
        descriptionZh: null,
        icon: null,
        color: null,
        sortOrder: 0,
      });

      const result = await service.createCategory({
        name: 'New Category',
        nameZh: '新分类',
      });

      expect(result.id).toBe('cat-new');
      expect(result.name).toBe('New Category');
      expect(result.postCount).toBe(0);
    });

    it('should throw BadRequestException when name already exists', async () => {
      (prisma.forumCategory.findFirst as jest.Mock).mockResolvedValue(
        mockCategory,
      );

      await expect(
        service.createCategory({
          name: 'General',
          nameZh: '新名称',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when nameZh already exists', async () => {
      (prisma.forumCategory.findFirst as jest.Mock).mockResolvedValue(
        mockCategory,
      );

      await expect(
        service.createCategory({
          name: 'New Name',
          nameZh: '综合',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set sortOrder to 0 by default', async () => {
      (prisma.forumCategory.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.forumCategory.create as jest.Mock).mockResolvedValue({
        id: 'cat-new',
        name: 'Test',
        nameZh: '测试',
        description: null,
        descriptionZh: null,
        icon: null,
        color: null,
        sortOrder: 0,
      });

      await service.createCategory({
        name: 'Test',
        nameZh: '测试',
      });

      expect(prisma.forumCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sortOrder: 0 }),
        }),
      );
    });

    it('should use provided sortOrder when specified', async () => {
      (prisma.forumCategory.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.forumCategory.create as jest.Mock).mockResolvedValue({
        id: 'cat-new',
        name: 'Test',
        nameZh: '测试',
        description: null,
        descriptionZh: null,
        icon: null,
        color: null,
        sortOrder: 5,
      });

      await service.createCategory({
        name: 'Test',
        nameZh: '测试',
        sortOrder: 5,
      });

      expect(prisma.forumCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sortOrder: 5 }),
        }),
      );
    });
  });
});
