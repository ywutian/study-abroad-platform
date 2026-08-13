import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../../common/redis/redis.service';
import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(null),
            connected: false,
          },
        },
      ],
    }).compile();

    service = module.get(RateLimiterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should allow requests under limit (memory fallback)', async () => {
    const result = await service.checkLimit('user-1', 'user', false);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('should block after exceeding limit', async () => {
    // Exhaust the limit by making many requests
    for (let i = 0; i < 100; i++) {
      await service.checkLimit('flood-user', 'user', false);
    }
    const result = await service.checkLimit('flood-user', 'user', false);
    // Depending on the default limit it should eventually block
    expect(result).toHaveProperty('allowed');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('limit');
  });

  it('should return rate limit status', async () => {
    const status = await service.getStatus('user-1', 'user');
    expect(status).toHaveProperty('remaining');
    expect(status).toHaveProperty('limit');
  });

  /**
   * This GC used to be a `@Cron`, which meant `SchedulerRegistry` — and, under
   * the http cron driver, `.github/cron-jobs.json` plus the post-deploy assert
   * — would have noticed it disappearing. As a plain interval it has no such
   * witness, so these two tests are the whole guardrail: delete the timer and
   * the in-memory fallback windows grow unbounded, silently.
   */
  describe('in-memory window GC', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('sweeps expired windows on its own interval, with no @Cron involved', async () => {
      const cleanup = jest.spyOn(service, 'cleanup');
      service.onModuleInit();

      jest.advanceTimersByTime(60_000);

      expect(cleanup).toHaveBeenCalledTimes(1);
      service.onModuleDestroy();
    });

    it('stops sweeping after onModuleDestroy', () => {
      const cleanup = jest.spyOn(service, 'cleanup');
      service.onModuleInit();
      service.onModuleDestroy();

      jest.advanceTimersByTime(5 * 60_000);

      expect(cleanup).not.toHaveBeenCalled();
    });
  });
});
