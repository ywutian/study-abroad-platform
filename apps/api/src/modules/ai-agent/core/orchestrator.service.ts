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

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRunnerService } from './agent-runner.service';
import { MemoryService } from './memory.service';
import { LLMService } from './llm.service';
import { ToolExecutorService } from './tool-executor.service';
import { WorkflowEngineService } from './workflow-engine.service';
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
import { REDIS_TTL } from '../../../common/redis/redis-ttl.constants';
import { TOOLS } from '../config/tools.config';
import {
  AgentChatContext,
  AgentType,
  AgentResponse,
  ConversationState,
  MemoryType,
  Message,
} from '../types';
import { MessageInput } from '../memory/types';
import { ActionSuggestion } from './types';
import { StreamEvent } from '@study-abroad/shared';
import { randomUUID } from 'crypto';
import {
  AgentRunService,
  getApprovalFingerprint,
  isAgentRunCheckpoint,
} from './agent-run.service';
import { AgentRuntimeConfigService } from '../skills/agent-runtime-config.service';

export type { StreamEvent };

function isAgentResponse(value: unknown): value is AgentResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { message?: unknown; agentType?: unknown };
  return (
    typeof candidate.message === 'string' &&
    typeof candidate.agentType === 'string'
  );
}

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
    private runtimeConfigs: AgentRuntimeConfigService,
    @Optional() private memoryManager?: MemoryManagerService,
    @Optional() private fastRouter?: FastRouterService,
    @Optional() private embeddingRouter?: EmbeddingRouterService,
    @Optional() private fallback?: FallbackService,
    @Optional() private metricsService?: MetricsService,
    @Optional() private redis?: RedisService,
    @Optional() private agentRuns?: AgentRunService,
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

  private async createRunIfEnabled(
    userId: string,
    conversationId: string,
    agentType: AgentType,
  ): Promise<string | undefined> {
    if (!this.agentRuns?.isEnabled()) return undefined;
    const run = await this.agentRuns.createRun({
      userId,
      conversationId,
      agentType,
    });
    return run.id;
  }

  private sanitizeAgentContext(
    context?: AgentChatContext,
  ): AgentChatContext | undefined {
    if (!context) return undefined;

    if (context.type === 'prediction-results') {
      return {
        type: 'prediction-results',
        source: context.source,
        createdAt: context.createdAt,
        summary: context.summary,
        results: context.results.slice(0, 10).map((result) => ({
          schoolId: result.schoolId,
          schoolName: result.schoolName,
          probability: result.probability,
          tier: result.tier,
          confidence: result.confidence,
          source: result.source,
          modelVersion: result.modelVersion,
          cohortKey: result.cohortKey,
          roundContext: result.roundContext,
          sourceSummary: result.sourceSummary?.slice(0, 5) || undefined,
          uncertaintyReasons:
            result.uncertaintyReasons?.slice(0, 5) || undefined,
          confidenceReason: result.confidenceReason,
          latestOutcomeLabel: result.latestOutcomeLabel || undefined,
          schoolMeta: result.schoolMeta
            ? {
                usNewsRank: result.schoolMeta.usNewsRank,
                acceptanceRate: result.schoolMeta.acceptanceRate,
                intlAcceptanceRate: result.schoolMeta.intlAcceptanceRate,
                intlStudentPct: result.schoolMeta.intlStudentPct,
                needBlindInternational:
                  result.schoolMeta.needBlindInternational,
                graduationRate: result.schoolMeta.graduationRate,
                satAvg: result.schoolMeta.satAvg,
                sat25: result.schoolMeta.sat25,
                sat75: result.schoolMeta.sat75,
              }
            : undefined,
        })),
      };
    }

    return {
      type: 'selected-schools',
      source: context.source,
      createdAt: context.createdAt,
      schools: context.schools.slice(0, 10).map((school) => ({
        id: school.id,
        name: school.name,
        nameZh: school.nameZh,
        usNewsRank: school.usNewsRank,
        acceptanceRate: school.acceptanceRate,
        prediction: school.prediction
          ? {
              probability: school.prediction.probability,
              tier: school.prediction.tier,
              confidence: school.prediction.confidence,
              source: school.prediction.source,
              modelVersion: school.prediction.modelVersion,
              updatedAt: school.prediction.updatedAt,
            }
          : undefined,
      })),
    };
  }

  private summarizeAgentContext(
    context: AgentChatContext,
    locale: string,
  ): string {
    if (context.type === 'prediction-results') {
      const topSchools = context.results
        .slice(0, 3)
        .map((result) => {
          const pct =
            typeof result.probability === 'number'
              ? `${Math.round(result.probability * 100)}%`
              : locale === 'en'
                ? 'unknown'
                : '未知';
          const tier =
            result.tier || (locale === 'en' ? 'unknown tier' : '未知分层');
          return `${result.schoolName} (${pct}, ${tier})`;
        })
        .join(', ');

      if (locale === 'en') {
        return `Prediction page context from ${context.source || 'ui'}: ${context.summary?.total ?? context.results.length} school predictions. Top schools: ${topSchools || 'none'}.`;
      }

      return `预测页面上下文，来源 ${context.source || 'ui'}：共 ${context.summary?.total ?? context.results.length} 所学校预测。重点学校：${topSchools || '暂无'}。`;
    }

    const schools = context.schools
      .slice(0, 5)
      .map((school) => school.name)
      .join(', ');
    if (locale === 'en') {
      return `Selected schools context from ${context.source || 'ui'}: ${context.schools.length} schools in scope. Schools: ${schools || 'none'}.`;
    }
    return `选校上下文，来源 ${context.source || 'ui'}：当前有 ${context.schools.length} 所学校。学校：${schools || '暂无'}。`;
  }

  private async applyConversationContext(
    conversation: ConversationState,
    locale: string,
    context?: AgentChatContext,
    agentHint?: AgentType,
  ): Promise<void> {
    const previousSummary = conversation.metadata?.lastAgentContextSummary;
    const nextMetadata = { ...(conversation.metadata || {}), locale };

    if (agentHint) {
      nextMetadata.lastAgentHint = agentHint;
    }

    const sanitizedContext = this.sanitizeAgentContext(context);
    if (sanitizedContext) {
      const summary = this.summarizeAgentContext(sanitizedContext, locale);
      nextMetadata.lastAgentContext = sanitizedContext;
      nextMetadata.lastAgentContextSummary = summary;
      nextMetadata.lastAgentContextAt = new Date().toISOString();

      if (this.useEnterpriseMemory && summary && summary !== previousSummary) {
        await this.memoryManager!.remember(conversation.userId, {
          type: MemoryType.FACT,
          category: 'prediction_ui_context',
          content: summary,
          importance: 0.45,
          metadata: {
            source: 'prediction_ui_context',
            conversationId: conversation.id,
            transient: true,
            agentHint,
            contextType: sanitizedContext.type,
          },
        });
      }
    }

    conversation.metadata = nextMetadata;

    if (this.useEnterpriseMemory) {
      await this.memoryManager!.updateConversationMetadata(
        conversation.id,
        nextMetadata,
      );
    }
  }

  // ==================== 对话级锁 ====================

  /** Acquire a per-conversation lock (Redis SET NX, 60s TTL). Returns false if already locked. */
  private async acquireConversationLock(key: string): Promise<boolean> {
    if (!this.redis) return true; // No Redis = no locking (single-instance safe)
    // setNX fails open (returns true) when Redis is unavailable, so a Redis
    // outage degrades to "no locking" exactly like the no-client path above.
    return this.redis.setNX(
      `lock:conv:${key}`,
      '1',
      REDIS_TTL.CONVERSATION_LOCK,
    );
  }

  /** Release the per-conversation lock. */
  private async releaseConversationLock(key: string): Promise<void> {
    // Best-effort: del is a no-op when Redis is down; lock expires in 60s anyway.
    await this.redis?.del(`lock:conv:${key}`);
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
    context?: AgentChatContext,
    agentHint?: AgentType,
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
          await this.applyConversationContext(conv, locale, context, agentHint);
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
          await this.applyConversationContext(
            conversation,
            locale,
            context,
            agentHint,
          );
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
      await this.applyConversationContext(
        conversation,
        locale,
        context,
        agentHint,
      );
      await this.addMessage(
        conversation,
        createMsg({ role: 'user', content: message }),
      );

      // New user guidance: hint agent to suggest profile completion
      if (!conversationId) {
        const ctx = conversation.context;
        if (!ctx?.profile?.gpa && !ctx?.profile?.testScores?.length) {
          this.memory.addMessage(
            conversation,
            createMsg({
              role: 'system',
              content:
                locale === 'en'
                  ? 'Note: This user has not completed their profile. Suggest completing their profile for better recommendations, but still help with their current question.'
                  : '提示：该用户尚未完善档案。建议完善档案以获取更精准推荐，但仍尽力回答当前问题。',
            }),
          );
        }
      }

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
      conversation.metadata = {
        ...(conversation.metadata || {}),
        ...(conv.metadata || {}),
      };

      // Backfill enterprise memory history into in-memory state so the
      // workflow engine's Plan/Solve phases see prior conversation turns.
      if (conversationId) {
        try {
          const context =
            await this.memoryManager!.getCompressedConversationContext(conv.id);
          if (context.summary) {
            conversation.metadata.conversationContextSummaryV1 =
              context.summary;
          }
          if (conversation.messages.length === 0) {
            for (const msg of context.recentMessages) {
              conversation.messages.push({
                id: msg.id,
                role: msg.role as Message['role'],
                content: msg.content,
                agentType: msg.agentType as AgentType | undefined,
                timestamp: msg.createdAt,
              });
            }
          }
        } catch (err) {
          this.logger.warn('Failed to prepare conversation context', err);
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
    context?: AgentChatContext,
    agentHint?: AgentType,
  ): Promise<AgentResponse> {
    this.logger.log(
      `callAgent started: userId=${userId}, agent=${agentType}, conversationId=${conversationId}`,
    );

    const conversation = await this.getOrCreateConversation(
      userId,
      conversationId,
    );
    await this.applyConversationContext(
      conversation,
      locale,
      context,
      agentHint,
    );
    await this.addMessage(
      conversation,
      createMsg({ role: 'user', content: message }),
    );

    this.logger.log(`callAgent: conversation ready, starting agent run`);
    if (!this.agentRuns?.isEnabled()) {
      const watermark = conversation.messages.length;
      const legacyResponse = await this.agentRunner.run(
        agentType,
        conversation,
      );
      await this.persistWorkflowMessages(conversation, watermark);
      const moderated = await this.persistAssistantResponse(
        conversation,
        legacyResponse.message,
        legacyResponse.agentType,
      );
      return { ...legacyResponse, message: moderated };
    }

    const runId = await this.createRunIfEnabled(
      userId,
      conversation.id,
      agentType,
    );
    let response: AgentResponse | undefined;
    let approval: StreamEvent['approval'];
    for await (const event of this.collectAndPersistStream(
      agentType,
      conversation,
      runId,
    )) {
      if (event.type === 'done' && event.response) response = event.response;
      if (event.type === 'approval_required') approval = event.approval;
      if (event.type === 'error') {
        throw new InternalServerErrorException(
          event.error || 'Agent execution failed',
        );
      }
    }

    if (approval) {
      return {
        message:
          locale === 'en'
            ? 'This action requires your confirmation before it can continue.'
            : '此操作需要你确认后才能继续。',
        agentType,
        data: { runId, approvalRequired: approval },
      };
    }
    if (!response) {
      throw new InternalServerErrorException(
        'Agent completed without a response',
      );
    }

    this.logger.log(`callAgent completed: agent=${response.agentType}`);
    return response;
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
      const messages =
        await this.memoryManager!.getConversationHistory(conversationId);
      return messages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          agentType: msg.agentType,
          toolCalls: msg.toolCalls?.map((toolCall) => ({
            id: toolCall.id,
            name: toolCall.name,
          })),
          createdAt: msg.createdAt,
        }));
    }

    const conversation = await this.memory.getOrCreateConversation(
      userId,
      conversationId,
    );
    return conversation.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agentType: m.agentType,
        createdAt: m.timestamp,
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
    context?: AgentChatContext,
    agentHint?: AgentType,
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
          await this.applyConversationContext(conv, locale, context, agentHint);
          await this.addMessage(
            conv,
            createMsg({ role: 'user', content: message }),
          );
          const runId = await this.createRunIfEnabled(
            userId,
            conv.id,
            AgentType.ORCHESTRATOR,
          );

          yield {
            type: 'start',
            agent: AgentType.ORCHESTRATOR,
            conversationId: conv.id,
            runId,
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
          if (runId) {
            await this.agentRuns?.completeRun(userId, runId, {
              message: simpleResponse,
              agentType: AgentType.ORCHESTRATOR,
            });
          }
          return;
        }

        const routeResult = this.fastRouter.route(message);
        if (!routeResult.shouldUseLLM && routeResult.agent) {
          this.metricsService?.recordRoutingDecision('fast');
          const conversation = await this.getOrCreateConversation(
            userId,
            conversationId,
          );
          await this.applyConversationContext(
            conversation,
            locale,
            context,
            agentHint,
          );
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
          const runId = await this.createRunIfEnabled(
            userId,
            conversation.id,
            routeResult.agent,
          );

          yield {
            type: 'start',
            agent: routeResult.agent,
            conversationId: conversation.id,
            runId,
            title: isNew
              ? message.slice(0, 50).replace(/\n/g, ' ').trim()
              : undefined,
          };

          // 收集流式内容并持久化 assistant 响应
          yield* this.collectAndPersistStream(
            routeResult.agent,
            conversation,
            runId,
          );
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
          await this.applyConversationContext(conv, locale, context, agentHint);
          await this.addMessage(
            conv,
            createMsg({ role: 'user', content: message }),
          );

          const isNew = !conversationId;
          if (isNew && this.useEnterpriseMemory) {
            const t = message.slice(0, 50).replace(/\n/g, ' ').trim();
            await this.memoryManager!.updateConversationTitle(conv.id, t);
          }
          const runId = await this.createRunIfEnabled(
            userId,
            conv.id,
            embeddingResult.agent,
          );

          yield {
            type: 'start',
            agent: embeddingResult.agent,
            conversationId: conv.id,
            runId,
            title: isNew
              ? message.slice(0, 50).replace(/\n/g, ' ').trim()
              : undefined,
          };

          yield* this.collectAndPersistStream(
            embeddingResult.agent,
            conv,
            runId,
          );
          return;
        }
      }

      // 3. 正常流程 (LLM Orchestrator)
      this.metricsService?.recordRoutingDecision('llm');
      const conversation = await this.getOrCreateConversation(
        userId,
        conversationId,
      );
      await this.applyConversationContext(
        conversation,
        locale,
        context,
        agentHint,
      );
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
      const runId = await this.createRunIfEnabled(
        userId,
        conversation.id,
        AgentType.ORCHESTRATOR,
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
        runId,
        title,
        memoryContext,
      };

      try {
        // 收集流式内容并持久化 assistant 响应
        yield* this.collectAndPersistStream(
          AgentType.ORCHESTRATOR,
          conversation,
          runId,
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
        if (runId) {
          await this.agentRuns?.failRun(
            userId,
            runId,
            'STREAM_FAILED',
            error instanceof Error ? error.message : 'Processing failed',
          );
        }
      }
    } finally {
      await this.releaseConversationLock(lockKey);
    }
  }

  async *resumeRunStream(
    userId: string,
    runId: string,
  ): AsyncGenerator<StreamEvent> {
    if (!this.agentRuns?.isEnabled()) {
      yield { type: 'error', error: 'Agent approvals are disabled' };
      return;
    }

    const claim = await this.agentRuns.claimApproved(userId, runId);
    if (!claim.claimed) {
      if (
        claim.run.status === 'COMPLETED' &&
        isAgentResponse(claim.run.result)
      ) {
        yield {
          type: 'done',
          runId,
          runStatus: 'COMPLETED',
          response: claim.run.result,
        };
        return;
      }
      if (claim.run.status === 'COMPLETED') {
        yield {
          type: 'error',
          runId,
          runStatus: 'COMPLETED',
          error: 'COMPLETED_RESULT_UNAVAILABLE',
        };
        return;
      }
      if (
        claim.run.status === 'FAILED' ||
        claim.run.status === 'CANCELLED' ||
        claim.run.status === 'EXPIRED'
      ) {
        yield {
          type: 'error',
          runId,
          runStatus: claim.run.status,
          error:
            claim.run.errorMessage ||
            `Run is ${claim.run.status.toLowerCase()}`,
        };
        return;
      }
      if (!claim.approval) {
        yield {
          type: 'error',
          runId,
          runStatus: claim.run.status,
          error: 'APPROVAL_STATE_UNAVAILABLE',
        };
        return;
      }
      yield {
        type: 'run_resumed',
        runId,
        runStatus: claim.run.status,
      };
      yield {
        type: 'error',
        runId,
        error:
          claim.approval.status === 'EXECUTED'
            ? 'Run has already consumed this approval'
            : 'Run is already being resumed',
      };
      return;
    }

    if (!isAgentRunCheckpoint(claim.run.checkpoint)) {
      await this.agentRuns.failRun(
        userId,
        runId,
        'CHECKPOINT_MISMATCH',
        'Persisted Agent checkpoint is invalid',
      );
      yield { type: 'error', runId, error: 'Approval checkpoint mismatch' };
      return;
    }
    const checkpoint = claim.run.checkpoint;
    const pendingTool =
      checkpoint?.steps?.[checkpoint.pendingStepIndex]?.toolCall;
    if (
      !pendingTool ||
      getApprovalFingerprint(pendingTool) !== claim.approval.fingerprint
    ) {
      await this.agentRuns.failRun(
        userId,
        runId,
        'CHECKPOINT_MISMATCH',
        'Persisted tool arguments no longer match the approved action',
      );
      yield { type: 'error', runId, error: 'Approval checkpoint mismatch' };
      return;
    }

    const conversation = await this.getOrCreateConversation(
      userId,
      claim.run.conversationId,
    );
    conversation.metadata = {
      ...(conversation.metadata || {}),
      locale: checkpoint.locale,
    };
    const config = await this.runtimeConfigs.resolve(
      checkpoint.agentType,
      runId,
    );
    if (!config) {
      await this.agentRuns.failRun(
        userId,
        runId,
        'CONFIG_NOT_FOUND',
        'Agent configuration is unavailable during resume',
      );
      yield { type: 'error', runId, error: 'Agent configuration unavailable' };
      return;
    }
    const tools = TOOLS.filter((tool) => config.tools.includes(tool.name));
    let watermark = conversation.messages.length;
    let fullContent = '';
    let paused = false;
    let approvalExecutionRecorded = false;

    for await (const event of this.workflowEngine.resumeStream(
      config,
      conversation,
      tools,
      checkpoint,
      claim.approval.fingerprint,
      { runId, approvalsEnabled: true },
    )) {
      switch (event.type) {
        case 'run_resumed':
          yield {
            type: 'run_resumed',
            runId,
            agent: checkpoint.agentType,
            runStatus: 'RUNNING',
          };
          break;
        case 'tool_start':
          yield {
            type: 'tool_start',
            runId,
            agent: checkpoint.agentType,
            tool: event.tool,
          };
          break;
        case 'tool_end':
          if (
            !approvalExecutionRecorded &&
            event.toolCall &&
            getApprovalFingerprint(event.toolCall) ===
              claim.approval.fingerprint
          ) {
            if (!event.toolResult?.success) {
              await this.agentRuns.failRun(
                userId,
                runId,
                event.toolResult?.errorCode || 'APPROVED_TOOL_FAILED',
                event.toolResult?.error || 'Approved tool execution failed',
              );
            } else {
              await this.agentRuns.markExecutionSucceeded(
                userId,
                runId,
                claim.approval.id,
              );
            }
            approvalExecutionRecorded = true;
          }
          yield {
            type: 'tool_end',
            runId,
            agent: checkpoint.agentType,
            tool: event.tool,
            toolResult: event.toolResult,
          };
          break;
        case 'approval_required': {
          if (!event.toolCall || !event.checkpoint) break;
          await this.persistWorkflowMessages(conversation, watermark);
          watermark = conversation.messages.length;
          const approval = await this.agentRuns.requestApproval({
            runId,
            userId,
            toolCall: event.toolCall,
            checkpoint: event.checkpoint,
          });
          yield {
            type: 'approval_required',
            runId,
            agent: checkpoint.agentType,
            approval,
            runStatus: 'WAITING_APPROVAL',
          };
          break;
        }
        case 'run_paused':
          paused = true;
          yield {
            type: 'run_paused',
            runId,
            agent: checkpoint.agentType,
            runStatus: 'WAITING_APPROVAL',
          };
          break;
        case 'solve_content':
        case 'plan_content':
          if (event.content) {
            fullContent += event.content;
            yield {
              type: 'content',
              runId,
              agent: checkpoint.agentType,
              content: event.content,
            };
          }
          break;
        case 'done': {
          const result = event.result;
          const response: AgentResponse = {
            message: result?.message || fullContent,
            agentType: checkpoint.agentType,
            toolsUsed: result?.toolsUsed,
            suggestions: this.extractSuggestions(
              result?.message || fullContent,
            ),
            actions: this.generateActions(
              result?.message || fullContent,
              result?.plan.steps.map((step) => ({ result: step.result })),
            ),
            data: result
              ? {
                  workflow: {
                    timing: result.timing,
                    usage: result.usage,
                    contextSummary: result.contextSummary,
                    steps: result.plan.steps.map((step) => ({
                      tool: step.toolCall.name,
                      status: step.status,
                      duration: step.duration,
                    })),
                  },
                }
              : undefined,
          };
          yield {
            type: 'done',
            runId,
            agent: checkpoint.agentType,
            runStatus: 'COMPLETED',
            response,
          };
          await this.persistWorkflowMessages(conversation, watermark);
          watermark = conversation.messages.length;
          if (response.message) {
            await this.persistAssistantResponse(
              conversation,
              response.message,
              response.agentType,
            );
          }
          await this.agentRuns.completeRun(userId, runId, response);
          return;
        }
        case 'error':
          await this.persistWorkflowMessages(conversation, watermark);
          await this.agentRuns.failRun(
            userId,
            runId,
            'RESUME_FAILED',
            event.error || 'Resume failed',
          );
          yield { type: 'error', runId, error: event.error || 'Resume failed' };
          return;
        case 'phase_change':
          break;
      }
    }

    await this.persistWorkflowMessages(conversation, watermark);
    if (!paused) {
      await this.agentRuns.failRun(
        userId,
        runId,
        'RESUME_INCOMPLETE',
        'Resume ended without a terminal workflow event',
      );
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
    runId?: string,
  ): AsyncGenerator<StreamEvent> {
    let fullContent = '';
    let finalAgentType: AgentType = agentType;
    let watermark = conversation.messages.length;
    let paused = false;
    let completed = false;
    let streamError: string | undefined;
    let finalResponse: AgentResponse | undefined;

    try {
      for await (const event of this.runAgentStream(
        agentType,
        conversation,
        0,
        runId,
        watermark,
      )) {
        if (event.type === 'content' && event.content) {
          fullContent += event.content;
        }
        if (event.type === 'done' && event.response) {
          fullContent = fullContent || event.response.message || '';
          finalAgentType = event.response.agentType || finalAgentType;
          finalResponse = event.response;
          completed = true;
        }
        if (event.type === 'approval_required') {
          watermark = conversation.messages.length;
        }
        if (event.type === 'run_paused') {
          paused = true;
        }
        if (event.type === 'error') {
          streamError = event.error || 'Workflow failed';
        }
        yield event;
      }
    } catch (error) {
      if (runId) {
        await this.agentRuns?.failRun(
          conversation.userId,
          runId,
          'STREAM_ABORTED',
          error instanceof Error ? error.message : 'Agent stream aborted',
        );
      }
      throw error;
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

    if (runId && !paused) {
      if (completed) {
        await this.agentRuns?.completeRun(
          conversation.userId,
          runId,
          finalResponse,
        );
      } else if (streamError) {
        await this.agentRuns?.failRun(
          conversation.userId,
          runId,
          'WORKFLOW_FAILED',
          streamError,
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
    runId?: string,
    persistenceWatermark?: number,
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
    const config = await this.runtimeConfigs.resolve(agentType, runId);

    if (!config) {
      this.logger.error(`Agent configuration missing for type: ${agentType}`, {
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

    for await (const event of this.workflowEngine.runStream(
      agentType,
      config,
      conversation,
      tools,
      runId
        ? { runId, approvalsEnabled: !!this.agentRuns?.isEnabled() }
        : undefined,
    )) {
      switch (event.type) {
        case 'phase_change':
          break;

        case 'plan_content':
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

        case 'approval_required': {
          if (
            !runId ||
            !this.agentRuns ||
            !event.toolCall ||
            !event.checkpoint
          ) {
            yield { type: 'error', error: 'Approval lifecycle unavailable' };
            return;
          }
          await this.persistWorkflowMessages(
            conversation,
            persistenceWatermark ?? conversation.messages.length,
          );
          const approval = await this.agentRuns.requestApproval({
            runId,
            userId: conversation.userId,
            toolCall: event.toolCall,
            checkpoint: event.checkpoint,
          });
          yield {
            type: 'approval_required',
            agent: agentType,
            runId,
            approval,
            runStatus: 'WAITING_APPROVAL',
          };
          break;
        }

        case 'run_paused':
          yield {
            type: 'run_paused',
            agent: agentType,
            runId,
            runStatus: 'WAITING_APPROVAL',
          };
          return;

        case 'run_resumed':
          yield {
            type: 'run_resumed',
            agent: agentType,
            runId,
            runStatus: 'RUNNING',
          };
          break;

        case 'solve_content':
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
            yield* this.runAgentStream(
              targetAgent,
              conversation,
              depth + 1,
              runId,
              persistenceWatermark,
            );
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
              actions: this.generateActions(
                result?.message || '',
                result?.plan?.steps?.map((s) => ({ result: s.result })),
              ),
              data: result
                ? {
                    workflow: {
                      timing: result.timing,
                      usage: result.usage,
                      contextSummary: result.contextSummary,
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
  private generateActions(
    message: string,
    toolResults?: Array<{ result?: any }>,
  ): ActionSuggestion[] | undefined {
    const actions: ActionSuggestion[] = [];

    // Priority 1: Explicit suggestedAction from tool results
    if (toolResults) {
      for (const tr of toolResults) {
        const sa =
          tr.result?.suggestedAction || tr.result?.result?.suggestedAction;
        if (sa?.label && sa?.action) {
          actions.push({ label: sa.label, action: sa.action });
        }
      }
    }

    // Priority 2: Keyword-based fallback (only if no explicit actions)
    if (actions.length === 0) {
      const lower = message.toLowerCase();
      if (lower.includes('档案'))
        actions.push({ label: '完善档案', action: 'navigate:/profile' });
      if (lower.includes('文书'))
        actions.push({ label: '文书管理', action: 'navigate:/essays' });
      if (lower.includes('学校') || lower.includes('排名'))
        actions.push({ label: '查看排名', action: 'navigate:/ranking' });
    }

    return actions.length > 0 ? actions : undefined;
  }
}
