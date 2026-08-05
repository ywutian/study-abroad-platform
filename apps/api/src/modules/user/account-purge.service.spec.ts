import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AccountPurgeService } from './account-purge.service';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CronRegistryService } from '../../common/cron/cron-registry.service';

describe('AccountPurgeService', () => {
  let service: AccountPurgeService;
  const findMany = jest.fn();
  const hardDelete = jest.fn();
  const setNXStrict = jest.fn();
  const tryAcquireLock = jest.fn();
  let env: Record<string, string | number>;

  const account = (id: string, payments = 0) => ({
    id,
    deletedAt: new Date('2026-01-01'),
    _count: { payments },
  });

  beforeEach(async () => {
    env = { ACCOUNT_PURGE_ENABLED: 'true', ACCOUNT_PURGE_GRACE_DAYS: 30 };
    findMany.mockReset().mockResolvedValue([]);
    hardDelete.mockReset().mockResolvedValue(undefined);
    setNXStrict.mockReset().mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountPurgeService,
        { provide: PrismaService, useValue: { user: { findMany } } },
        { provide: UserService, useValue: { hardDelete } },
        { provide: RedisService, useValue: { setNXStrict, tryAcquireLock } },
        {
          provide: ConfigService,
          useValue: { get: (k: string) => env[k] },
        },
      ],
    }).compile();

    service = module.get(AccountPurgeService);
  });

  it('only considers accounts whose grace window has closed', async () => {
    await service.purgeExpired();

    const where = findMany.mock.calls[0][0].where;
    expect(where.deletedAt.not).toBeNull();
    // A live account (deletedAt null) must never match, and one deleted
    // yesterday must not either — the cutoff is graceDays in the past.
    const cutoff: Date = where.deletedAt.lt;
    const daysAgo = (Date.now() - cutoff.getTime()) / 86_400_000;
    expect(daysAgo).toBeGreaterThan(29.9);
    expect(daysAgo).toBeLessThan(30.1);
  });

  it('refuses to purge an account holding payment records', async () => {
    findMany.mockResolvedValue([account('u-1'), account('u-pay', 3)]);

    const r = await service.purgeExpired();

    expect(hardDelete).toHaveBeenCalledTimes(1);
    expect(hardDelete).toHaveBeenCalledWith('u-1');
    expect(hardDelete).not.toHaveBeenCalledWith('u-pay');
    expect(r).toMatchObject({ purged: 1, retained: 1 });
  });

  it('deletes nothing while disabled, but reports what it would do', async () => {
    env.ACCOUNT_PURGE_ENABLED = 'false';
    findMany.mockResolvedValue([
      account('u-1'),
      account('u-2'),
      account('u-pay', 1),
    ]);

    const r = await service.purgeExpired();

    expect(hardDelete).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      dryRun: true,
      eligible: 3,
      purged: 0,
      retained: 1,
    });
  });

  it('keeps going when one account fails to purge', async () => {
    findMany.mockResolvedValue([
      account('u-1'),
      account('u-bad'),
      account('u-3'),
    ]);
    hardDelete.mockImplementation((id: string) =>
      id === 'u-bad'
        ? Promise.reject(new Error('fk violation'))
        : Promise.resolve(),
    );

    const r = await service.purgeExpired();

    expect(r).toMatchObject({ purged: 2, failed: 1 });
    expect(hardDelete).toHaveBeenCalledWith('u-3');
  });

  it('skips the run when another replica holds the lock', async () => {
    setNXStrict.mockResolvedValue(false);
    tryAcquireLock.mockResolvedValue({ acquired: false, reason: 'held' });
    findMany.mockResolvedValue([account('u-1')]);

    await service.scheduledPurge();

    // Hard deletion is irreversible and not idempotent across replicas — a
    // lost lock must mean no work, not duplicated work.
    expect(findMany).not.toHaveBeenCalled();
    expect(hardDelete).not.toHaveBeenCalled();
  });

  it('is actually dispatchable on the path production uses', async () => {
    // The defect this whole service exists to close was a deletion promise
    // with no job behind it. A @Cron that is never discovered would recreate
    // it exactly — silently, and only in production. Assert the wiring.
    //
    // Production no longer runs in-process timers (CRON_DRIVER=http): what
    // makes this job run is CronRegistryService discovering it and Cloud
    // Scheduler POSTing its name. So assert THAT, not SchedulerRegistry —
    // a timer-registration test would now pass while prod never fires.
    const module = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        CronRegistryService,
        AccountPurgeService,
        { provide: PrismaService, useValue: { user: { findMany } } },
        { provide: UserService, useValue: { hardDelete } },
        { provide: RedisService, useValue: { setNXStrict, tryAcquireLock } },
        { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
      ],
    }).compile();
    await module.init();

    const names = module
      .get(CronRegistryService)
      .list()
      .map((job) => job.name);
    expect(names).toContain('account-purge-service-scheduled-purge');

    // …and that name is what the deploy provisions a Cloud Scheduler job for.
    const manifest = JSON.parse(
      readFileSync(
        join(__dirname, '../../../../../.github/cron-jobs.json'),
        'utf8',
      ),
    ) as { jobs: Array<{ name: string }> };
    expect(manifest.jobs.map((job) => job.name)).toContain(
      'account-purge-service-scheduled-purge',
    );

    await module.close();
  });
});
