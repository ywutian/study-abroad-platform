/**
 * OrchestratorService 单元测试
 *
 * 测试路由决策、委派逻辑、会话管理
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OrchestratorService } from './orchestrator.service';
import { AgentRunnerService } from './agent-runner.service';
import { MemoryService } from './memory.service';
import { LLMService } from './llm.service';
import { ToolExecutorService } from './tool-executor.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { ConfigValidatorService } from '../config/config-validator.service';
import { MemoryManagerService } from '../memory/memory-manager.service';
import { FastRouterService } from './fast-router.service';
import { FallbackService } from './fallback.service';
import { AgentType } from '../types';

describe('OrchestratorService', () => {
  let service: OrchestratorService;
  let module: TestingModule;
  let agentRunner: jest.Mocked<AgentRunnerService>;
  let memory: jest.Mocked<MemoryService>;
  let llm: jest.Mocked<LLMService>;
  let fastRouter: jest.Mocked<FastRouterService>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        {
          provide: AgentRunnerService,
          useValue: {
            run: jest.fn(),
          },
        },
        {
          provide: MemoryService,
          useValue: {
            getOrCreateConversation: jest.fn(),
            addMessage: jest.fn(),
            getRecentMessages: jest.fn().mockReturnValue([]),
            loadUserContext: jest.fn(),
            refreshUserContext: jest.fn(),
            clearConversation: jest.fn(),
            getContextSummary: jest.fn().mockReturnValue(''),
          },
        },
        {
          provide: LLMService,
          useValue: {
            call: jest.fn(),
            callStream: jest.fn(),
          },
        },
        {
          provide: ToolExecutorService,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: WorkflowEngineService,
          useValue: {
            run: jest.fn(),
            runStream: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(3),
          },
        },
        {
          provide: ConfigValidatorService,
          useValue: {
            validate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: MemoryManagerService,
          useValue: {
            getOrCreateConversation: jest.fn(),
            addMessage: jest.fn(),
            getRetrievalContext: jest.fn(),
            getConversationHistory: jest.fn().mockResolvedValue([]),
            buildContextSummary: jest.fn().mockReturnValue(''),
            getStats: jest.fn().mockResolvedValue(null),
            clearConversation: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: FastRouterService,
          useValue: {
            route: jest.fn(),
            getSimpleResponse: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: FallbackService,
          useValue: {
            getFallbackResponse: jest.fn().mockReturnValue({
              message: '抱歉，服务暂时不可用，请稍后再试。',
              agentType: AgentType.ORCHESTRATOR,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    agentRunner = module.get(AgentRunnerService);
    memory = module.get(MemoryService);
    llm = module.get(LLMService);
    fastRouter = module.get(FastRouterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Fast Routing', () => {
    const mockConversation = {
      id: 'conv_1',
      userId: 'user_1',
      messages: [],
      context: { userId: 'user_1' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      // 企业级记忆 mock
      const memoryManager = module.get(MemoryManagerService);
      (memoryManager.getOrCreateConversation as jest.Mock).mockResolvedValue({
        id: 'conv_1',
      });

      // 内存 mock（用于 AgentRunner 兼容）
      memory.getOrCreateConversation.mockResolvedValue(mockConversation);
    });

    it('should route essay-related queries to Essay Agent', async () => {
      // 设置快速路由返回 essay
      fastRouter.route.mockReturnValue({
        agent: AgentType.ESSAY,
        confidence: 0.9,
        matchedKeywords: ['文书'],
        shouldUseLLM: false,
      });

      // 设置 agentRunner mock
      agentRunner.run.mockResolvedValue({
        message: '关于文书写作...',
        agentType: AgentType.ESSAY,
      });

      const result = await service.handleMessage('user_1', '帮我写文书');

      expect(fastRouter.route).toHaveBeenCalledWith('帮我写文书');
      expect(agentRunner.run).toHaveBeenCalledWith(
        AgentType.ESSAY,
        expect.any(Object),
        '帮我写文书',
      );
      expect(result.agentType).toBe(AgentType.ESSAY);
    });

    it('should route school-related queries to School Agent', async () => {
      fastRouter.route.mockReturnValue({
        agent: AgentType.SCHOOL,
        confidence: 0.85,
        matchedKeywords: ['学校', '推荐'],
        shouldUseLLM: false,
      });

      agentRunner.run.mockResolvedValue({
        message: '推荐以下学校...',
        agentType: AgentType.SCHOOL,
      });

      const result = await service.handleMessage('user_1', '帮我推荐学校');

      expect(agentRunner.run).toHaveBeenCalledWith(
        AgentType.SCHOOL,
        expect.any(Object),
        '帮我推荐学校',
      );
    });
  });

  describe('Conversation Management', () => {
    beforeEach(() => {
      // 企业级记忆 mock
      const memoryManager = module.get(MemoryManagerService);
      (memoryManager.getOrCreateConversation as jest.Mock).mockResolvedValue({
        id: 'conv_new',
      });
    });

    it('should create new conversation when conversationId is not provided', async () => {
      fastRouter.route.mockReturnValue({
        agent: null,
        confidence: 0,
        matchedKeywords: [],
        shouldUseLLM: true,
      });

      memory.getOrCreateConversation.mockResolvedValue({
        id: 'conv_new',
        userId: 'user_1',
        messages: [],
        context: { userId: 'user_1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      agentRunner.run.mockResolvedValue({
        message: '你好！有什么可以帮助你的？',
        agentType: AgentType.ORCHESTRATOR,
      });

      await service.handleMessage('user_1', '你好');

      // 因为使用企业级记忆，先调用 memoryManager，再同步到 memory
      const memoryManager = module.get(MemoryManagerService);
      expect(memoryManager.getOrCreateConversation).toHaveBeenCalledWith(
        'user_1',
        undefined,
      );
    });

    it('should reuse existing conversation when conversationId is provided', async () => {
      fastRouter.route.mockReturnValue({
        agent: null,
        confidence: 0,
        matchedKeywords: [],
        shouldUseLLM: true,
      });

      const memoryManager = module.get(MemoryManagerService);
      (memoryManager.getOrCreateConversation as jest.Mock).mockResolvedValue({
        id: 'conv_existing',
      });

      memory.getOrCreateConversation.mockResolvedValue({
        id: 'conv_existing',
        userId: 'user_1',
        messages: [{ role: 'user', content: '之前的消息' }],
        context: { userId: 'user_1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      agentRunner.run.mockResolvedValue({
        message: '继续我们的对话...',
        agentType: AgentType.ORCHESTRATOR,
      });

      await service.handleMessage('user_1', '继续', 'conv_existing');

      expect(memoryManager.getOrCreateConversation).toHaveBeenCalledWith(
        'user_1',
        'conv_existing',
      );
    });
  });

  describe('Error Handling', () => {
    it('should return fallback response when LLM fails', async () => {
      fastRouter.route.mockReturnValue({
        agent: null,
        confidence: 0,
        matchedKeywords: [],
        shouldUseLLM: true,
      });

      memory.getOrCreateConversation.mockResolvedValue({
        id: 'conv_1',
        userId: 'user_1',
        messages: [],
        context: { userId: 'user_1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // AgentRunnerService.run 被调用，它会抛出错误
      agentRunner.run.mockRejectedValue(new Error('LLM service unavailable'));

      // 因为有 FallbackService，应该返回 fallback response 而不是抛出错误
      const result = await service.handleMessage('user_1', '你好');
      expect(result.message).toContain('抱歉');
    });
  });

  describe('getHistory', () => {
    it('should return conversation history from enterprise memory', async () => {
      const mockMessages = [
        { role: 'user', content: '你好', timestamp: new Date() },
        { role: 'assistant', content: '你好！', timestamp: new Date() },
      ];

      // 因为有 MemoryManagerService，会使用企业级记忆
      const memoryManager = module.get(MemoryManagerService);
      (memoryManager.getConversationHistory as jest.Mock).mockResolvedValue(
        mockMessages,
      );

      const history = await service.getHistory('user_1', 'conv_1');

      expect(memoryManager.getConversationHistory).toHaveBeenCalledWith(
        'conv_1',
      );
      expect(history).toHaveLength(2);
    });
  });

  describe('clearConversation', () => {
    it('should clear conversation', async () => {
      await service.clearConversation('user_1', 'conv_1');

      expect(memory.clearConversation).toHaveBeenCalledWith('user_1', 'conv_1');
    });
  });
});
