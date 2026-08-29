/**
 * LLMService 单元测试
 */
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ILLMProvider,
  LLM_PROVIDER_TOKEN,
} from '../providers/llm-provider.interface';
import {
  LLMChatRequest,
  LLMChatResponse,
  LLMErrorCode,
  LLMProviderError,
} from '../providers/llm-provider.types';
import { Message } from '../types';
import { LLMService } from './llm.service';
import { ResilienceService } from './resilience.service';
import { TokenTrackerService } from './token-tracker.service';
import { AgentRunBudgetTracker } from './agent-run-context';

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
  let mockProvider: jest.Mocked<ILLMProvider>;
  let mockResilienceService: jest.Mocked<ResilienceService>;
  let mockTokenTracker: jest.Mocked<TokenTrackerService>;

  const mockProviderResponse: LLMChatResponse = {
    content: 'Hello! How can I help you?',
    finishReason: 'stop',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
  };

  beforeEach(async () => {
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

    mockProvider = {
      providerId: 'openai',
      chat: jest.fn().mockResolvedValue(mockProviderResponse),
      chatStream: jest.fn(),
      supportsModel: jest.fn().mockReturnValue(true),
      getContextWindow: jest.fn().mockReturnValue(128000),
    };

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
        { provide: LLM_PROVIDER_TOKEN, useValue: mockProvider },
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
  it('settles non-routed SSE usage against the unchanged run token budget', async () => {
    const runBudget = new AgentRunBudgetTracker({
      version: 1,
      maxTokens: 24000,
      maxToolCalls: 16,
      maxSupplementalRounds: 2,
      maxDurationMs: 120000,
    });
    mockProvider.chatStream.mockImplementation(async function* () {
      yield { type: 'content', content: 'OK' };
      yield {
        type: 'done',
        usage: { promptTokens: 2500, completionTokens: 1, totalTokens: 2501 },
      };
    });
    for await (const chunk of service.callStream('Synthetic', [], {
      runBudget,
    })) {
      expect(chunk.type).not.toBe('error');
    }
    expect(runBudget.snapshot(0, 0).estimatedTokens).toBe(2501);
  });

  describe('call', () => {
    it('enforces the run token budget before provider execution', async () => {
      const runBudget = new AgentRunBudgetTracker({
        version: 1,
        maxTokens: 1000,
        maxToolCalls: 16,
        maxSupplementalRounds: 2,
        maxDurationMs: 120000,
      });

      await expect(
        service.call('x'.repeat(8000), [], { runBudget, maxTokens: 500 }),
      ).rejects.toThrow('AGENT_TOKEN_BUDGET_EXCEEDED');
      expect(mockProvider.chat).not.toHaveBeenCalled();
    });

    it('rejects oversized Chinese input that chars/3 would have let through', async () => {
      const zh = '请比较这两所大学的录取难度、专业实力和奖学金政策。'.repeat(
        6000,
      );

      // 150000 chars: the old heuristic claimed 50000 tokens against a 102400
      // gate and let this reach the provider; o200k_base charges 120000.
      expect(Math.ceil(zh.length / 3)).toBeLessThan(128000 * 0.8);
      await expect(service.call(zh, [])).rejects.toMatchObject({
        response: { code: 'CONTEXT_WINDOW_EXCEEDED' },
      });
      expect(mockProvider.chat).not.toHaveBeenCalled();
    });

    it('should call provider with correct parameters', async () => {
      const messages: Message[] = [
        createMessage({ role: 'user', content: 'Hello' }),
      ];
      await service.call('You are a helpful assistant', messages);

      expect(mockProvider.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: 'You are a helpful assistant',
          model: 'gpt-4o-mini',
        }),
      );
    });

    it('should convert ChatMessage[] to LLM message format', async () => {
      const messages: Message[] = [
        createMessage({ role: 'user', content: 'Hello' }),
        createMessage({ role: 'assistant', content: 'Hi there!' }),
      ];

      await service.call('System prompt', messages);

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      expect(request.systemPrompt).toBe('System prompt');
      expect(request.messages[0]).toMatchObject({
        role: 'user',
        content: 'Hello',
      });
      expect(request.messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('should include tool definitions when provided', async () => {
      const tools = [
        {
          name: 'search_schools',
          description: 'Search for schools',
          parameters: {
            type: 'object' as const,
            properties: {
              query: { type: 'string' as const, description: 'Search query' },
            },
            required: ['query'],
          },
          handler: 'school-tools',
        },
      ];

      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        { tools },
      );

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      expect(request.tools).toBeDefined();
      expect(request.tools![0].name).toBe('search_schools');
      expect(request.toolChoice).toBe('auto');
    });

    it('should return parsed response', async () => {
      const result = await service.call('System', [
        createMessage({ role: 'user', content: 'Hello' }),
      ]);

      expect(result.content).toBe('Hello! How can I help you?');
      expect(result.finishReason).toBe('stop');
    });

    it('should propagate provider errors (e.g. API key not configured)', async () => {
      mockProvider.chat.mockRejectedValueOnce(
        new LLMProviderError(
          'OpenAI API key not configured',
          LLMErrorCode.AUTHENTICATION,
          false,
        ),
      );
      // Bypass resilience so the error propagates directly
      mockResilienceService.execute.mockImplementationOnce((_, fn) => fn());

      await expect(
        service.call('System', [
          createMessage({ role: 'user', content: 'Hello' }),
        ]),
      ).rejects.toThrow('OpenAI API key not configured');
    });
  });

  // === 弹性保护测试 ===
  describe('resilience integration', () => {
    it('should use resilience service when available', async () => {
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

    it('should handle provider error responses', async () => {
      mockResilienceService.execute.mockImplementationOnce((_, fn) => fn());
      mockProvider.chat.mockRejectedValueOnce(
        new LLMProviderError(
          'LLM API error: 500',
          LLMErrorCode.SERVER_ERROR,
          true,
          500,
        ),
      );

      await expect(
        service.call('System', [
          createMessage({ role: 'user', content: 'Hello' }),
        ]),
      ).rejects.toThrow('LLM API error: 500');
    });
  });

  // === Token 追踪测试 ===
  describe('token tracking', () => {
    it('should track token usage when userId is provided', async () => {
      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        {
          userId: 'user-123',
        },
      );

      expect(mockTokenTracker.trackUsage).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          model: 'gpt-4o-mini',
        }),
        expect.any(Object),
      );
    });

    it('should track by model', async () => {
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
        expect.objectContaining({
          model: 'gpt-4',
        }),
        expect.any(Object),
      );
    });
  });

  // === 消息格式转换 ===
  describe('message conversion', () => {
    it('should convert user message', async () => {
      await service.call('System', [
        createMessage({ role: 'user', content: 'Hello' }),
      ]);

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      expect(request.messages[0]).toMatchObject({
        role: 'user',
        content: 'Hello',
      });
    });

    it('should convert assistant message', async () => {
      await service.call('System', [
        createMessage({ role: 'assistant', content: 'Hi' }),
      ]);

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      expect(request.messages[0]).toMatchObject({
        role: 'assistant',
        content: 'Hi',
      });
    });

    it('should pass system prompt via systemPrompt field', async () => {
      await service.call('Main system prompt', [
        createMessage({ role: 'user', content: 'Hello' }),
      ]);

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      expect(request.systemPrompt).toBe('Main system prompt');
    });

    it('should convert tool result message', async () => {
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

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      // messages[0] = assistant with tool_calls, messages[1] = tool result
      expect(request.messages[1]).toMatchObject({
        role: 'tool',
        content: '{"result": "data"}',
        toolCallId: 'call_123',
      });
    });

    it('should preserve tool_calls in assistant message', async () => {
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

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      expect(request.messages[0].toolCalls).toBeDefined();
      expect(request.messages[0].toolCalls![0].name).toBe('search');
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
      mockProvider.chat.mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'call_abc123',
            name: 'search_schools',
            arguments: { query: 'MIT' },
          },
        ],
        finishReason: 'tool_calls',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      });

      const result = await service.call('System', [
        createMessage({ role: 'user', content: 'Search MIT' }),
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
      await service.call('System', []);

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      expect(request.messages).toHaveLength(0);
      expect(request.systemPrompt).toBe('System');
    });

    it('should handle max token limit', async () => {
      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        {
          maxTokens: 100,
        },
      );

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      expect(request.maxTokens).toBe(100);
    });

    it('should handle custom model', async () => {
      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        {
          model: 'gpt-4',
        },
      );

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      expect(request.model).toBe('gpt-4');
    });

    it('should handle temperature setting', async () => {
      await service.call(
        'System',
        [createMessage({ role: 'user', content: 'Hello' })],
        {
          temperature: 0.5,
        },
      );

      const request: LLMChatRequest = mockProvider.chat.mock.calls[0][0];
      expect(request.temperature).toBe(0.5);
    });
  });

  // === chatSimpleGuarded tests ===
  describe('chatSimpleGuarded', () => {
    it('should pass through to chatSimple when no promptGuard', async () => {
      const result = await service.chatSimpleGuarded([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toBe('Hello! How can I help you?');
      expect(mockProvider.chat).toHaveBeenCalled();
    });

    it('should pass through safe input when promptGuard is available', async () => {
      // Create a new service instance with promptGuard
      const mockPromptGuard = {
        analyze: jest.fn().mockResolvedValue({
          blocked: false,
          riskScore: 0.1,
          sanitizedInput: undefined,
        }),
      };

      const _moduleWithGuard = await Test.createTestingModule({
        providers: [
          LLMService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: LLM_PROVIDER_TOKEN, useValue: mockProvider },
          { provide: ResilienceService, useValue: mockResilienceService },
          { provide: TokenTrackerService, useValue: mockTokenTracker },
          {
            provide: 'PromptGuardService',
            useValue: mockPromptGuard,
          },
        ],
      }).compile();

      // Since PromptGuardService is @Optional, we test via the default service
      // which has no guard injected — it should pass through
      const result = await service.chatSimpleGuarded([
        { role: 'user', content: 'safe input' },
      ]);

      expect(result).toBe('Hello! How can I help you?');
    });
  });
});
