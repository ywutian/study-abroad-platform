/**
 * 协调者服务 - 管理多 Agent 协作（支持流式输出）
 *
 * 集成企业级记忆系统、弹性保护、限流、快速路由
 *
 * 记忆系统优先级：
 * 1. MemoryManagerService（企业级，Redis + PostgreSQL）
 * 2. MemoryService（降级，内存）
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryType } from '@prisma/client';
import { AgentRunnerService } from './agent-runner.service';
import { MemoryService } from './memory.service';
import { LLMService, StreamChunk } from './llm.service';
import { ToolExecutorService } from './tool-executor.service';
import {
  WorkflowEngineService,
  WorkflowStreamEvent,
  WorkflowPhase,
} from './workflow-engine.service';
import { MemoryManagerService } from '../memory';
import { FastRouterService } from './fast-router.service';
import { FallbackService } from './fallback.service';
import { ConfigValidatorService } from '../config/config-validator.service';
import { AGENT_CONFIGS } from '../config/agents.config';
import { TOOLS } from '../config/tools.config';
import {
  AgentType,
  AgentResponse,
  ConversationState,
  ToolDefinition,
  Message,
  AgentConfig,
} from '../types';
import {
  ToolExecutionResult,
  ActionSuggestion,
  PendingToolCall,
} from './types';
import { randomUUID } from 'crypto';

// 辅助函数：创建完整 Message 对象
function createMsg(partial: Omit<Message, 'id' | 'timestamp'>): Message {
  return {
    id: randomUUID(),
    timestamp: new Date(),
    ...partial,
  };
}

export interface StreamEvent {
  type:
    | 'start'
    | 'content'
    | 'tool_start'
    | 'tool_end'
    | 'agent_switch'
    | 'done'
    | 'error';
  agent?: AgentType;
  conversationId?: string;
  content?: string;
  tool?: string;
  toolResult?: ToolExecutionResult;
  response?: AgentResponse;
  error?: string;
  /** 检索到的相关记忆 */
  memoryContext?: {
    recentMemories: number;
    relevantFacts: number;
    entities: string[];
  };
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);
  private readonly maxDelegationDepth: number;

  // 是否使用企业级记忆系统
  private readonly useEnterpriseMemory: boolean;

  constructor(
    private agentRunner: AgentRunnerService,
    private memory: MemoryService,
    private llm: LLMService,
    private toolExecutor: ToolExecutorService,
    private workflowEngine: WorkflowEngineService,
    private configService: ConfigService,
    @Optional() private configValidator?: ConfigValidatorService,
    @Optional() private memoryManager?: MemoryManagerService,
    @Optional() private fastRouter?: FastRouterService,
    @Optional() private fallback?: FallbackService,
  ) {
    this.maxDelegationDepth = this.configService.get<number>(
      'AGENT_MAX_DELEGATION_DEPTH',
      3,
    );
    this.useEnterpriseMemory = !!this.memoryManager;

    if (this.useEnterpriseMemory) {
      this.logger.log('Using enterprise memory system (MemoryManagerService)');
    } else {
      this.logger.warn(
        'Enterprise memory not available, using fallback MemoryService',
      );
    }
  }

  /**
   * 处理用户消息（统一入口）
   *
   * 自动选择记忆系统：优先使用企业级 MemoryManagerService
   * 注: 限流和配额检查已在 Guard 层完成
   */
  async handleMessage(
    userId: string,
    message: string,
    conversationId?: string,
  ): Promise<AgentResponse> {
    try {
      // 1. 快速路由检查 (减少 LLM 调用)
      if (this.fastRouter) {
        // 简单问答直接回复
        const simpleResponse = this.fastRouter.getSimpleResponse(message);
        if (simpleResponse) {
          return {
            message: simpleResponse,
            agentType: AgentType.ORCHESTRATOR,
            data: { fastRoute: true },
          };
        }

        // 尝试快速路由到专业 Agent
        const routeResult = this.fastRouter.route(message);
        if (!routeResult.shouldUseLLM && routeResult.agent) {
          this.logger.debug(
            `Fast route to ${routeResult.agent} (confidence: ${routeResult.confidence})`,
          );

          const conversation = await this.getOrCreateConversation(
            userId,
            conversationId,
          );
          await this.addMessage(
            conversation,
            createMsg({ role: 'user', content: message }),
          );

          return this.agentRunner.run(routeResult.agent, conversation, message);
        }
      }

      // 2. 正常处理流程
      const conversation = await this.getOrCreateConversation(
        userId,
        conversationId,
      );
      await this.addMessage(
        conversation,
        createMsg({ role: 'user', content: message }),
      );

      let response = await this.agentRunner.run(
        AgentType.ORCHESTRATOR,
        conversation,
        message,
      );

      // 3. 处理委派
      let delegationDepth = 0;

      while (
        response.delegatedTo &&
        delegationDepth < this.maxDelegationDepth
      ) {
        delegationDepth++;
        this.logger.debug(`Delegating to ${response.delegatedTo}`);

        const task = (response.data?.task as string) || message;

        await this.addMessage(
          conversation,
          createMsg({
            role: 'system',
            content: `[委派给 ${response.delegatedTo} 处理: ${task}]`,
          }),
        );

        response = await this.agentRunner.run(
          response.delegatedTo,
          conversation,
          task,
        );
      }

      // 4. 保存 assistant 响应到企业级记忆
      if (this.useEnterpriseMemory) {
        await this.memoryManager!.addMessage(conversation.id, {
          role: 'assistant',
          content: response.message,
          agentType: response.agentType,
        });
      }

      return response;
    } catch (error) {
      // 5. 错误处理与降级
      if (this.fallback) {
        return this.fallback.getFallbackResponse(
          error instanceof Error ? error : new Error(String(error)),
          undefined,
          { userId, conversationId, userMessage: message },
        );
      }
      throw error;
    }
  }

  /**
   * 获取或创建对话（统一方法）
   */
  private async getOrCreateConversation(
    userId: string,
    conversationId?: string,
  ): Promise<ConversationState> {
    if (this.useEnterpriseMemory) {
      // 企业级：先通过 MemoryManager 获取/创建，再同步到 MemoryService
      const conv = await this.memoryManager!.getOrCreateConversation(
        userId,
        conversationId,
      );
      // 同步到内存（用于 AgentRunner 兼容）
      return this.memory.getOrCreateConversation(userId, conv.id);
    }
    return this.memory.getOrCreateConversation(userId, conversationId);
  }

  /**
   * 添加消息（统一方法）
   */
  private async addMessage(
    conversation: ConversationState,
    message: Message,
  ): Promise<void> {
    // 始终写入内存（AgentRunner 需要）
    this.memory.addMessage(conversation, message);

    // 企业级：同时写入 Redis/PostgreSQL
    if (this.useEnterpriseMemory && message.role !== 'system') {
      await this.memoryManager!.addMessage(conversation.id, message);
    }
  }

  /**
   * 直接调用特定 Agent
   */
  async callAgent(
    userId: string,
    agentType: AgentType,
    message: string,
    conversationId?: string,
  ): Promise<AgentResponse> {
    this.logger.log(
      `callAgent started: userId=${userId}, agent=${agentType}, conversationId=${conversationId}`,
    );

    const conversation = await this.getOrCreateConversation(
      userId,
      conversationId,
    );
    await this.addMessage(
      conversation,
      createMsg({ role: 'user', content: message }),
    );

    this.logger.log(`callAgent: conversation ready, starting agent run`);
    const response = await this.agentRunner.run(
      agentType,
      conversation,
      message,
    );

    this.logger.log(`callAgent completed: agent=${response.agentType}`);
    return response;
  }

  /**
   * 获取对话历史
   */
  async getHistory(userId: string, conversationId?: string) {
    // 优先从企业级记忆获取
    if (this.useEnterpriseMemory && conversationId) {
      return this.memoryManager!.getConversationHistory(conversationId);
    }

    const conversation = await this.memory.getOrCreateConversation(
      userId,
      conversationId,
    );
    return conversation.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: m.content,
        agentType: m.agentType,
        timestamp: m.timestamp,
      }));
  }

  /**
   * 清除对话
   */
  async clearConversation(userId: string, conversationId?: string) {
    this.memory.clearConversation(userId, conversationId);
    // 企业级记忆清除
    if (this.memoryManager && conversationId) {
      await this.memoryManager.clearConversation(conversationId);
    }
  }

  /**
   * 刷新用户上下文
   */
  async refreshContext(userId: string) {
    return this.memory.refreshUserContext(userId);
  }

  /**
   * 流式处理用户消息
   *
   * 注: 限流和配额检查已在 Guard 层完成
   */
  async *handleMessageStream(
    userId: string,
    message: string,
    conversationId?: string,
  ): AsyncGenerator<StreamEvent> {
    // 1. 快速路由 (减少 LLM 调用)
    if (this.fastRouter) {
      const simpleResponse = this.fastRouter.getSimpleResponse(message);
      if (simpleResponse) {
        yield { type: 'start', agent: AgentType.ORCHESTRATOR };
        yield {
          type: 'content',
          agent: AgentType.ORCHESTRATOR,
          content: simpleResponse,
        };
        yield {
          type: 'done',
          agent: AgentType.ORCHESTRATOR,
          response: {
            message: simpleResponse,
            agentType: AgentType.ORCHESTRATOR,
          },
        };
        return;
      }

      const routeResult = this.fastRouter.route(message);
      if (!routeResult.shouldUseLLM && routeResult.agent) {
        const conversation = await this.getOrCreateConversation(
          userId,
          conversationId,
        );
        await this.addMessage(
          conversation,
          createMsg({ role: 'user', content: message }),
        );

        yield { type: 'start', agent: routeResult.agent };
        yield* this.runAgentStream(routeResult.agent, conversation);
        return;
      }
    }

    // 2. 正常流程
    const conversation = await this.getOrCreateConversation(
      userId,
      conversationId,
    );
    await this.addMessage(
      conversation,
      createMsg({ role: 'user', content: message }),
    );

    // 获取记忆上下文统计
    let memoryContext: StreamEvent['memoryContext'];
    if (this.memoryManager) {
      try {
        const ctx = await this.memoryManager.getRetrievalContext(
          userId,
          message,
          conversation.id,
        );
        memoryContext = {
          recentMemories: ctx.relevantMemories.length,
          relevantFacts: ctx.relevantMemories.filter((m) => m.type === 'FACT')
            .length,
          entities: ctx.entities.map((e) => e.name),
        };
      } catch (err) {
        this.logger.warn('Failed to retrieve memory context', err);
      }
    }

    yield {
      type: 'start',
      agent: AgentType.ORCHESTRATOR,
      conversationId: conversation.id,
      memoryContext,
    };

    try {
      yield* this.runAgentStream(AgentType.ORCHESTRATOR, conversation);
    } catch (error) {
      // 错误降级
      if (this.fallback) {
        const fallbackResponse = this.fallback.getFallbackResponse(
          error instanceof Error ? error : new Error(String(error)),
        );
        yield { type: 'error', error: fallbackResponse.message };
        yield { type: 'done', response: fallbackResponse };
      } else {
        yield {
          type: 'error',
          error: error instanceof Error ? error.message : '处理失败',
        };
      }
    }
  }

  /**
   * 流式运行 Agent — 基于三阶段工作流引擎
   *
   * Plan → Execute → Solve，从根本上杜绝重复 tool 调用
   */
  private async *runAgentStream(
    agentType: AgentType,
    conversation: ConversationState,
    depth: number = 0,
  ): AsyncGenerator<StreamEvent> {
    if (depth > this.maxDelegationDepth) {
      this.logger.warn(
        `Delegation depth exceeded: ${depth} > ${this.maxDelegationDepth}`,
      );
      yield { type: 'error', error: '委派层级过深' };
      return;
    }

    // 企业级：使用 ConfigValidator 获取验证后的配置
    const config =
      this.configValidator?.getValidatedConfig(agentType) ??
      AGENT_CONFIGS[agentType];

    // 配置缺失时使用 FallbackService 处理
    if (!config) {
      this.logger.error(`Agent configuration missing for type: ${agentType}`, {
        availableAgents: Object.keys(AGENT_CONFIGS),
        requestedAgent: agentType,
      });

      if (this.fallback) {
        const fallbackResponse = this.fallback.getFallbackResponse(
          new Error(`Agent configuration not found: ${agentType}`),
          agentType,
        );
        yield { type: 'error', error: fallbackResponse.message };
        yield { type: 'done', response: fallbackResponse };
      } else {
        yield { type: 'error', error: '服务配置出现问题，请稍后再试' };
      }
      return;
    }

    const tools = TOOLS.filter((t) => config.tools.includes(t.name));

    // 使用三阶段工作流引擎（流式）
    for await (const event of this.workflowEngine.runStream(
      agentType,
      config,
      conversation,
      tools,
    )) {
      // 将工作流事件转换为 StreamEvent
      switch (event.type) {
        case 'phase_change':
          // Plan 阶段不通知前端（内部决策）
          // Execute 和 Solve 阶段通知前端
          if (event.phase === WorkflowPhase.SOLVE) {
            // Solve 阶段开始，前端可以准备接收最终内容
          }
          break;

        case 'plan_content':
          // Plan 阶段的直接回复（不需要工具时）
          if (event.content) {
            yield {
              type: 'content',
              agent: agentType,
              content: event.content,
            };
          }
          break;

        case 'tool_start':
          yield {
            type: 'tool_start',
            agent: agentType,
            tool: event.tool,
          };
          break;

        case 'tool_end':
          yield {
            type: 'tool_end',
            agent: agentType,
            tool: event.tool,
            toolResult: event.toolResult,
          };
          break;

        case 'solve_content':
          // Solve 阶段的流式输出 → 这是最终回复
          if (event.content) {
            yield {
              type: 'content',
              agent: agentType,
              content: event.content,
            };
          }
          break;

        case 'done': {
          const result = event.result;

          // 处理委派
          if (result?.delegation) {
            const targetAgent = result.delegation.targetAgent;
            const task = result.delegation.task;

            yield { type: 'agent_switch', agent: targetAgent };

            // 添加任务到对话
            if (task) {
              await this.addMessage(
                conversation,
                createMsg({ role: 'user', content: task }),
              );
            }

            // 递归运行目标 Agent
            yield* this.runAgentStream(targetAgent, conversation, depth + 1);
            return;
          }

          // 正常完成
          yield {
            type: 'done',
            agent: agentType,
            response: {
              message: result?.message || '',
              agentType,
              toolsUsed:
                result?.toolsUsed && result.toolsUsed.length > 0
                  ? result.toolsUsed
                  : undefined,
              suggestions: this.extractSuggestions(result?.message || ''),
              actions: this.generateActions(result?.message || ''),
              data: result
                ? {
                    workflow: {
                      timing: result.timing,
                      steps: result.plan.steps.map((s) => ({
                        tool: s.toolCall.name,
                        status: s.status,
                        duration: s.duration,
                      })),
                    },
                  }
                : undefined,
            },
          };
          return;
        }

        case 'error':
          yield { type: 'error', error: event.error };
          break;
      }
    }
  }

  /**
   * 构建 System Prompt（自动选择是否使用记忆增强）
   *
   * 增强版本：检索多类型记忆，包括：
   * - FACT: 用户陈述的事实
   * - PREFERENCE: 用户偏好
   * - DECISION: 用户决策历史
   * - FEEDBACK: 系统反馈记录
   */
  private async buildSystemPrompt(
    config: AgentConfig,
    conversation: ConversationState,
    currentMessage?: string,
  ): Promise<string> {
    const baseSummary = this.memory.getContextSummary(conversation.context);

    // 如果没有记忆管理器或没有消息，使用基础提示
    if (!this.memoryManager || !currentMessage) {
      return `${config.systemPrompt}\n\n## 当前用户信息\n${baseSummary}`;
    }

    try {
      // 并行获取多种类型的记忆
      const [context, facts, preferences, decisions] = await Promise.all([
        // 语义检索相关记忆
        this.memoryManager.getRetrievalContext(
          conversation.userId,
          currentMessage,
          conversation.id,
        ),
        // 获取用户事实（高重要性）
        this.memoryManager.recall(conversation.userId, {
          types: [MemoryType.FACT],
          minImportance: 0.6,
          limit: 5,
        }),
        // 获取用户偏好
        this.memoryManager.recall(conversation.userId, {
          types: [MemoryType.PREFERENCE],
          limit: 3,
        }),
        // 获取近期决策
        this.memoryManager.recall(conversation.userId, {
          types: [MemoryType.DECISION],
          limit: 3,
        }),
      ]);

      // 构建增强上下文
      const parts: string[] = [];

      // 基础上下文摘要
      const enhancedContext = this.memoryManager.buildContextSummary(context);
      if (enhancedContext) {
        parts.push(enhancedContext);
      }

      // 补充重要事实
      const additionalFacts = facts.filter(
        (f) => !context.relevantMemories.some((m) => m.id === f.id),
      );
      if (additionalFacts.length > 0) {
        parts.push('\n## 用户重要信息');
        for (const fact of additionalFacts) {
          parts.push(`- ${fact.content}`);
        }
      }

      // 补充偏好
      const additionalPrefs = preferences.filter(
        (p) => !context.relevantMemories.some((m) => m.id === p.id),
      );
      if (additionalPrefs.length > 0) {
        parts.push('\n## 用户偏好');
        for (const pref of additionalPrefs) {
          parts.push(`- ${pref.content}`);
        }
      }

      // 补充决策历史
      if (decisions.length > 0) {
        parts.push('\n## 近期决策');
        for (const decision of decisions) {
          parts.push(`- ${decision.content}`);
        }
      }

      return `${config.systemPrompt}

## 当前用户信息
${baseSummary}

## 记忆上下文
${parts.join('\n')}`;
    } catch (error) {
      this.logger.error('Failed to build enhanced context', error);
      return `${config.systemPrompt}\n\n## 当前用户信息\n${baseSummary}`;
    }
  }

  /**
   * 使用企业级记忆系统处理消息
   *
   * @deprecated 使用 handleMessage，已自动集成企业级记忆
   */
  async handleMessageWithMemory(
    userId: string,
    message: string,
    conversationId?: string,
  ): Promise<AgentResponse> {
    // 直接调用统一入口
    return this.handleMessage(userId, message, conversationId);
  }

  /**
   * 获取对话历史（企业级）
   */
  async getConversationHistory(conversationId: string): Promise<any[]> {
    if (this.memoryManager) {
      return this.memoryManager.getConversationHistory(conversationId);
    }
    return [];
  }

  /**
   * 获取用户记忆统计
   */
  async getMemoryStats(userId: string): Promise<any> {
    if (this.memoryManager) {
      return this.memoryManager.getStats(userId);
    }
    return null;
  }

  private extractSuggestions(message: string): string[] | undefined {
    const suggestions: string[] = [];
    const lines = message.split('\n');
    for (const line of lines) {
      const match = line.match(/^[\d\-\*]\s*[\.）\)]\s*(.+)$/);
      if (match) suggestions.push(match[1].trim());
    }
    return suggestions.length > 0 ? suggestions.slice(0, 5) : undefined;
  }

  private generateActions(message: string): ActionSuggestion[] | undefined {
    const actions: ActionSuggestion[] = [];
    const lower = message.toLowerCase();
    if (lower.includes('档案'))
      actions.push({ label: '完善档案', action: 'navigate:/profile' });
    if (lower.includes('文书'))
      actions.push({ label: '文书管理', action: 'navigate:/essays' });
    if (lower.includes('学校') || lower.includes('排名'))
      actions.push({ label: '查看排名', action: 'navigate:/ranking' });
    return actions.length > 0 ? actions : undefined;
  }
}
