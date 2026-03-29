/**
 * 协调者服务 - 管理多 Agent 协作（支持流式输出）
 *
 * 集成企业级记忆系统、弹性保护、限流、快速路由
 *
 * 记忆系统优先级：
 * 1. MemoryManagerService（企业级，Redis + PostgreSQL）
 * 2. MemoryService（降级，内存）
 *
 * === 架构守护 ===
 * - PG 写入：仅 Orchestrator 通过 memoryManager（addMessage / persistWorkflowMessages）
 * - 内存写入：WorkflowEngine 通过 MemoryService（不触及 PG/Redis）
 * - 新增持久化入口必须走 persistWorkflowMessages，禁止在 WorkflowEngine 中直接注入 MemoryManager
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRunnerService } from './agent-runner.service';
import { MemoryService } from './memory.service';
import { LLMService } from './llm.service';
import { ToolExecutorService } from './tool-executor.service';
import {
  WorkflowEngineService,
  WorkflowPhase,
} from './workflow-engine.service';
import { MemoryManagerService } from '../memory';
import {
  ContentModerationService,
  ModerationAction,
} from '../security/content-moderation.service';
import { FastRouterService } from './fast-router.service';
import { EmbeddingRouterService } from './embedding-router.service';
import { FallbackService } from './fallback.service';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { RedisService } from '../../../common/redis/redis.service';
import { ConfigValidatorService } from '../config/config-validator.service';
import { AGENT_CONFIGS } from '../config/agents.config';
import { TOOLS } from '../config/tools.config';
import { AgentType, AgentResponse, ConversationState, Message } from '../types';
import { MessageInput } from '../memory/types';
import { ActionSuggestion } from './types';
import { StreamEvent } from '@study-abroad/shared';
import { randomUUID } from 'crypto';

export type { StreamEvent };

// 辅助函数：创建完整 Message 对象
function createMsg(partial: Omit<Message, 'id' | 'timestamp'>): Message {
  return {
    id: randomUUID(),
    timestamp: new Date(),
    ...partial,
  };
}

/**
 * Convert an in-memory Message to a MessageInput suitable for enterprise persistence.
 *
 * Extracts tokensUsed/latencyMs from metadata (set by WorkflowEngine) and maps
 * toolCalls to ToolCallRecord format. Fields not present in the AgentMessage schema
 * (metadata, toolCallId) are intentionally dropped.
 */
