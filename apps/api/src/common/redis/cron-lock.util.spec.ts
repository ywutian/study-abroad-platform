import { Logger } from '@nestjs/common';
import { runWithCronLock } from './cron-lock.util';
import type { RedisService } from './redis.service';

describe('runWithCronLock', () => {
  const makeRedis = (acquired: boolean) =>
    makeRedisLock(
      acquired ? { acquired: true } : { acquired: false, reason: 'held' },
    );

  const makeRedisLock = (
    result:
      { acquired: true } | { acquired: false; reason: 'held' | 'unavailable' },
  ) =>
    ({ tryAcquireLock: jest.fn().mockResolvedValue(result) }) as unknown as
      RedisService | undefined;

  it('runs the job and returns true when the lock is acquired', async () => {
    const redis = makeRedis(true);
    const job = jest.fn().mockResolvedValue(undefined);

    const ran = await runWithCronLock(redis, 'k', 600, job);

    expect(ran).toBe(true);
    expect(job).toHaveBeenCalledTimes(1);
    expect((redis as RedisService).tryAcquireLock).toHaveBeenCalledWith(
      'k',
      '1',
      600,
    );
  });

  it('skips the job and returns false when the lock is held / Redis down', async () => {
    const redis = makeRedis(false);
    const job = jest.fn().mockResolvedValue(undefined);

    const ran = await runWithCronLock(redis, 'k', 600, job);

    expect(ran).toBe(false);
    expect(job).not.toHaveBeenCalled();
  });

  /**
   * The whole point of the change: "another replica has it" and "Redis is
   * unreachable" both skip, but they are not the same event and must not read
   * the same in the logs. Prod carried a month of the merged message while the
   * circuit breaker opened 60-85 times a day — every line looked like healthy
   * contention, and AccountPurgeService had never completed a single run.
   */
  describe('tells contention apart from an outage', () => {
    const capture = () => {
      const log = jest.fn();
      const warn = jest.fn();
      return { logger: { log, warn } as unknown as Logger, log, warn };
    };

    it('logs a held lock at LOG, and says another replica is running it', async () => {
      const { logger, log, warn } = capture();

      const ran = await runWithCronLock(
        makeRedisLock({ acquired: false, reason: 'held' }),
        'k',
        600,
        jest.fn(),
        logger,
      );

      expect(ran).toBe(false);
      expect(warn).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('another replica'),
      );
    });

    it('logs an unreachable Redis at WARN, and says the job ran nowhere', async () => {
      const { logger, log, warn } = capture();

      const ran = await runWithCronLock(
        makeRedisLock({ acquired: false, reason: 'unavailable' }),
        'k',
        600,
        jest.fn(),
        logger,
      );

      expect(ran).toBe(false);
      expect(log).not.toHaveBeenCalled();
      const [message] = warn.mock.calls[0] as [string];
      expect(message).toContain('NOT RUN');
      expect(message).toContain('No replica executed');
    });

    it('warns even with no logger passed — an outage must not be silent', async () => {
      const spy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await runWithCronLock(
        makeRedisLock({ acquired: false, reason: 'unavailable' }),
        'k',
        600,
        jest.fn(),
      );

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('NOT RUN'));
      spy.mockRestore();
    });
  });

  /**
   * Under the http driver the only caller is one Cloud Scheduler request, so a
   * quiet `false` would be recorded as a successful run of a job that ran
   * nowhere — the failure shape this driver exists to remove. Contention is
   * different: another attempt IS doing the work, and retrying it would be
   * wrong.
   */
  describe('under CRON_DRIVER=http', () => {
    const saved = process.env.CRON_DRIVER;
    beforeEach(() => {
      process.env.CRON_DRIVER = 'http';
    });
    afterEach(() => {
      if (saved === undefined) delete process.env.CRON_DRIVER;
      else process.env.CRON_DRIVER = saved;
    });

    it('throws when Redis is unreachable, so Cloud Scheduler records a failure and retries', async () => {
      const redis = makeRedisLock({ acquired: false, reason: 'unavailable' });
      const job = jest.fn().mockResolvedValue(undefined);

      await expect(runWithCronLock(redis, 'k', 600, job)).rejects.toThrow(
        /did not run: Redis was unreachable/,
      );
      expect(job).not.toHaveBeenCalled();
    });

    it('stays quiet when the lock is merely held — that attempt is being run, retrying it would duplicate work', async () => {
      const redis = makeRedisLock({ acquired: false, reason: 'held' });
      const job = jest.fn().mockResolvedValue(undefined);

      await expect(runWithCronLock(redis, 'k', 600, job)).resolves.toBe(false);
      expect(job).not.toHaveBeenCalled();
    });

    it('rethrows a failed job so the HTTP dispatcher returns 5xx', async () => {
      const redis = {
        tryAcquireLock: jest.fn().mockResolvedValue({ acquired: true }),
        del: jest.fn().mockResolvedValue(1),
      } as unknown as RedisService;
      const job = jest.fn().mockRejectedValue(new Error('boom'));

      await expect(runWithCronLock(redis, 'k', 600, job)).rejects.toThrow(
        'boom',
      );
      expect(redis.del).toHaveBeenCalledWith('k');
    });
  });

  it('does NOT throw on an unreachable Redis in timer mode — @Cron is fire-and-forget, a rejection would be an unhandledRejection', async () => {
    const redis = makeRedisLock({ acquired: false, reason: 'unavailable' });

    await expect(runWithCronLock(redis, 'k', 600, jest.fn())).resolves.toBe(
      false,
    );
  });

  it('runs unguarded when redis is undefined (single-instance / dev)', async () => {
    const job = jest.fn().mockResolvedValue(undefined);

    const ran = await runWithCronLock(undefined, 'k', 600, job);

    expect(ran).toBe(true);
    expect(job).toHaveBeenCalledTimes(1);
  });

  // `@Cron` handlers are fire-and-forget — nothing awaits them, so a rejection
  // escaping this helper becomes an unhandledRejection rather than a logged
  // error, and Node's default kills the process. Assert the resolution, not
  // just the log: `expect(logger.error).toHaveBeenCalled()` still passes if the
  // promise rejects afterwards.
  describe('when the job throws', () => {
    const makeLogger = () =>
      ({ log: jest.fn(), error: jest.fn() }) as unknown as Logger;

    it('resolves instead of rejecting, and reports it ran', async () => {
      const redis = makeRedis(true);
      const logger = makeLogger();
      const job = jest.fn().mockRejectedValue(new Error('boom'));

      await expect(runWithCronLock(redis, 'k', 600, job, logger)).resolves.toBe(
        true,
      );
    });

    it('logs the failure with the lock key and the stack', async () => {
      const logger = makeLogger();
      const err = new Error('boom');

      const failing = () => Promise.reject(err);
      await runWithCronLock(
        makeRedis(true),
        'weekly-refresh',
        600,
        failing,
        logger,
      );

      expect(logger.error).toHaveBeenCalledTimes(1);
      const [message, stack] = (logger.error as jest.Mock).mock.calls[0];
      expect(message).toContain('weekly-refresh');
      expect(message).toContain('boom');
      expect(stack).toBe(err.stack);
    });

    it('does not release the lock, so other replicas cannot retry a failing job', async () => {
      const redis = makeRedis(true) as RedisService & {
        del?: jest.Mock;
        tryAcquireLock: jest.Mock;
      };

      const failing = () => Promise.reject(new Error('boom'));
      await runWithCronLock(redis, 'k', 600, failing, makeLogger());

      expect(redis.del).toBeUndefined();
      expect(redis.tryAcquireLock).toHaveBeenCalledTimes(1);
    });

    it('still logs when no logger is passed, rather than swallowing silently', async () => {
      const spy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      await expect(
        runWithCronLock(undefined, 'k', 600, () =>
          Promise.reject(new Error('boom')),
        ),
      ).resolves.toBe(true);

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });
});
