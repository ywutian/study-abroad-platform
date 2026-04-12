import { Test, TestingModule } from '@nestjs/testing';
import { TokenTrackerService } from './token-tracker.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';

describe('TokenTrackerService', () => {
  let service: TokenTrackerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenTrackerService,
        {
          provide: PrismaService,
          useValue: {
            tokenUsage: {
              create: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 } }),
            },
            user: { findUnique: jest.fn() },
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(null),
            connected: false,
          },
        },
      ],
    }).compile();

    service = module.get(TokenTrackerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should count tokens for a string', () => {
    const count = service.countTokens('Hello, world!', 'gpt-4o-mini');
    expect(count).toBeGreaterThan(0);
    expect(typeof count).toBe('number');
  });

  it('should estimate tokens without tiktoken', () => {
    const estimate = service.estimateTokens('This is a test sentence.');
    expect(estimate).toBeGreaterThan(0);
  });

  it('should check user quota', async () => {
    const result = await service.checkQuota('user-1');
    expect(result).toHaveProperty('allowed');
    expect(result).toHaveProperty('usage');
    expect(result.usage).toHaveProperty('remaining');
  });
});
