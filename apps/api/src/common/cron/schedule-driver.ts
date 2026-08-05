import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * The single ScheduleModule root for the whole app.
 *
 * WHY THIS EXISTS — `@Cron` timers fire inside whatever container they live in,
 * and production runs Cloud Run with `--cpu-throttling` + `min-instances=0`: an
 * idle instance has effectively NO CPU until a request wakes it. A timer on
 * such an instance starves, its 1s Redis command deadline elapses while the
 * event loop is frozen, the circuit breaker opens, and every single-flight
 * cron inside the 30s window silently skips. That chain tripped the breaker
 * 60-85×/day for a month and kept AccountPurgeService from ever completing a
 * run (#553). The root fix is to never rely on background CPU in prod:
 *
 * - `CRON_DRIVER=timer` (default — dev, tests, docker): `@Cron` registers
 *   normally and fires in-process. Unchanged behavior.
 * - `CRON_DRIVER=http` (production): NO cron job is registered at all
 *   (`cronJobs: false` is @nestjs/schedule's own registration gate). Cloud
 *   Scheduler calls `POST /internal/cron/:name/run` instead — CPU is
 *   guaranteed during a request, and one scheduler firing one request is
 *   single-flight by construction. See `InternalCronController`.
 *
 * `SCHEDULERS_ENABLED=false` is the kill switch. It used to be consulted by
 * exactly one scheduler (application-analysis-experiment) and silently ignored
 * by the other 29 — now it gates registration itself, so it kills every timer.
 *
 * All three historical `ScheduleModule.forRoot()` call sites import THIS
 * object. It must stay a single shared instance: NestJS dedupes dynamic
 * modules by object identity, so three separate `forRoot()` calls would be
 * fine today but three separately-configured ones could drift apart.
 */
export const SCHEDULE_MODULE_ROOT = ScheduleModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    cronJobs:
      config.get<string>('CRON_DRIVER') !== 'http' &&
      config.get<string>('SCHEDULERS_ENABLED') !== 'false',
  }),
});
