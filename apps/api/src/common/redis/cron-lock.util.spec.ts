import { Logger } from '@nestjs/common';
import { runWithCronLock } from './cron-lock.util';
import type { RedisService } from './redis.service';

describe('runWithCronLock', () => {
  const makeRedis = (acquired: boolean) =>
    ({ setNXStrict: jest.fn().mockResolvedValue(acquired) }) as unknown as
      RedisService | undefined;

  it('runs the job and returns true when the lock is acquired', async () => {
    const redis = makeRedis(true);
    const job = jest.fn().mockResolvedValue(undefined);

    const ran = await runWithCronLock(redis, 'k', 600, job);

    expect(ran).toBe(true);
    expect(job).toHaveBeenCalledTimes(1);
    expect((redis as RedisService).setNXStrict).toHaveBeenCalledWith(
      'k',
      '1',
      600,
    );
  });

  it('skips the job and returns false when the lock is held / Redis down', async () => {
    const redis = makeRedis(false); // setNXStrict false = held OR Redis unavailable
    const job = jest.fn().mockResolvedValue(undefined);

    const ran = await runWithCronLock(redis, 'k', 600, job);

    expect(ran).toBe(false);
    expect(job).not.toHaveBeenCalled();
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
        setNXStrict: jest.Mock;
      };

      const failing = () => Promise.reject(new Error('boom'));
      await runWithCronLock(redis, 'k', 600, failing, makeLogger());

      expect(redis.del).toBeUndefined();
      expect(redis.setNXStrict).toHaveBeenCalledTimes(1);
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
