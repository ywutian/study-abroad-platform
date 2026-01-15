/**
 * 工作流引擎 - 企业级三阶段 Agent 执行架构
 *
 * 基于 ReWOO (Reason Without Observation) 模式：
 *
 *   Phase 1: PLAN   — LLM 分析用户意图，一次性规划所有需要调用的工具
 *   Phase 2: EXECUTE — 按计划执行所有工具调用（无 LLM 参与，杜绝重复）
 *   Phase 3: SOLVE   — LLM 综合所有工具结果，生成最终回复
 *
 * 优势：
 * - 从根本上杜绝重复 tool 调用（执行阶段不调用 LLM）
 * - 减少 LLM 调用次数（最多 2 次：Plan + Solve）
 * - 可并行执行无依赖的工具调用
 * - 完整的状态追踪和可观测性
 *
 * 降级策略：
 * - 如果 Plan 阶段 LLM 未返回工具调用 → 直接返回文本回复（无需 Solve）
 * - 如果 Plan 阶段返回 delegate_to_agent → 直接委派，不进入 Execute
 * - 如果 Execute 阶段某工具失败 → 标记失败，Solve 阶段基于已有结果生成回复
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { LLMService, LLMResponse } from './llm.service';
import { ToolExecutorService } from './tool-executor.service';
import { MemoryService } from './memory.service';
import { ResilienceService } from './resilience.service';
import {
  AgentType,
  AgentConfig,
  ConversationState,
  ToolDefinition,
  ToolCall,
} from '../types';
import { ToolExecutionResult } from './types';

// ==================== 工作流类型定义 ====================

/** 工作流阶段 */
export enum WorkflowPhase {
  PLAN = 'plan',
  EXECUTE = 'execute',
  SOLVE = 'solve',
  DONE = 'done',
}

/** 规划的工具调用步骤 */
export interface PlannedStep {
  /** 工具调用信息 */
  toolCall: ToolCall;
  /** 步骤状态 */
  status: 'pending' | 'running' | 'success' | 'failed';
  /** 执行结果 */
  result?: ToolExecutionResult;
  /** 错误信息 */
  error?: string;
  /** 执行耗时 (ms) */
  duration?: number;
}

/** 执行计划 */
export interface ExecutionPlan {
  /** Plan 阶段 LLM 的分析/思考内容 */
  planningContent: string;
  /** 规划的步骤 */
  steps: PlannedStep[];
  /** 是否需要委派 */
  delegation?: {
    targetAgent: AgentType;
    task: string;
    context?: string;
  };
}

/** 工作流执行结果 */
export interface WorkflowResult {
  /** 最终回复内容 */
  message: string;
  /** 使用的工具列表 */
  toolsUsed: string[];
  /** 是否需要委派 */
  delegation?: ExecutionPlan['delegation'];
  /** 执行计划详情（可观测性） */
  plan: ExecutionPlan;
  /** 各阶段耗时 */
  timing: {
    planMs: number;
    executeMs: number;
    solveMs: number;
    totalMs: number;
  };
}

/** 工作流流式事件 */
export interface WorkflowStreamEvent {
  type:
    | 'phase_change'
    | 'plan_content'
    | 'tool_start'
    | 'tool_end'
    | 'solve_content'
    | 'done'
    | 'error';
  phase?: WorkflowPhase;
  content?: string;
  tool?: string;
  toolResult?: ToolExecutionResult;
  result?: WorkflowResult;
  error?: string;
}

// ==================== 配置 ====================

const TOOL_TIMEOUT_MS = 30000;

const PLAN_SYSTEM_SUFFIX = `

## 工作流指令（必须严格遵守）
你正处于 **规划阶段**。你的任务是：
1. 分析用户的需求
2. 判断需要调用哪些工具来收集信息或执行操作
3. **一次性** 调用所有需要的工具（不要分多轮）

重要规则：
- 仔细思考后，一次性列出所有需要的工具调用
- 每种工具最多调用一次
- 如果不需要任何工具，直接回复用户即可
- 不要在回复中解释"我要调用什么工具"，直接调用即可`;

const SOLVE_SYSTEM_SUFFIX = `

## 工作流指令（必须严格遵守）
你正处于 **总结阶段**。所有工具已经执行完毕，结果已包含在对话历史中。
你的任务是：基于所有工具返回的数据，生成一个完整、友好、有条理的中文回复。

重要规则：
- **绝对不要** 再调用任何工具
- 直接基于已有的工具结果生成回复
- 如果某个工具执行失败，跳过相关内容或告知用户
- 回复要完整、有条理，不要遗漏重要信息`;

