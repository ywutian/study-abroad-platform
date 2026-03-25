import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagService } from './feature-flag.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let prismaService: PrismaService;
  let redisService: RedisService;

  const mockFlag = {
    id: 'flag-1',
    key: 'test-feature',
    description: 'A test feature flag',
    enabled: true,
    rules: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        {
          provide: PrismaService,
          useValue: {
            featureFlag: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            getJSON: jest.fn().mockResolvedValue(null),
            setJSON: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<FeatureFlagService>(FeatureFlagService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // isEnabled()
  // ─────────────────────────────────────────────

  describe('isEnabled', () => {
    it('should return false when flag is not found', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await service.isEnabled('non-existent');

      expect(result).toBe(false);
    });

    it('should return false when flag is disabled', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: false,
        rules: null,
      });

      const result = await service.isEnabled('disabled-flag');

      expect(result).toBe(false);
    });

    it('should return true when flag is enabled with no rules (global rollout)', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: null,
      });

      const result = await service.isEnabled('global-flag');

      expect(result).toBe(true);
    });

    it('should return true when roles rule matches context role', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: { roles: ['ADMIN', 'VERIFIED'] },
      });

      const result = await service.isEnabled('role-flag', { role: 'ADMIN' });

      expect(result).toBe(true);
    });

    it('should return false when roles rule does not match context role', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: { roles: ['ADMIN'] },
      });

      const result = await service.isEnabled('role-flag', { role: 'USER' });

      expect(result).toBe(false);
    });

    it('should return true when userIds rule matches context userId', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: { userIds: ['user-abc', 'user-def'] },
      });

      const result = await service.isEnabled('user-flag', {
        userId: 'user-abc',
      });

      expect(result).toBe(true);
    });

    it('should return false when userIds rule does not match context userId', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: { userIds: ['user-abc'] },
      });

      const result = await service.isEnabled('user-flag', {
        userId: 'user-xyz',
      });

      expect(result).toBe(false);
    });

    it('should evaluate percentage rollout deterministically based on userId', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: { percentage: 50 },
      });

      // Call twice with the same userId — result must be identical
      const result1 = await service.isEnabled('pct-flag', {
        userId: 'user-123',
      });
      const result2 = await service.isEnabled('pct-flag', {
        userId: 'user-123',
      });

      expect(result1).toBe(result2);
    });

    it('should return true for percentage rollout when user hash falls within range', async () => {
      // We use percentage: 100 to guarantee inclusion
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: { percentage: 100 },
      });

      const result = await service.isEnabled('pct-flag', {
        userId: 'any-user',
      });

      expect(result).toBe(true);
    });

    it('should return false for percentage rollout when percentage is 0', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: { percentage: 0 },
      });

      const result = await service.isEnabled('pct-flag', {
        userId: 'any-user',
      });

      expect(result).toBe(false);
    });

    it('should return false when rules exist but no context is provided', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: { roles: ['ADMIN'], userIds: ['user-1'], percentage: 50 },
      });

      const result = await service.isEnabled('rules-flag');

      expect(result).toBe(false);
    });

    it('should return false when rules exist but context has no matching fields', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: { roles: ['ADMIN'] },
      });

      // Context has userId but not role — roles rule cannot match
      const result = await service.isEnabled('rules-flag', {
        userId: 'user-1',
      });

      expect(result).toBe(false);
    });

    it('should short-circuit on roles match before checking userIds or percentage', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: {
          roles: ['ADMIN'],
          userIds: ['other-user'],
          percentage: 0,
        },
      });

      // Role matches even though userId would not match and percentage is 0
      const result = await service.isEnabled('multi-rule-flag', {
        userId: 'user-1',
        role: 'ADMIN',
      });

      expect(result).toBe(true);
    });

    it('should fall through to userIds when roles do not match', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: {
          roles: ['ADMIN'],
          userIds: ['user-1'],
        },
      });

      const result = await service.isEnabled('multi-rule-flag', {
        userId: 'user-1',
        role: 'USER',
      });

      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // Cache behavior
  // ─────────────────────────────────────────────

  describe('cache behavior', () => {
    it('should return cached value from Redis without querying DB', async () => {
      (redisService.getJSON as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: null,
      });

      const result = await service.isEnabled('cached-flag');

      expect(result).toBe(true);
      expect(redisService.getJSON).toHaveBeenCalledWith('ff:cached-flag');
      expect(prismaService.featureFlag.findUnique).not.toHaveBeenCalled();
    });

    it('should query DB on cache miss and cache the result', async () => {
      (redisService.getJSON as jest.Mock).mockResolvedValue(null);
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: null,
      });

      const result = await service.isEnabled('uncached-flag');

      expect(result).toBe(true);
      expect(prismaService.featureFlag.findUnique).toHaveBeenCalledWith({
        where: { key: 'uncached-flag' },
        select: { enabled: true, rules: true },
      });
      expect(redisService.setJSON).toHaveBeenCalledWith(
        'ff:uncached-flag',
        { enabled: true, rules: null },
        60,
      );
    });

    it('should gracefully degrade to DB when Redis getJSON throws', async () => {
      (redisService.getJSON as jest.Mock).mockRejectedValue(
        new Error('Redis connection refused'),
      );
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: null,
      });

      const result = await service.isEnabled('fallback-flag');

      expect(result).toBe(true);
      expect(prismaService.featureFlag.findUnique).toHaveBeenCalled();
    });

    it('should still return DB result when Redis setJSON throws during caching', async () => {
      (redisService.getJSON as jest.Mock).mockResolvedValue(null);
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        rules: null,
      });
      (redisService.setJSON as jest.Mock).mockRejectedValue(
        new Error('Redis write error'),
      );

      const result = await service.isEnabled('write-fail-flag');

      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // CRUD operations
  // ─────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all flags ordered by createdAt desc', async () => {
      const flags = [mockFlag, { ...mockFlag, id: 'flag-2', key: 'other' }];
      (prismaService.featureFlag.findMany as jest.Mock).mockResolvedValue(
        flags,
      );

      const result = await service.findAll();

      expect(result).toEqual(flags);
      expect(prismaService.featureFlag.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('should return a flag by id', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue(
        mockFlag,
      );

      const result = await service.findById('flag-1');

      expect(result).toEqual(mockFlag);
      expect(prismaService.featureFlag.findUnique).toHaveBeenCalledWith({
        where: { id: 'flag-1' },
      });
    });

    it('should return null when flag does not exist', async () => {
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a flag and invalidate cache', async () => {
      (prismaService.featureFlag.create as jest.Mock).mockResolvedValue(
        mockFlag,
      );

      const result = await service.create({
        key: 'test-feature',
        description: 'A test feature flag',
        enabled: true,
      });

      expect(result).toEqual(mockFlag);
      expect(prismaService.featureFlag.create).toHaveBeenCalledWith({
        data: {
          key: 'test-feature',
          description: 'A test feature flag',
          enabled: true,
          rules: undefined,
        },
      });
      expect(redisService.del).toHaveBeenCalledWith('ff:test-feature');
    });

    it('should default enabled to false when not provided', async () => {
      const disabledFlag = { ...mockFlag, enabled: false };
      (prismaService.featureFlag.create as jest.Mock).mockResolvedValue(
        disabledFlag,
      );

      await service.create({ key: 'new-flag' });

      expect(prismaService.featureFlag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ enabled: false }),
      });
    });

    it('should pass rules when provided', async () => {
      (prismaService.featureFlag.create as jest.Mock).mockResolvedValue(
        mockFlag,
      );

      await service.create({
        key: 'rule-flag',
        rules: { roles: ['ADMIN'] },
      });

      expect(prismaService.featureFlag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ rules: { roles: ['ADMIN'] } }),
      });
    });
  });

  describe('update', () => {
    it('should update a flag and invalidate cache for current key', async () => {
      const updatedFlag = { ...mockFlag, description: 'Updated' };
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue(
        mockFlag,
      );
      (prismaService.featureFlag.update as jest.Mock).mockResolvedValue(
        updatedFlag,
      );

      const result = await service.update('flag-1', {
        description: 'Updated',
      });

      expect(result).toEqual(updatedFlag);
      // Only the current key cache should be invalidated (key did not change)
      expect(redisService.del).toHaveBeenCalledTimes(1);
      expect(redisService.del).toHaveBeenCalledWith('ff:test-feature');
    });

    it('should invalidate both old and new key caches when key changes', async () => {
      const renamedFlag = { ...mockFlag, key: 'renamed-feature' };
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue(
        mockFlag,
      );
      (prismaService.featureFlag.update as jest.Mock).mockResolvedValue(
        renamedFlag,
      );

      await service.update('flag-1', { key: 'renamed-feature' });

      expect(redisService.del).toHaveBeenCalledTimes(2);
      expect(redisService.del).toHaveBeenCalledWith('ff:test-feature');
      expect(redisService.del).toHaveBeenCalledWith('ff:renamed-feature');
    });

    it('should only invalidate new key cache when old flag is not found', async () => {
      const updatedFlag = { ...mockFlag, key: 'new-key' };
      (prismaService.featureFlag.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prismaService.featureFlag.update as jest.Mock).mockResolvedValue(
        updatedFlag,
      );

      await service.update('flag-1', { key: 'new-key' });

      // old is null, so only new key is invalidated
      expect(redisService.del).toHaveBeenCalledTimes(1);
      expect(redisService.del).toHaveBeenCalledWith('ff:new-key');
    });
  });

  describe('remove', () => {
    it('should delete a flag and invalidate cache', async () => {
      (prismaService.featureFlag.delete as jest.Mock).mockResolvedValue(
        mockFlag,
      );

      const result = await service.remove('flag-1');

      expect(result).toEqual(mockFlag);
      expect(prismaService.featureFlag.delete).toHaveBeenCalledWith({
        where: { id: 'flag-1' },
      });
      expect(redisService.del).toHaveBeenCalledWith('ff:test-feature');
    });
  });

  // ─────────────────────────────────────────────
  // invalidateCache
  // ─────────────────────────────────────────────

  describe('invalidateCache', () => {
    it('should call redis.del with the correct cache key', async () => {
      await service.invalidateCache('my-flag');

      expect(redisService.del).toHaveBeenCalledWith('ff:my-flag');
    });

    it('should not throw when redis.del fails', async () => {
      (redisService.del as jest.Mock).mockRejectedValue(
        new Error('Redis unavailable'),
      );

      await expect(service.invalidateCache('my-flag')).resolves.toBeUndefined();
    });
  });
});
