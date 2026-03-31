/**
 * WorkflowEngineService 单元测试
 *
 * 测试三阶段 ReWOO 工作流：Plan → Execute → Solve
 * - 快速路径（Plan 无工具调用，直接返回文本）
 * - 委派路径（Plan 返回 delegate_to_agent）
 * - 完整三阶段流程
 * - 企业记忆上下文缓存（仅调用一次）
 * - 消息持久化边界（assistant 消息不由 workflow 写入）
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  WorkflowEngineService,
  WorkflowPhase,
  WorkflowStreamEvent,
} from './workflow-engine.service';
import { LLMService } from './llm.service';
import { ToolExecutorService } from './tool-executor.service';
import { MemoryService } from './memory.service';
import { ResilienceService } from './resilience.service';
import { MemoryManagerService } from '../memory/memory-manager.service';
import { AgentType, ConversationState, AgentConfig } from '../types';
import { LLMResponse } from './llm.service';

// Helper: create a minimal valid LLMResponse
function mockLLMResponse(
  partial: Partial<LLMResponse> & { content: string },
): LLMResponse {
  return {
    finishReason: partial.toolCalls ? 'tool_calls' : 'stop',
    ...partial,
  };
}

// Helper: collect all events from the async generator
async function collectEvents(
  gen: AsyncGenerator<WorkflowStreamEvent>,
): Promise<WorkflowStreamEvent[]> {
  const events: WorkflowStreamEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let llm: jest.Mocked<LLMService>;
  let toolExecutor: jest.Mocked<ToolExecutorService>;
  let memory: jest.Mocked<MemoryService>;
  let memoryManager: jest.Mocked<MemoryManagerService>;

  const mockConfig: AgentConfig = {
    type: AgentType.ORCHESTRATOR,
    name: 'Test Agent',
    description: 'Test agent for unit tests',
    systemPrompt: '你是一个测试助手。',
    systemPromptEn: 'You are a test assistant.',
    tools: [],
    canDelegate: [],
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
  };

  const mockConversation: ConversationState = {
    id: 'conv_1',
    userId: 'user_1',
    messages: [
      {
        id: 'msg_1',
        role: 'user',
        content: '你好',
        timestamp: new Date(),
      },
    ],
    context: { userId: 'user_1' },
    metadata: { locale: 'zh' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
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
          provide: MemoryService,
          useValue: {
            addMessage: jest.fn(),
            getRecentMessages: jest.fn().mockReturnValue([]),
            getContextSummary: jest.fn().mockReturnValue('用户档案为空'),
          },
        },
        {
          provide: ResilienceService,
          useValue: {
            withTimeout: jest
              .fn()
              .mockImplementation((fn: () => Promise<unknown>) => fn()),
          },
        },
        {
          provide: MemoryManagerService,
          useValue: {
            getRetrievalContext: jest.fn().mockResolvedValue({}),
            buildContextSummary: jest.fn().mockReturnValue(''),
          },
        },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
    llm = module.get(LLMService);
    toolExecutor = module.get(ToolExecutorService);
    memory = module.get(MemoryService);
    memoryManager = module.get(MemoryManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== Plan Fast Path ====================

  describe('Plan fast path (no tools, no delegation)', () => {
    beforeEach(() => {
      // LLM returns text without tool calls
      llm.call.mockResolvedValue(
        mockLLMResponse({
          content: '你好！我可以帮助你进行留学申请。',
        }),
      );
    });

    it('should emit phase_change(PLAN), plan_content chunks, and done event', async () => {
      const events = await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      // First event: phase_change to PLAN
      expect(events[0]).toEqual({
        type: 'phase_change',
        phase: WorkflowPhase.PLAN,
      });

      // Middle events: plan_content chunks
      const planContentEvents = events.filter((e) => e.type === 'plan_content');
      expect(planContentEvents.length).toBeGreaterThan(0);

      // Reassemble chunked content
      const fullContent = planContentEvents.map((e) => e.content).join('');
      expect(fullContent).toBe('你好！我可以帮助你进行留学申请。');

      // Last event: done
      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent).toBeDefined();
      expect(doneEvent!.result).toBeDefined();
      expect(doneEvent!.result!.message).toBe(
        '你好！我可以帮助你进行留学申请。',
      );
      expect(doneEvent!.result!.toolsUsed).toEqual([]);
      expect(doneEvent!.result!.plan.steps).toEqual([]);
    });

    it('should NOT emit phase_change for EXECUTE or SOLVE', async () => {
      const events = await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      const phaseChanges = events.filter((e) => e.type === 'phase_change');
      expect(phaseChanges).toHaveLength(1);
      expect(phaseChanges[0].phase).toBe(WorkflowPhase.PLAN);
    });

    it('should NOT call memory.addMessage for assistant response', async () => {
      await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      // The workflow engine should NOT persist the assistant message —
      // that responsibility belongs to the Orchestrator.
      const assistantCalls = memory.addMessage.mock.calls.filter(
        (call) => call[1]?.role === 'assistant',
      );
      expect(assistantCalls).toHaveLength(0);
    });

    it('should report correct timing with 0ms for execute and solve', async () => {
      const events = await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent!.result!.timing.executeMs).toBe(0);
      expect(doneEvent!.result!.timing.solveMs).toBe(0);
      expect(doneEvent!.result!.timing.planMs).toBeGreaterThanOrEqual(0);
      expect(doneEvent!.result!.timing.totalMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty plan content gracefully', async () => {
      llm.call.mockResolvedValue(mockLLMResponse({ content: '' }));

      const events = await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      // No plan_content events for empty content
      const planContentEvents = events.filter((e) => e.type === 'plan_content');
      expect(planContentEvents).toHaveLength(0);

      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent!.result!.message).toBe('');
    });
  });

  // ==================== Delegation Path ====================

  describe('Delegation path', () => {
    it('should emit done with delegation info when plan has delegate_to_agent', async () => {
      llm.call.mockResolvedValue(
        mockLLMResponse({
          content: '',
          toolCalls: [
            {
              id: 'call_delegate',
              name: 'delegate_to_agent',
              arguments: {
                agent: AgentType.ESSAY,
                task: '帮用户写 Personal Statement',
                context: '用户想写文书',
              },
            },
          ],
        }),
      );

      const events = await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent).toBeDefined();
      expect(doneEvent!.result!.delegation).toEqual({
        targetAgent: AgentType.ESSAY,
        task: '帮用户写 Personal Statement',
        context: '用户想写文书',
      });
      expect(doneEvent!.result!.message).toBe('');
    });

    it('should NOT enter Execute or Solve phases when delegating', async () => {
      llm.call.mockResolvedValue(
        mockLLMResponse({
          content: 'Let me delegate this.',
          toolCalls: [
            {
              id: 'call_delegate',
              name: 'delegate_to_agent',
              arguments: {
                agent: AgentType.SCHOOL,
                task: '搜索学校',
              },
            },
          ],
        }),
      );

      const events = await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      const phaseChanges = events.filter((e) => e.type === 'phase_change');
      expect(phaseChanges).toHaveLength(1);
      expect(phaseChanges[0].phase).toBe(WorkflowPhase.PLAN);

      // No tool execution, no solve
      expect(toolExecutor.execute).not.toHaveBeenCalled();
      expect(llm.callStream).not.toHaveBeenCalled();
    });
  });

  // ==================== Full Plan + Execute + Solve ====================

  describe('Full three-phase workflow (Plan + Execute + Solve)', () => {
    const mockToolCall = {
      id: 'call_1',
      name: 'get_profile',
      arguments: {},
    };

    beforeEach(() => {
      // Plan phase: returns tool calls
      llm.call.mockResolvedValue(
        mockLLMResponse({
          content: '我来查看你的档案。',
          toolCalls: [mockToolCall],
        }),
      );

      // Tool execution: success
      toolExecutor.execute.mockResolvedValue({
        success: true,
        result: { gpa: 3.8, major: 'CS' },
        duration: 50,
      });

      // Solve phase: streaming response
      llm.callStream.mockReturnValue(
        (async function* () {
          yield { type: 'content', content: '根据你的档案，' };
          yield { type: 'content', content: 'GPA 3.8，专业 CS。' };
          yield { type: 'done' };
        })() as any,
      );
    });

    it('should emit all three phase_change events in order', async () => {
      const events = await collectEvents(
        service.runStream(AgentType.PROFILE, mockConfig, mockConversation, []),
      );

      const phaseChanges = events.filter((e) => e.type === 'phase_change');
      expect(phaseChanges).toHaveLength(3);
      expect(phaseChanges[0].phase).toBe(WorkflowPhase.PLAN);
      expect(phaseChanges[1].phase).toBe(WorkflowPhase.EXECUTE);
      expect(phaseChanges[2].phase).toBe(WorkflowPhase.SOLVE);
    });

    it('should emit tool_start and tool_end events during Execute', async () => {
      const events = await collectEvents(
        service.runStream(AgentType.PROFILE, mockConfig, mockConversation, []),
      );

      const toolStart = events.find((e) => e.type === 'tool_start');
      expect(toolStart).toBeDefined();
      expect(toolStart!.tool).toBe('get_profile');

      const toolEnd = events.find((e) => e.type === 'tool_end');
      expect(toolEnd).toBeDefined();
      expect(toolEnd!.tool).toBe('get_profile');
      expect(toolEnd!.toolResult).toEqual({
        success: true,
        result: { gpa: 3.8, major: 'CS' },
        duration: 50,
      });
    });

    it('should emit solve_content chunks during Solve', async () => {
      const events = await collectEvents(
        service.runStream(AgentType.PROFILE, mockConfig, mockConversation, []),
      );

      const solveChunks = events.filter((e) => e.type === 'solve_content');
      expect(solveChunks).toHaveLength(2);
      expect(solveChunks[0].content).toBe('根据你的档案，');
      expect(solveChunks[1].content).toBe('GPA 3.8，专业 CS。');
    });

    it('should produce done event with correct result', async () => {
      const events = await collectEvents(
        service.runStream(AgentType.PROFILE, mockConfig, mockConversation, []),
      );

      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent).toBeDefined();
      expect(doneEvent!.result!.message).toBe(
        '根据你的档案，GPA 3.8，专业 CS。',
      );
      expect(doneEvent!.result!.toolsUsed).toContain('get_profile');
      expect(doneEvent!.result!.plan.steps).toHaveLength(1);
      expect(doneEvent!.result!.timing.planMs).toBeGreaterThanOrEqual(0);
      expect(doneEvent!.result!.timing.executeMs).toBeGreaterThanOrEqual(0);
      expect(doneEvent!.result!.timing.solveMs).toBeGreaterThanOrEqual(0);
    });

    it('should write assistant plan message and tool results to memory during Execute', async () => {
      await collectEvents(
        service.runStream(AgentType.PROFILE, mockConfig, mockConversation, []),
      );

      // Execute phase writes assistant plan message (with toolCalls)
      expect(memory.addMessage).toHaveBeenCalledWith(
        mockConversation,
        expect.objectContaining({
          role: 'assistant',
          content: '我来查看你的档案。',
          toolCalls: [mockToolCall],
        }),
      );

      // Execute phase writes tool result
      expect(memory.addMessage).toHaveBeenCalledWith(
        mockConversation,
        expect.objectContaining({
          role: 'tool',
          content: JSON.stringify({ gpa: 3.8, major: 'CS' }),
          toolCallId: 'call_1',
        }),
      );
    });

    it('should NOT write Solve assistant message to memory', async () => {
      await collectEvents(
        service.runStream(AgentType.PROFILE, mockConfig, mockConversation, []),
      );

      // memory.addMessage calls: 1 for assistant plan + 1 for tool result = 2 total
      // No call for the final Solve-phase assistant message
      expect(memory.addMessage).toHaveBeenCalledTimes(2);

      const calls = memory.addMessage.mock.calls;
      // Verify the two calls are: assistant (plan) and tool (result)
      expect(calls[0][1].role).toBe('assistant');
      expect(calls[0][1].toolCalls).toBeDefined();
      expect(calls[1][1].role).toBe('tool');
    });
  });

  // ==================== Execute Phase Error Handling ====================

  describe('Execute phase error handling', () => {
    it('should mark step as failed and continue when tool execution throws', async () => {
      llm.call.mockResolvedValue(
        mockLLMResponse({
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              name: 'search_schools',
              arguments: { query: 'MIT' },
            },
            { id: 'call_2', name: 'get_profile', arguments: {} },
          ],
        }),
      );

      // First tool fails
      toolExecutor.execute
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          success: true,
          result: { gpa: 3.8 },
          duration: 30,
        });

      // Solve still runs
      llm.callStream.mockReturnValue(
        (async function* () {
          yield {
            type: 'content',
            content: '搜索失败，但你的档案显示 GPA 3.8。',
          };
          yield { type: 'done' };
        })() as any,
      );

      const events = await collectEvents(
        service.runStream(AgentType.SCHOOL, mockConfig, mockConversation, []),
      );

      // Both tool_start/tool_end pairs emitted
      const toolEnds = events.filter((e) => e.type === 'tool_end');
      expect(toolEnds).toHaveLength(2);

      // Failed tool has error message written to memory
      expect(memory.addMessage).toHaveBeenCalledWith(
        mockConversation,
        expect.objectContaining({
          role: 'tool',
          content: JSON.stringify({ error: 'Network timeout' }),
          toolCallId: 'call_1',
        }),
      );

      // Solve phase still produces output
      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent!.result!.message).toBe(
        '搜索失败，但你的档案显示 GPA 3.8。',
      );
    });

    it('should mark step as failed when tool returns success: false', async () => {
      llm.call.mockResolvedValue(
        mockLLMResponse({
          content: '',
          toolCalls: [{ id: 'call_1', name: 'get_profile', arguments: {} }],
        }),
      );

      toolExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Profile not found',
        duration: 10,
      });

      llm.callStream.mockReturnValue(
        (async function* () {
          yield { type: 'content', content: '未找到档案。' };
          yield { type: 'done' };
        })() as any,
      );

      const events = await collectEvents(
        service.runStream(AgentType.PROFILE, mockConfig, mockConversation, []),
      );

      // Tool result written as error
      expect(memory.addMessage).toHaveBeenCalledWith(
        mockConversation,
        expect.objectContaining({
          role: 'tool',
          content: JSON.stringify({ error: 'Profile not found' }),
          toolCallId: 'call_1',
        }),
      );

      const doneEvent = events.find((e) => e.type === 'done');
      // Failed tools should not appear in toolsUsed
      expect(doneEvent!.result!.toolsUsed).toEqual([]);
    });
  });

  // ==================== Solve Phase Fallback ====================

  describe('Solve phase empty content fallback', () => {
    beforeEach(() => {
      llm.call.mockResolvedValue(
        mockLLMResponse({
          content: '',
          toolCalls: [{ id: 'call_1', name: 'get_profile', arguments: {} }],
        }),
      );

      toolExecutor.execute.mockResolvedValue({
        success: true,
        result: { gpa: 3.8 },
        duration: 20,
      });
    });

    it('should fallback to non-streaming call when streaming produces empty content', async () => {
      // Streaming produces nothing
      llm.callStream.mockReturnValue(
        (async function* () {
          yield { type: 'done' };
        })() as any,
      );

      // Non-streaming fallback works
      llm.call
        .mockResolvedValueOnce(
          mockLLMResponse({
            content: '',
            toolCalls: [{ id: 'call_1', name: 'get_profile', arguments: {} }],
          }),
        )
        .mockResolvedValueOnce(
          mockLLMResponse({
            content: '根据你的档案，GPA 3.8。',
          }),
        );

      const events = await collectEvents(
        service.runStream(AgentType.PROFILE, mockConfig, mockConversation, []),
      );

      // llm.call called twice: once for Plan, once for Solve fallback
      expect(llm.call).toHaveBeenCalledTimes(2);

      const solveChunks = events.filter((e) => e.type === 'solve_content');
      expect(solveChunks).toHaveLength(1);
      expect(solveChunks[0].content).toBe('根据你的档案，GPA 3.8。');
    });
  });

  // ==================== Enterprise Memory Context Caching ====================

  describe('Enterprise memory context caching', () => {
    it('should call getRetrievalContext only once for the entire workflow', async () => {
      memoryManager.getRetrievalContext.mockResolvedValue({
        facts: ['GPA 3.8'],
      } as any);
      memoryManager.buildContextSummary.mockReturnValue('记忆：GPA 3.8');

      // Full three-phase workflow
      llm.call.mockResolvedValue(
        mockLLMResponse({
          content: '',
          toolCalls: [{ id: 'call_1', name: 'get_profile', arguments: {} }],
        }),
      );

      toolExecutor.execute.mockResolvedValue({
        success: true,
        result: { gpa: 3.8 },
        duration: 20,
      });

      llm.callStream.mockReturnValue(
        (async function* () {
          yield { type: 'content', content: '回复内容' };
          yield { type: 'done' };
        })() as any,
      );

      await collectEvents(
        service.runStream(AgentType.PROFILE, mockConfig, mockConversation, []),
      );

      // Enterprise memory retrieval called exactly once at the top of runStream,
      // not once per phase
      expect(memoryManager.getRetrievalContext).toHaveBeenCalledTimes(1);
      expect(memoryManager.getRetrievalContext).toHaveBeenCalledWith(
        'user_1',
        '你好',
        'conv_1',
      );
    });

    it('should return empty context when no user message exists', async () => {
      const convWithoutUserMsg: ConversationState = {
        ...mockConversation,
        messages: [],
      };

      llm.call.mockResolvedValue(mockLLMResponse({ content: '你好！' }));

      await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          convWithoutUserMsg,
          [],
        ),
      );

      // No user message means no retrieval call
      expect(memoryManager.getRetrievalContext).not.toHaveBeenCalled();
    });

    it('should gracefully handle enterprise memory retrieval failure', async () => {
      memoryManager.getRetrievalContext.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      llm.call.mockResolvedValue(mockLLMResponse({ content: '你好！' }));

      const events = await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      // Workflow still completes despite memory failure
      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent).toBeDefined();
      expect(doneEvent!.result!.message).toBe('你好！');
    });
  });

  // ==================== Plan Deduplication ====================

  describe('Plan tool call deduplication', () => {
    it('should deduplicate tool calls with the same name', async () => {
      llm.call.mockResolvedValue(
        mockLLMResponse({
          content: '',
          toolCalls: [
            { id: 'call_1', name: 'get_profile', arguments: {} },
            { id: 'call_2', name: 'get_profile', arguments: { extra: true } },
            {
              id: 'call_3',
              name: 'search_schools',
              arguments: { query: 'MIT' },
            },
          ],
        }),
      );

      toolExecutor.execute.mockResolvedValue({
        success: true,
        result: {},
        duration: 10,
      });

      llm.callStream.mockReturnValue(
        (async function* () {
          yield { type: 'content', content: '结果' };
          yield { type: 'done' };
        })() as any,
      );

      const events = await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      // Only 2 tool executions (deduped from 3)
      expect(toolExecutor.execute).toHaveBeenCalledTimes(2);

      const toolStarts = events.filter((e) => e.type === 'tool_start');
      expect(toolStarts).toHaveLength(2);
      expect(toolStarts[0].tool).toBe('get_profile');
      expect(toolStarts[1].tool).toBe('search_schools');
    });
  });

  // ==================== Non-streaming run() wrapper ====================

  describe('run() non-streaming wrapper', () => {
    it('should return WorkflowResult from runStream done event', async () => {
      llm.call.mockResolvedValue(
        mockLLMResponse({
          content: '你好！我可以帮助你。',
        }),
      );

      const result = await service.run(
        AgentType.ORCHESTRATOR,
        mockConfig,
        mockConversation,
        [],
      );

      expect(result.message).toBe('你好！我可以帮助你。');
      expect(result.toolsUsed).toEqual([]);
    });

    it('should throw InternalServerErrorException on error event', async () => {
      llm.call.mockRejectedValue(new Error('LLM is down'));

      await expect(
        service.run(AgentType.ORCHESTRATOR, mockConfig, mockConversation, []),
      ).rejects.toThrow('LLM is down');
    });
  });

  // ==================== Locale Handling ====================

  describe('Locale handling', () => {
    it('should use English prompts when locale is en', async () => {
      const enConversation: ConversationState = {
        ...mockConversation,
        metadata: { locale: 'en' },
      };

      llm.call.mockResolvedValue(mockLLMResponse({ content: 'Hello!' }));

      await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          enConversation,
          [],
        ),
      );

      // Verify the system prompt passed to LLM contains English plan suffix
      const callArgs = llm.call.mock.calls[0];
      const systemPrompt = callArgs[0];
      expect(systemPrompt).toContain('Workflow Instructions');
      expect(systemPrompt).toContain('planning phase');
    });

    it('should use Chinese prompts when locale is zh', async () => {
      llm.call.mockResolvedValue(mockLLMResponse({ content: '你好！' }));

      await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      const callArgs = llm.call.mock.calls[0];
      const systemPrompt = callArgs[0];
      expect(systemPrompt).toContain('工作流指令');
      expect(systemPrompt).toContain('规划阶段');
    });
  });

  // ==================== Error Boundary ====================

  describe('Error boundary', () => {
    it('should emit error event when Plan phase throws', async () => {
      llm.call.mockRejectedValue(new Error('Rate limit exceeded'));

      const events = await collectEvents(
        service.runStream(
          AgentType.ORCHESTRATOR,
          mockConfig,
          mockConversation,
          [],
        ),
      );

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.error).toBe('Rate limit exceeded');
    });
  });
});
