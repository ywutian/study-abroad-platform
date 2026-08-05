import { Injectable, NotFoundException } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Cron } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { CronRegistryService } from './cron-registry.service';

/**
 * Uses the REAL `@Cron` decorator on purpose: the registry restates
 * @nestjs/schedule's internal metadata key as a string constant, and this spec
 * is the tripwire that goes red if a package upgrade ever renames it. If these
 * tests start reporting zero discovered jobs, that is the failure mode — do
 * not "fix" them by mocking the decorator.
 */
@Injectable()
class FakeScheduler {
  runs = 0;

  @Cron('0 3 * * *')
  async nightlyCleanup(): Promise<void> {
    this.runs++;
  }

  @Cron('0 08 * * *', { name: 'explicitly-named', timeZone: 'Asia/Shanghai' })
  async morningReminder(): Promise<void> {}

  @Cron('0 4 * * *')
  async failingJob(): Promise<void> {
    throw new Error('boom');
  }
}

@Injectable()
class PlainService {
  notACron(): void {}
}

async function buildRegistry(providers: unknown[]) {
  const moduleRef = await Test.createTestingModule({
    imports: [DiscoveryModule],
    providers: [CronRegistryService, ...(providers as never[])],
  }).compile();
  await moduleRef.init();
  return {
    registry: moduleRef.get(CronRegistryService),
    moduleRef,
  };
}

describe('CronRegistryService', () => {
  it('discovers @Cron methods with derived and explicit names', async () => {
    const { registry } = await buildRegistry([FakeScheduler, PlainService]);
    const jobs = registry.list();
    const names = jobs.map((job) => job.name).sort();
    expect(names).toEqual([
      'explicitly-named',
      'fake-scheduler-failing-job',
      'fake-scheduler-nightly-cleanup',
    ]);

    const named = jobs.find((job) => job.name === 'explicitly-named');
    expect(named).toMatchObject({
      cronExpression: '0 08 * * *',
      timeZone: 'Asia/Shanghai',
      className: 'FakeScheduler',
      methodName: 'morningReminder',
    });

    const derived = jobs.find(
      (job) => job.name === 'fake-scheduler-nightly-cleanup',
    );
    expect(derived).toMatchObject({ cronExpression: '0 3 * * *' });
    expect(derived).not.toHaveProperty('run');
  });

  it('run() awaits the underlying method on the real instance', async () => {
    const { registry, moduleRef } = await buildRegistry([FakeScheduler]);
    const scheduler = moduleRef.get(FakeScheduler);
    expect(scheduler.runs).toBe(0);
    await registry.run('fake-scheduler-nightly-cleanup');
    expect(scheduler.runs).toBe(1);
  });

  it('run() propagates job errors (so the HTTP driver can 5xx and Cloud Scheduler retries)', async () => {
    const { registry } = await buildRegistry([FakeScheduler]);
    await expect(registry.run('fake-scheduler-failing-job')).rejects.toThrow(
      'boom',
    );
  });

  it('run() throws NotFound for unknown names', async () => {
    const { registry } = await buildRegistry([FakeScheduler]);
    await expect(registry.run('nope')).rejects.toThrow(NotFoundException);
  });

  it('rejects duplicate job names at boot', async () => {
    @Injectable()
    class DuplicateA {
      @Cron('0 1 * * *', { name: 'same-name' })
      async a(): Promise<void> {}
    }
    @Injectable()
    class DuplicateB {
      @Cron('0 2 * * *', { name: 'same-name' })
      async b(): Promise<void> {}
    }
    await expect(buildRegistry([DuplicateA, DuplicateB])).rejects.toThrow(
      /Duplicate cron job name "same-name"/,
    );
  });
});
