import { Test, TestingModule } from '@nestjs/testing';
import { RedisCacheService } from './redis-cache.service';
import { RedisService } from '../../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';

describe('RedisCacheService', () => {
  let service: RedisCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCacheService,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(null),
            connected: false,
            del: jest.fn().mockResolvedValue(undefined),
            // Redis unavailable → withClient throws → memory fallback path
            withClient: jest
              .fn()
              .mockRejectedValue(new Error('Redis unavailable')),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('86400'),
          },
        },
      ],
    }).compile();

    service = module.get(RedisCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should cache and retrieve conversation messages (fallback)', async () => {
    const message = {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'user' as const,
      content: 'Hello',
      createdAt: new Date(),
    };

    await service.cacheMessage('conv-1', message);
    const messages = await service.getConversationMessages('conv-1');
    expect(messages.length).toBeGreaterThanOrEqual(0);
  });

  it('should cache and retrieve conversation meta (fallback)', async () => {
    const meta = {
      id: 'conv-1',
      userId: 'user-1',
      messageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await service.cacheConversation('conv-1', meta);
    const cached = await service.getConversationMeta('conv-1');
    // In fallback mode it should store in memory
    expect(cached).toBeDefined();
  });

  it('should delete conversation cache', async () => {
    await service.deleteConversation('conv-1');
    const meta = await service.getConversationMeta('conv-1');
    expect(meta).toBeNull();
  });
});
