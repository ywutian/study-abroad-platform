import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

const MAX_ATTEMPTS = 10;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes
const KEY_PREFIX = 'brute_force:';

// Lua script: atomically INCR the key and set TTL only if no TTL exists.
// Prevents race condition where concurrent requests both see current===1
// and both try to set TTL, or where a crash between INCR and EXPIRE
// leaves a key with no TTL (permanent lockout).
const INCR_WITH_EXPIRE_SCRIPT = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`;

@Injectable()
export class BruteForceService {
  private readonly logger = new Logger(BruteForceService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Check if an email is currently locked out due to too many failed attempts.
   * Returns true if locked, false otherwise.
   * Fails open (returns false) when Redis is unavailable.
   */
  async isLocked(email: string): Promise<boolean> {
    try {
      const key = this.buildKey(email);
      const attempts = await this.redis.get(key);
      if (attempts === null) {
        return false;
      }
      return parseInt(attempts, 10) >= MAX_ATTEMPTS;
    } catch (error) {
      this.logger.warn(
        `Redis error during lockout check for ${email}, failing open: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return false;
    }
  }

  /**
   * Record a failed login attempt for the given email.
   * Returns the number of remaining attempts before lockout.
   * Uses atomic Lua script to prevent INCR/EXPIRE race conditions.
   * Fails open (returns MAX_ATTEMPTS) when Redis is unavailable.
   */
  async recordFailedAttempt(email: string): Promise<number> {
    try {
      const key = this.buildKey(email);
      const client = this.redis.getClient();

      let current: number;
      if (client) {
        // Atomic INCR + conditional EXPIRE via Lua script
        current = (await client.eval(
          INCR_WITH_EXPIRE_SCRIPT,
          1,
          key,
          LOCKOUT_SECONDS,
        )) as number;
      } else {
        // No Redis — degrade gracefully
        return MAX_ATTEMPTS;
      }

      const remaining = Math.max(0, MAX_ATTEMPTS - current);

      if (current >= MAX_ATTEMPTS) {
        // Refresh TTL when lockout threshold is reached
        await this.redis.expire(key, LOCKOUT_SECONDS);
        this.logger.warn(
          `Account locked for ${email} after ${current} failed attempts`,
        );
      }

      return remaining;
    } catch (error) {
      this.logger.warn(
        `Redis error recording failed attempt for ${email}, failing open: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return MAX_ATTEMPTS;
    }
  }

  /**
   * Reset the failed-attempt counter for the given email (on successful login).
   */
  async resetAttempts(email: string): Promise<void> {
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

  private buildKey(email: string): string {
    return `${KEY_PREFIX}${email.toLowerCase()}`;
  }
}
