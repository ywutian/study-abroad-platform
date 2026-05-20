import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../common/redis/redis.service';
import {
  DAILY_SYSTEM_CENT_CAP,
  DAILY_USER_TURN_CAP,
  DebateBudgetService,
} from './debate-budget.service';

/**
 * Validates the daily-budget invariants without touching a real Redis.
 * We drive `RedisService.incr` returning a counter the test controls so
 * we can step it past the cap and assert the right failure shape.
 */
describe('DebateBudgetService', () => {
  let service: DebateBudgetService;
  let counter: number;

  const mockRedis = {
    incr: jest.fn(),
    expire: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
  };

  beforeEach(async () => {
    counter = 0;
    mockRedis.incr.mockImplementation(async () => ++counter);
    mockRedis.get.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebateBudgetService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(DebateBudgetService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns ok with decreasing remaining for the first few user turns', async () => {
    const r1 = await service.incrementUserTurn('u');
    expect(r1).toEqual({ ok: true, remaining: DAILY_USER_TURN_CAP - 1 });
    // First INCR triggers an EXPIRE.
    expect(mockRedis.expire).toHaveBeenCalledTimes(1);
    const r2 = await service.incrementUserTurn('u');
    expect(r2).toEqual({ ok: true, remaining: DAILY_USER_TURN_CAP - 2 });
    // Second INCR must NOT extend the TTL.
    expect(mockRedis.expire).toHaveBeenCalledTimes(1);
  });

  it('flips to user_daily_cap once the user exceeds DAILY_USER_TURN_CAP', async () => {
    counter = DAILY_USER_TURN_CAP; // next incr returns CAP+1
    const result = await service.incrementUserTurn('u');
    expect(result).toEqual({
      ok: false,
      reason: 'user_daily_cap',
      remaining: 0,
    });
  });

  it('flips to system_daily_cap when global cents pass DAILY_SYSTEM_CENT_CAP', async () => {
    counter = DAILY_SYSTEM_CENT_CAP; // next incr returns CAP+1
    const result = await service.incrementGlobalSpend(1);
    expect(result).toEqual({
      ok: false,
      reason: 'system_daily_cap',
      remaining: 0,
    });
  });

  it('estCents floors to a minimum of 1 cent', async () => {
    const ok = await service.incrementGlobalSpend(0);
    expect(ok.ok).toBe(true);
    // INCR was called once even though caller asked for 0 cents.
    expect(mockRedis.incr).toHaveBeenCalledTimes(1);
  });
});