function toMessageInput(msg: Message): MessageInput {
  return {
    role: msg.role,
    content: msg.content,
    agentType: msg.agentType,
    toolCalls: msg.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    })),
    tokensUsed: msg.metadata?.tokensUsed ?? undefined,
    latencyMs: msg.metadata?.latencyMs ?? undefined,
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
    private contentModeration: ContentModerationService,
    @Optional() private configValidator?: ConfigValidatorService,
    @Optional() private memoryManager?: MemoryManagerService,
    @Optional() private fastRouter?: FastRouterService,
    @Optional() private embeddingRouter?: EmbeddingRouterService,
    @Optional() private fallback?: FallbackService,
    @Optional() private metricsService?: MetricsService,
    @Optional() private redis?: RedisService,
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

  // ==================== 对话级锁 ====================

  /** Acquire a per-conversation lock (Redis SET NX, 60s TTL). Returns false if already locked. */
  private async acquireConversationLock(key: string): Promise<boolean> {
    const client = this.redis?.getClient();
    if (!client) return true; // No Redis = no locking (single-instance safe)
    try {
      const result = await client.set(`lock:conv:${key}`, '1', 'EX', 60, 'NX');
      return result === 'OK';
    } catch {
      return true; // Fail-open: allow request if Redis is down
    }
  }

  /** Release the per-conversation lock. */
  private async releaseConversationLock(key: string): Promise<void> {
    const client = this.redis?.getClient();
    if (!client) return;
    try {
      await client.del(`lock:conv:${key}`);
    } catch {
      // Best-effort: lock will expire in 60s anyway
    }
  }

  /**
   * Process a user message through the multi-agent orchestration pipeline (non-streaming).
   *
   * Execution flow:
   * 1. Fast-route check (keyword-based, bypasses LLM if confident)
   * 2. Orchestrator agent determines intent and may delegate to specialist agents
   * 3. Delegation loop runs up to `maxDelegationDepth` times
   * 4. Final assistant response is persisted to enterprise memory
   *
   * @param userId - Authenticated user ID
   * @param message - Raw user message text
   * @param conversationId - Optional existing conversation ID; a new conversation is created if omitted
   * @param locale - Response locale ('zh' | 'en'), defaults to 'zh'
   * @returns The agent's response including message text, agent type, and optional suggestions/actions
   * @throws {Error} Re-thrown if no FallbackService is available and an internal error occurs
   */
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
    locale: string = 'zh',
  ): Promise<AgentResponse> {
    const lockKey = conversationId || userId;
    if (!(await this.acquireConversationLock(lockKey))) {
      return {
        message:
          locale === 'en'
            ? 'Still processing your previous message. Please wait a moment.'
            : '正在处理上一条消息，请稍后再发送。',
        agentType: AgentType.ORCHESTRATOR,
      };
    }

    try {
      // 1. 快速路由检查 (减少 LLM 调用)
      if (this.fastRouter) {
        // 简单问答直接回复
        const simpleResponse = this.fastRouter.getSimpleResponse(message);
        if (simpleResponse) {
          const conv = await this.getOrCreateConversation(
            userId,
            conversationId,
          );
          conv.metadata = { ...conv.metadata, locale };
          await this.addMessage(
            conv,
            createMsg({ role: 'user', content: message }),
          );
          const moderated = await this.persistAssistantResponse(
            conv,
            simpleResponse,
            AgentType.ORCHESTRATOR,
          );
          return {
            message: moderated,
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
          this.metricsService?.recordRoutingDecision('fast');

          const conversation = await this.getOrCreateConversation(
            userId,
            conversationId,
          );
          conversation.metadata = { ...conversation.metadata, locale };
          await this.addMessage(
            conversation,
            createMsg({ role: 'user', content: message }),
          );

          const watermark = conversation.messages.length;
          const response = await this.agentRunner.run(
            routeResult.agent,
            conversation,
          );
          await this.persistWorkflowMessages(conversation, watermark);
          const moderated = await this.persistAssistantResponse(
            conversation,
            response.message,
            response.agentType,
          );
          return { ...response, message: moderated };
        }
      }

      // 2. 语义路由 (Embedding, ~5ms)
      if (this.embeddingRouter) {
        const embeddingResult = await this.embeddingRouter.route(message);
        if (!embeddingResult.shouldUseLLM && embeddingResult.agent) {
          this.logger.debug(
            `Embedding route to ${embeddingResult.agent} (similarity: ${embeddingResult.confidence.toFixed(3)})`,
          );
          this.metricsService?.recordRoutingDecision('embedding');

          const conversation = await this.getOrCreateConversation(
            userId,
            conversationId,
          );
          conversation.metadata = { ...conversation.metadata, locale };
          await this.addMessage(
            conversation,
            createMsg({ role: 'user', content: message }),
          );

          const watermark = conversation.messages.length;
          const response = await this.agentRunner.run(
            embeddingResult.agent,
            conversation,
          );
          await this.persistWorkflowMessages(conversation, watermark);
          const moderated = await this.persistAssistantResponse(
            conversation,
            response.message,
            response.agentType,
          );
          return { ...response, message: moderated };
        }
      }

      // 3. 正常处理流程 (LLM Orchestrator)
      this.metricsService?.recordRoutingDecision('llm');
      const conversation = await this.getOrCreateConversation(
        userId,
        conversationId,
      );
      conversation.metadata = { ...conversation.metadata, locale };
      await this.addMessage(
        conversation,
        createMsg({ role: 'user', content: message }),
      );

      let watermark = conversation.messages.length;
      let response = await this.agentRunner.run(
        AgentType.ORCHESTRATOR,
        conversation,
      );
      await this.persistWorkflowMessages(conversation, watermark);

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
            role: 'assistant',
            content: `[委派给 ${response.delegatedTo} 处理: ${task}]`,
            agentType: AgentType.ORCHESTRATOR,
            metadata: { delegation: true, targetAgent: response.delegatedTo },
          }),
        );

        watermark = conversation.messages.length;
        response = await this.agentRunner.run(
          response.delegatedTo,
          conversation,
        );
        await this.persistWorkflowMessages(conversation, watermark);
      }

      // 4. 保存 assistant 响应（in-memory + enterprise）
      const moderated = await this.persistAssistantResponse(
        conversation,
        response.message,
        response.agentType,
      );

      return { ...response, message: moderated };
    } catch (error) {
      // 5. 错误处理与降级
      if (this.fallback) {
        return this.fallback.getFallbackResponse(
          error instanceof Error ? error : new Error(String(error)),
          undefined,
          { userId, conversationId, userMessage: message, locale },
        );
      }
      throw error;
    } finally {
      await this.releaseConversationLock(lockKey);
    }
  }

  /**
   * Retrieve an existing conversation or create a new one.
   *
   * When enterprise memory is enabled, the conversation is first resolved via
   * MemoryManagerService (Redis/PostgreSQL) and then synced to the in-memory
   * MemoryService so that AgentRunnerService can access it.
   *
   * @param userId - Owner of the conversation
   * @param conversationId - Optional ID of an existing conversation
   * @returns The conversation state object
   */
  /**
   * 获取或创建对话（统一方法）
   */
  private async getOrCreateConversation(
    userId: string,
    conversationId?: string,
  ): Promise<ConversationState> {
    if (this.useEnterpriseMemory) {
      const conv = await this.memoryManager!.getOrCreateConversation(
        userId,
        conversationId,
      );
      const conversation = await this.memory.getOrCreateConversation(
        userId,
        conv.id,
      );

      // Backfill enterprise memory history into in-memory state so the
      // workflow engine's Plan/Solve phases see prior conversation turns.
      if (conversationId && conversation.messages.length === 0) {
        try {
          const history = await this.memoryManager!.getConversationHistory(
            conv.id,
          );
          for (const msg of history) {
            conversation.messages.push({
              id: msg.id,
              role: msg.role as Message['role'],
              content: msg.content,
              agentType: msg.agentType as AgentType | undefined,
              timestamp: msg.createdAt,
            });
          }
        } catch (err) {
          this.logger.warn('Failed to backfill conversation history', err);
        }
      }

      return conversation;
    }
    return this.memory.getOrCreateConversation(userId, conversationId);
  }

  /**
   * Persist a message to both in-memory and enterprise storage.
   *
   * The in-memory write always happens (required by AgentRunner).
   * Enterprise-level persistence (Redis + PostgreSQL) is performed for non-system messages
   * when MemoryManagerService is available.
   *
   * @param conversation - The target conversation state
   * @param message - The message to append
   */
  /**
   * 添加消息（统一方法）
   */
  private async addMessage(
    conversation: ConversationState,
    message: Message,
  ): Promise<void> {
    // 始终写入内存（AgentRunner 需要）
    this.memory.addMessage(conversation, message);

    // 企业级：同时写入 Redis/PostgreSQL（统一使用 toMessageInput 映射）
    if (this.useEnterpriseMemory && message.role !== 'system') {
      await this.memoryManager!.addMessage(
        conversation.id,
        toMessageInput(message),
      );
    }
  }

  /**
   * Persist an assistant response to both in-memory and enterprise storage.
   * No-op if content is empty. Used as the unified exit-path for all response routes.
   *
   * Runs output content moderation before persisting. Returns the (possibly
   * moderated) content so callers can use it in the HTTP/WS response.
   */
  private async persistAssistantResponse(
    conversation: ConversationState,
    content: string,
    agentType: AgentType,
  ): Promise<string> {
    if (!content) return content;

    // Output moderation: sanitize or block before persisting
    try {
      const modResult = await this.contentModeration.moderate(content, {
        context: 'output',
        sanitize: true,
      });
      if (
        modResult.action === ModerationAction.SANITIZE &&
        modResult.sanitizedContent
      ) {
        content = modResult.sanitizedContent;
      } else if (modResult.action === ModerationAction.BLOCK) {
        this.logger.warn(
          `Output blocked by content moderation: ${modResult.details.map((d) => d.type).join(', ')}`,
        );
        content =
          conversation.metadata?.locale === 'en'
            ? 'I apologize, but I cannot provide that response.'
            : '抱歉，我无法提供该回复。';
      }
    } catch (err) {
      this.logger.warn('Output moderation check failed', err);
      // Fail-open: persist original content if moderation errors
    }

    await this.addMessage(
      conversation,
      createMsg({ role: 'assistant', content, agentType }),
    );
    return content;
  }

  /**
   * Persist workflow-generated tool messages (role=tool and assistant+toolCalls)
   * to enterprise memory. Uses a watermark pattern: caller records conversation
   * message count before workflow runs, then slices new messages after.
   *
   * Architecture note:
   * - Only the Orchestrator writes to PG (via memoryManager).
   * - WorkflowEngine only writes to in-process MemoryService.
   * - Any new persistence entry point must go through this method.
   *
   * @param conversation - The conversation state (contains in-memory messages)
   * @param watermark - The message count before the workflow run
   */
  private async persistWorkflowMessages(
    conversation: ConversationState,
    watermark: number,
  ): Promise<void> {
    if (!this.useEnterpriseMemory) return;

    const newMessages = conversation.messages.slice(watermark);
    const toolMessages = newMessages.filter(
      (m) =>
        m.role === 'tool' ||
        (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0),
    );

    for (const msg of toolMessages) {
      try {
        await this.memoryManager!.addMessage(
          conversation.id,
          toMessageInput(msg),
        );
      } catch (err) {
        this.logger.warn(
          `Failed to persist workflow message (role=${msg.role})`,
          err,
        );
      }
    }
  }

  /**
   * Invoke a specific agent type directly, bypassing the orchestrator's routing logic.
   *
   * Useful for scenarios where the caller already knows which specialist agent
   * should handle the request (e.g., UI-driven agent selection).
   *
   * @param userId - Authenticated user ID
   * @param agentType - The specific agent to invoke
   * @param message - Raw user message text
   * @param conversationId - Optional existing conversation ID
   * @param locale - Response locale ('zh' | 'en'), defaults to 'zh'
   * @returns The agent's response
   */
  /**
   * 直接调用特定 Agent
   */
  async callAgent(
    userId: string,
    agentType: AgentType,
    message: string,
    conversationId?: string,
    locale: string = 'zh',
  ): Promise<AgentResponse> {
    this.logger.log(
      `callAgent started: userId=${userId}, agent=${agentType}, conversationId=${conversationId}`,
    );

    const conversation = await this.getOrCreateConversation(
      userId,
      conversationId,
    );
    conversation.metadata = { ...conversation.metadata, locale };
    await this.addMessage(
      conversation,
      createMsg({ role: 'user', content: message }),
    );

    this.logger.log(`callAgent: conversation ready, starting agent run`);
    const watermark = conversation.messages.length;
    const response = await this.agentRunner.run(agentType, conversation);
    await this.persistWorkflowMessages(conversation, watermark);

    const moderated = await this.persistAssistantResponse(
      conversation,
      response.message,
      response.agentType,
    );

    this.logger.log(`callAgent completed: agent=${response.agentType}`);
    return { ...response, message: moderated };
  }

  /**
   * Retrieve the message history for a conversation.
   *
   * Prefers enterprise memory (MemoryManagerService) when available;
   * falls back to in-memory MemoryService otherwise. Only user and
   * assistant messages are returned (system messages are filtered out).
   *
   * @param userId - Owner of the conversation
   * @param conversationId - Optional conversation ID; if omitted, uses the user's default conversation
   * @returns Array of message objects with role, content, agentType, and timestamp
   */
  /**
   * 获取对话历史
   */
  async getHistory(userId: string, conversationId?: string) {
    // 优先从企业级记忆获取（含 ownership 校验）
    if (this.useEnterpriseMemory && conversationId) {
      const conversation =
        await this.memoryManager!.getConversation(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return [];
      }
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
   * Clear a conversation from both in-memory and enterprise storage.
   *
   * @param userId - Owner of the conversation
   * @param conversationId - Optional conversation ID to clear; clears the default conversation if omitted
   */
  /**
   * 清除对话
   */
  async clearConversation(userId: string, conversationId?: string) {
    this.memory.clearConversation(userId, conversationId);
    // 企业级记忆清除（含 ownership 校验）
    if (this.memoryManager && conversationId) {
      const conversation =
        await this.memoryManager.getConversation(conversationId);
      if (conversation && conversation.userId === userId) {
        await this.memoryManager.clearConversation(conversationId);
      }
    }
  }

  /**
   * Refresh the user's context data (profile, preferences, etc.) from the database.
   *
   * @param userId - The user whose context should be refreshed
   * @returns Updated user context
   */
  /**
   * 刷新用户上下文
   */
  async refreshContext(userId: string) {
    return this.memory.refreshUserContext(userId);
  }

  /**
   * Process a user message with streaming output via an async generator.
   *
   * Yields a sequence of {@link StreamEvent} objects:
   * - `start`  : conversation metadata (ID, title, memory context)
   * - `content` : incremental text chunks
   * - `tool_start` / `tool_end` : tool execution lifecycle events
   * - `agent_switch` : delegation to another agent
   * - `done`   : final aggregated response
   * - `error`  : error information (with optional fallback)
   *
   * The method mirrors `handleMessage` but uses streaming for real-time UX.
   *
   * @param userId - Authenticated user ID
   * @param message - Raw user message text
   * @param conversationId - Optional existing conversation ID
   * @param locale - Response locale ('zh' | 'en'), defaults to 'zh'
   * @returns An async generator of StreamEvent objects
   */
  /**
   * 流式处理用户消息
   *
   * 注: 限流和配额检查已在 Guard 层完成
   */
  async *handleMessageStream(
    userId: string,
    message: string,
    conversationId?: string,
    locale: string = 'zh',
  ): AsyncGenerator<StreamEvent> {
    const lockKey = conversationId || userId;
    if (!(await this.acquireConversationLock(lockKey))) {
      yield {
        type: 'error',
        error:
          locale === 'en'
            ? 'Still processing your previous message. Please wait.'
            : '正在处理上一条消息，请稍后再发送。',
      };
      return;
    }

    try {
      // 1. 快速路由 (减少 LLM 调用)
      if (this.fastRouter) {
        const simpleResponse = this.fastRouter.getSimpleResponse(message);
        if (simpleResponse) {
          const conv = await this.getOrCreateConversation(
            userId,
            conversationId,
          );
          conv.metadata = { ...conv.metadata, locale };
          await this.addMessage(
            conv,
            createMsg({ role: 'user', content: message }),
          );

          yield {
            type: 'start',
            agent: AgentType.ORCHESTRATOR,
            conversationId: conv.id,
          };
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

          await this.persistAssistantResponse(
            conv,
            simpleResponse,
            AgentType.ORCHESTRATOR,
          );
          return;
        }

        const routeResult = this.fastRouter.route(message);
        if (!routeResult.shouldUseLLM && routeResult.agent) {
          this.metricsService?.recordRoutingDecision('fast');
          const conversation = await this.getOrCreateConversation(
            userId,
            conversationId,
          );
          conversation.metadata = { ...conversation.metadata, locale };
          await this.addMessage(
            conversation,
            createMsg({ role: 'user', content: message }),
          );

          // 新对话自动生成标题
          const isNew = !conversationId;
          if (isNew && this.useEnterpriseMemory) {
            const title = message.slice(0, 50).replace(/\n/g, ' ').trim();
            await this.memoryManager!.updateConversationTitle(
              conversation.id,
              title,
            );
          }

          yield {
            type: 'start',
            agent: routeResult.agent,
            conversationId: conversation.id,
            title: isNew
              ? message.slice(0, 50).replace(/\n/g, ' ').trim()
              : undefined,
          };

          // 收集流式内容并持久化 assistant 响应
          yield* this.collectAndPersistStream(routeResult.agent, conversation);
          return;
        }
      }

      // 2. 语义路由 (Embedding, ~5ms)
      if (this.embeddingRouter) {
        const embeddingResult = await this.embeddingRouter.route(message);
        if (!embeddingResult.shouldUseLLM && embeddingResult.agent) {
          this.logger.debug(
            `Embedding route (stream) to ${embeddingResult.agent} (similarity: ${embeddingResult.confidence.toFixed(3)})`,
          );
          this.metricsService?.recordRoutingDecision('embedding');

          const conv = await this.getOrCreateConversation(
            userId,
            conversationId,
          );
          conv.metadata = { ...conv.metadata, locale };
          await this.addMessage(
            conv,
            createMsg({ role: 'user', content: message }),
          );

          const isNew = !conversationId;
          if (isNew && this.useEnterpriseMemory) {
            const t = message.slice(0, 50).replace(/\n/g, ' ').trim();
            await this.memoryManager!.updateConversationTitle(conv.id, t);
          }

          yield {
            type: 'start',
            agent: embeddingResult.agent,
            conversationId: conv.id,
            title: isNew
              ? message.slice(0, 50).replace(/\n/g, ' ').trim()
              : undefined,
          };

          yield* this.collectAndPersistStream(embeddingResult.agent, conv);
          return;
        }
      }

      // 3. 正常流程 (LLM Orchestrator)
      this.metricsService?.recordRoutingDecision('llm');
      const conversation = await this.getOrCreateConversation(
        userId,
        conversationId,
      );
      conversation.metadata = { ...conversation.metadata, locale };
      await this.addMessage(
        conversation,
        createMsg({ role: 'user', content: message }),
      );

      // 新对话自动生成标题
      const isNewConversation = !conversationId;
      let title: string | undefined;
      if (isNewConversation && this.useEnterpriseMemory) {
        title = message.slice(0, 50).replace(/\n/g, ' ').trim();
        await this.memoryManager!.updateConversationTitle(
          conversation.id,
          title,
        );
      }

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
        title,
        memoryContext,
      };

      try {
        // 收集流式内容并持久化 assistant 响应
        yield* this.collectAndPersistStream(
          AgentType.ORCHESTRATOR,
          conversation,
        );
      } catch (error) {
        // 错误降级
        const streamLocale = (conversation.metadata?.locale as string) || 'zh';
        if (this.fallback) {
          const fallbackResponse = this.fallback.getFallbackResponse(
            error instanceof Error ? error : new Error(String(error)),
            undefined,
            { userId, locale: streamLocale },
          );
          yield { type: 'error', error: fallbackResponse.message };
          yield { type: 'done', response: fallbackResponse };
        } else {
          yield {
            type: 'error',
            error:
              error instanceof Error
                ? error.message
                : streamLocale === 'zh'
                  ? '处理失败'
                  : 'Processing failed',
          };
        }
      }
    } finally {
      await this.releaseConversationLock(lockKey);
    }
  }

  /**
   * Wrap the agent stream to collect the full response text and persist it
   * to enterprise memory after the stream completes.
   *
   * All events from `runAgentStream` are forwarded to the caller unchanged.
   * After the stream ends, the accumulated content is saved as an assistant
   * message so that future conversations have access to the response history.
   *
   * @param agentType - The agent type that is producing the stream
   * @param conversation - The current conversation state
   * @returns An async generator that forwards all stream events
   */
  /**
   * 包装 runAgentStream：收集流式内容并在结束后持久化 assistant 响应
   */
  private async *collectAndPersistStream(
    agentType: AgentType,
    conversation: ConversationState,
  ): AsyncGenerator<StreamEvent> {
    let fullContent = '';
    let finalAgentType: AgentType = agentType;
    const watermark = conversation.messages.length;

    for await (const event of this.runAgentStream(agentType, conversation)) {
      if (event.type === 'content' && event.content) {
        fullContent += event.content;
      }
      if (event.type === 'done' && event.response) {
        fullContent = fullContent || event.response.message || '';
        finalAgentType = event.response.agentType || finalAgentType;
      }
      yield event;
    }

    // Persist tool messages generated during the workflow
    await this.persistWorkflowMessages(conversation, watermark);

    if (fullContent) {
      try {
        await this.persistAssistantResponse(
          conversation,
          fullContent,
          finalAgentType,
        );
      } catch (err) {
        this.logger.error(
          'Failed to persist streaming assistant response',
          err,
        );
      }
    }
  }

  /**
   * Stream the execution of a single agent through the three-phase workflow engine.
   *
   * Converts {@link WorkflowStreamEvent} from the workflow engine into
   * {@link StreamEvent} for the client. Handles agent delegation recursively
   * up to `maxDelegationDepth` to prevent infinite loops.
   *
   * Phase mapping:
   * - Plan phase: `plan_content` events become `content` events
   * - Execute phase: `tool_start` / `tool_end` events are forwarded
   * - Solve phase: `solve_content` events become `content` events
   * - Done: builds the final `AgentResponse` with workflow metadata
   *
   * @param agentType - The agent to run
   * @param conversation - The current conversation state
   * @param depth - Current delegation depth (guards against infinite recursion)
   * @returns An async generator of StreamEvent objects
   */
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
    const agentLocale = (conversation.metadata?.locale as string) || 'zh';

    if (depth > this.maxDelegationDepth) {
      this.logger.warn(
        `Delegation depth exceeded: ${depth} > ${this.maxDelegationDepth}`,
      );
      yield {
        type: 'error',
        error:
          agentLocale === 'zh' ? '委派层级过深' : 'Delegation depth exceeded',
      };
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
          { locale: agentLocale },
        );
        yield { type: 'error', error: fallbackResponse.message };
        yield { type: 'done', response: fallbackResponse };
      } else {
        yield {
          type: 'error',
          error:
            agentLocale === 'zh'
              ? '服务配置出现问题，请稍后再试'
              : 'Service configuration error. Please try again later.',
        };
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

            // 添加委派标记到对话（使用 assistant 角色 + metadata 标记，与非流式一致）
            if (task) {
              await this.addMessage(
                conversation,
                createMsg({
                  role: 'assistant',
                  content: `[委派给 ${targetAgent} 处理: ${task}]`,
                  agentType: AgentType.ORCHESTRATOR,
                  metadata: { delegation: true, targetAgent },
                }),
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
   * Retrieve the full message history of a conversation from enterprise memory.
   *
   * @param conversationId - The conversation to retrieve
   * @returns Array of message records; empty array if enterprise memory is not available
   */
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
   * List recent conversations for a user.
   *
   * @param userId - The user whose conversations to list
   * @param limit - Maximum number of conversations to return (default 20)
   * @returns Array of conversation summaries; empty array if enterprise memory is not available
   */
  /**
   * 获取用户的对话列表
   */
  async getConversations(userId: string, limit?: number) {
    if (this.useEnterpriseMemory) {
      return this.memoryManager!.getRecentConversations(userId, limit || 20);
    }
    return [];
  }

  /**
   * Retrieve memory usage statistics for a user (memory count, types, storage).
   *
   * @param userId - The user to query
   * @returns Memory statistics object, or null if enterprise memory is not available
   */
  /**
   * 获取用户记忆统计
   */
  async getMemoryStats(userId: string): Promise<any> {
    if (this.memoryManager) {
      return this.memoryManager.getStats(userId);
    }
    return null;
  }

  /**
   * Extract numbered/bulleted suggestions from the agent's response text.
   *
   * Parses lines matching list-item patterns (e.g., "1. ...", "- ...") and
   * returns up to 5 suggestion strings for the client to display as quick actions.
   *
   * @param message - The agent's full response text
   * @returns Array of suggestion strings, or undefined if none found
   */
  private extractSuggestions(message: string): string[] | undefined {
    const suggestions: string[] = [];
    const lines = message.split('\n');
    for (const line of lines) {
      const match = line.match(/^[\d\-*]\s*[.）)]\s*(.+)$/);
      if (match) suggestions.push(match[1].trim());
    }
    return suggestions.length > 0 ? suggestions.slice(0, 5) : undefined;
  }

  /**
   * Generate contextual navigation actions based on keywords in the response.
   *
   * Scans the response for domain-specific keywords (e.g., "档案", "文书", "学校")
   * and produces corresponding UI navigation suggestions.
   *
   * @param message - The agent's full response text
   * @returns Array of action suggestions with labels and navigation targets, or undefined if none
   */
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
