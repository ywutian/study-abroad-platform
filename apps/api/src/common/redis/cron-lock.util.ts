import { Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/** Used when a caller passes no logger, so a failure is never swallowed silently. */
const fallbackLogger = new Logger('runWithCronLock');

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
 * A throwing job is caught and logged here rather than propagated. `@Cron`
 * handlers are fire-and-forget: nothing awaits them, so a rejection escapes as
 * an unhandledRejection instead of an error anyone reads, and under Node's
 * default that is a hard process exit — one failing weekly job taking down the
 * API replica with it. No caller wraps this in a try/catch, so catching once
 * here covers all of them.
 *
 * The lock is deliberately NOT released on failure: releasing it would let the
 * other replicas immediately retry the same failing job N×, which is what the
 * single-flight window exists to prevent. It expires on its TTL as usual.
 *
 * @returns `true` if the job ran (whether or not it threw), `false` if it was
 * skipped. A throw means it ran, so callers logging "skipped" on `false` stay
 * correct.
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
  try {
    await job();
  } catch (error) {
    (logger ?? fallbackLogger).error(
      `Cron job holding lock "${lockKey}" failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );
  }
  return true;
}
