import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

const MAX_ATTEMPTS = 10;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes
const KEY_PREFIX = 'brute_force:';

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
   * Fails open (returns MAX_ATTEMPTS) when Redis is unavailable.
   */
  async recordFailedAttempt(email: string): Promise<number> {
    try {
      const key = this.buildKey(email);
      const current = await this.redis.incr(key);

      // Set TTL on first failed attempt so the counter auto-expires
      if (current === 1) {
        await this.redis.expire(key, LOCKOUT_SECONDS);
      }

      const remaining = Math.max(0, MAX_ATTEMPTS - current);

      if (current >= MAX_ATTEMPTS) {
        // Ensure TTL is refreshed when lockout threshold is reached
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
