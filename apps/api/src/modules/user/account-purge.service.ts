import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import { runWithCronLock } from '../../common/redis/cron-lock.util';
import { UserService } from './user.service';

/**
 * The job behind the deletion promise.
 *
 * `DELETE /users/me` is a soft delete: it disables sign-in, clears the profile
 * identifiers and turns the user's cases private, but the rows stay. Until this
 * service existed, `hardDelete` had no caller anywhere — which is why the
 * "永久删除" copy was removed rather than kept. This purges accounts once the
 * grace window has passed, so the claim can be made truthfully again.
 *
 * Three deliberate constraints:
 *
 *  - **Disabled by default.** The first enabled run purges the whole existing
 *    backlog at once, irreversibly. Left disabled the job still runs and logs
 *    what it *would* delete, so the blast radius can be read off a log line
 *    before anyone commits to it.
 *  - **Retention beats erasure.** An account with Payment rows is skipped, not
 *    purged: `Payment` cascades off `User`, so deleting the account destroys
 *    the financial record with it. Erasure obligations yield to retention
 *    obligations — the account stays soft-deleted and is reported.
 *  - **Capped per run.** A bounded batch keeps one bad night bounded too, and
 *    the remainder is simply picked up tomorrow.
 */
@Injectable()
export class AccountPurgeService {
  private readonly logger = new Logger(AccountPurgeService.name);

  /** Upper bound on accounts purged in a single run. */
  private static readonly BATCH_LIMIT = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserService,
    private readonly config: ConfigService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private get enabled(): boolean {
    return this.config.get<string>('ACCOUNT_PURGE_ENABLED') === 'true';
  }

  private get graceDays(): number {
    return Number(this.config.get('ACCOUNT_PURGE_GRACE_DAYS') ?? 30);
  }

  /** Daily at 04:00. Off-peak, and far from the deploy window. */
  @Cron('0 4 * * *')
  async scheduledPurge(): Promise<void> {
    await runWithCronLock(
      this.redis,
      'cron:account-purge',
      REDIS_TTL.ACCOUNT_PURGE_CRON_LOCK,
      () => this.purgeExpired().then(() => undefined),
      this.logger,
    );
  }

  /**
   * Purge every account whose grace window has closed.
   *
   * Exposed (rather than inlined into the cron) so the behaviour is testable
   * and so an operator can trigger it deliberately.
   */
  async purgeExpired(): Promise<{
    eligible: number;
    purged: number;
    retained: number;
    failed: number;
    dryRun: boolean;
  }> {
    const cutoff = new Date(Date.now() - this.graceDays * 24 * 60 * 60 * 1000);
    const dryRun = !this.enabled;

    // governance: batch-operation — sweeping every expired account is the job;
    // the scope is `deletedAt` older than the cutoff, and only ids and a payment
    // count leave the query.
    const candidates = await this.prisma.user.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      select: {
        id: true,
        deletedAt: true,
        _count: { select: { payments: true } },
      },
      orderBy: { deletedAt: 'asc' },
      take: AccountPurgeService.BATCH_LIMIT,
    });

    if (candidates.length === 0) {
      return { eligible: 0, purged: 0, retained: 0, failed: 0, dryRun };
    }

    const retained = candidates.filter((u) => u._count.payments > 0);
    const purgeable = candidates.filter((u) => u._count.payments === 0);

    for (const u of retained) {
      // Not a failure — a deliberate refusal. Surfaced every run so it cannot
      // quietly become a permanent backlog nobody decided about.
      this.logger.warn(
        `Account ${u.id} is past its grace window but holds ${u._count.payments} payment ` +
          `record(s); skipping purge so the financial history survives. Needs a retention decision.`,
      );
    }

    if (dryRun) {
      this.logger.log(
        `Account purge DRY RUN (ACCOUNT_PURGE_ENABLED=false): would purge ${purgeable.length}, ` +
          `would retain ${retained.length}, cutoff ${cutoff.toISOString()} ` +
          `(grace ${this.graceDays}d). Set ACCOUNT_PURGE_ENABLED=true to act.`,
      );
      return {
        eligible: candidates.length,
        purged: 0,
        retained: retained.length,
        failed: 0,
        dryRun,
      };
    }

    let purged = 0;
    let failed = 0;
    for (const u of purgeable) {
      try {
        await this.users.hardDelete(u.id);
        purged++;
      } catch (err) {
        // One bad row must not strand the rest of the batch; it is retried on
        // the next run, and a row that keeps failing keeps being logged.
        failed++;
        this.logger.error(
          `Failed to purge account ${u.id}: ${String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }

    this.logger.warn(
      `Account purge complete: purged ${purged}, retained ${retained.length}, failed ${failed} ` +
        `(cutoff ${cutoff.toISOString()}, grace ${this.graceDays}d).`,
    );

    return {
      eligible: candidates.length,
      purged,
      retained: retained.length,
      failed,
      dryRun,
    };
  }
}
