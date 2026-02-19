import { Test, TestingModule } from '@nestjs/testing';
import { AiAgentController } from './ai-agent.controller';
import { OrchestratorService } from './core/orchestrator.service';
import { TokenTrackerService } from './core/token-tracker.service';
import { RateLimiterService } from './core/rate-limiter.service';
import { LLMService } from './core/llm.service';

describe('AiAgentController', () => {
  let controller: AiAgentController;
  let orchestrator: OrchestratorService;
  let tokenTracker: TokenTrackerService;
  let rateLimiter: RateLimiterService;
  let llm: LLMService;

  const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };

  const mockResponse = {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    json: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiAgentController],
      providers: [
        {
          provide: OrchestratorService,
          useValue: {
            handleMessage: jest.fn().mockResolvedValue({ reply: 'hello' }),
            handleMessageStream: jest.fn(),
            callAgent: jest.fn().mockResolvedValue({ reply: 'agent response' }),
            getConversations: jest.fn().mockResolvedValue([]),
            getHistory: jest.fn().mockResolvedValue([]),
            clearConversation: jest.fn(),
            refreshContext: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TokenTrackerService,
          useValue: {
            getUsageStats: jest.fn().mockResolvedValue({ totalTokens: 1000 }),
            checkQuota: jest
              .fn()
              .mockResolvedValue({ allowed: true, remaining: 500 }),
          },
        },
        {
          provide: RateLimiterService,
          useValue: {
            getStatus: jest.fn().mockReturnValue({ remaining: 10 }),
          },
        },
        {
          provide: LLMService,
          useValue: {
            getServiceStatus: jest.fn().mockResolvedValue({ isHealthy: true }),
          },
        },
      ],
    }).compile();

    controller = module.get<AiAgentController>(AiAgentController);
    orchestrator = module.get<OrchestratorService>(OrchestratorService);
    tokenTracker = module.get<TokenTrackerService>(TokenTrackerService);
    rateLimiter = module.get<RateLimiterService>(RateLimiterService);
    llm = module.get<LLMService>(LLMService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /chat (non-stream)', () => {
    it('should call orchestrator.handleMessage and return json', async () => {
      await controller.chat(
        mockUser as any,
        { message: 'hi', stream: false },
        mockResponse as any,
      );

      expect(orchestrator.handleMessage).toHaveBeenCalledWith(
        'user-1',
        'hi',
        undefined,
        undefined,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({ reply: 'hello' });
    });
  });

  describe('POST /chat (stream)', () => {
    it('should set SSE headers and call orchestrator.handleMessageStream', async () => {
      const events = (async function* () {
        yield { type: 'token', content: 'hi' };
      })();
      (orchestrator.handleMessageStream as jest.Mock).mockReturnValue(events);

      await controller.chat(
        mockUser as any,
        { message: 'hi', stream: true, conversationId: 'conv-1', locale: 'en' },
        mockResponse as any,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(orchestrator.handleMessageStream).toHaveBeenCalledWith(
        'user-1',
        'hi',
        'conv-1',
        'en',
      );
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });

  describe('POST /agent', () => {
    it('should call orchestrator.callAgent with correct params', async () => {
      const result = await controller.callAgent(mockUser as any, {
        agent: 'essay' as any,
        message: 'help with essay',
        conversationId: 'conv-2',
        locale: 'zh',
      });

      expect(orchestrator.callAgent).toHaveBeenCalledWith(
        'user-1',
        'essay',
        'help with essay',
        'conv-2',
        'zh',
      );
      expect(result).toEqual({ reply: 'agent response' });
    });
  });

  describe('GET /conversations', () => {
    it('should return conversations for the user', async () => {
      const result = await controller.getConversations(mockUser as any, 5);

      expect(orchestrator.getConversations).toHaveBeenCalledWith('user-1', 5);
      expect(result).toEqual({ conversations: [] });
    });
  });

  describe('GET /history', () => {
    it('should return message history for the user', async () => {
      const result = await controller.getHistory(mockUser as any, 'conv-1');

      expect(orchestrator.getHistory).toHaveBeenCalledWith('user-1', 'conv-1');
      expect(result).toEqual({ messages: [] });
    });
  });

  describe('DELETE /conversation', () => {
    it('should clear conversation and return success', async () => {
      const result = await controller.clearConversation(
        mockUser as any,
        'conv-1',
      );

      expect(orchestrator.clearConversation).toHaveBeenCalledWith(
        'user-1',
        'conv-1',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('POST /refresh-context', () => {
    it('should refresh context and return success', async () => {
      const result = await controller.refreshContext(mockUser as any);

      expect(orchestrator.refreshContext).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('GET /usage', () => {
    it('should return token usage stats', async () => {
      const result = await controller.getUsage(mockUser as any);

      expect(tokenTracker.getUsageStats).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ totalTokens: 1000 });
    });
  });

  describe('GET /rate-limit', () => {
    it('should return rate limit status for user and conversation', async () => {
      const result = await controller.getRateLimit(mockUser as any);

      expect(rateLimiter.getStatus).toHaveBeenCalledWith('user-1', 'user');
      expect(rateLimiter.getStatus).toHaveBeenCalledWith(
        'user-1',
        'conversation',
      );
      expect(result).toEqual({
        user: { remaining: 10 },
        conversation: { remaining: 10 },
      });
    });
  });

  describe('GET /quota', () => {
    it('should return quota check result', async () => {
      const result = await controller.checkQuota(mockUser as any);

      expect(tokenTracker.checkQuota).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ allowed: true, remaining: 500 });
    });
  });

  describe('GET /health', () => {
    it('should return healthy status when LLM is healthy', async () => {
      const result = await controller.health();

      expect(llm.getServiceStatus).toHaveBeenCalled();
      expect(result.status).toBe('healthy');
      expect(result.llm).toEqual({ isHealthy: true });
      expect(result.timestamp).toBeDefined();
    });

    it('should return degraded status when LLM is unhealthy', async () => {
      (llm.getServiceStatus as jest.Mock).mockResolvedValue({
        isHealthy: false,
      });

      const result = await controller.health();

      expect(result.status).toBe('degraded');
    });
  });
});
