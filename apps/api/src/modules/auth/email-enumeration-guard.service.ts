import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';

/**
 * Per-IP sustained rate limiter for the public signup email-existence check.
 *
 * That check is a deliberate (product-justified) email-enumeration surface.
 * `@ThrottleSensitive` already caps bursts (5/min); this adds the tighter
 * *sustained* window a slow scraper would otherwise stay under, and emits a
 * structured security signal the first time the threshold trips (SIEM/Sentry
 * alerting hook) without per-request log spam.
 *
 * Fails OPEN: if Redis is unavailable the check is allowed. This is a UX
 * affordance, not a security gate, so a Redis outage must never block signups.
 */
const MAX_CHECKS_PER_WINDOW = 20;
const KEY_PREFIX = 'email_check:ip:';

// Atomic INCR + first-hit EXPIRE — same proven pattern as BruteForceService
// (survives a crash between INCR and EXPIRE instead of leaking a no-TTL key).
const INCR_WITH_EXPIRE = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`;

export interface EnumerationGuardResult {
  allowed: boolean;
  count: number;
}

@Injectable()
export class EmailEnumerationGuardService {
  private readonly logger = new Logger(EmailEnumerationGuardService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Record one email-check from `ip` and report whether it is within the
   * sustained window limit. Fails open on any Redis error.
   */
  async hit(ip: string): Promise<EnumerationGuardResult> {
    const key = `${KEY_PREFIX}${ip}`;
    try {
      const count = (await this.redis.withClient('atomic', key, (client) =>
        client.eval(
          INCR_WITH_EXPIRE,
          1,
          key,
          REDIS_TTL.EMAIL_CHECK_RATE_WINDOW,
        ),
      )) as number;

      if (count === MAX_CHECKS_PER_WINDOW + 1) {
        // Fire once, on the crossing — structured signal for enumeration alerting.
        this.logger.warn(
          `Email-enumeration threshold tripped for ip=${ip} (count=${count})`,
        );
      }

      return { allowed: count <= MAX_CHECKS_PER_WINDOW, count };
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for email-check guard, failing open: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return { allowed: true, count: 0 };
    }
  }
}
