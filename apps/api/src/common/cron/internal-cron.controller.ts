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
  ) {}

  @Get()
  list() {
    return { jobs: this.registry.list() };
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
    return { name, ran: true, durationMs: Date.now() - startedAt };
  }
}
