import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { CronRegistryService } from './cron-registry.service';
import { CronSecretGuard } from './cron-secret.guard';

/** Job names are derived from class/method names or explicit @Cron names. */
const JOB_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,199}$/;

/**
 * HTTP driver for scheduled jobs (`CRON_DRIVER=http` — see schedule-driver.ts
 * for why prod must not run in-process timers). Cloud Scheduler is the caller:
 * one scheduler job per `@Cron` method, provisioned by
 * `scripts/ci/sync-cloud-scheduler.mjs` from `.github/cron-jobs.json`.
 *
 * POST answers only AFTER the job completes — on Cloud Run, CPU is guaranteed
 * exactly for the lifetime of a request, so returning early would strand the
 * job on a throttled container (the precise failure this driver removes).
 * TimeoutMiddleware exempts this path; Cloud Run's `--timeout` is the ceiling.
 *
 * A throwing job propagates → 5xx → Cloud Scheduler records the failure and
 * retries. Single-flight under retry overlap is still guarded by the jobs' own
 * `runWithCronLock` (its role shrinks from "dedupe N replicas every tick" to
 * "dedupe a retry racing a still-running attempt").
 *
 * `@Public()` skips JWT; `CronSecretGuard` is the actual gate (fail-closed).
 */
@ApiExcludeController()
@Public()
@UseGuards(CronSecretGuard)
@Controller('internal/cron')
export class InternalCronController {
  constructor(
    private readonly registry: CronRegistryService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  /**
   * `driver` + `inProcessTimers` exist so the post-deploy assert can prove
   * production is ACTUALLY in http mode. Without them, dropping CRON_DRIVER
   * from the deploy's `--set-env-vars` (which replaces the whole set) would
   * leave every job running on BOTH a starved in-process timer and Cloud
   * Scheduler, while the manifest assert stayed green — #553 back, no red.
   */
  @Get()
  list() {
    return {
      driver: this.config.get<string>('CRON_DRIVER') ?? 'timer',
      inProcessTimers: this.scheduler.getCronJobs().size,
      jobs: this.registry.list(),
    };
  }

  @Post(':name/run')
  async run(@Param('name') name: string) {
    if (!JOB_NAME_PATTERN.test(name)) {
      throw new BadRequestException('Invalid job name');
    }
    if (this.config.get<string>('SCHEDULERS_ENABLED') === 'false') {
      throw new ServiceUnavailableException(
        'SCHEDULERS_ENABLED=false — scheduled jobs are switched off',
      );
    }
    const startedAt = Date.now();
    await this.registry.run(name);
    // `dispatched`, not `ran`: for a job wrapped in runWithCronLock this says
    // the handler was invoked and returned — the lock may have declined to do
    // the work because another attempt holds it. That case is deliberate and
    // must not be retried. The case that MUST be retried (Redis unreachable →
    // the job ran nowhere) throws out of the lock in http mode, so it never
    // reaches here. See cron-lock.util.ts.
    return { name, dispatched: true, durationMs: Date.now() - startedAt };
  }
}
