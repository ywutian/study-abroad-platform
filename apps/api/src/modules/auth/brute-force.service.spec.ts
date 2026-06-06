import { Test, TestingModule } from '@nestjs/testing';
import { BruteForceService } from './brute-force.service';
import { RedisService } from '../../common/redis/redis.service';

describe('BruteForceService', () => {
  let service: BruteForceService;
  let redisService: RedisService;
  let mockRedisClient: {
    eval: jest.Mock;
  };

  beforeEach(async () => {
    mockRedisClient = {
      eval: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BruteForceService,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockRedisClient),
            get: jest.fn(),
            del: jest.fn(),
            expire: jest.fn(),
            // withClient invokes the callback with the mock client so the Lua
            // eval still runs; tests simulate "Redis down" by rejecting it.
            withClient: jest.fn((_op, _key, fn) => fn(mockRedisClient)),
          },
        },
      ],
    }).compile();

    service = module.get<BruteForceService>(BruteForceService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    // Clean up the interval timer to prevent leaks
    service.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('isLocked', () => {
    it('should return false when no attempts recorded', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.isLocked('test@example.com');

      expect(result).toBe(false);
      expect(redisService.get).toHaveBeenCalledWith(
        'brute_force:test@example.com',
      );
    });

    it('should return false when attempts are below threshold', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('5');

      const result = await service.isLocked('test@example.com');

      expect(result).toBe(false);
    });

    it('should return true when attempts reach MAX_ATTEMPTS (10)', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('10');

      const result = await service.isLocked('test@example.com');

      expect(result).toBe(true);
    });

    it('should return true when attempts exceed MAX_ATTEMPTS', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('15');

      const result = await service.isLocked('test@example.com');

      expect(result).toBe(true);
    });

    it('should normalize email to lowercase for key lookup', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);

      await service.isLocked('Test@EXAMPLE.com');

      expect(redisService.get).toHaveBeenCalledWith(
        'brute_force:test@example.com',
      );
    });

    it('should fall back to in-memory store when Redis is unavailable', async () => {
      // get() returns null when Redis is down → isLocked consults memory.
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.isLocked('test@example.com');

      expect(result).toBe(false);
    });

    it('should fall back to in-memory store when Redis errors (get returns null)', async () => {
      // RedisService.get is safeRecord — a Redis error surfaces as null, not a throw.
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.isLocked('test@example.com');

      // No in-memory entries, so should be false
      expect(result).toBe(false);
    });

    it('should fall back to in-memory store when Redis returns null (key expired)', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);

      // The service falls back to memory when Redis returns null
      const result = await service.isLocked('test@example.com');

      expect(result).toBe(false);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should return remaining attempts after first failure', async () => {
      mockRedisClient.eval.mockResolvedValue(1);

      const remaining = await service.recordFailedAttempt('test@example.com');

      expect(remaining).toBe(9); // MAX_ATTEMPTS(10) - 1 = 9
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('INCR'),
        1,
        'brute_force:test@example.com',
        900, // 15 * 60 = LOCKOUT_SECONDS
      );
    });

    it('should decrement remaining attempts on subsequent failures', async () => {
      mockRedisClient.eval.mockResolvedValue(5);

      const remaining = await service.recordFailedAttempt('test@example.com');

      expect(remaining).toBe(5); // 10 - 5 = 5
    });

    it('should return 0 remaining when reaching MAX_ATTEMPTS', async () => {
      mockRedisClient.eval.mockResolvedValue(10);

      const remaining = await service.recordFailedAttempt('test@example.com');

      expect(remaining).toBe(0);
    });

    it('should refresh TTL when lockout threshold is reached', async () => {
      mockRedisClient.eval.mockResolvedValue(10);

      await service.recordFailedAttempt('test@example.com');

      expect(redisService.expire).toHaveBeenCalledWith(
        'brute_force:test@example.com',
        900,
      );
    });

    it('should not refresh TTL when below lockout threshold', async () => {
      mockRedisClient.eval.mockResolvedValue(5);

      await service.recordFailedAttempt('test@example.com');

      expect(redisService.expire).not.toHaveBeenCalled();
    });

    it('should return 0 remaining when exceeding MAX_ATTEMPTS', async () => {
      mockRedisClient.eval.mockResolvedValue(15);

      const remaining = await service.recordFailedAttempt('test@example.com');

      expect(remaining).toBe(0); // Math.max(0, 10 - 15) = 0
    });

    it('should fall back to in-memory when Redis is unavailable', async () => {
      (redisService.withClient as jest.Mock).mockRejectedValue(
        new Error('Redis unavailable'),
      );

      const remaining = await service.recordFailedAttempt('test@example.com');

      expect(remaining).toBe(9); // First failure in memory
      expect(mockRedisClient.eval).not.toHaveBeenCalled();
    });

    it('should fall back to in-memory when Redis eval throws', async () => {
      mockRedisClient.eval.mockRejectedValue(new Error('Redis timeout'));

      const remaining = await service.recordFailedAttempt('test@example.com');

      expect(remaining).toBe(9); // Falls back to memory store
    });

    it('treats TTL refresh as best-effort after lockout', async () => {
      mockRedisClient.eval.mockResolvedValue(10);

      // RedisService.expire is safeRecord (never throws); lockout still works.
      const remaining = await service.recordFailedAttempt('test@example.com');

      expect(remaining).toBe(0);
      expect(redisService.expire).toHaveBeenCalledWith(
        'brute_force:test@example.com',
        900,
      );
    });
  });

  describe('resetAttempts', () => {
    it('should delete the Redis key for the email', async () => {
      await service.resetAttempts('test@example.com');

      expect(redisService.del).toHaveBeenCalledWith(
        'brute_force:test@example.com',
      );
    });

    it('should normalize email to lowercase', async () => {
      await service.resetAttempts('Test@EXAMPLE.COM');

      expect(redisService.del).toHaveBeenCalledWith(
        'brute_force:test@example.com',
      );
    });

    it('should not throw when Redis delete fails', async () => {
      (redisService.del as jest.Mock).mockRejectedValue(
        new Error('Redis error'),
      );

      // Should not throw, just log warning
      await expect(
        service.resetAttempts('test@example.com'),
      ).resolves.toBeUndefined();
    });

    it('should also clear in-memory store entry', async () => {
      // First, record a failure in memory
      (redisService.getClient as jest.Mock).mockReturnValue(null);
      await service.recordFailedAttempt('test@example.com');

      // Re-enable Redis for reset
      (redisService.getClient as jest.Mock).mockReturnValue(mockRedisClient);

      // Reset should clear both stores
      await service.resetAttempts('test@example.com');

      // Verify by checking in-memory lockout is cleared
      (redisService.getClient as jest.Mock).mockReturnValue(null);
      const locked = await service.isLocked('test@example.com');
      expect(locked).toBe(false);
    });
  });

  describe('in-memory fallback behavior', () => {
    beforeEach(() => {
      // Disable Redis for all tests in this block: withClient throws → memory
      // path for recordFailedAttempt; get returns null → isLocked uses memory.
      (redisService.withClient as jest.Mock).mockRejectedValue(
        new Error('Redis unavailable'),
      );
      (redisService.get as jest.Mock).mockResolvedValue(null);
    });

    it('should track failed attempts in memory and lock after 10 failures', async () => {
      for (let i = 1; i <= 10; i++) {
        await service.recordFailedAttempt('memory@test.com');
      }

      const locked = await service.isLocked('memory@test.com');
      expect(locked).toBe(true);
    });

    it('should return decreasing remaining attempts', async () => {
      const results: number[] = [];
      for (let i = 0; i < 12; i++) {
        results.push(await service.recordFailedAttempt('counter@test.com'));
      }

      expect(results[0]).toBe(9); // 10 - 1
      expect(results[4]).toBe(5); // 10 - 5
      expect(results[8]).toBe(1); // 10 - 9
      expect(results[9]).toBe(0); // 10 - 10 = 0 (locked)
      expect(results[10]).toBe(0); // stays at 0
      expect(results[11]).toBe(0); // stays at 0
    });

    it('should not lock when attempts are below threshold', async () => {
      for (let i = 0; i < 5; i++) {
        await service.recordFailedAttempt('partial@test.com');
      }

      const locked = await service.isLocked('partial@test.com');
      expect(locked).toBe(false);
    });

    it('should treat emails case-insensitively in memory', async () => {
      for (let i = 0; i < 10; i++) {
        await service.recordFailedAttempt('CaSe@TeSt.Com');
      }

      const locked = await service.isLocked('case@test.com');
      expect(locked).toBe(true);
    });

    it('should handle expired in-memory entries as unlocked', async () => {
      // Record failures
      for (let i = 0; i < 10; i++) {
        await service.recordFailedAttempt('expire@test.com');
      }

      // Simulate time passing beyond lockout window by manipulating the entry
      // Access private memoryStore via bracket notation for testing
      const memoryStore = (service as any).memoryStore as Map<
        string,
        { count: number; expiresAt: number }
      >;
      const entry = memoryStore.get('expire@test.com');
      if (entry) {
        entry.expiresAt = Date.now() - 1; // Expired
      }

      const locked = await service.isLocked('expire@test.com');
      expect(locked).toBe(false);
    });

    it('should reset in-memory entry for expired attempts on new failure', async () => {
      // Record some failures
      for (let i = 0; i < 5; i++) {
        await service.recordFailedAttempt('expired@test.com');
      }

      // Expire the entry
      const memoryStore = (service as any).memoryStore as Map<
        string,
        { count: number; expiresAt: number }
      >;
      const entry = memoryStore.get('expired@test.com');
      if (entry) {
        entry.expiresAt = Date.now() - 1;
      }

      // New failure should start fresh
      const remaining = await service.recordFailedAttempt('expired@test.com');
      expect(remaining).toBe(9); // Fresh start: 10 - 1
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear the cleanup interval timer', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      service.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should be safe to call multiple times', () => {
      service.onModuleDestroy();
      // Second call should not throw
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('evictExpired (via timer simulation)', () => {
    it('should remove expired entries from memory store', () => {
      const memoryStore = (service as any).memoryStore as Map<
        string,
        { count: number; expiresAt: number }
      >;

      memoryStore.set('fresh@test.com', {
        count: 3,
        expiresAt: Date.now() + 60_000,
      });
      memoryStore.set('stale@test.com', {
        count: 5,
        expiresAt: Date.now() - 1,
      });

      // Call private evictExpired directly
      (service as any).evictExpired();

      expect(memoryStore.has('fresh@test.com')).toBe(true);
      expect(memoryStore.has('stale@test.com')).toBe(false);
    });
  });
});
