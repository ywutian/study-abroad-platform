import { Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Single-flight guard for `@Cron` jobs in a multi-instance (Cloud Run, N-replica)
 * deployment.
 *
 * Every replica fires the same cron at the same time, so any side-effecting job
 * (sends a notification/email, calls an external API, scrapes, emits an event,
 * does a non-idempotent write) must run on exactly ONE replica or it fans out
 * N×. This acquires a Redis lock via `setNXStrict`; the TTL is the single-flight
 * window — there is deliberately NO explicit release, so the lock simply expires
 * before the next scheduled tick (pick a TTL longer than one run, shorter than
 * the cron interval; see the `*_CRON_LOCK` entries in redis-ttl.constants).
 *
 * `setNXStrict` returns false when the lock is held OR Redis is unavailable;
 * both correctly SKIP the run (fail-closed — for a scheduled job a missed tick
 * is far cheaper than N duplicate side effects). When `redis` is undefined
 * (single-instance / dev / tests without Redis) the job runs unguarded.
 *
 * Idempotent jobs (delete-where-expired, pure-overwrite recompute) don't need
 * this — running them N× is harmless. Use it only when duplication is harmful.
 *
 * @returns `true` if the job ran, `false` if it was skipped.
 */
export async function runWithCronLock(
  redis: RedisService | undefined,
  lockKey: string,
  ttlSeconds: number,
  job: () => Promise<void>,
  logger?: Logger,
): Promise<boolean> {
  if (redis) {
    const acquired = await redis.setNXStrict(lockKey, '1', ttlSeconds);
    if (!acquired) {
      logger?.log(
        `Cron skipped: single-flight lock "${lockKey}" held by another instance or Redis unavailable.`,
      );
      return false;
    }
  }
  await job();
  return true;
}
