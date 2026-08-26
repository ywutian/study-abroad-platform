/**
 * OrchestratorService 单元测试
 *
 * 测试路由决策、委派逻辑、会话管理、消息持久化一致性
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
import { AgentRunService } from './agent-run.service';
import { AgentType } from '../types';
import { AgentRuntimeConfigService } from '../skills/agent-runtime-config.service';
import { AGENT_CONFIGS } from '../config/agents.config';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { AssistantOutputSafetyService } from './assistant-output-safety.service';

describe('OrchestratorService', () => {
  let service: OrchestratorService;
  let module: TestingModule;
  let agentRunner: jest.Mocked<AgentRunnerService>;
  let memory: jest.Mocked<MemoryService>;
  let _llm: jest.Mocked<LLMService>;
  let workflowEngine: jest.Mocked<WorkflowEngineService>;
  let fastRouter: jest.Mocked<FastRouterService>;
  let memoryManager: jest.Mocked<MemoryManagerService>;
  let outputSafety: { review: jest.Mock };

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
          provide: AgentRuntimeConfigService,
          useValue: {
            resolve: jest.fn((agentType: AgentType) =>
              Promise.resolve(AGENT_CONFIGS[agentType]),
            ),
          },
        },
        {
          provide: MemoryManagerService,
          useValue: {
            getOrCreateConversation: jest.fn(),
            addMessage: jest.fn(),
            remember: jest.fn().mockResolvedValue(undefined),
            getRetrievalContext: jest.fn(),
            getConversation: jest.fn().mockResolvedValue({
              id: 'conv_1',
              userId: 'user_1',
            }),
            getConversationHistory: jest.fn().mockResolvedValue([]),
            buildContextSummary: jest.fn().mockReturnValue(''),
            getStats: jest.fn().mockResolvedValue(null),
            clearConversation: jest.fn().mockResolvedValue(undefined),
            updateConversationTitle: jest.fn().mockResolvedValue(undefined),
            updateConversationMetadata: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: AssistantOutputSafetyService,
          useValue: {
            review: jest.fn((content: string) => Promise.resolve(content)),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordRoutingDecision: jest.fn(),
            recordError: jest.fn(),
            recordHarnessEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    agentRunner = module.get(AgentRunnerService);
    memory = module.get(MemoryService);
    _llm = module.get(LLMService);
    workflowEngine = module.get(WorkflowEngineService);
    fastRouter = module.get(FastRouterService);
    memoryManager = module.get(MemoryManagerService);
    outputSafety = module.get(AssistantOutputSafetyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Helper to set up conversation mocks
  const setupConversationMocks = (convId = 'conv_1') => {
    const mockConversation = {
      id: convId,
      userId: 'user_1',
      messages: [] as any[],
      context: { userId: 'user_1' },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryManager.getOrCreateConversation.mockResolvedValue({
      id: convId,
    } as any);
    memory.getOrCreateConversation.mockResolvedValue(mockConversation);

    return mockConversation;
  };

  describe('Fast Routing', () => {
    beforeEach(() => {
      setupConversationMocks();
    });

    it('should route essay-related queries to Essay Agent', async () => {
      fastRouter.route.mockReturnValue({
        agent: AgentType.ESSAY,
        confidence: 0.9,
        matchedKeywords: ['文书'],
        shouldUseLLM: false,
      });

      agentRunner.run.mockResolvedValue({
        message: '关于文书写作...',
        agentType: AgentType.ESSAY,
      });

      const result = await service.handleMessage('user_1', '帮我写文书');

      expect(fastRouter.route).toHaveBeenCalledWith('帮我写文书');
      // Orchestrator no longer passes initialMessage (fixes double user write)
      expect(agentRunner.run).toHaveBeenCalledWith(
        AgentType.ESSAY,
        expect.any(Object),
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

      const _result = await service.handleMessage('user_1', '帮我推荐学校');

      expect(agentRunner.run).toHaveBeenCalledWith(
        AgentType.SCHOOL,
        expect.any(Object),
      );
    });

    it('honors an explicit agent hint before heuristic routing', async () => {
      fastRouter.getSimpleResponse.mockReturnValue('heuristic response');
      agentRunner.run.mockResolvedValue({
        message: 'essay response',
        agentType: AgentType.ESSAY,
      });

      const result = await service.handleMessage(
        'user_1',
        'review this draft',
        undefined,
        'en',
        undefined,
        AgentType.ESSAY,
      );

      expect(fastRouter.getSimpleResponse).not.toHaveBeenCalled();
      expect(fastRouter.route).not.toHaveBeenCalled();
      expect(agentRunner.run).toHaveBeenCalledWith(
        AgentType.ESSAY,
        expect.any(Object),
      );
      expect(result.agentType).toBe(AgentType.ESSAY);
    });

    it('honors an explicit agent hint for streaming requests', async () => {
      fastRouter.getSimpleResponse.mockReturnValue('heuristic response');
      workflowEngine.runStream.mockImplementation(async function* () {
        yield {
          type: 'done',
          result: {
            message: 'resume response',
            toolsUsed: ['review_resume'],
            plan: { planningContent: '', steps: [] },
            timing: { planMs: 1, executeMs: 1, solveMs: 1, totalMs: 3 },
          },
        };
      });

      const events = [];
      for await (const event of service.handleMessageStream(
        'user_1',
        'review my resume',
        undefined,
        'en',
        undefined,
        AgentType.RESUME,
      )) {
        events.push(event);
      }

      expect(fastRouter.getSimpleResponse).not.toHaveBeenCalled();
      expect(fastRouter.route).not.toHaveBeenCalled();
      expect(workflowEngine.runStream).toHaveBeenCalledWith(
        AgentType.RESUME,
        expect.any(Object),
        expect.any(Object),
        expect.any(Array),
        undefined,
      );
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'start',
            agent: AgentType.RESUME,
            memoryContext: {
              recentMemories: 0,
              relevantFacts: 0,
              entities: [],
            },
          }),
          expect.objectContaining({ type: 'done', agent: AgentType.RESUME }),
        ]),
      );
    });
  });

  describe('Message Persistence', () => {
    beforeEach(() => {
      setupConversationMocks();
    });

    it('should persist prediction UI context metadata and memory summary', async () => {
      fastRouter.getSimpleResponse.mockReturnValue('好的，我来分析这批预测。');
      agentRunner.run.mockResolvedValue({
        message: '学校分析',
        agentType: AgentType.SCHOOL,
      });

      const context = {
        type: 'prediction-results' as const,
        source: 'prediction_page',
        summary: { total: 2, reach: 1, match: 1, safety: 0 },
        results: [
          { schoolName: 'MIT', probability: 0.21, tier: 'reach' as const },
          { schoolName: 'Stanford', probability: 0.42, tier: 'match' as const },
        ],
      };

      await service.handleMessage(
        'user_1',
        '帮我分析这批预测',
        undefined,
        'zh',
        context,
        AgentType.SCHOOL,
      );

      expect(memoryManager.updateConversationMetadata).toHaveBeenCalledWith(
        'conv_1',
        expect.objectContaining({
          locale: 'zh',
          lastAgentHint: AgentType.SCHOOL,
          lastAgentContextSummary: expect.stringContaining('预测页面上下文'),
          lastAgentContext: expect.objectContaining({
            type: 'prediction-results',
            source: 'prediction_page',
          }),
        }),
      );
      expect(memoryManager.remember).toHaveBeenCalledWith(
        'user_1',
        expect.objectContaining({
          category: 'prediction_ui_context',
          metadata: expect.objectContaining({
            contextType: 'prediction-results',
            agentHint: AgentType.SCHOOL,
          }),
        }),
      );
    });

    it('should persist selected-schools context metadata for follow-up turns', async () => {
      fastRouter.getSimpleResponse.mockReturnValue('我来比较这几所学校。');
      agentRunner.run.mockResolvedValue({
        message: '学校比较',
        agentType: AgentType.SCHOOL,
      });

      const context = {
        type: 'selected-schools' as const,
        source: 'profile_school_list',
        schools: [
          { id: 'school-1', name: 'MIT', usNewsRank: 2 },
          { id: 'school-2', name: 'Stanford', usNewsRank: 3 },
        ],
      };

      await service.handleMessage(
        'user_1',
        '比较我选中的学校',
        undefined,
        'zh',
        context,
        AgentType.SCHOOL,
      );

      expect(memoryManager.updateConversationMetadata).toHaveBeenCalledWith(
        'conv_1',
        expect.objectContaining({
          lastAgentHint: AgentType.SCHOOL,
          lastAgentContextSummary: expect.stringContaining('选校上下文'),
          lastAgentContext: expect.objectContaining({
            type: 'selected-schools',
            source: 'profile_school_list',
          }),
        }),
      );
      expect(memoryManager.remember).toHaveBeenCalledWith(
        'user_1',
        expect.objectContaining({
          category: 'prediction_ui_context',
          metadata: expect.objectContaining({
            contextType: 'selected-schools',
            agentHint: AgentType.SCHOOL,
          }),
        }),
      );
    });

    it('should persist both user and assistant for simple greeting', async () => {
      fastRouter.getSimpleResponse.mockReturnValue('你好！有什么可以帮你的？');

      const result = await service.handleMessage('user_1', '你好');

      expect(result.message).toBe('你好！有什么可以帮你的？');
      // user message persisted
      expect(memory.addMessage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ role: 'user', content: '你好' }),
      );
      // assistant message persisted
      expect(memory.addMessage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          role: 'assistant',
          content: '你好！有什么可以帮你的？',
        }),
      );
    });

    it('should keep the resolved locale even when user input uses another language', async () => {
      fastRouter.getSimpleResponse.mockReturnValue('好的，我用中文回复。');

      const result = await service.handleMessage(
        'user_1',
        'Please answer in English',
        undefined,
        'zh',
      );

      expect(result.message).toBe('好的，我用中文回复。');
      expect(memoryManager.updateConversationMetadata).toHaveBeenCalledWith(
        'conv_1',
        expect.objectContaining({ locale: 'zh' }),
      );
    });

    it('should persist assistant response for fast route specialist', async () => {
      fastRouter.route.mockReturnValue({
        agent: AgentType.ESSAY,
        confidence: 0.9,
        matchedKeywords: ['文书'],
        shouldUseLLM: false,
      });

      agentRunner.run.mockResolvedValue({
        message: '关于文书...',
        agentType: AgentType.ESSAY,
      });

      await service.handleMessage('user_1', '帮我写文书');

      // assistant persisted to enterprise memory
      expect(memoryManager.addMessage).toHaveBeenCalledWith(
        'conv_1',
        expect.objectContaining({
          role: 'assistant',
          content: '关于文书...',
        }),
      );
    });

    it('should persist assistant response for callAgent', async () => {
      agentRunner.run.mockResolvedValue({
        message: '分析结果...',
        agentType: AgentType.PROFILE,
      });

      await service.callAgent('user_1', AgentType.PROFILE, '帮我分析');

      // assistant persisted
      expect(memoryManager.addMessage).toHaveBeenCalledWith(
        'conv_1',
        expect.objectContaining({
          role: 'assistant',
          content: '分析结果...',
        }),
      );
    });

    it('should not persist empty assistant response', async () => {
      fastRouter.route.mockReturnValue({
        agent: AgentType.ESSAY,
        confidence: 0.9,
        matchedKeywords: ['文书'],
        shouldUseLLM: false,
      });

      agentRunner.run.mockResolvedValue({
        message: '',
        agentType: AgentType.ESSAY,
      });

      await service.handleMessage('user_1', '帮我写文书');

      // user message persisted (1 call for user)
      // assistant NOT persisted because content is empty (persistAssistantResponse no-ops)
      const assistantCalls = memoryManager.addMessage.mock.calls.filter(
        (call) => call[1]?.role === 'assistant',
      );
      expect(assistantCalls).toHaveLength(0);
    });

    it('should not double-write user message (no initialMessage to agentRunner)', async () => {
      fastRouter.route.mockReturnValue({
        agent: null,
        confidence: 0,
        matchedKeywords: [],
        shouldUseLLM: true,
      });

      agentRunner.run.mockResolvedValue({
        message: '回复',
        agentType: AgentType.ORCHESTRATOR,
      });

      await service.handleMessage('user_1', '你好');

      // agentRunner.run called without initialMessage (2 args, not 3)
      expect(agentRunner.run).toHaveBeenCalledWith(
        AgentType.ORCHESTRATOR,
        expect.any(Object),
      );
      expect(agentRunner.run.mock.calls[0]).toHaveLength(2);
    });
  });

  describe('Delegation', () => {
    beforeEach(() => {
      setupConversationMocks();
    });

    it('should use assistant role with delegation metadata for delegation markers', async () => {
      fastRouter.route.mockReturnValue({
        agent: null,
        confidence: 0,
        matchedKeywords: [],
        shouldUseLLM: true,
      });

      // First call: orchestrator delegates
      agentRunner.run
        .mockResolvedValueOnce({
          message: '',
          agentType: AgentType.ORCHESTRATOR,
          delegatedTo: AgentType.ESSAY,
          data: { task: '帮我写文书' },
        })
        // Second call: specialist responds
        .mockResolvedValueOnce({
          message: '文书写作建议...',
          agentType: AgentType.ESSAY,
        });

      await service.handleMessage('user_1', '帮我写文书');

      // Delegation marker should use assistant role (not system)
      expect(memory.addMessage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('委派给'),
          metadata: expect.objectContaining({
            delegation: true,
            targetAgent: AgentType.ESSAY,
          }),
        }),
      );
    });
  });

  describe('Conversation Management', () => {
    beforeEach(() => {
      setupConversationMocks();
    });

    it('should create new conversation when conversationId is not provided', async () => {
      fastRouter.route.mockReturnValue({
        agent: null,
        confidence: 0,
        matchedKeywords: [],
        shouldUseLLM: true,
      });

      agentRunner.run.mockResolvedValue({
        message: '你好！有什么可以帮助你的？',
        agentType: AgentType.ORCHESTRATOR,
      });

      await service.handleMessage('user_1', '你好');

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

      memoryManager.getOrCreateConversation.mockResolvedValue({
        id: 'conv_existing',
      } as any);

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

      setupConversationMocks();

      agentRunner.run.mockRejectedValue(new Error('LLM service unavailable'));

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

      memoryManager.getConversationHistory.mockResolvedValue(
        mockMessages as any,
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

  describe('completed run reconnect', () => {
    it('returns the persisted result without reclaiming the approval', async () => {
      const agentRuns = {
        isEnabled: jest.fn().mockReturnValue(true),
        claimApproved: jest.fn().mockResolvedValue({
          claimed: false,
          run: {
            status: 'COMPLETED',
            result: { message: 'Persisted result', agentType: 'timeline' },
          },
          approval: { status: 'EXECUTED' },
        }),
      };
      (service as any).agentRuns = agentRuns as Partial<AgentRunService>;

      const events = [];
      for await (const event of service.resumeRunStream('user_1', 'run_1')) {
        events.push(event);
      }

      expect(events).toEqual([
        expect.objectContaining({
          type: 'done',
          runId: 'run_1',
          runStatus: 'COMPLETED',
          response: expect.objectContaining({ message: 'Persisted result' }),
        }),
      ]);
      expect(agentRuns.claimApproved).toHaveBeenCalledTimes(1);
    });

    it('returns a stable terminal reason when the persisted result is unavailable', async () => {
      (service as any).agentRuns = {
        isEnabled: jest.fn().mockReturnValue(true),
        claimApproved: jest.fn().mockResolvedValue({
          claimed: false,
          run: { status: 'COMPLETED', result: null },
          approval: { status: 'EXECUTED' },
        }),
      } as Partial<AgentRunService>;

      const events = [];
      for await (const event of service.resumeRunStream('user_1', 'run_1')) {
        events.push(event);
      }

      expect(events).toEqual([
        expect.objectContaining({
          type: 'error',
          runId: 'run_1',
          runStatus: 'COMPLETED',
          error: 'COMPLETED_RESULT_UNAVAILABLE',
        }),
      ]);
    });
  });

  describe('Output safety boundary', () => {
    beforeEach(() => {
      setupConversationMocks();
    });

    it('persists and returns only the output safety service result', async () => {
      fastRouter.getSimpleResponse.mockReturnValue('unreviewed content');
      outputSafety.review.mockResolvedValue('reviewed content');

      const result = await service.handleMessage('user_1', '你好');

      expect(outputSafety.review).toHaveBeenCalledWith(
        'unreviewed content',
        'zh',
        AgentType.ORCHESTRATOR,
      );
      expect(result.message).toBe('reviewed content');
      expect(memoryManager.addMessage).toHaveBeenCalledWith(
        'conv_1',
        expect.objectContaining({
          role: 'assistant',
          content: 'reviewed content',
        }),
      );
      expect(memoryManager.addMessage).not.toHaveBeenCalledWith(
        'conv_1',
        expect.objectContaining({ content: 'unreviewed content' }),
      );
    });
  });
});
