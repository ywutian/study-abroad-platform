/**
 * AgentRunnerService 单元测试
 *
 * 测试 ReAct 循环、工具调用、委派处理
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AgentRunnerService } from './agent-runner.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { LLMService } from './llm.service';
import { ToolExecutorService } from './tool-executor.service';
import { MemoryService } from './memory.service';
import { ResilienceService } from './resilience.service';
import { AgentType, ConversationState, UserContext } from '../types';

describe('AgentRunnerService', () => {
  let service: AgentRunnerService;
  let workflow: jest.Mocked<WorkflowEngineService>;
  let memory: jest.Mocked<MemoryService>;

  const mockConversation: ConversationState = {
    id: 'conv_1',
    userId: 'user_1',
    messages: [],
    context: { userId: 'user_1' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRunnerService,
        {
          provide: WorkflowEngineService,
          useValue: {
            run: jest.fn().mockResolvedValue({
              message: '你好！我可以帮助你进行留学申请。',
              toolsUsed: [],
              plan: {
                planningContent: '',
                steps: [],
              },
              timing: {
                planMs: 50,
                executeMs: 30,
                solveMs: 20,
                totalMs: 100,
              },
            }),
            runStream: jest.fn(),
          },
        },
        {
          provide: LLMService,
          useValue: {
            call: jest.fn(),
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
            addMessage: jest
              .fn()
              .mockReturnValue({ id: 'msg_1', timestamp: new Date() }),
            getRecentMessages: jest.fn().mockReturnValue([]),
            getContextSummary: jest.fn().mockReturnValue('用户档案为空'),
          },
        },
        {
          provide: ResilienceService,
          useValue: {
            withTimeout: jest.fn().mockImplementation((fn) => fn()),
          },
        },
      ],
    }).compile();

    service = module.get<AgentRunnerService>(AgentRunnerService);
    workflow = module.get(WorkflowEngineService);
    memory = module.get(MemoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('run', () => {
    it('should return response when workflow returns content', async () => {
      const result = await service.run(
        AgentType.ORCHESTRATOR,
        mockConversation,
        '你好',
      );

      expect(result.message).toBe('你好！我可以帮助你进行留学申请。');
      expect(result.agentType).toBe(AgentType.ORCHESTRATOR);
      expect(memory.addMessage).toHaveBeenCalled();
    });

    it('should include tools used from workflow result', async () => {
      workflow.run.mockResolvedValueOnce({
        message: '根据你的档案，GPA 3.8，目标专业 CS...',
        toolsUsed: ['get_profile'],
        plan: {
          planningContent: '',
          steps: [
            {
              toolCall: { id: 'call_1', name: 'get_profile', arguments: {} },
              status: 'completed',
              duration: 100,
            },
          ],
        },
        timing: { planMs: 50, executeMs: 30, solveMs: 20, totalMs: 100 },
      });

      const result = await service.run(
        AgentType.PROFILE,
        mockConversation,
        '查看我的档案',
      );

      expect(result.toolsUsed).toContain('get_profile');
    });

    it('should handle delegation', async () => {
      workflow.run.mockResolvedValueOnce({
        message: '',
        toolsUsed: [],
        delegation: {
          targetAgent: AgentType.ESSAY,
          task: '帮助用户写文书',
          context: '用户想写 Personal Statement',
        },
        plan: { planningContent: '', steps: [] },
        timing: { planMs: 50, executeMs: 0, solveMs: 0, totalMs: 50 },
      });

      const result = await service.run(
        AgentType.ORCHESTRATOR,
        mockConversation,
        '帮我写文书',
      );

      expect(result.delegatedTo).toBe(AgentType.ESSAY);
    });

    it('should handle workflow errors gracefully', async () => {
      workflow.run.mockResolvedValueOnce({
        message: '抱歉，搜索学校时遇到问题，请稍后再试。',
        toolsUsed: ['search_schools'],
        plan: { planningContent: '', steps: [] },
        timing: { planMs: 50, executeMs: 30, solveMs: 20, totalMs: 100 },
      });

      const result = await service.run(
        AgentType.SCHOOL,
        mockConversation,
        '搜索 MIT',
      );

      expect(result.message).toContain('抱歉');
    });
  });

  describe('extractSuggestions', () => {
    it('should extract numbered suggestions from response', async () => {
      workflow.run.mockResolvedValueOnce({
        message: `根据你的情况，建议：
1. 提高 GPA 到 3.9 以上
2. 准备 SAT 考试
3. 增加课外活动`,
        toolsUsed: [],
        plan: { planningContent: '', steps: [] },
        timing: { planMs: 50, executeMs: 0, solveMs: 20, totalMs: 70 },
      });

      const result = await service.run(
        AgentType.PROFILE,
        mockConversation,
        '分析我的背景',
      );

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });
  });

  describe('generateActions', () => {
    it('should generate navigation actions based on content', async () => {
      workflow.run.mockResolvedValueOnce({
        message: '建议你先完善档案信息，然后查看学校排名。',
        toolsUsed: [],
        plan: { planningContent: '', steps: [] },
        timing: { planMs: 50, executeMs: 0, solveMs: 20, totalMs: 70 },
      });

      const result = await service.run(
        AgentType.ORCHESTRATOR,
        mockConversation,
        '我该怎么开始',
      );

      expect(result.actions).toBeDefined();
    });
  });
});
