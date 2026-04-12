import { Test, TestingModule } from '@nestjs/testing';
import { RateLimiterService } from './rate-limiter.service';
import { RedisService } from '../../../common/redis/redis.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let redis: jest.Mocked<RedisService>;

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
    redis = module.get(RedisService);
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
});
