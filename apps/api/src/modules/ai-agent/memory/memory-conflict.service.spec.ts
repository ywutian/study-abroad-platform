/**
 * MemoryConflictService 单元测试
 *
 * 覆盖 resolveConflictById 的 3 种 action 及异常路径
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MemoryConflictService } from './memory-conflict.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { PersistentMemoryService } from './persistent-memory.service';
import { MemoryType } from '@prisma/client';

type MockPrismaMemory = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
};

describe('MemoryConflictService', () => {
  let service: MemoryConflictService;
  let mockPrisma: { memory: MockPrismaMemory };
  let mockPersistent: jest.Mocked<
    Pick<PersistentMemoryService, 'updateMemory'>
  >;

  const baseMemory = {
    id: 'mem-1',
    userId: 'user-1',
    type: MemoryType.FACT,
    content: 'GPA 3.9',
    importance: 0.8,
    accessCount: 1,
    metadata: {
      pendingConflict: true,
      conflictWith: 'mem-old',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = {
      memory: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(baseMemory),
        delete: jest.fn().mockResolvedValue(baseMemory),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockPersistent = {
      updateMemory: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryConflictService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: EmbeddingService,
          useValue: {
            embed: jest.fn(),
            cosineSimilarity: jest.fn(),
          },
        },
        {
          provide: PersistentMemoryService,
          useValue: mockPersistent,
        },
      ],
    }).compile();

    service = module.get<MemoryConflictService>(MemoryConflictService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveConflictById', () => {
    describe('keep_new', () => {
      it('should clear pending flags and delete conflictWith memory', async () => {
        mockPrisma.memory.findUnique.mockResolvedValue(baseMemory);

        const result = await service.resolveConflictById('mem-1', 'keep_new');

        expect(result).toEqual({ resolved: true });
        // Should update metadata without pendingConflict/conflictWith
        expect(mockPrisma.memory.update).toHaveBeenCalledWith({
          where: { id: 'mem-1' },
          data: {
            metadata: expect.objectContaining({
              resolvedAt: expect.any(String),
            }),
          },
        });
        // Updated metadata should not contain pendingConflict
        const updateCall = mockPrisma.memory.update.mock.calls[0][0];
        expect(updateCall.data.metadata).not.toHaveProperty('pendingConflict');
        expect(updateCall.data.metadata).not.toHaveProperty('conflictWith');
        // Should delete the conflicting memory
        expect(mockPrisma.memory.deleteMany).toHaveBeenCalledWith({
          where: { id: 'mem-old' },
        });
      });

      it('should skip deleteMany when no conflictWith', async () => {
        mockPrisma.memory.findUnique.mockResolvedValue({
          ...baseMemory,
          metadata: { pendingConflict: true },
        });

        await service.resolveConflictById('mem-1', 'keep_new');

        expect(mockPrisma.memory.update).toHaveBeenCalled();
        expect(mockPrisma.memory.deleteMany).not.toHaveBeenCalled();
      });
    });

    describe('keep_existing', () => {
      it('should delete the pending memory', async () => {
        mockPrisma.memory.findUnique.mockResolvedValue(baseMemory);

        const result = await service.resolveConflictById(
          'mem-1',
          'keep_existing',
        );

        expect(result).toEqual({ resolved: true });
        expect(mockPrisma.memory.delete).toHaveBeenCalledWith({
          where: { id: 'mem-1' },
        });
      });
    });

    describe('merge', () => {
      it('should use persistent.updateMemory and delete conflictWith', async () => {
        mockPrisma.memory.findUnique.mockResolvedValue(baseMemory);

        const result = await service.resolveConflictById(
          'mem-1',
          'merge',
          'GPA 3.9 (updated)',
        );

        expect(result).toEqual({ resolved: true });
        // Must go through persistent.updateMemory for embedding re-computation
        expect(mockPersistent.updateMemory).toHaveBeenCalledWith('mem-1', {
          content: 'GPA 3.9 (updated)',
          metadata: expect.objectContaining({
            mergedAt: expect.any(String),
          }),
        });
        // Updated metadata should not contain pendingConflict
        const updateCall = mockPersistent.updateMemory.mock.calls[0];
        expect(updateCall[1].metadata).not.toHaveProperty('pendingConflict');
        expect(updateCall[1].metadata).not.toHaveProperty('conflictWith');
        // Should delete the conflicting memory
        expect(mockPrisma.memory.deleteMany).toHaveBeenCalledWith({
          where: { id: 'mem-old' },
        });
      });

      it('should throw BadRequestException when mergedContent is missing', async () => {
        mockPrisma.memory.findUnique.mockResolvedValue(baseMemory);

        await expect(
          service.resolveConflictById('mem-1', 'merge'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('error cases', () => {
      it('should throw NotFoundException when memory does not exist', async () => {
        mockPrisma.memory.findUnique.mockResolvedValue(null);

        await expect(
          service.resolveConflictById('nonexistent', 'keep_new'),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException when memory has no pending conflict', async () => {
        mockPrisma.memory.findUnique.mockResolvedValue({
          ...baseMemory,
          metadata: {}, // no pendingConflict
        });

        await expect(
          service.resolveConflictById('mem-1', 'keep_new'),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });
});
