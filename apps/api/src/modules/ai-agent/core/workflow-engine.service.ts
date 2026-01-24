/**
 * 工作流引擎 - 企业级三阶段 Agent 执行架构
 *
 * 基于 ReWOO (Reason Without Observation) 模式：
 *
 *   Phase 1: PLAN   — LLM 分析用户意图，一次性规划所有需要调用的工具
 *   Phase 2: EXECUTE — 按计划执行所有工具调用（无 LLM 参与，杜绝重复）
 *   Phase 3: SOLVE   — LLM 综合所有工具结果，生成最终回复
 *
 * 架构原则：
 * - runStream() 是唯一的工作流实现（单一事实来源）
 * - run() 是 runStream() 的薄包装，结构性杜绝流式/非流式路径不一致
 * - 每个阶段的核心逻辑封装为独立方法，不存在重复代码
 * - Solve 阶段内置空内容 fallback（流式失败自动重试非流式）
 *
 * 降级策略：
 * - Plan 阶段 LLM 未返回工具调用 → 直接返回文本回复（无需 Solve）
 * - Plan 阶段返回 delegate_to_agent → 直接委派，不进入 Execute
 * - Execute 阶段某工具失败 → 标记失败，Solve 阶段基于已有结果生成回复
 * - Solve 阶段流式输出为空 → 自动 fallback 到非流式重试
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
import { getLocalizedSystemPrompt } from '../config/agents.config';

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

function getPlanSystemSuffix(locale: string): string {
  if (locale === 'en') {
    return `

## Workflow Instructions (Must Follow Strictly)
You are in the **planning phase**. Your tasks are:
1. Analyze the user's request
2. Determine which tools need to be called to collect information or perform actions
3. Call **all** needed tools at once (do not split into multiple rounds)

Important rules:
- Think carefully, then list all tool calls at once
- Each tool should be called at most once
- If no tools are needed, reply to the user directly
- Do not explain which tools you are calling; just call them`;
  }
  return `

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
}

function getSolveSystemSuffix(locale: string): string {
  if (locale === 'en') {
    return `

## Workflow Instructions (Must Follow Strictly)
You are in the **summarization phase**. All tools have been executed and their results are in the conversation history.
Your task is: Based on all tool results, generate a complete, friendly, well-organized **English** response.

Important rules:
- **Never** call any tools again
- Generate the response directly based on existing tool results
- If a tool failed, skip that content or inform the user
- The response should be complete, organized, and not omit important information
- If tool results contain search results (web_search or search_school_website), you **must** cite information from the search results and include source links. Search results are real-time data; use them directly. Do not say "I cannot search" or "I cannot get real-time information"`;
  }
  return `

## 工作流指令（必须严格遵守）
你正处于 **总结阶段**。所有工具已经执行完毕，结果已包含在对话历史中。
你的任务是：基于所有工具返回的数据，生成一个完整、友好、有条理的中文回复。

重要规则：
- **绝对不要** 再调用任何工具
- 直接基于已有的工具结果生成回复
- 如果某个工具执行失败，跳过相关内容或告知用户
- 回复要完整、有条理，不要遗漏重要信息
- 如果工具结果中包含搜索结果（web_search 或 search_school_website），你**必须**引用搜索结果中的信息来回答用户问题，并附上来源链接。搜索结果就是实时数据，直接使用即可，不要说"我无法搜索"或"我无法获取实时信息"`;
}

/** 阶段耗时警告阈值 (ms) */
const PHASE_WARN_MS: Record<string, number> = {
  plan: 10_000,
  execute: 30_000,
  solve: 15_000,
};

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

  // ==================== 公开 API ====================

  /**
   * Run the complete three-phase workflow (non-streaming).
   *
   * This is a thin wrapper around {@link runStream} that consumes the event
   * stream and returns the final aggregated result. Because it delegates
   * entirely to `runStream`, streaming and non-streaming paths are guaranteed
   * to be consistent.
   *
   * @param agentType - The agent type executing the workflow
   * @param config - Agent configuration (model, temperature, tools, etc.)
   * @param conversation - Current conversation state with message history
   * @param tools - Available tool definitions for this agent
   * @returns The complete workflow result including message, tools used, timing, and plan details
   * @throws {Error} If the workflow completes without producing a result or encounters an error event
   */
  /**
   * 运行完整的三阶段工作流（非流式）
   *
   * 消费 runStream() 的事件流并聚合为最终结果。
   * 与 runStream() 共享同一套实现，不可能产生不一致。
   */
  async run(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    tools: ToolDefinition[],
  ): Promise<WorkflowResult> {
    let result: WorkflowResult | undefined;

    for await (const event of this.runStream(
      agentType,
      config,
      conversation,
      tools,
    )) {
      if (event.type === 'done') result = event.result;
      if (event.type === 'error')
        throw new Error(event.error || 'Workflow failed');
    }

    if (!result) {
      throw new Error(
        `[${agentType}] Workflow completed without producing a result`,
      );
    }

    return result;
  }

  /**
   * Run the complete three-phase ReWOO workflow with streaming output.
   *
   * This is the **single source of truth** for workflow execution. All code
   * paths -- fast path (no tools needed), delegation path, and full
   * Plan-Execute-Solve -- are implemented here.
   *
   * Yields {@link WorkflowStreamEvent} objects:
   * - `phase_change`: transition between Plan / Execute / Solve phases
   * - `plan_content`: direct reply from Plan phase (fast path, no tools)
   * - `tool_start` / `tool_end`: tool execution lifecycle in Execute phase
   * - `solve_content`: incremental text chunks from Solve phase
   * - `done`: final {@link WorkflowResult}
   * - `error`: error information
   *
   * @param agentType - The agent type executing the workflow
   * @param config - Agent configuration (model, temperature, tools, etc.)
   * @param conversation - Current conversation state with message history
   * @param tools - Available tool definitions for this agent
   * @returns An async generator of WorkflowStreamEvent objects
   */
  /**
   * 运行完整的三阶段工作流（流式输出）
   *
   * 这是工作流的唯一实现（单一事实来源）。
   * 所有路径（快速路径、委派路径、完整三阶段）都在这里。
   */
  async *runStream(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    tools: ToolDefinition[],
  ): AsyncGenerator<WorkflowStreamEvent> {
    const totalStart = Date.now();

    try {
      // ---- Phase 1: PLAN ----
      yield { type: 'phase_change', phase: WorkflowPhase.PLAN };
      const planStart = Date.now();

      const plan = await this.planPhase(agentType, config, conversation, tools);
      const planMs = Date.now() - planStart;
      this.warnIfSlow(agentType, 'plan', planMs);

      this.logger.log(
        `[${agentType}] PLAN completed (${planMs}ms, ${plan.steps.length} steps)`,
      );

      // 快速路径：不需要工具调用 → 直接把 Plan 内容当最终回复输出
      if (plan.steps.length === 0 && !plan.delegation) {
        if (plan.planningContent) {
          this.memory.addMessage(conversation, {
            role: 'assistant',
            content: plan.planningContent,
            agentType,
          });
          yield { type: 'plan_content', content: plan.planningContent };
        }

        yield {
          type: 'done',
          result: this.buildWorkflowResult({
            message: plan.planningContent,
            plan,
            timing: {
              planMs,
              executeMs: 0,
              solveMs: 0,
              totalMs: Date.now() - totalStart,
            },
          }),
        };
        return;
      }

      // 委派路径 → 不进入 Execute，直接返回
      if (plan.delegation) {
        yield {
          type: 'done',
          result: this.buildWorkflowResult({
            message: '',
            plan,
            delegation: plan.delegation,
            timing: {
              planMs,
              executeMs: 0,
              solveMs: 0,
              totalMs: Date.now() - totalStart,
            },
          }),
        };
        return;
      }

      // ---- Phase 2: EXECUTE ----
      yield { type: 'phase_change', phase: WorkflowPhase.EXECUTE };
      const executeStart = Date.now();

      for await (const event of this.executePhaseCore(plan, conversation)) {
        yield event;
      }
      const executeMs = Date.now() - executeStart;
      this.warnIfSlow(agentType, 'execute', executeMs);

      this.logger.log(`[${agentType}] EXECUTE completed (${executeMs}ms)`);

      // ---- Phase 3: SOLVE ----
      yield { type: 'phase_change', phase: WorkflowPhase.SOLVE };
      const solveStart = Date.now();

      let finalMessage = '';
      for await (const chunk of this.solvePhaseCore(
        agentType,
        config,
        conversation,
      )) {
        finalMessage += chunk;
        yield { type: 'solve_content', content: chunk };
      }
      const solveMs = Date.now() - solveStart;
      this.warnIfSlow(agentType, 'solve', solveMs);

      this.logger.log(`[${agentType}] SOLVE completed (${solveMs}ms)`);

      yield {
        type: 'done',
        result: this.buildWorkflowResult({
          message: finalMessage,
          plan,
          timing: {
            planMs,
            executeMs,
            solveMs,
            totalMs: Date.now() - totalStart,
          },
        }),
      };
    } catch (error) {
      this.logger.error(
        `[${agentType}] Workflow failed: ${error instanceof Error ? error.message : error}`,
      );
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Workflow failed',
      };
    }
  }

  // ==================== Phase 1: PLAN ====================

  /**
   * Phase 1: PLAN -- Ask the LLM to analyze the user's intent and produce an execution plan.
   *
   * The LLM receives the full conversation history, the agent's system prompt
   * (with planning instructions appended), and the list of available tools.
   * With `tool_choice: 'auto'`, the LLM decides in a single call which tools
   * (if any) are needed and returns all tool calls at once.
   *
   * Possible outcomes:
   * - No tool calls: the LLM's text response is the final answer (fast path)
   * - `delegate_to_agent` tool call: delegation to another specialist agent
   * - One or more tool calls: an execution plan for the Execute phase
   *
   * @param agentType - The agent type for logging and token tracking
   * @param config - Agent configuration (model, temperature, maxTokens)
   * @param conversation - Current conversation state
   * @param tools - Available tool definitions
   * @returns The execution plan including steps, planning content, and optional delegation
   */
  /**
   * 规划阶段 —— 调用 LLM 获取执行计划
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
   * Parse the LLM's Plan-phase response into a structured execution plan.
   *
   * Handles three cases:
   * 1. No tool calls -- returns the text content as `planningContent` with empty steps
   * 2. `delegate_to_agent` tool call -- extracts delegation target and task
   * 3. Regular tool calls -- deduplicates by tool name (keeps first occurrence)
   *    and converts to `PlannedStep` objects
   *
   * @param response - The raw LLM response from the Plan phase
   * @param agentType - The agent type (used for deduplication logging)
   * @returns A structured {@link ExecutionPlan}
   */
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
   * Phase 2: EXECUTE -- Run all planned tool calls sequentially without LLM involvement.
   *
   * This is the single source of truth for the Execute phase. It:
   * 1. Records the assistant's plan message (with tool calls) into conversation history,
   *    ensuring the Solve phase sees the complete [assistant+toolCalls] -> [tool results] sequence
   * 2. Executes each planned step in order, yielding `tool_start` and `tool_end` events
   *
   * No LLM calls are made during this phase, which structurally prevents
   * duplicate or hallucinated tool invocations.
   *
   * @param plan - The execution plan from the Plan phase
   * @param conversation - Current conversation state (tool results are appended to its messages)
   * @returns An async generator of tool lifecycle events
   */
  /**
   * 执行阶段核心 —— 单一事实来源
   *
   * 1. 记录 assistant plan 消息（含 toolCalls）到对话历史
   * 2. 依次执行每个工具，yield tool_start/tool_end 事件
   *
   * 这个阶段完全不调用 LLM，只执行工具
   */
  private async *executePhaseCore(
    plan: ExecutionPlan,
    conversation: ConversationState,
  ): AsyncGenerator<WorkflowStreamEvent> {
    // 记录 assistant plan 消息（含 toolCalls）
    // 确保 Solve 阶段 getRecentMessages() 拿到完整的
    // [assistant+toolCalls] → [tool results] 消息序列
    this.memory.addMessage(conversation, {
      role: 'assistant',
      content: plan.planningContent || '',
      toolCalls: plan.steps.map((s) => s.toolCall),
    });

    for (const step of plan.steps) {
      yield { type: 'tool_start', tool: step.toolCall.name };
      await this.executeStep(step, conversation);
      yield {
        type: 'tool_end',
        tool: step.toolCall.name,
        toolResult: step.result,
      };
    }
  }

  /**
   * Execute a single planned tool call step with timeout and resilience protection.
   *
   * Updates the step's status, result, duration, and error fields in-place.
   * The tool result (or error) is also recorded as a `tool` message in the
   * conversation history so that the Solve phase has access to it.
   *
   * @param step - The planned step to execute (mutated in-place with results)
   * @param conversation - Current conversation state for message recording
   */
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
   * Phase 3: SOLVE -- Synthesize all tool results into a final user-facing response.
   *
   * This is the single source of truth for the Solve phase with built-in
   * empty-content fallback:
   *
   * 1. Streams the LLM response via `callStream`, yielding each text chunk
   * 2. If streaming produces empty content (network issue, LLM anomaly),
   *    automatically retries with a non-streaming `call` as fallback
   * 3. Logs a warning if the response is suspiciously short despite tool results
   * 4. Records the final assistant response to conversation history
   *
   * Critically, **no tools are passed** to the LLM in this phase, making it
   * structurally impossible for the LLM to invoke tools again.
   *
   * @param agentType - The agent type for logging and token tracking
   * @param config - Agent configuration (model, temperature, maxTokens)
   * @param conversation - Current conversation state (contains tool results from Execute phase)
   * @returns An async generator yielding text chunks of the final response
   */
  /**
   * 总结阶段核心 —— 单一事实来源，内置空内容 fallback
   *
   * 策略：
   * 1. 流式调用 LLM (callStream)，逐 chunk yield
   * 2. 如果流式输出为空（网络异常、LLM 异常），自动 fallback 到非流式重试
   * 3. 记录最终 assistant 回复到对话历史
   *
   * 关键：不传入 tools，让 LLM 无法调用任何工具
   */
  private async *solvePhaseCore(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
  ): AsyncGenerator<string> {
    const systemPrompt = this.buildSolvePrompt(config, conversation);
    const messages = this.memory.getRecentMessages(conversation);
    const llmOpts = {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      // 故意不传 tools → LLM 只能输出文本
      userId: conversation.userId,
      conversationId: conversation.id,
      agentType,
    };

    let fullContent = '';

    // 1. 流式输出
    for await (const chunk of this.llm.callStream(
      systemPrompt,
      messages,
      llmOpts,
    )) {
      if (chunk.type === 'content' && chunk.content) {
        fullContent += chunk.content;
        yield chunk.content;
      }
      if (chunk.type === 'done') break;
    }

    // 2. 空内容 fallback：非流式重试一次
    if (!fullContent.trim()) {
      this.logger.warn(
        `[${agentType}] Solve streaming produced empty content, retrying non-streaming`,
      );

      const response = await this.llm.call(systemPrompt, messages, llmOpts);
      fullContent = response.content;

      if (fullContent) {
        yield fullContent;
      } else {
        this.logger.error(
          `[${agentType}] Solve fallback also produced empty content`,
        );
      }
    }

    // 3. 可观测性：工具结果存在但回复过短
    const hasToolResults = conversation.messages.some((m) => m.role === 'tool');
    if (hasToolResults && fullContent.length > 0 && fullContent.length < 20) {
      this.logger.warn(
        `[${agentType}] Solve output suspiciously short (${fullContent.length} chars) with tool results`,
      );
    }

    // 4. 记录最终 assistant 回复
    this.memory.addMessage(conversation, {
      role: 'assistant',
      content: fullContent,
      agentType,
    });
  }

  // ==================== 辅助方法 ====================

  /**
   * Build a standardized {@link WorkflowResult} from workflow execution data.
   *
   * Deduplicates the list of successfully used tools and assembles timing,
   * plan, and delegation information into a single result object.
   *
   * @param params - Result parameters including message, plan, timing, and optional delegation
   * @returns A fully populated WorkflowResult
   */
  /**
   * 构建 WorkflowResult（统一结果构建，消除重复）
   */
  private buildWorkflowResult(params: {
    message: string;
    plan: ExecutionPlan;
    timing: WorkflowResult['timing'];
    delegation?: ExecutionPlan['delegation'];
  }): WorkflowResult {
    const toolsUsed = params.plan.steps
      .filter((s) => s.status === 'success')
      .map((s) => s.toolCall.name);

    return {
      message: params.message,
      toolsUsed: [...new Set(toolsUsed)],
      delegation: params.delegation,
      plan: params.plan,
      timing: params.timing,
    };
  }

  /**
   * Log a warning if a workflow phase exceeds its expected duration threshold.
   *
   * @param agentType - The agent type (for log context)
   * @param phase - The workflow phase name ('plan', 'execute', or 'solve')
   * @param ms - Actual duration in milliseconds
   */
  /**
   * 阶段耗时警告
   */
  private warnIfSlow(agentType: AgentType, phase: string, ms: number): void {
    const threshold = PHASE_WARN_MS[phase];
    if (threshold && ms > threshold) {
      this.logger.warn(
        `[${agentType}] ${phase.toUpperCase()} took ${ms}ms (threshold: ${threshold}ms)`,
      );
    }
  }

  // ==================== Prompt 构建 ====================

  /**
   * Format the current date as a human-readable string for injection into system prompts.
   *
   * @param locale - Locale for formatting ('en' for English, defaults to Chinese)
   * @returns Formatted date string (e.g., "January 15, 2026" or "2026年1月15日")
   */
  /**
   * 获取当前日期字符串（注入到系统提示中）
   */
  private getCurrentDateString(locale?: string): string {
    const now = new Date();
    if (locale === 'en') {
      return now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return `${year}年${month}月${day}日`;
  }

  /**
   * Build the system prompt for the Plan phase.
   *
   * Combines the agent's localized base prompt, the current date, the user's
   * context summary, and Plan-specific workflow instructions that tell the LLM
   * to analyze intent and call all needed tools in a single response.
   *
   * @param config - Agent configuration containing the base system prompt
   * @param conversation - Current conversation state (provides locale and user context)
   * @returns The assembled Plan-phase system prompt
   */
  /**
   * 构建 Plan 阶段的 system prompt
   */
  private buildPlanPrompt(
    config: AgentConfig,
    conversation: ConversationState,
  ): string {
    const contextSummary = this.memory.getContextSummary(conversation.context);
    const locale = (conversation.metadata?.locale as string) || 'zh';
    const localizedPrompt = getLocalizedSystemPrompt(config, locale);
    const dateLabel =
      locale === 'en' ? '## Current Date\nToday is' : '## 当前时间\n今天是';
    const userInfoLabel =
      locale === 'en' ? '## Current User Info' : '## 当前用户信息';

    return `${localizedPrompt}

${dateLabel} ${this.getCurrentDateString(locale)}

${userInfoLabel}
${contextSummary}
${getPlanSystemSuffix(locale)}`;
  }

  /**
   * Build the system prompt for the Solve phase.
   *
   * Similar to `buildPlanPrompt` but appends Solve-specific instructions that
   * tell the LLM to synthesize tool results into a final response without
   * calling any tools. Includes instructions for citing search results.
   *
   * @param config - Agent configuration containing the base system prompt
   * @param conversation - Current conversation state (provides locale and user context)
   * @returns The assembled Solve-phase system prompt
   */
  /**
   * 构建 Solve 阶段的 system prompt
   */
  private buildSolvePrompt(
    config: AgentConfig,
    conversation: ConversationState,
  ): string {
    const contextSummary = this.memory.getContextSummary(conversation.context);
    const locale = (conversation.metadata?.locale as string) || 'zh';
    const localizedPrompt = getLocalizedSystemPrompt(config, locale);
    const dateLabel =
      locale === 'en' ? '## Current Date\nToday is' : '## 当前时间\n今天是';
    const userInfoLabel =
      locale === 'en' ? '## Current User Info' : '## 当前用户信息';

    return `${localizedPrompt}

${dateLabel} ${this.getCurrentDateString(locale)}

${userInfoLabel}
${contextSummary}
${getSolveSystemSuffix(locale)}`;
  }
}