// ==================== 工作流引擎 ====================

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private llm: LLMService,
    private toolExecutor: ToolExecutorService,
    private memory: MemoryService,
    @Optional() private resilience?: ResilienceService,
  ) {}

  // ==================== 非流式执行 ====================

  /**
   * 运行完整的三阶段工作流（非流式）
   */
  async run(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    tools: ToolDefinition[],
  ): Promise<WorkflowResult> {
    const totalStart = Date.now();

    // ---- Phase 1: PLAN ----
    const planStart = Date.now();
    this.logger.log(`[${agentType}] Phase 1: PLAN started`);

    const plan = await this.planPhase(agentType, config, conversation, tools);
    const planMs = Date.now() - planStart;

    this.logger.log(
      `[${agentType}] Phase 1: PLAN completed (${planMs}ms, ${plan.steps.length} steps)`,
    );

    // 快速路径：不需要工具调用 → 直接返回
    if (plan.steps.length === 0 && !plan.delegation) {
      return {
        message: plan.planningContent,
        toolsUsed: [],
        plan,
        timing: {
          planMs,
          executeMs: 0,
          solveMs: 0,
          totalMs: Date.now() - totalStart,
        },
      };
    }

    // 委派路径
    if (plan.delegation) {
      return {
        message: '',
        toolsUsed: [],
        delegation: plan.delegation,
        plan,
        timing: {
          planMs,
          executeMs: 0,
          solveMs: 0,
          totalMs: Date.now() - totalStart,
        },
      };
    }

    // ---- Phase 2: EXECUTE ----
    const executeStart = Date.now();
    this.logger.log(
      `[${agentType}] Phase 2: EXECUTE started (${plan.steps.length} tools)`,
    );

    await this.executePhase(plan, conversation);
    const executeMs = Date.now() - executeStart;

    this.logger.log(
      `[${agentType}] Phase 2: EXECUTE completed (${executeMs}ms)`,
    );

    // ---- Phase 3: SOLVE ----
    const solveStart = Date.now();
    this.logger.log(`[${agentType}] Phase 3: SOLVE started`);

    const finalMessage = await this.solvePhase(agentType, config, conversation);
    const solveMs = Date.now() - solveStart;

    this.logger.log(`[${agentType}] Phase 3: SOLVE completed (${solveMs}ms)`);

    const toolsUsed = plan.steps
      .filter((s) => s.status === 'success')
      .map((s) => s.toolCall.name);

    return {
      message: finalMessage,
      toolsUsed: [...new Set(toolsUsed)],
      plan,
      timing: {
        planMs,
        executeMs,
        solveMs,
        totalMs: Date.now() - totalStart,
      },
    };
  }

  // ==================== 流式执行 ====================

  /**
   * 运行完整的三阶段工作流（流式输出）
   */
  async *runStream(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    tools: ToolDefinition[],
  ): AsyncGenerator<WorkflowStreamEvent> {
    const totalStart = Date.now();

    // ---- Phase 1: PLAN ----
    yield { type: 'phase_change', phase: WorkflowPhase.PLAN };
    const planStart = Date.now();

    const plan = await this.planPhaseStream(
      agentType,
      config,
      conversation,
      tools,
    );
    const planMs = Date.now() - planStart;

    // 快速路径：不需要工具调用 → 直接把 Plan 内容当最终回复流式输出
    if (plan.steps.length === 0 && !plan.delegation) {
      // 在 plan 阶段已经通过 stream 输出了 content，直接返回 done
      yield {
        type: 'done',
        result: {
          message: plan.planningContent,
          toolsUsed: [],
          plan,
          timing: {
            planMs,
            executeMs: 0,
            solveMs: 0,
            totalMs: Date.now() - totalStart,
          },
        },
      };
      return;
    }

    // 委派路径 → 不进入 Execute，直接返回
    if (plan.delegation) {
      yield {
        type: 'done',
        result: {
          message: '',
          toolsUsed: [],
          delegation: plan.delegation,
          plan,
          timing: {
            planMs,
            executeMs: 0,
            solveMs: 0,
            totalMs: Date.now() - totalStart,
          },
        },
      };
      return;
    }

    // ---- Phase 2: EXECUTE ----
    yield { type: 'phase_change', phase: WorkflowPhase.EXECUTE };
    const executeStart = Date.now();

    for (const step of plan.steps) {
      yield { type: 'tool_start', tool: step.toolCall.name };
      await this.executeStep(step, conversation);
      yield {
        type: 'tool_end',
        tool: step.toolCall.name,
        toolResult: step.result,
      };
    }
    const executeMs = Date.now() - executeStart;

    // ---- Phase 3: SOLVE ----
    yield { type: 'phase_change', phase: WorkflowPhase.SOLVE };
    const solveStart = Date.now();

    let finalMessage = '';
    for await (const chunk of this.solvePhaseStream(
      agentType,
      config,
      conversation,
    )) {
      finalMessage += chunk;
      yield { type: 'solve_content', content: chunk };
    }
    const solveMs = Date.now() - solveStart;

    const toolsUsed = plan.steps
      .filter((s) => s.status === 'success')
      .map((s) => s.toolCall.name);

    yield {
      type: 'done',
      result: {
        message: finalMessage,
        toolsUsed: [...new Set(toolsUsed)],
        plan,
        timing: {
          planMs,
          executeMs,
          solveMs,
          totalMs: Date.now() - totalStart,
        },
      },
    };
  }

  // ==================== Phase 1: PLAN ====================

  /**
   * 规划阶段（非流式）—— 调用 LLM 获取执行计划
   *
   * 使用 tool_choice: 'auto' 让 LLM 自己决定需要哪些工具
   * LLM 会在一次调用中返回所有需要的工具调用
   */
  private async planPhase(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    tools: ToolDefinition[],
  ): Promise<ExecutionPlan> {
    const systemPrompt = this.buildPlanPrompt(config, conversation);
    const messages = this.memory.getRecentMessages(conversation);

    const response = await this.llm.call(systemPrompt, messages, {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      tools,
      userId: conversation.userId,
      conversationId: conversation.id,
      agentType,
    });

    return this.parsePlanResponse(response, agentType);
  }

  /**
   * 规划阶段（流式）—— 流式获取执行计划
   *
   * Plan 阶段如果不需要工具，文本内容会被当作最终回复
   * 如果需要工具，则只收集 tool calls 不输出 plan 阶段文本
   */
  private async planPhaseStream(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    tools: ToolDefinition[],
  ): Promise<ExecutionPlan> {
    const systemPrompt = this.buildPlanPrompt(config, conversation);
    const messages = this.memory.getRecentMessages(conversation);

    // 使用非流式调用获取完整的 Plan（Plan 阶段不需要流式输出）
    const response = await this.llm.call(systemPrompt, messages, {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      tools,
      userId: conversation.userId,
      conversationId: conversation.id,
      agentType,
    });

    return this.parsePlanResponse(response, agentType);
  }

  /**
   * 解析 Plan LLM 响应为执行计划
   */
  private parsePlanResponse(
    response: LLMResponse,
    agentType: AgentType,
  ): ExecutionPlan {
    // 没有工具调用 → 直接回复
    if (!response.toolCalls?.length) {
      return {
        planningContent: response.content,
        steps: [],
      };
    }

    // 检查委派
    const delegateCall = response.toolCalls.find(
      (tc) => tc.name === 'delegate_to_agent',
    );
    if (delegateCall) {
      const args = delegateCall.arguments as {
        agent?: string;
        task?: string;
        context?: string;
      };
      return {
        planningContent: response.content || '',
        steps: [],
        delegation: {
          targetAgent: args.agent as AgentType,
          task: args.task || '',
          context: args.context,
        },
      };
    }

    // 按工具名去重（Plan 阶段 LLM 可能返回重复的工具名）
    const seen = new Set<string>();
    const uniqueToolCalls = response.toolCalls.filter((tc) => {
      if (seen.has(tc.name)) {
        this.logger.warn(
          `[${agentType}] Plan dedup: skipping duplicate ${tc.name}`,
        );
        return false;
      }
      seen.add(tc.name);
      return true;
    });

    const steps: PlannedStep[] = uniqueToolCalls.map((tc) => ({
      toolCall: tc,
      status: 'pending' as const,
    }));

    this.logger.log(
      `[${agentType}] Plan created: ${steps.map((s) => s.toolCall.name).join(', ')}`,
    );

    return {
      planningContent: response.content || '',
      steps,
    };
  }

  // ==================== Phase 2: EXECUTE ====================

  /**
   * 执行阶段 —— 按计划依次执行工具调用
   *
   * 这个阶段完全不调用 LLM，只执行工具
   * 工具结果写入 conversation 的 message 历史
   */
  private async executePhase(
    plan: ExecutionPlan,
    conversation: ConversationState,
  ): Promise<void> {
    // 先记录 assistant 的 plan 消息（包含所有 tool calls）
    this.memory.addMessage(conversation, {
      role: 'assistant',
      content: plan.planningContent || '',
      toolCalls: plan.steps.map((s) => s.toolCall),
    });

    // 依次执行每个步骤
    for (const step of plan.steps) {
      await this.executeStep(step, conversation);
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: PlannedStep,
    conversation: ConversationState,
  ): Promise<void> {
    step.status = 'running';
    const stepStart = Date.now();

    try {
      const executeWithTimeout = async () => {
        return this.toolExecutor.execute(
          step.toolCall,
          conversation.userId,
          conversation.context,
        );
      };

      const result = this.resilience
        ? await this.resilience.withTimeout(
            executeWithTimeout,
            TOOL_TIMEOUT_MS,
            `tool:${step.toolCall.name}`,
          )
        : await executeWithTimeout();

      step.duration = Date.now() - stepStart;
      step.result = result;

      if (result.success) {
        step.status = 'success';
      } else {
        step.status = 'failed';
        step.error = result.error;
      }

      // 记录工具结果到对话历史
      const resultContent =
        step.status === 'success'
          ? JSON.stringify(result.result)
          : JSON.stringify({ error: result.error || 'Tool execution failed' });

      this.memory.addMessage(conversation, {
        role: 'tool',
        content: resultContent,
        toolCallId: step.toolCall.id,
      });
    } catch (error) {
      step.duration = Date.now() - stepStart;
      step.status = 'failed';
      step.error =
        error instanceof Error ? error.message : 'Tool execution failed';

      this.memory.addMessage(conversation, {
        role: 'tool',
        content: JSON.stringify({ error: step.error }),
        toolCallId: step.toolCall.id,
      });

      this.logger.error(
        `[EXECUTE] Tool ${step.toolCall.name} failed: ${step.error}`,
      );
    }
  }

  // ==================== Phase 3: SOLVE ====================

  /**
   * 总结阶段（非流式）—— LLM 综合所有工具结果生成最终回复
   *
   * 关键：不传入 tools，让 LLM 无法调用任何工具
   */
  private async solvePhase(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
  ): Promise<string> {
    const systemPrompt = this.buildSolvePrompt(config, conversation);
    const messages = this.memory.getRecentMessages(conversation);

    // 不传 tools → LLM 无法生成 tool_calls → 只能输出文本
    const response = await this.llm.call(systemPrompt, messages, {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      // 故意不传 tools
      userId: conversation.userId,
      conversationId: conversation.id,
      agentType,
    });

    // 记录 assistant 最终回复
    this.memory.addMessage(conversation, {
      role: 'assistant',
      content: response.content,
      agentType,
    });

    return response.content;
  }

  /**
   * 总结阶段（流式）—— 流式输出最终回复
   */
  private async *solvePhaseStream(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
  ): AsyncGenerator<string> {
    const systemPrompt = this.buildSolvePrompt(config, conversation);
    const messages = this.memory.getRecentMessages(conversation);

    let fullContent = '';

    // 不传 tools → 只有文本输出
    for await (const chunk of this.llm.callStream(systemPrompt, messages, {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      // 故意不传 tools
    })) {
      if (chunk.type === 'content' && chunk.content) {
        fullContent += chunk.content;
        yield chunk.content;
      }
      if (chunk.type === 'done') break;
    }

    // 记录 assistant 最终回复
    this.memory.addMessage(conversation, {
      role: 'assistant',
      content: fullContent,
      agentType,
    });
  }

  // ==================== Prompt 构建 ====================

  /**
   * 构建 Plan 阶段的 system prompt
   */
  private buildPlanPrompt(
    config: AgentConfig,
    conversation: ConversationState,
  ): string {
    const contextSummary = this.memory.getContextSummary(conversation.context);

    return `${config.systemPrompt}

## 当前用户信息
${contextSummary}
${PLAN_SYSTEM_SUFFIX}`;
  }

  /**
   * 构建 Solve 阶段的 system prompt
   */
  private buildSolvePrompt(
    config: AgentConfig,
    conversation: ConversationState,
  ): string {
    const contextSummary = this.memory.getContextSummary(conversation.context);

    return `${config.systemPrompt}

## 当前用户信息
${contextSummary}
${SOLVE_SYSTEM_SUFFIX}`;
  }
}
