import { Test, TestingModule } from '@nestjs/testing';
import { ForumMemoryService } from './forum-memory.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

describe('ForumMemoryService', () => {
  let service: ForumMemoryService;

  const mockPrisma = {
    forumPost: {
      findUnique: jest.fn(),
    },
    school: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockMemoryManager = {
    remember: jest.fn().mockResolvedValue(undefined),
    recordEntity: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumMemoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MemoryManagerService, useValue: mockMemoryManager },
      ],
    }).compile();

    service = module.get<ForumMemoryService>(ForumMemoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('savePostToMemory', () => {
    it('should save regular post as PREFERENCE', async () => {
      await service.savePostToMemory('user-1', 'General', {
        categoryId: 'cat-1',
        title: 'Test Post',
        content: 'Content',
        tags: ['test'],
        isTeamPost: false,
      } as any);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'PREFERENCE' }),
      );
    });

    it('should save team post as DECISION', async () => {
      await service.savePostToMemory('user-1', 'Teams', {
        categoryId: 'cat-1',
        title: 'Team Post',
        content: 'Content',
        isTeamPost: true,
        teamSize: 5,
      } as any);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'DECISION' }),
      );
    });
  });

  describe('recordViewToMemory', () => {
    it('should record view with low importance', async () => {
      await service.recordViewToMemory('user-1', {
        id: 'post-1',
        title: 'Test',
        isTeamPost: false,
      });

      expect(mockMemoryManager.remember).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ importance: 0.2 }),
      );
    });
  });

  describe('recordLikeToMemory', () => {
    it('should record like as PREFERENCE', async () => {
      mockPrisma.forumPost.findUnique.mockResolvedValue({
        title: 'Liked Post',
        tags: ['tag1'],
        isTeamPost: false,
      });

      await service.recordLikeToMemory('user-1', 'post-1');

      expect(mockMemoryManager.remember).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'PREFERENCE' }),
      );
    });
  });

  describe('recordTeamApplicationToMemory', () => {
    it('should record team application as DECISION', async () => {
      await service.recordTeamApplicationToMemory(
        'user-1',
        'Team Post',
        'I want to join',
      );

      expect(mockMemoryManager.remember).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'DECISION' }),
      );
    });
  });
});
