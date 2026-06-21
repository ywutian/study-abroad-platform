import { runWithCronLock } from './cron-lock.util';
import type { RedisService } from './redis.service';

describe('runWithCronLock', () => {
  const makeRedis = (acquired: boolean) =>
    ({ setNXStrict: jest.fn().mockResolvedValue(acquired) }) as unknown as
      | RedisService
      | undefined;

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
});
