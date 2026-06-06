import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

const MAX_ATTEMPTS = 10;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes
const LOCKOUT_MS = LOCKOUT_SECONDS * 1000;
const KEY_PREFIX = 'brute_force:';

const INCR_WITH_EXPIRE_SCRIPT = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`;

interface MemoryEntry {
  count: number;
  expiresAt: number;
}

@Injectable()
export class BruteForceService {
  private readonly logger = new Logger(BruteForceService.name);
  private readonly memoryStore = new Map<string, MemoryEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly redis: RedisService) {
    this.cleanupTimer = setInterval(() => this.evictExpired(), 60_000);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  async isLocked(email: string): Promise<boolean> {
    const key = this.buildKey(email);
    // `get` returns null when Redis is down OR no attempts are recorded — both
    // consult the in-memory store, matching the previous fallback behavior.
    const attempts = await this.redis.get(key);
    if (attempts === null) {
      return this.isLockedMemory(email);
    }
    return parseInt(attempts, 10) >= MAX_ATTEMPTS;
  }

  async recordFailedAttempt(email: string): Promise<number> {
    const key = this.buildKey(email);

    let current: number;
    try {
      // Atomic INCR + first-time EXPIRE via Lua. withClient throws when Redis is
      // down or errors, so we fall back to the in-memory counter exactly as
      // before — the op is now metered in the cache-health dashboard.
      current = (await this.redis.withClient('atomic', key, (client) =>
        client.eval(INCR_WITH_EXPIRE_SCRIPT, 1, key, LOCKOUT_SECONDS),
      )) as number;
    } catch (error) {
      this.logger.warn(
        `Redis error recording failed attempt for ${email}, using in-memory fallback: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return this.recordFailedAttemptMemory(email);
    }

    const remaining = Math.max(0, MAX_ATTEMPTS - current);

    if (current >= MAX_ATTEMPTS) {
      // Refresh TTL — non-critical; expire no-ops on failure.
      await this.redis.expire(key, LOCKOUT_SECONDS);
      this.logger.warn(
        `Account locked for ${email} after ${current} failed attempts`,
      );
    }

    return remaining;
  }

  async resetAttempts(email: string): Promise<void> {
    this.memoryStore.delete(email.toLowerCase());
    try {
      const key = this.buildKey(email);
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(
        `Redis error resetting attempts for ${email}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  private isLockedMemory(email: string): boolean {
    const entry = this.memoryStore.get(email.toLowerCase());
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.memoryStore.delete(email.toLowerCase());
      return false;
    }
    return entry.count >= MAX_ATTEMPTS;
  }

  private recordFailedAttemptMemory(email: string): number {
    const key = email.toLowerCase();
    const now = Date.now();
    let entry = this.memoryStore.get(key);

    if (!entry || now > entry.expiresAt) {
      entry = { count: 0, expiresAt: now + LOCKOUT_MS };
      this.memoryStore.set(key, entry);
    }

    entry.count++;
    const remaining = Math.max(0, MAX_ATTEMPTS - entry.count);

    if (entry.count >= MAX_ATTEMPTS) {
      entry.expiresAt = now + LOCKOUT_MS;
      this.logger.warn(
        `Account locked (in-memory) for ${email} after ${entry.count} failed attempts`,
      );
    }

    return remaining;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore) {
      if (now > entry.expiresAt) {
        this.memoryStore.delete(key);
      }
    }
  }

  private buildKey(email: string): string {
    return `${KEY_PREFIX}${email.toLowerCase()}`;
  }
}
