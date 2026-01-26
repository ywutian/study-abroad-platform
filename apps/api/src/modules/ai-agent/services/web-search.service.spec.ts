import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebSearchService, SearchResponse } from './web-search.service';
import { RedisService } from '../../../common/redis/redis.service';
import { ResilienceService } from '../core/resilience.service';

// ==================== Mock fetch ====================

const originalFetch = global.fetch;

function mockFetchResponse(body: any, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

// ==================== Test Suite ====================

describe('WebSearchService', () => {
  let service: WebSearchService;
  let configService: ConfigService;
  let redisService: Partial<RedisService>;
  let resilienceService: Partial<ResilienceService>;
  let fetchMock: jest.Mock;

  // 默认配置：双引擎启用
  const defaultConfig: Record<string, string> = {
    GOOGLE_SEARCH_API_KEY: 'test-google-key',
    GOOGLE_SEARCH_ENGINE_ID: 'test-cx',
    TAVILY_API_KEY: 'test-tavily-key',
  };

  beforeEach(async () => {
    // Mock fetch
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    // Mock Redis
    redisService = {
      connected: true,
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    // Mock Resilience - 直接执行传入的函数
    resilienceService = {
      execute: jest.fn().mockImplementation((_name, fn) => fn()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSearchService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => defaultConfig[key]),
          },
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: ResilienceService,
          useValue: resilienceService,
        },
      ],
    }).compile();

    service = module.get<WebSearchService>(WebSearchService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ==================== 基础测试 ====================

  describe('初始化', () => {
    it('双引擎都启用时应报告可用', () => {
      expect(service.isAvailable()).toBe(true);
      expect(service.getAvailableEngines()).toEqual(['google', 'tavily']);
    });

    it('仅 Google 启用时应报告可用', async () => {
      const module = await Test.createTestingModule({
        providers: [
          WebSearchService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'GOOGLE_SEARCH_API_KEY') return 'test-key';
                if (key === 'GOOGLE_SEARCH_ENGINE_ID') return 'test-cx';
                return undefined;
              }),
            },
          },
          { provide: RedisService, useValue: redisService },
          { provide: ResilienceService, useValue: resilienceService },
        ],
      }).compile();

      const svc = module.get<WebSearchService>(WebSearchService);
      expect(svc.isAvailable()).toBe(true);
      expect(svc.getAvailableEngines()).toEqual(['google']);
    });

    it('仅 Tavily 启用时应报告可用', async () => {
      const module = await Test.createTestingModule({
        providers: [
          WebSearchService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'TAVILY_API_KEY') return 'test-key';
                return undefined;
              }),
            },
          },
          { provide: RedisService, useValue: redisService },
          { provide: ResilienceService, useValue: resilienceService },
        ],
      }).compile();

      const svc = module.get<WebSearchService>(WebSearchService);
      expect(svc.isAvailable()).toBe(true);
      expect(svc.getAvailableEngines()).toEqual(['tavily']);
    });

    it('无 API Key 时应报告不可用', async () => {
      const module = await Test.createTestingModule({
        providers: [
          WebSearchService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn(() => undefined) },
          },
          { provide: RedisService, useValue: redisService },
          { provide: ResilienceService, useValue: resilienceService },
        ],
      }).compile();

      const svc = module.get<WebSearchService>(WebSearchService);
      expect(svc.isAvailable()).toBe(false);
      expect(svc.getAvailableEngines()).toEqual([]);
    });
  });

  // ==================== 通用搜索测试 ====================

  describe('search() - 通用搜索', () => {
    it('应调用 Tavily API 并返回统一格式（主引擎）', async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          results: [
            {
              title: 'MIT Admissions',
              content: 'Apply to MIT...',
              url: 'https://admissions.mit.edu',
            },
            {
              title: 'MIT Requirements',
              content: 'SAT scores...',
              url: 'https://admissions.mit.edu/requirements',
            },
          ],
        }),
      );

      const result = await service.search('MIT admissions');

      expect(result.source).toBe('tavily');
      expect(result.cached).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe('MIT Admissions');
      expect(result.results[0].url).toBe('https://admissions.mit.edu');
    });

    it('Tavily 不可用时应降级到 Google', async () => {
      // Tavily 失败
      fetchMock.mockRejectedValueOnce(new Error('Tavily API timeout'));

      // Google 成功
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          items: [
            {
              title: 'MIT Info',
              snippet: 'Some content about MIT...',
              link: 'https://example.com/mit',
            },
          ],
        }),
      );

      const result = await service.search('MIT admissions');

      expect(result.source).toBe('google');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('MIT Info');
    });

    it('双引擎都失败时应返回空结果', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Tavily failed'));
      fetchMock.mockRejectedValueOnce(new Error('Google failed'));

      const result = await service.search('test query');

      expect(result.results).toHaveLength(0);
    });

    it('应支持 news topic', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ results: [] }));

      await service.search('US visa policy', { topic: 'news' });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody.topic).toBe('news');
    });
  });

  // ==================== 学校官网搜索测试 ====================

  describe('searchSchoolWebsite() - 学校官网搜索', () => {
    it('应调用 Tavily API 并使用 advanced 深度搜索', async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          results: [
            {
              title: 'MIT Deadlines',
              content: 'Early Action: November 1...',
              url: 'https://mitadmissions.org/apply/deadlines',
            },
          ],
        }),
      );

      const result = await service.searchSchoolWebsite(
        'MIT',
        'application deadline',
      );

      expect(result.source).toBe('tavily');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].content).toContain('Early Action');

      // 验证请求体包含 advanced 深度和域名限定
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody.search_depth).toBe('advanced');
      expect(requestBody.include_domains).toEqual(['mit.edu']);
    });

    it('Tavily 不可用时应降级到 Google site: 搜索', async () => {
      // Tavily 失败
      fetchMock.mockRejectedValueOnce(new Error('Tavily down'));

      // Google 成功
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          items: [
            {
              title: 'Stanford Deadlines',
              snippet: 'REA deadline...',
              link: 'https://stanford.edu/deadlines',
            },
          ],
        }),
      );

      const result = await service.searchSchoolWebsite('Stanford', 'deadline');

      expect(result.source).toBe('google');
      expect(result.results).toHaveLength(1);

      // 验证 Google 请求包含 siteSearch
      const calledUrl = fetchMock.mock.calls[1][0] as string;
      expect(calledUrl).toContain('siteSearch=stanford.edu');
    });
  });

  // ==================== 缓存测试 ====================

  describe('缓存', () => {
    it('Redis 缓存命中时应直接返回且不调用 API', async () => {
      const cachedResponse: SearchResponse = {
        results: [
          { title: 'Cached', snippet: 'From cache', url: 'https://cached.com' },
        ],
        source: 'google',
        query: 'test',
        cached: false,
      };

      (redisService.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(cachedResponse),
      );

      const result = await service.search('test');

      expect(result.cached).toBe(true);
      expect(result.source).toBe('cache');
      expect(result.results[0].title).toBe('Cached');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('搜索成功后应写入 Redis 缓存', async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          results: [
            { title: 'Result', content: 'test', url: 'https://test.com' },
          ],
        }),
      );

      await service.search('test');

      expect(redisService.set).toHaveBeenCalled();
      const [key, value, ttl] = (redisService.set as jest.Mock).mock.calls[0];
      expect(key).toMatch(/^search:/);
      expect(ttl).toBe(6 * 3600); // 通用搜索 6 小时 TTL
    });

    it('学校搜索应使用 24 小时 TTL', async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          results: [{ title: 'MIT', content: 'test', url: 'https://mit.edu' }],
        }),
      );

      await service.searchSchoolWebsite('MIT', 'deadline');

      expect(redisService.set).toHaveBeenCalled();
      const [, , ttl] = (redisService.set as jest.Mock).mock.calls[0];
      expect(ttl).toBe(24 * 3600);
    });

    it('news topic 应使用 2 小时 TTL', async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          results: [
            { title: 'News', content: 'test', url: 'https://test.com' },
          ],
        }),
      );

      await service.search('visa news', { topic: 'news' });

      const [, , ttl] = (redisService.set as jest.Mock).mock.calls[0];
      expect(ttl).toBe(2 * 3600);
    });

    it('Redis 不可用时应降级到内存缓存', async () => {
      // 设置 Redis 不可用
      Object.defineProperty(redisService, 'connected', { value: false });

      fetchMock.mockResolvedValue(
        mockFetchResponse({
          results: [
            { title: 'Result', content: 'test', url: 'https://test.com' },
          ],
        }),
      );

      // 第一次调用应该命中 API
      await service.search('memory cache test');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // 第二次调用应该命中内存缓存
      const result2 = await service.search('memory cache test');
      expect(result2.cached).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1); // 不再调用
    });
  });

  // ==================== 学校域名映射测试 ====================

  describe('resolveSchoolDomain() - 学校域名映射', () => {
    it('MIT → mit.edu', () => {
      expect(service.resolveSchoolDomain('MIT')).toBe('mit.edu');
    });

    it('Stanford → stanford.edu', () => {
      expect(service.resolveSchoolDomain('Stanford')).toBe('stanford.edu');
    });

    it('Harvard → harvard.edu', () => {
      expect(service.resolveSchoolDomain('Harvard')).toBe('harvard.edu');
    });

    it('Carnegie Mellon → cmu.edu', () => {
      expect(service.resolveSchoolDomain('Carnegie Mellon')).toBe('cmu.edu');
    });

    it('UC Berkeley → berkeley.edu', () => {
      expect(service.resolveSchoolDomain('berkeley')).toBe('berkeley.edu');
    });

    it('University of Michigan → umich.edu', () => {
      expect(service.resolveSchoolDomain('umich')).toBe('umich.edu');
    });

    it('未知学校应尝试推断', () => {
      expect(service.resolveSchoolDomain('University of Miami')).toBe(
        'miami.edu',
      );
    });

    it('完全未知的学校返回 null', () => {
      expect(service.resolveSchoolDomain('Some Random School')).toBeNull();
    });
  });

  // ==================== 不可用时的行为测试 ====================

  describe('引擎不可用', () => {
    it('无引擎可用时 search() 返回空结果', async () => {
      const module = await Test.createTestingModule({
        providers: [
          WebSearchService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn(() => undefined) },
          },
          { provide: RedisService, useValue: redisService },
          { provide: ResilienceService, useValue: resilienceService },
        ],
      }).compile();

      const svc = module.get<WebSearchService>(WebSearchService);
      const result = await svc.search('test');

      expect(result.results).toHaveLength(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('无引擎可用时 searchSchoolWebsite() 返回空结果', async () => {
      const module = await Test.createTestingModule({
        providers: [
          WebSearchService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn(() => undefined) },
          },
          { provide: RedisService, useValue: redisService },
          { provide: ResilienceService, useValue: resilienceService },
        ],
      }).compile();

      const svc = module.get<WebSearchService>(WebSearchService);
      const result = await svc.searchSchoolWebsite('MIT', 'deadline');

      expect(result.results).toHaveLength(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ==================== 弹性保护测试 ====================

  describe('弹性保护', () => {
    it('应通过 ResilienceService 执行搜索', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ results: [] }));

      await service.search('test');

      expect(resilienceService.execute).toHaveBeenCalledWith(
        'tavily-search',
        expect.any(Function),
        expect.objectContaining({
          retry: expect.objectContaining({ maxAttempts: 2 }),
          timeoutMs: 10000,
        }),
      );
    });
  });

  // ==================== 统计测试 ====================

  describe('getStats()', () => {
    it('应返回正确的统计信息', () => {
      const stats = service.getStats();
      expect(stats.googleEnabled).toBe(true);
      expect(stats.tavilyEnabled).toBe(true);
      expect(stats.memoryCacheSize).toBe(0);
    });
  });
});
