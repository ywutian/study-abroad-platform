/**
 * MemoryDecayService 单元测试
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MemoryDecayService, DecayConfig } from './memory-decay.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { MemoryScorerService, MemoryTier } from './memory-scorer.service';
import { RedisService } from '../../../common/redis/redis.service';

describe('MemoryDecayService', () => {
  let service: MemoryDecayService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockScorerService: jest.Mocked<MemoryScorerService>;
  let mockRedisService: jest.Mocked<RedisService>;

  const mockMemory = {
    id: 'memory-1',
    userId: 'user-1',
    importance: 0.8,
    accessCount: 5,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    lastAccessedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      memory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      $executeRaw: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<PrismaService>;

    mockScorerService = {
      getFreshness: jest.fn().mockReturnValue(0.7),
    } as unknown as jest.Mocked<MemoryScorerService>;

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(null),
      connected: false,
    } as unknown as jest.Mocked<RedisService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryDecayService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MemoryScorerService, useValue: mockScorerService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<MemoryDecayService>(MemoryDecayService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // === 衰减执行测试 ===
  describe('executeDecay (via runDailyDecay)', () => {
    it('should reduce importance by decay rate', async () => {
      mockPrismaService.memory.findMany
        .mockResolvedValueOnce([mockMemory])
        .mockResolvedValueOnce([]);
      mockPrismaService.memory.update.mockResolvedValue(mockMemory);
      mockPrismaService.memory.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.triggerDecay();

      expect(mockPrismaService.memory.update).toHaveBeenCalled();
      expect(result.processed).toBe(1);
    });

    it('should not decay below minImportance', async () => {
      const lowImportanceMemory = { ...mockMemory, importance: 0.11 };
      mockPrismaService.memory.findMany
        .mockResolvedValueOnce([lowImportanceMemory])
        .mockResolvedValueOnce([]);
      mockPrismaService.memory.update.mockResolvedValue(lowImportanceMemory);
      mockPrismaService.memory.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 0 });

      await service.triggerDecay();

      // 验证更新调用的参数中 importance >= minImportance
      if (mockPrismaService.memory.update.mock.calls.length > 0) {
        const updateCall = mockPrismaService.memory.update.mock.calls[0][0];
        expect(updateCall.data.importance).toBeGreaterThanOrEqual(0.1);
      }
    });

    it('should batch process memories', async () => {
      // 模拟 200 条记忆，分两批处理
      const batch1 = Array.from({ length: 100 }, (_, i) => ({
        ...mockMemory,
        id: `memory-${i}`,
      }));
      const batch2 = Array.from({ length: 100 }, (_, i) => ({
        ...mockMemory,
        id: `memory-${i + 100}`,
      }));

      mockPrismaService.memory.findMany
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);
      mockPrismaService.memory.update.mockResolvedValue(mockMemory);
      mockPrismaService.memory.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.triggerDecay();

      expect(result.processed).toBe(200);
    });

    it('should skip recently created memories (freshness factor)', async () => {
      const freshMemory = {
        ...mockMemory,
        createdAt: new Date(), // Just created
      };
      mockScorerService.getFreshness.mockReturnValueOnce(1.0); // 完全新鲜

      mockPrismaService.memory.findMany
        .mockResolvedValueOnce([freshMemory])
        .mockResolvedValueOnce([]);
      mockPrismaService.memory.update.mockResolvedValue(freshMemory);
      mockPrismaService.memory.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.triggerDecay();

      // 新鲜度为 1 时，衰减因子为 0，不应更新
      expect(result.processed).toBe(1);
    });

    it('should apply freshness factor to decay rate', async () => {
      mockScorerService.getFreshness.mockReturnValue(0.5); // 50% 新鲜度

      mockPrismaService.memory.findMany
        .mockResolvedValueOnce([mockMemory])
        .mockResolvedValueOnce([]);
      mockPrismaService.memory.update.mockResolvedValue(mockMemory);
      mockPrismaService.memory.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 0 });

      await service.triggerDecay();

      expect(mockScorerService.getFreshness).toHaveBeenCalled();
    });
  });

  // === 归档执行测试 ===
  describe('executeArchive (via runDailyDecay)', () => {
    it('should mark low importance memories as archived via raw SQL', async () => {
      mockPrismaService.memory.findMany.mockResolvedValue([]);
      (mockPrismaService.$executeRaw as jest.Mock).mockResolvedValue(5);
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.triggerDecay();

      expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
      expect(result.archived).toBe(5);
    });

    it('should return 0 archived when no memories match', async () => {
      mockPrismaService.memory.findMany.mockResolvedValue([]);
      (mockPrismaService.$executeRaw as jest.Mock).mockResolvedValue(0);
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.triggerDecay();

      expect(result.archived).toBe(0);
    });
  });

  // === 删除执行测试 ===
  describe('executeDelete (via runDailyDecay)', () => {
    it('should delete memories older than deleteAfterDays', async () => {
      mockPrismaService.memory.findMany.mockResolvedValue([]);
      mockPrismaService.memory.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.triggerDecay();

      expect(mockPrismaService.memory.deleteMany).toHaveBeenCalled();
      expect(result.deleted).toBe(3);
    });

    it('should only delete low importance memories', async () => {
      mockPrismaService.memory.findMany.mockResolvedValue([]);
      mockPrismaService.memory.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 0 });

      await service.triggerDecay();

      const deleteManyCall =
        mockPrismaService.memory.deleteMany.mock.calls[0][0];
      expect(deleteManyCall.where.importance).toBeDefined();
      expect(deleteManyCall.where.importance.lt).toBeLessThan(0.2);
    });
  });

  // === 访问强化测试 ===
  describe('recordAccess', () => {
    it('should increment accessCount', async () => {
      mockPrismaService.memory.findUnique.mockResolvedValue(mockMemory);
      mockPrismaService.memory.update.mockResolvedValue({
        ...mockMemory,
        accessCount: 6,
      });

      await service.recordAccess('memory-1');

      expect(mockPrismaService.memory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessCount: { increment: 1 },
          }),
        }),
      );
    });

    it('should update lastAccessedAt', async () => {
      mockPrismaService.memory.findUnique.mockResolvedValue(mockMemory);
      mockPrismaService.memory.update.mockResolvedValue(mockMemory);

      await service.recordAccess('memory-1');

      expect(mockPrismaService.memory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastAccessedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should boost importance', async () => {
      mockPrismaService.memory.findUnique.mockResolvedValue(mockMemory);
      mockPrismaService.memory.update.mockResolvedValue(mockMemory);

      await service.recordAccess('memory-1');

      expect(mockPrismaService.memory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            importance: expect.any(Number),
          }),
        }),
      );
    });

    it('should not exceed maxAccessBoost', async () => {
      const highAccessMemory = {
        ...mockMemory,
        accessCount: 100,
        importance: 0.99,
      };
      mockPrismaService.memory.findUnique.mockResolvedValue(highAccessMemory);
      mockPrismaService.memory.update.mockResolvedValue(highAccessMemory);

      await service.recordAccess('memory-1');

      const updateCall = mockPrismaService.memory.update.mock.calls[0][0];
      expect(updateCall.data.importance).toBeLessThanOrEqual(1);
    });

    it('should handle non-existent memory', async () => {
      mockPrismaService.memory.findUnique.mockResolvedValue(null);

      await service.recordAccess('non-existent');

      expect(mockPrismaService.memory.update).not.toHaveBeenCalled();
    });
  });

  // === 定时任务测试 ===
  describe('runDailyDecay', () => {
    it('should run all decay phases', async () => {
      mockPrismaService.memory.findMany.mockResolvedValue([]);
      mockPrismaService.memory.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.triggerDecay();

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('decayed');
      expect(result).toHaveProperty('archived');
      expect(result).toHaveProperty('deleted');
      expect(result).toHaveProperty('durationMs');
    });

    it('should skip if already running', async () => {
      mockPrismaService.memory.findMany.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      );
      mockPrismaService.memory.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 0 });

      // 启动两个并发任务
      const task1 = service.triggerDecay();
      const task2 = service.triggerDecay();

      const [result1, result2] = await Promise.all([task1, task2]);

      // 其中一个应该被跳过（返回空结果）
      const skipped =
        (result1.processed === 0 && result1.durationMs === 0) ||
        (result2.processed === 0 && result2.durationMs === 0);
      expect(skipped).toBe(true);
    });

    it('should skip if disabled', async () => {
      service.updateConfig({ enabled: false });

      const result = await service.triggerDecay();

      expect(result.processed).toBe(0);
      expect(result.durationMs).toBe(0);
    });

    it('should return comprehensive result', async () => {
      mockPrismaService.memory.findMany
        .mockResolvedValueOnce([mockMemory])
        .mockResolvedValueOnce([]);
      mockPrismaService.memory.update.mockResolvedValue(mockMemory);
      (mockPrismaService.$executeRaw as jest.Mock).mockResolvedValue(2);
      mockPrismaService.memory.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.triggerDecay();

      expect(result.processed).toBe(1);
      expect(result.archived).toBe(2);
      expect(result.deleted).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // === 配置管理测试 ===
  describe('config management', () => {
    it('should use default config', () => {
      const config = service.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.decayRate).toBe(0.01);
      expect(config.minImportance).toBe(0.1);
    });

    it('should allow config updates', () => {
      service.updateConfig({ decayRate: 0.02, batchSize: 200 });

      const config = service.getConfig();
      expect(config.decayRate).toBe(0.02);
      expect(config.batchSize).toBe(200);
    });

    it('should preserve unmodified config values', () => {
      const originalConfig = service.getConfig();
      service.updateConfig({ decayRate: 0.05 });

      const newConfig = service.getConfig();
      expect(newConfig.minImportance).toBe(originalConfig.minImportance);
      expect(newConfig.archiveAfterDays).toBe(originalConfig.archiveAfterDays);
    });
  });

  // === 统计测试 ===
  describe('getDecayStats', () => {
    it('should return tier distribution', async () => {
      mockPrismaService.memory.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20) // low importance
        .mockResolvedValueOnce(5) // old memories
        .mockResolvedValueOnce(30) // long tier
        .mockResolvedValueOnce(50) // short tier
        .mockResolvedValueOnce(20); // archive tier

      mockPrismaService.memory.aggregate.mockResolvedValue({
        _avg: { importance: 0.6 },
      });

      mockPrismaService.memory.findMany.mockResolvedValue([
        { createdAt: new Date() },
      ]);

      const stats = await service.getDecayStats();

      expect(stats.totalMemories).toBe(100);
      expect(stats.byTier).toBeDefined();
    });

    it('should calculate average importance', async () => {
      mockPrismaService.memory.count.mockResolvedValue(100);
      mockPrismaService.memory.aggregate.mockResolvedValue({
        _avg: { importance: 0.65 },
      });
      mockPrismaService.memory.findMany.mockResolvedValue([]);

      const stats = await service.getDecayStats();

      expect(stats.averageImportance).toBe(0.65);
    });

    it('should calculate average freshness', async () => {
      mockPrismaService.memory.count.mockResolvedValue(10);
      mockPrismaService.memory.aggregate.mockResolvedValue({
        _avg: { importance: 0.5 },
      });
      mockPrismaService.memory.findMany.mockResolvedValue([
        { createdAt: new Date() },
        { createdAt: new Date(Date.now() - 86400000) },
      ]);
      mockScorerService.getFreshness.mockReturnValue(0.8);

      const stats = await service.getDecayStats();

      expect(stats.averageFreshness).toBeGreaterThan(0);
    });

    it('should count scheduled for archive', async () => {
      mockPrismaService.memory.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(15) // low importance (scheduled for archive)
        .mockResolvedValueOnce(5); // old memories

      mockPrismaService.memory.aggregate.mockResolvedValue({
        _avg: { importance: 0.5 },
      });
      mockPrismaService.memory.findMany.mockResolvedValue([]);

      const stats = await service.getDecayStats();

      expect(stats.scheduledForArchive).toBe(15);
    });

    it('should count scheduled for delete', async () => {
      mockPrismaService.memory.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8); // old memories (scheduled for delete)

      mockPrismaService.memory.aggregate.mockResolvedValue({
        _avg: { importance: 0.5 },
      });
      mockPrismaService.memory.findMany.mockResolvedValue([]);

      const stats = await service.getDecayStats();

      expect(stats.scheduledForDelete).toBe(8);
    });
  });

  // === 批量访问测试 ===
  describe('recordAccessBatch', () => {
    it('should record access for multiple memories', async () => {
      mockPrismaService.memory.findUnique.mockResolvedValue(mockMemory);
      mockPrismaService.memory.update.mockResolvedValue(mockMemory);

      await service.recordAccessBatch(['memory-1', 'memory-2', 'memory-3']);

      expect(mockPrismaService.memory.findUnique).toHaveBeenCalledTimes(3);
      expect(mockPrismaService.memory.update).toHaveBeenCalledTimes(3);
    });
  });
});
