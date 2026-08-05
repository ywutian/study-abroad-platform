import { Injectable } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { SCHEDULE_MODULE_ROOT } from './schedule-driver';

/**
 * Pins the driver lever itself: SCHEDULE_MODULE_ROOT must register in-process
 * timers under CRON_DRIVER=timer (dev default) and register NONE under
 * CRON_DRIVER=http (production) or SCHEDULERS_ENABLED=false (kill switch).
 * Uses the real ScheduleModule + a real @Cron so this goes red if the
 * forRootAsync `cronJobs` option ever stops being honoured by an upgrade.
 */
@Injectable()
class TickingScheduler {
  @Cron('0 3 * * *', { name: 'driver-spec-job' })
  async tick(): Promise<void> {}
}

describe('SCHEDULE_MODULE_ROOT (cron driver gate)', () => {
  const ENV_KEYS = ['CRON_DRIVER', 'SCHEDULERS_ENABLED'] as const;
  const saved: Record<string, string | undefined> = {};
  let moduleRef: TestingModule | undefined;

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
  });

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  async function bootWith(env: Record<string, string>): Promise<number> {
    for (const key of ENV_KEYS) delete process.env[key];
    Object.assign(process.env, env);
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        SCHEDULE_MODULE_ROOT,
      ],
      providers: [TickingScheduler],
    }).compile();
    await moduleRef.init();
    return moduleRef.get(SchedulerRegistry).getCronJobs().size;
  }

  it('registers in-process timers by default (dev/tests: CRON_DRIVER=timer)', async () => {
    expect(await bootWith({})).toBe(1);
  });

  it('registers NO timers under CRON_DRIVER=http (production — Cloud Scheduler drives)', async () => {
    expect(await bootWith({ CRON_DRIVER: 'http' })).toBe(0);
  });

  it('registers NO timers when the SCHEDULERS_ENABLED kill switch is off', async () => {
    expect(await bootWith({ SCHEDULERS_ENABLED: 'false' })).toBe(0);
  });
});
