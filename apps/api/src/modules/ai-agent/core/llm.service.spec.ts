/**
 * LLMService 单元测试
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LLMService, LLMOptions } from './llm.service';
import {
  ResilienceService,
  CircuitOpenError,
  TimeoutError,
} from './resilience.service';
import { TokenTrackerService } from './token-tracker.service';
import { Message } from '../types';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// 辅助函数：创建测试用 Message
function createMessage(
  partial: Partial<Message> & { role: Message['role']; content: string },
): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    ...partial,
  };
}

describe('LLMService', () => {
  let service: LLMService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockResilienceService: jest.Mocked<ResilienceService>;
  let mockTokenTracker: jest.Mocked<TokenTrackerService>;

  const mockOpenAIResponse = {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1677652288,
    model: 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you?',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };

  beforeEach(async () => {
    mockFetch.mockReset();

    mockConfigService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'OPENAI_API_KEY':
            return 'test-api-key';
          case 'OPENAI_BASE_URL':
            return 'https://api.openai.com/v1';
          case 'OPENAI_MODEL':
            return 'gpt-4o-mini';
          default:
            return undefined;
        }
      }),
    } as unknown as jest.Mocked<ConfigService>;

    mockResilienceService = {
      execute: jest.fn((_, fn) => fn()),
      getCircuitStatus: jest
        .fn()
        .mockResolvedValue({ state: 'CLOSED', isOpen: false }),
    } as unknown as jest.Mocked<ResilienceService>;

    mockTokenTracker = {
      parseUsageFromResponse: jest.fn().mockReturnValue({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        cost: 0.001,
        model: 'gpt-4o-mini',
      }),
      trackUsage: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TokenTrackerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ResilienceService, useValue: mockResilienceService },
        { provide: TokenTrackerService, useValue: mockTokenTracker },
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // === 基础调用测试 ===
  describe('call', () => {
    it('should call OpenAI with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      const messages: Message[] = [
        createMessage(createMessage({ role: 'user', content: 'Hello' })),
      ];
      await service.call('You are a helpful assistant', messages);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('should convert ChatMessage[] to OpenAI format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      const messages: Message[] = [
        createMessage(createMessage({ role: 'user', content: 'Hello' })),
        createMessage(
          createMessage({ role: 'assistant', content: 'Hi there!' }),
        ),
      ];

      await service.call('System prompt', messages);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0]).toEqual({
        role: 'system',
        content: 'System prompt',
      });
      // API 请求体只包含 role/content，不包含 id/timestamp
      expect(body.messages[1]).toMatchObject({
        role: 'user',
        content: 'Hello',
      });
      expect(body.messages[2]).toMatchObject({
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('should include tool definitions when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      const tools = [
        {
          name: 'search_schools',
          description: 'Search for schools',
          parameters: {
            type: 'object' as const,
            properties: {
              query: { type: 'string' as const },
            },
          },
        },
      ];

      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        { tools },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools).toBeDefined();
      expect(body.tool_choice).toBe('auto');
    });

    it('should return parsed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      const result = await service.call('System', [
        createMessage({ role: 'user', content: 'Hello' }),
      ]);

      expect(result.content).toBe('Hello! How can I help you?');
      expect(result.finishReason).toBe('stop');
    });

    it('should throw error when API key not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const newService = new LLMService(
        mockConfigService,
        mockResilienceService,
        mockTokenTracker,
      );

      await expect(
        newService.call('System', [
          createMessage({ role: 'user', content: 'Hello' }),
        ]),
      ).rejects.toThrow('OpenAI API key not configured');
    });
  });

  // === 弹性保护测试 ===
  describe('resilience integration', () => {
    it('should use resilience service when available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      await service.call('System', [
        createMessage({ role: 'user', content: 'Hello' }),
      ]);

      expect(mockResilienceService.execute).toHaveBeenCalledWith(
        'llm',
        expect.any(Function),
        expect.objectContaining({
          retry: expect.any(Object),
          circuit: expect.any(Object),
        }),
      );
    });

    it('should handle API error responses', async () => {
      mockResilienceService.execute.mockImplementationOnce((_, fn) => fn());
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(
        service.call('System', [
          createMessage({ role: 'user', content: 'Hello' }),
        ]),
      ).rejects.toThrow('LLM API error: 500');
    });
  });

  // === Token 追踪测试 ===
  describe('token tracking', () => {
    it('should record prompt tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        {
          userId: 'user-123',
        },
      );

      expect(mockTokenTracker.parseUsageFromResponse).toHaveBeenCalled();
    });

    it('should track by model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        {
          userId: 'user-123',
          model: 'gpt-4',
        },
      );

      expect(mockTokenTracker.trackUsage).toHaveBeenCalledWith(
        'user-123',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  // === 消息格式转换 ===
  describe('message conversion', () => {
    it('should convert user message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      await service.call('System', [
        createMessage({ role: 'user', content: 'Hello' }),
      ]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // API 请求体只包含 role/content
      expect(body.messages[1]).toMatchObject({
        role: 'user',
        content: 'Hello',
      });
    });

    it('should convert assistant message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      await service.call('System', [
        createMessage({ role: 'assistant', content: 'Hi' }),
      ]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[1]).toEqual({ role: 'assistant', content: 'Hi' });
    });

    it('should convert system message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      await service.call('Main system prompt', [
        createMessage({ role: 'user', content: 'Hello' }),
      ]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0]).toEqual({
        role: 'system',
        content: 'Main system prompt',
      });
    });

    it('should convert tool result message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      // Tool messages require a preceding assistant message with tool_calls
      const messages: Message[] = [
        createMessage({
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_123', name: 'get_data', arguments: {} }],
        }),
        createMessage({
          role: 'tool',
          content: '{"result": "data"}',
          toolCallId: 'call_123',
        }),
      ];

      await service.call('System', messages);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // messages[0] = system, messages[1] = assistant with tool_calls, messages[2] = tool result
      expect(body.messages[2]).toEqual({
        role: 'tool',
        content: '{"result": "data"}',
        tool_call_id: 'call_123',
      });
    });

    it('should preserve tool_calls in assistant message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      const messages: Message[] = [
        createMessage({
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 'call_1', name: 'search', arguments: { q: 'test' } },
          ],
        }),
      ];

      await service.call('System', messages);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[1].tool_calls).toBeDefined();
      expect(body.messages[1].tool_calls[0].function.name).toBe('search');
    });
  });

  // === 服务状态 ===
  describe('getServiceStatus', () => {
    it('should return healthy status when circuit is closed', async () => {
      mockResilienceService.getCircuitStatus.mockResolvedValueOnce({
        state: 'CLOSED',
        failures: 0,
        isOpen: false,
      });

      const status = await service.getServiceStatus();

      expect(status.isHealthy).toBe(true);
      expect(status.circuitState).toBe('CLOSED');
    });

    it('should return unhealthy when circuit is open', async () => {
      mockResilienceService.getCircuitStatus.mockResolvedValueOnce({
        state: 'OPEN',
        failures: 5,
        isOpen: true,
      });

      const status = await service.getServiceStatus();

      expect(status.isHealthy).toBe(false);
      expect(status.circuitState).toBe('OPEN');
    });
  });

  // === Tool calls 响应解析 ===
  describe('tool calls response parsing', () => {
    it('should parse tool calls from response', async () => {
      const responseWithToolCalls = {
        ...mockOpenAIResponse,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_abc123',
                  type: 'function',
                  function: {
                    name: 'search_schools',
                    arguments: '{"query": "MIT"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithToolCalls),
      });

      const result = await service.call('System', [
        { role: 'user', content: 'Search MIT' },
      ]);

      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls?.[0].name).toBe('search_schools');
      expect(result.toolCalls?.[0].arguments).toEqual({ query: 'MIT' });
      expect(result.finishReason).toBe('tool_calls');
    });
  });

  // === 边界条件 ===
  describe('edge cases', () => {
    it('should handle empty messages array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      await service.call('System', []);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(1); // 只有 system
    });

    it('should handle max token limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        {
          maxTokens: 100,
        },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.max_tokens).toBe(100);
    });

    it('should handle custom model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        {
          model: 'gpt-4',
        },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4');
    });

    it('should handle temperature setting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      });

      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        {
          temperature: 0.5,
        },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.5);
    });
  });
});
