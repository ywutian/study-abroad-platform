import { Test, TestingModule } from '@nestjs/testing';
import { MessageFilterService } from './message-filter.service';
import { RedisService } from '../../common/redis/redis.service';

describe('MessageFilterService', () => {
  let service: MessageFilterService;

  const mockRedis = {
    connected: true,
    incr: jest.fn(),
    expire: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageFilterService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<MessageFilterService>(MessageFilterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('filterContent', () => {
    it('should return clean=true for normal content', () => {
      const result = service.filterContent('Hello, I need help with my essay');

      expect(result.clean).toBe(true);
      expect(result.filtered).toBe('Hello, I need help with my essay');
    });

    it('should replace English sensitive words with ***', () => {
      const result = service.filterContent('This is shit and fuck you');

      expect(result.clean).toBe(false);
      expect(result.filtered).toContain('***');
      expect(result.filtered).not.toContain('shit');
      expect(result.filtered).not.toContain('fuck');
    });

    it('should replace Chinese sensitive words with ***', () => {
      const result = service.filterContent('你是傻逼吗');

      expect(result.clean).toBe(false);
      expect(result.filtered).toContain('***');
      expect(result.filtered).not.toContain('傻逼');
    });

    it('should replace scam-related words', () => {
      const result = service.filterContent('我们可以代写文书，包过名校');

      expect(result.clean).toBe(false);
      expect(result.filtered).not.toContain('代写');
      expect(result.filtered).not.toContain('包过');
    });

    it('should be case-insensitive for English words', () => {
      const result = service.filterContent('FUCK this SHIT');

      expect(result.clean).toBe(false);
      expect(result.filtered).not.toMatch(/fuck/i);
      expect(result.filtered).not.toMatch(/shit/i);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow messages under rate limit', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const result = await service.checkRateLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should set expiry on first message', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await service.checkRateLimit('user-1');

      expect(mockRedis.expire).toHaveBeenCalledWith('chat:rate:user-1', 60);
    });

    it('should reject messages exceeding rate limit (30/min)', async () => {
      mockRedis.incr.mockResolvedValue(31);

      const result = await service.checkRateLimit('user-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should allow all messages when Redis is disconnected', async () => {
      mockRedis.connected = false;

      const result = await service.checkRateLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(mockRedis.incr).not.toHaveBeenCalled();

      // Restore for other tests
      mockRedis.connected = true;
    });
  });

  describe('checkRepeat', () => {
    it('should allow first instance of a message', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const result = await service.checkRepeat('user-1', 'Hello world');

      expect(result.allowed).toBe(true);
    });

    it('should reject message sent more than 3 times in 5 minutes', async () => {
      mockRedis.incr.mockResolvedValue(4);

      const result = await service.checkRepeat('user-1', 'spam message');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('REPEATED_CONTENT');
    });

    it('should allow all messages when Redis is disconnected', async () => {
      mockRedis.connected = false;

      const result = await service.checkRepeat('user-1', 'Hello');

      expect(result.allowed).toBe(true);
      expect(mockRedis.incr).not.toHaveBeenCalled();

      mockRedis.connected = true;
    });
  });

  describe('validate', () => {
    it('should pass validation for clean, non-repeated, rate-limited content', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const result = await service.validate('user-1', 'Normal message');

      expect(result.allowed).toBe(true);
      expect(result.filtered).toBe('Normal message');
    });

    it('should block when rate limit is exceeded', async () => {
      // Rate limit check comes first, returns 31
      mockRedis.incr.mockResolvedValueOnce(31);

      const result = await service.validate('user-1', 'Any message');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should block when repeat limit is exceeded', async () => {
      // Rate limit passes (count = 5)
      mockRedis.incr.mockResolvedValueOnce(5);
      // Repeat check fails (count = 4)
      mockRedis.incr.mockResolvedValueOnce(4);

      const result = await service.validate('user-1', 'repeated message');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('REPEATED_CONTENT');
    });

    it('should filter sensitive words but still allow the message', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const result = await service.validate('user-1', 'This is shit advice');

      expect(result.allowed).toBe(true);
      expect(result.filtered).not.toContain('shit');
      expect(result.filtered).toContain('***');
    });
  });
});
