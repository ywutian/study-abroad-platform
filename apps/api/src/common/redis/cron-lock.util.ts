import { Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/** Used when a caller passes no logger, so a failure is never swallowed silently. */
const fallbackLogger = new Logger('runWithCronLock');

/**
 * Single-flight guard for `@Cron` jobs.
 *
 * WHO FIRES THE JOB depends on `CRON_DRIVER` (common/cron/schedule-driver.ts):
 *
 * - `timer` (dev/tests/docker): every replica's in-process timer fires the same
 *   cron at the same time, so any side-effecting job (notification, email,
 *   external API call, scrape, non-idempotent write) must run on exactly ONE
 *   replica or it fans out N×. That N-replica dedupe is this lock's original
 *   job.
 * - `http` (production, since #553's follow-up): no in-process timers exist —
 *   Cloud Scheduler POSTs `/internal/cron/:name/run`, which is single-flight by
 *   construction. Here the lock's remaining job is narrower but real: dedupe a
 *   scheduler RETRY racing an attempt that is still running, and a manual
 *   `gcloud scheduler jobs run` racing either. (#553 recorded "don't run @Cron
 *   on a CPU-throttled service" as the real fix; the http driver is that fix.)
 *
 * This acquires a Redis lock via `setNXStrict`; the TTL is the single-flight
 * window — there is deliberately NO explicit release, so the lock simply expires
 * before the next scheduled tick (pick a TTL longer than one run, shorter than
 * the cron interval; see the `*_CRON_LOCK` entries in redis-ttl.constants).
 *
 * Both "the lock is held" and "Redis is unavailable" SKIP the run (fail-closed —
 * for a scheduled job a missed tick is far cheaper than N duplicate side
 * effects), but they are logged DIFFERENTLY, and that distinction is the whole
 * reason `tryAcquireLock` exists. A held lock means another replica is running
 * the job right now: normal, expected, LOG level. Redis being unavailable means
 * the job did not run anywhere: that is an outage symptom and gets WARN.
 *
 * This used to be one message — "held by another instance or Redis unavailable"
 * — and prod carried a month of it while Redis's circuit breaker opened 60-85
 * times a day. Every one of those lines read like healthy contention.
 * `AccountPurgeService` had never once completed a run and the logs said
 * nothing that looked wrong. Do not merge these two branches again.
 *
 * When `redis` is undefined (single-instance / dev / tests without Redis) the
 * job runs unguarded.
 *
 * Idempotent jobs (delete-where-expired, pure-overwrite recompute) don't need
 * this — running them N× is harmless. Use it only when duplication is harmful.
 *
 * WHO SEES A THROWING JOB depends on the driver:
 *
 * - `timer`: `@Cron` handlers are fire-and-forget. A rejection escapes as an
 *   unhandledRejection, and Node's default kills the process — one failing
 *   weekly job taking down the API replica. Catch, log, return true. The lock
 *   is NOT released: releasing it would let the other replicas immediately
 *   retry the same failing job N×.
 * - `http`: the caller is Cloud Scheduler via InternalCronController. A quiet
 *   `true`/200 after a failed job is the same "nothing happened looks like
 *   fine" this driver exists to kill. Log, release the lock, rethrow → 5xx.
 *   Scheduler retries after `--min-backoff` (300s). That backoff is SHORTER
 *   than several lock TTLs (account-purge 30m, essay-scraper 1h), so keeping
 *   the lock on failure would make the retry look like healthy contention and
 *   return 200. Fan-out is bounded by `--max-retry-attempts=1`, not by the
 *   lock: a retry racing a still-running attempt still sees the lock held.
 *
 * @returns `true` if the job ran to completion, `false` if it was skipped.
 * Under `http`, a throwing job rejects rather than returning true.
 */
export async function runWithCronLock(
  redis: RedisService | undefined,
  lockKey: string,
  ttlSeconds: number,
  job: () => Promise<void>,
  logger?: Logger,
): Promise<boolean> {
  if (redis) {
    const lock = await redis.tryAcquireLock(lockKey, '1', ttlSeconds);
    if (!lock.acquired) {
      if (lock.reason === 'held') {
        logger?.log(
          `Cron skipped: single-flight lock "${lockKey}" is held by another replica, which is running the job.`,
        );
      } else {
        // The job ran NOWHERE this tick. Loud on purpose: a Redis outage
        // silently disables every cron that uses this helper, and the only
        // signal is this line.
        (logger ?? fallbackLogger).warn(
          `Cron NOT RUN: could not reach Redis to take single-flight lock "${lockKey}". ` +
            `No replica executed this job on this tick — this is a Redis availability problem, not contention.`,
        );
        // Under the http driver the caller is ONE Cloud Scheduler request, and
        // returning normally would have it record a success for a job that ran
        // nowhere — the same "nothing happened looks like fine" this whole
        // driver exists to kill. Throwing turns it into a 5xx, which Scheduler
        // retries after its backoff. In timer mode we must NOT throw: @Cron
        // handlers are fire-and-forget, so a rejection escapes as an
        // unhandledRejection (see the note below on why this file catches).
        if (process.env.CRON_DRIVER === 'http') {
          throw new Error(
            `Cron "${lockKey}" did not run: Redis was unreachable, so the single-flight ` +
              `lock could not be taken. Failing loudly so Cloud Scheduler retries.`,
          );
        }
      }
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
    if (process.env.CRON_DRIVER === 'http') {
      // Release so the Scheduler retry (min-backoff 300s) can actually run.
      // Attempt-capped retries, not lock TTL, stop a failing job from fanning
      // out; a retry that arrives while this attempt is still running still
      // sees the lock held because we only release after the job returns.
      if (redis) {
        try {
          await redis.del(lockKey);
        } catch (releaseErr) {
          (logger ?? fallbackLogger).warn(
            `Failed to release cron lock "${lockKey}" after job failure: ${
              releaseErr instanceof Error
                ? releaseErr.message
                : String(releaseErr)
            }`,
          );
        }
      }
      throw error;
    }
  }
  return true;
}
