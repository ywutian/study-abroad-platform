import { Test, TestingModule } from '@nestjs/testing';
import { HallListService } from './hall-list.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { PointsService } from '../points/incentive.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('HallListService', () => {
  let service: HallListService;

  const mockPrisma = {
    userList: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    userListVote: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const mockMemoryManager = {
    remember: jest.fn().mockResolvedValue(undefined),
  };

  const mockPointsService = {
    adjustPoints: jest.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HallListService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MemoryManagerService, useValue: mockMemoryManager },
        { provide: PointsService, useValue: mockPointsService },
      ],
    }).compile();

    service = module.get<HallListService>(HallListService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // createList
  // ============================================

  describe('createList', () => {
    it('should create a new list with default isPublic=true', async () => {
      const created = {
        id: 'list-1',
        userId: 'user-1',
        title: 'Top Schools',
        isPublic: true,
      };
      mockPrisma.userList.create.mockResolvedValue(created);

      const result = await service.createList('user-1', {
        title: 'Top Schools',
        items: [{ name: 'Harvard' }],
      });

      expect(result).toEqual(created);
      expect(mockPrisma.userList.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          title: 'Top Schools',
          isPublic: true,
        }),
      });
    });

    it('should respect explicit isPublic=false', async () => {
      mockPrisma.userList.create.mockResolvedValue({ id: 'list-2' });

      await service.createList('user-1', {
        title: 'Private List',
        items: [],
        isPublic: false,
      });

      expect(mockPrisma.userList.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isPublic: false,
        }),
      });
    });

    it('should include category and description when provided', async () => {
      mockPrisma.userList.create.mockResolvedValue({ id: 'list-3' });

      await service.createList('user-1', {
        title: 'CS Schools',
        description: 'Best CS programs',
        category: 'schools',
        items: [],
      });

      expect(mockPrisma.userList.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Best CS programs',
          category: 'schools',
        }),
      });
    });
  });

  // ============================================
  // updateList
  // ============================================

  describe('updateList', () => {
    it('should update list when owned by user', async () => {
      const existing = { id: 'list-1', userId: 'user-1' };
      const updated = { ...existing, title: 'Updated Title' };

      mockPrisma.userList.findUnique.mockResolvedValue(existing);
      mockPrisma.userList.update.mockResolvedValue(updated);

      const result = await service.updateList('list-1', 'user-1', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundException if list not found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(
        service.updateList('nonexistent', 'user-1', { title: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if not owned by user', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'other-user',
      });

      await expect(
        service.updateList('list-1', 'user-1', { title: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // deleteList
  // ============================================

  describe('deleteList', () => {
    it('should delete list when owned by user', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'user-1',
      });
      mockPrisma.userList.delete.mockResolvedValue({});

      await service.deleteList('list-1', 'user-1');

      expect(mockPrisma.userList.delete).toHaveBeenCalledWith({
        where: { id: 'list-1' },
      });
    });

    it('should throw NotFoundException if list not found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(service.deleteList('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if not owned by user', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'other-user',
      });

      await expect(service.deleteList('list-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================
  // getPublicLists
  // ============================================

  describe('getPublicLists', () => {
    it('should return paginated public lists', async () => {
      const lists = [{ id: 'list-1', title: 'Top Schools', isPublic: true }];
      mockPrisma.userList.findMany.mockResolvedValue(lists);
      mockPrisma.userList.count.mockResolvedValue(1);

      const result = await service.getPublicLists({ page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by category when provided', async () => {
      mockPrisma.userList.findMany.mockResolvedValue([]);
      mockPrisma.userList.count.mockResolvedValue(0);

      await service.getPublicLists({ page: 1, pageSize: 20 }, 'schools');

      expect(mockPrisma.userList.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublic: true, category: 'schools' },
        }),
      );
    });
  });

  // ============================================
  // getMyLists
  // ============================================

  describe('getMyLists', () => {
    it('should return user own lists', async () => {
      const lists = [{ id: 'list-1', userId: 'user-1', title: 'My List' }];
      mockPrisma.userList.findMany.mockResolvedValue(lists);

      const result = await service.getMyLists('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.userList.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        }),
      );
    });
  });

  // ============================================
  // getListById
  // ============================================

  describe('getListById', () => {
    it('should return list by id', async () => {
      const list = { id: 'list-1', title: 'Test List' };
      mockPrisma.userList.findUnique.mockResolvedValue(list);

      const result = await service.getListById('list-1');

      expect(result).toEqual(list);
    });

    it('should throw NotFoundException if list not found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(service.getListById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================
  // voteList
  // ============================================

  describe('voteList', () => {
    it('should throw NotFoundException if list not found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(
        service.voteList('nonexistent', 'user-1', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if list is not public', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'other-user',
        isPublic: false,
      });

      await expect(service.voteList('list-1', 'user-1', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when voting on own list', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'user-1',
        isPublic: true,
      });

      await expect(service.voteList('list-1', 'user-1', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should upsert vote successfully', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue({
        id: 'list-1',
        userId: 'other-user',
        isPublic: true,
        title: 'Some List',
        category: 'schools',
      });
      const vote = {
        id: 'vote-1',
        listId: 'list-1',
        userId: 'user-1',
        value: 1,
      };
      mockPrisma.userListVote.upsert.mockResolvedValue(vote);

      const result = await service.voteList('list-1', 'user-1', 1);

      expect(result).toEqual(vote);
      expect(mockPrisma.userListVote.upsert).toHaveBeenCalledWith({
        where: { listId_userId: { listId: 'list-1', userId: 'user-1' } },
        update: { value: 1 },
        create: { listId: 'list-1', userId: 'user-1', value: 1 },
      });
    });
  });

  // ============================================
  // removeVote
  // ============================================

  describe('removeVote', () => {
    it('should delete vote for given list and user', async () => {
      mockPrisma.userListVote.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeVote('list-1', 'user-1');

      expect(mockPrisma.userListVote.deleteMany).toHaveBeenCalledWith({
        where: { listId: 'list-1', userId: 'user-1' },
      });
    });
  });

  // ============================================
  // getListVoteCount
  // ============================================

  describe('getListVoteCount', () => {
    it('should return aggregated vote sum', async () => {
      mockPrisma.userListVote.aggregate.mockResolvedValue({
        _sum: { value: 42 },
      });

      const result = await service.getListVoteCount('list-1');

      expect(result).toBe(42);
    });

    it('should return 0 when no votes', async () => {
      mockPrisma.userListVote.aggregate.mockResolvedValue({
        _sum: { value: null },
      });

      const result = await service.getListVoteCount('list-1');

      expect(result).toBe(0);
    });
  });
});
