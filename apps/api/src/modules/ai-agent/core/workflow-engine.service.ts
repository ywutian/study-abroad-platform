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
 * - Solve 内置成功空响应 fallback；Harness 错误或缺终态不重试
 *
 * 降级策略：
 * - Plan 阶段 LLM 未返回工具调用 → 直接返回文本回复（无需 Solve）
 * - Plan 阶段返回 delegate_to_agent → 直接委派，不进入 Execute
 * - Execute 阶段某工具失败 → 标记失败，Solve 阶段基于已有结果生成回复
 * - Solve 成功完成但内容为空 → fallback 到非流式重试（仍受预算约束）
 */

import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMService, LLMResponse } from './llm.service';
import {
  parseVerificationFacts,
  verifySchoolFacts,
} from './workflow-verification';
import { ToolExecutorService } from './tool-executor.service';
import { MemoryService } from './memory.service';
import { ResilienceService } from './resilience.service';
import { MemoryManagerService } from '../memory';
import {
  AgentType,
  AgentConfig,
  ConversationState,
  ToolDefinition,
  ToolCall,
  AgentHarnessMode,
} from '../types';
import { getLocalizedSystemPrompt } from '../config/agents.config';
import { getToolMetadata, TOOL_READONLY } from '../config/tools.config';
import { extractJsonFromLlm } from '../../../common/utils/llm-json.util';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { ToolPolicyService } from './tool-policy.service';
import {
  getApprovalFingerprint,
  type AgentRunBudgetV1,
} from './agent-run.service';
import { AgentRunBudgetTracker } from './agent-run-context';
import {
  canAffordVerification,
  VERIFY_RESERVE,
  withSupplementalBudget,
} from './workflow-budget';
import { checkedWorkflowStream } from './workflow-stream';
import { getConfiguredRunBudget } from './agent-run-settings';
import type { AgentRunCheckpoint } from './agent-run-state';
import {
  canonicalize,
  ExecutionPlan,
  getPlanSystemSuffix,
  getSolveSystemSuffix,
  MAX_SUPPLEMENTAL_PLANNING_ROUNDS,
  MAX_TOOL_CALLS_PER_RUN,
  PHASE_WARN_MS,
  PlannedStep,
  TOOL_TIMEOUT_MS,
  WorkflowPhase,
  WorkflowResult,
  WorkflowRunContext,
  WorkflowStreamEvent,
} from './workflow-contract';
import {
  buildRunCheckpoint,
  buildWorkflowResult,
} from './workflow-result-builder';
import { AgentRunService } from './agent-run.service';

export * from './workflow-contract';

export type WorkflowLlmClient = Pick<LLMService, 'call' | 'callStream'>;
export type WorkflowToolExecutor = Pick<ToolExecutorService, 'execute'>;
export type WorkflowMemory = Pick<
  MemoryService,
  'addMessage' | 'getRecentMessages' | 'getContextSummary'
>;

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    @Inject(LLMService) private llm: WorkflowLlmClient,
    @Inject(ToolExecutorService) private toolExecutor: WorkflowToolExecutor,
    @Inject(MemoryService) private memory: WorkflowMemory,
    @Optional() private resilience?: ResilienceService,
    @Optional() private memoryManager?: MemoryManagerService,
    @Optional() private metricsService?: MetricsService,
    @Optional() private toolPolicy?: ToolPolicyService,
    @Optional() private configService?: ConfigService,
    @Optional() private agentRuns?: AgentRunService,
  ) {}

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
  async run(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    tools: ToolDefinition[],
    runContext?: WorkflowRunContext,
  ): Promise<WorkflowResult> {
    let result: WorkflowResult | undefined;

    for await (const event of this.runStream(
      agentType,
      config,
      conversation,
      tools,
      runContext,
    )) {
      if (event.type === 'done') result = event.result;
      if (event.type === 'error')
        throw new InternalServerErrorException(
          event.error || 'Workflow failed',
        );
    }

    if (!result) {
      throw new InternalServerErrorException(
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
    runContext?: WorkflowRunContext,
  ): AsyncGenerator<WorkflowStreamEvent> {
    const totalStart = Date.now();
    const harnessEnabled = this.isHarnessEnabled();
    const persistedBudget = runContext?.runId
      ? await this.agentRuns?.getPersistedBudget(
          conversation.userId,
          runContext.runId,
        )
      : undefined;
    const budgetTracker =
      harnessEnabled && this.isContextEnabled()
        ? new AgentRunBudgetTracker(persistedBudget ?? this.getRunBudget())
        : undefined;
    let scheduledCalls = 0;
    let supplementalRounds = 0;

    // Pre-fetch enterprise memory context once for the entire workflow turn.
    // Reused by both Plan and Solve phases to avoid redundant embedding + DB queries.
    const locale = (conversation.metadata?.locale as string) || 'zh';
    const cachedMemoryContext = await this.getEnterpriseMemoryContext(
      conversation,
      locale,
    );

    try {
      // ---- Phase 1: PLAN ----
      yield { type: 'phase_change', phase: WorkflowPhase.PLAN };
      const planStart = Date.now();

      let plan = await this.planPhase(
        agentType,
        config,
        conversation,
        tools,
        cachedMemoryContext,
        harnessEnabled,
        budgetTracker,
      );
      let planMs = Date.now() - planStart;
      this.warnIfSlow(agentType, 'plan', planMs);

      this.logger.log(
        `[${agentType}] PLAN completed (${planMs}ms, ${plan.steps.length} steps)`,
      );

      // 快速路径：不需要工具调用 → 把 Plan 内容当最终回复，分块输出模拟流式
      if (plan.steps.length === 0 && !plan.delegation) {
        if (plan.planningContent) {
          // Emit in small chunks to simulate streaming for the client.
          // Without this, the entire response arrives as a single event
          // because the Plan phase uses non-streaming llm.call().
          // Note: assistant message persistence is handled by the Orchestrator's
          // collectAndPersistStream / persistAssistantResponse to avoid double-write.
          yield* this.emitChunked(plan.planningContent, 'plan_content');
        }

        yield {
          type: 'done',
          result: buildWorkflowResult({
            message: plan.planningContent,
            plan,
            timing: {
              planMs,
              executeMs: 0,
              solveMs: 0,
              totalMs: Date.now() - totalStart,
            },
            budgetTracker,
            scheduledCalls,
            supplementalRounds,
            conversation,
          }),
        };
        return;
      }

      // 委派路径 → 不进入 Execute，直接返回
      if (plan.delegation) {
        yield {
          type: 'done',
          result: buildWorkflowResult({
            message: '',
            plan,
            delegation: plan.delegation,
            timing: {
              planMs,
              executeMs: 0,
              solveMs: 0,
              totalMs: Date.now() - totalStart,
            },
            budgetTracker,
            scheduledCalls,
            supplementalRounds,
            conversation,
          }),
        };
        return;
      }

      // ---- Phase 2: EXECUTE ----
      yield { type: 'phase_change', phase: WorkflowPhase.EXECUTE };
      let executeMs = 0;

      if (harnessEnabled) {
        const aggregatePlan: ExecutionPlan = {
          planningContent: plan.planningContent,
          steps: [],
        };
        const successfulCalls = new Set<string>();
        const allowedToolNames = new Set(tools.map((tool) => tool.name));
        const mode = this.getHarnessMode();
        let currentRound = plan;
        while (
          currentRound.steps.length > 0 &&
          scheduledCalls <
            (budgetTracker?.limits.maxToolCalls ?? MAX_TOOL_CALLS_PER_RUN)
        ) {
          budgetTracker?.assertWithinDuration();
          const remainingBudget =
            (budgetTracker?.limits.maxToolCalls ?? MAX_TOOL_CALLS_PER_RUN) -
            scheduledCalls;
          const roundSteps = currentRound.steps.slice(0, remainingBudget);
          if (roundSteps.length < currentRound.steps.length) {
            this.logger.warn(
              `[${agentType}] Tool budget reached; dropped ${currentRound.steps.length - roundSteps.length} planned calls`,
            );
          }

          const executionRound: ExecutionPlan = {
            planningContent: currentRound.planningContent,
            steps: roundSteps,
          };
          aggregatePlan.steps.push(...roundSteps);
          const roundStartIndex =
            aggregatePlan.steps.length - roundSteps.length;
          scheduledCalls += roundSteps.length;

          const roundStart = Date.now();
          let pauseEvent: WorkflowStreamEvent | undefined;
          for await (const event of this.executeHarnessPhaseCore(
            executionRound,
            conversation,
            agentType,
            mode,
            successfulCalls,
            allowedToolNames,
            !!runContext?.approvalsEnabled,
          )) {
            if (event.type === 'approval_required' && event.toolCall) {
              const pendingStepIndex =
                roundStartIndex + (event.pendingStepIndex ?? 0);
              const checkpoint = buildRunCheckpoint({
                agentType,
                locale,
                plan: aggregatePlan,
                pendingStepIndex,
                successfulCalls,
                scheduledCalls,
                supplementalRounds,
                planMs,
                executeMs: executeMs + (Date.now() - roundStart),
                startedAt: new Date(totalStart),
                conversation,
                budgetTracker,
                approvalState: 'waiting',
              });
              pauseEvent = { ...event, checkpoint, runId: runContext?.runId };
              yield pauseEvent;
              break;
            }
            yield event;
          }
          executeMs += Date.now() - roundStart;

          if (pauseEvent) {
            yield {
              type: 'run_paused',
              toolCall: pauseEvent.toolCall,
              checkpoint: pauseEvent.checkpoint,
              runId: runContext?.runId,
            };
            return;
          }

          if (
            scheduledCalls >=
              (budgetTracker?.limits.maxToolCalls ?? MAX_TOOL_CALLS_PER_RUN) ||
            supplementalRounds >=
              (budgetTracker?.limits.maxSupplementalRounds ??
                MAX_SUPPLEMENTAL_PLANNING_ROUNDS)
          ) {
            break;
          }

          const supplementalStart = Date.now();
          const nextRound = await this.supplementalPlanPhase(
            agentType,
            config,
            conversation,
            tools,
            cachedMemoryContext,
            supplementalRounds + 1,
            budgetTracker,
          );
          planMs += Date.now() - supplementalStart;
          if (!nextRound) break;
          supplementalRounds += 1;
          currentRound = nextRound;
        }

        plan = aggregatePlan;
      } else {
        const executeStart = Date.now();
        for await (const event of this.executePhaseCore(plan, conversation)) {
          yield event;
        }
        executeMs = Date.now() - executeStart;
      }
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
        cachedMemoryContext,
        budgetTracker,
      )) {
        finalMessage += chunk;
        yield { type: 'solve_content', content: chunk };
      }
      const solveMs = Date.now() - solveStart;
      this.warnIfSlow(agentType, 'solve', solveMs);

      this.logger.log(`[${agentType}] SOLVE completed (${solveMs}ms)`);

      // ---- Optional: Chain-of-Verification (CoVE) for enableReflection agents ----
      let verifyMs = 0;
      if (config.enableReflection && finalMessage && plan.steps.length > 0) {
        const verifyStart = Date.now();
        const verifyResult = await this.verificationPhase(
          agentType,
          config,
          finalMessage,
          plan,
          conversation,
          locale,
          budgetTracker,
          (budgetTracker?.limits.maxToolCalls ?? MAX_TOOL_CALLS_PER_RUN) -
            scheduledCalls,
        );
        scheduledCalls += verifyResult.toolCalls;
        verifyMs = Date.now() - verifyStart;

        if (
          verifyResult.status === 'verified' ||
          verifyResult.status === 'conflict'
        ) {
          this.metricsService?.recordCritique(verifyResult.allCorrect);
        }

        if (verifyResult.corrections.length > 0) {
          this.logger.log(
            `[${agentType}] CoVE found ${verifyResult.corrections.length} inaccuracies (${verifyMs}ms), re-solving`,
          );

          const correctionReport = verifyResult.corrections
            .map(
              (c) => `- "${c.claim}" → actual: ${c.actual} (source: ${c.tool})`,
            )
            .join('\n');

          let resolvedMessage = '';
          for await (const chunk of this.reSolvePhase(
            agentType,
            config,
            conversation,
            `The following facts in your response were verified against the database and found to be inaccurate. Please correct them:\n${correctionReport}`,
            cachedMemoryContext,
            budgetTracker,
          )) {
            resolvedMessage += chunk;
            yield { type: 'solve_content', content: chunk };
          }

          if (resolvedMessage) {
            finalMessage = resolvedMessage;
          }
        } else if (verifyResult.allCorrect) {
          this.logger.debug(
            `[${agentType}] CoVE passed — ${verifyResult.verified} facts verified (${verifyMs}ms)`,
          );
        }
        if (verifyResult.unverified > 0) {
          const notice =
            locale === 'en'
              ? '\n\nSome factual claims could not be independently checked. Confirm school policies, costs and deadlines with official sources before acting.'
              : '\n\n部分事实尚未完成独立核验。采取行动前，请向学校官方确认政策、费用和截止日期。';
          finalMessage += notice;
          yield { type: 'solve_content', content: notice };
        }
      }

      yield {
        type: 'done',
        result: buildWorkflowResult({
          message: finalMessage,
          plan,
          timing: {
            planMs,
            executeMs,
            solveMs: solveMs + verifyMs,
            totalMs: Date.now() - totalStart,
          },
          budgetTracker,
          scheduledCalls,
          supplementalRounds,
          conversation,
        }),
      };
    } catch (error) {
      this.logger.error(
        `[${agentType}] Workflow failed: ${String(error instanceof Error ? error.message : error)}`,
      );
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Workflow failed',
      };
    }
  }

  /** Resume a persisted plan from the exact tool call approved by the user. */
  async *resumeStream(
    config: AgentConfig,
    conversation: ConversationState,
    tools: ToolDefinition[],
    checkpoint: AgentRunCheckpoint,
    approvedFingerprint: string,
    runContext: WorkflowRunContext,
  ): AsyncGenerator<WorkflowStreamEvent> {
    const agentType = checkpoint.agentType;
    const locale = checkpoint.locale || 'zh';
    const plan: ExecutionPlan = {
      planningContent: checkpoint.planningContent,
      steps: checkpoint.steps.map((step) => ({
        toolCall: step.toolCall,
        status: step.status,
        error: step.error,
      })),
    };
    const successfulCalls = new Set(checkpoint.successfulFingerprints);
    const allowedToolNames = new Set(tools.map((tool) => tool.name));
    const mode = this.getHarnessMode();
    const budgetTracker =
      checkpoint.version === 2
        ? new AgentRunBudgetTracker(checkpoint.budget, checkpoint.usage)
        : this.isContextEnabled()
          ? new AgentRunBudgetTracker({
              ...this.getRunBudget(),
              routing: undefined,
            })
          : undefined;
    const totalStart = new Date(checkpoint.startedAt).getTime() || Date.now();
    let executeMs = checkpoint.executeMs;

    yield { type: 'run_resumed', runId: runContext.runId };

    for (
      let index = checkpoint.pendingStepIndex;
      index < plan.steps.length;
      index++
    ) {
      const step = plan.steps[index];
      budgetTracker?.assertWithinDuration();
      const fingerprint = this.getToolCallFingerprint(step.toolCall);
      const approvalFingerprint = getApprovalFingerprint(step.toolCall);
      if (successfulCalls.has(fingerprint)) {
        step.status = 'success';
        step.duration = 0;
        step.result = {
          success: true,
          result: { skipped: true, reason: 'DUPLICATE_SUCCESSFUL_CALL' },
          duration: 0,
          cached: true,
        };
        this.appendToolResultToMemory(step, conversation);
        yield {
          type: 'tool_end',
          tool: step.toolCall.name,
          toolResult: step.result,
          toolCall: step.toolCall,
        };
        continue;
      }
      const decision = this.toolPolicy?.evaluate({
        toolName: step.toolCall.name,
        mode,
        agentType,
        userContext: conversation.context,
        allowedToolNames,
      }) ?? {
        action: 'deny' as const,
        reasonCode: 'POLICY_SERVICE_UNAVAILABLE' as const,
      };
      const isApprovedStep =
        index === checkpoint.pendingStepIndex &&
        approvalFingerprint === approvedFingerprint;

      if (decision.action === 'deny') {
        yield { type: 'error', error: decision.reasonCode };
        return;
      }

      if (decision.action === 'confirmation_required' && !isApprovedStep) {
        const nextCheckpoint = buildRunCheckpoint({
          agentType,
          locale,
          plan,
          pendingStepIndex: index,
          successfulCalls,
          scheduledCalls: checkpoint.scheduledCalls,
          supplementalRounds: checkpoint.supplementalRounds,
          planMs: checkpoint.planMs,
          executeMs,
          startedAt: new Date(totalStart),
          conversation,
          budgetTracker,
          approvalState: 'waiting',
        });
        yield {
          type: 'approval_required',
          tool: step.toolCall.name,
          toolCall: step.toolCall,
          checkpoint: nextCheckpoint,
          runId: runContext.runId,
        };
        yield {
          type: 'run_paused',
          toolCall: step.toolCall,
          checkpoint: nextCheckpoint,
          runId: runContext.runId,
        };
        return;
      }

      if (isApprovedStep && decision.action !== 'confirmation_required') {
        yield { type: 'error', error: 'APPROVAL_POLICY_CHANGED' };
        return;
      }

      yield { type: 'tool_start', tool: step.toolCall.name };
      const stepStart = Date.now();
      await this.executeStepNoMemory(
        step,
        conversation,
        getToolMetadata(step.toolCall.name)?.timeoutMs,
      );
      executeMs += Date.now() - stepStart;
      if (step.status === 'success') successfulCalls.add(fingerprint);
      this.appendToolResultToMemory(step, conversation);
      yield {
        type: 'tool_end',
        tool: step.toolCall.name,
        toolResult: step.result,
        toolCall: step.toolCall,
      };

      if (isApprovedStep && step.status !== 'success') {
        yield {
          type: 'error',
          error: step.error || 'APPROVED_TOOL_EXECUTION_FAILED',
        };
        return;
      }
    }

    yield { type: 'phase_change', phase: WorkflowPhase.SOLVE };
    const memoryContext = await this.getEnterpriseMemoryContext(
      conversation,
      locale,
    );
    const solveStart = Date.now();
    let finalMessage = '';
    for await (const chunk of this.solvePhaseCore(
      agentType,
      config,
      conversation,
      memoryContext,
      budgetTracker,
    )) {
      finalMessage += chunk;
      yield { type: 'solve_content', content: chunk };
    }
    const solveMs = Date.now() - solveStart;
    yield {
      type: 'done',
      result: buildWorkflowResult({
        message: finalMessage,
        plan,
        timing: {
          planMs: checkpoint.planMs,
          executeMs,
          solveMs,
          totalMs: Date.now() - totalStart,
        },
        budgetTracker,
        scheduledCalls: checkpoint.scheduledCalls,
        supplementalRounds: checkpoint.supplementalRounds,
        conversation,
      }),
    };
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
  private async planPhase(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    tools: ToolDefinition[],
    memoryContext: string = '',
    harnessEnabled = false,
    budgetTracker?: AgentRunBudgetTracker,
  ): Promise<ExecutionPlan> {
    const systemPrompt = this.buildPlanPrompt(
      config,
      conversation,
      memoryContext,
      harnessEnabled,
    );
    const messages = this.memory.getRecentMessages(conversation);

    const response = await this.llm.call(systemPrompt, messages, {
      taskType: 'agent.plan',
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      tools,
      userId: conversation.userId,
      conversationId: conversation.id,
      agentType,
      runBudget: budgetTracker,
    });

    return this.parsePlanResponse(response, agentType, harnessEnabled);
  }

  private async supplementalPlanPhase(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    tools: ToolDefinition[],
    memoryContext: string,
    round: number,
    budgetTracker?: AgentRunBudgetTracker,
  ): Promise<ExecutionPlan | undefined> {
    const locale = (conversation.metadata?.locale as string) || 'zh';
    const instruction =
      locale === 'en'
        ? `\n\n## Supplemental Planning Round ${round}\nReview the tool results already in the conversation. Call only additional tools that are necessary. Do not repeat a successful call with identical arguments. If the available results are sufficient, return no tool calls.`
        : `\n\n## 补充规划第 ${round} 轮\n检查对话中已有的工具结果，只调用仍然必要的补充工具。不要重复参数相同且已经成功的调用。如果现有结果已经足够，不要再调用工具。`;
    const systemPrompt =
      this.buildPlanPrompt(config, conversation, memoryContext, true) +
      instruction;
    const messages = this.memory.getRecentMessages(conversation);
    const replanTools = tools.filter(
      (tool) => tool.name !== 'delegate_to_agent',
    );
    const response = await withSupplementalBudget<LLMResponse>({
      budget: budgetTracker,
      solvePrompt: this.buildSolvePrompt(config, conversation, memoryContext),
      replanPrompt: systemPrompt,
      messages,
      tools: replanTools,
      maxTokens: config.maxTokens ?? 4000,
      verifyReserveTokens: config.enableReflection ? VERIFY_RESERVE : 0,
      observe: (decision) =>
        this.logger.log(`Workflow budget ${JSON.stringify(decision)}`),
      call: (maxTokens) =>
        this.llm.call(systemPrompt, messages, {
          taskType: 'agent.replan',
          model: config.model,
          temperature: config.temperature,
          maxTokens,
          tools: replanTools,
          userId: conversation.userId,
          conversationId: conversation.id,
          agentType,
          runBudget: budgetTracker,
        }),
    });
    if (!response) return undefined;

    const plan = this.parsePlanResponse(response, agentType, true);
    if (plan.delegation) {
      this.logger.warn(
        `[${agentType}] Ignoring delegation requested during supplemental planning`,
      );
      return { planningContent: response.content || '', steps: [] };
    }
    return plan;
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
    dedupeByFingerprint = false,
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

    // Legacy ReWOO deduplicates by tool name. Harness mode permits the same
    // tool with different arguments and only removes identical calls.
    const seen = new Set<string>();
    const uniqueToolCalls = response.toolCalls.filter((tc) => {
      const dedupeKey = dedupeByFingerprint
        ? this.getToolCallFingerprint(tc)
        : tc.name;
      if (seen.has(dedupeKey)) {
        this.logger.warn(
          `[${agentType}] Plan dedup: skipping duplicate ${tc.name}`,
        );
        return false;
      }
      seen.add(dedupeKey);
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
   * Phase 2: EXECUTE -- Run planned tool calls with read/write-split parallelism.
   *
   * Strategy:
   * 1. Record the assistant's plan message (with tool calls) into conversation history
   * 2. Partition tools into readonly (parallelizable) and mutable (sequential) groups
   * 3. Execute all readonly tools concurrently via Promise.allSettled
   * 4. Execute mutable tools sequentially
   * 5. Append tool results to conversation history in plan-original order
   *    (critical for Solve phase coherence)
   *
   * No LLM calls are made during this phase, which structurally prevents
   * duplicate or hallucinated tool invocations.
   */
  private async *executePhaseCore(
    plan: ExecutionPlan,
    conversation: ConversationState,
  ): AsyncGenerator<WorkflowStreamEvent> {
    // Record assistant plan message (with toolCalls)
    this.memory.addMessage(conversation, {
      role: 'assistant',
      content: plan.planningContent || '',
      toolCalls: plan.steps.map((s) => s.toolCall),
    });

    // Partition: readonly (parallelizable) vs mutable (sequential)
    const readonlySteps = plan.steps.filter((s) =>
      TOOL_READONLY.has(s.toolCall.name),
    );
    const mutableSteps = plan.steps.filter(
      (s) => !TOOL_READONLY.has(s.toolCall.name),
    );

    // Phase 2a: Execute readonly tools in parallel
    if (readonlySteps.length > 0) {
      for (const step of readonlySteps) {
        yield { type: 'tool_start', tool: step.toolCall.name };
      }

      // Parallel execution — no memory writes inside (order-preserving)
      await Promise.allSettled(
        readonlySteps.map((step) =>
          this.executeStepNoMemory(step, conversation),
        ),
      );

      // Append results to conversation history in plan-original order
      for (const step of readonlySteps) {
        this.appendToolResultToMemory(step, conversation);
        yield {
          type: 'tool_end',
          tool: step.toolCall.name,
          toolResult: step.result,
        };
      }
    }

    // Phase 2b: Execute mutable tools sequentially
    for (const step of mutableSteps) {
      yield { type: 'tool_start', tool: step.toolCall.name };
      await this.executeStep(step, conversation);
      yield {
        type: 'tool_end',
        tool: step.toolCall.name,
        toolResult: step.result,
      };
    }
  }

  private async *executeHarnessPhaseCore(
    plan: ExecutionPlan,
    conversation: ConversationState,
    agentType: AgentType,
    mode: AgentHarnessMode,
    successfulCalls: Set<string>,
    allowedToolNames: ReadonlySet<string>,
    approvalsEnabled: boolean,
  ): AsyncGenerator<WorkflowStreamEvent> {
    this.memory.addMessage(conversation, {
      role: 'assistant',
      content: plan.planningContent || '',
      toolCalls: plan.steps.map((step) => step.toolCall),
    });

    for (const [stepIndex, step] of plan.steps.entries()) {
      const fingerprint = this.getToolCallFingerprint(step.toolCall);

      if (successfulCalls.has(fingerprint)) {
        step.status = 'success';
        step.duration = 0;
        step.result = {
          success: true,
          result: { skipped: true, reason: 'DUPLICATE_SUCCESSFUL_CALL' },
          duration: 0,
          cached: true,
        };
        this.appendToolResultToMemory(step, conversation);
        yield {
          type: 'tool_end',
          tool: step.toolCall.name,
          toolResult: step.result,
        };
        continue;
      }

      const decision = this.toolPolicy?.evaluate({
        toolName: step.toolCall.name,
        mode,
        agentType,
        userContext: conversation.context,
        allowedToolNames,
      }) ?? {
        action: 'deny' as const,
        reasonCode: 'POLICY_SERVICE_UNAVAILABLE' as const,
      };

      if (decision.action !== 'allow') {
        if (decision.action === 'confirmation_required' && approvalsEnabled) {
          yield {
            type: 'approval_required',
            tool: step.toolCall.name,
            toolCall: step.toolCall,
            pendingStepIndex: stepIndex,
          };
          return;
        }

        yield { type: 'tool_start', tool: step.toolCall.name };
        step.status = 'failed';
        step.duration = 0;
        step.error = decision.reasonCode;
        step.result = {
          success: false,
          error:
            decision.action === 'confirmation_required'
              ? 'Tool execution requires confirmation'
              : 'Tool execution denied by policy',
          errorCode: decision.reasonCode,
          duration: 0,
          policy: decision,
        };
        this.appendToolResultToMemory(step, conversation);
        yield {
          type: 'tool_end',
          tool: step.toolCall.name,
          toolResult: step.result,
        };
        continue;
      }

      yield { type: 'tool_start', tool: step.toolCall.name };
      await this.executeStepNoMemory(
        step,
        conversation,
        getToolMetadata(step.toolCall.name)?.timeoutMs,
      );
      if (step.status === 'success' && !step.result?.cached) {
        successfulCalls.add(this.getToolCallFingerprint(step.toolCall));
      }
      this.appendToolResultToMemory(step, conversation);
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
      const stepLocale = (conversation.metadata?.locale as string) || 'zh';
      const executeWithTimeout = async () => {
        return this.toolExecutor.execute(
          step.toolCall,
          conversation.userId,
          conversation.context,
          stepLocale,
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

  /**
   * Execute a single tool step WITHOUT writing to conversation memory.
   *
   * Used by parallel execution: results are appended to memory in
   * plan-original order after all parallel steps complete, preserving
   * the message sequence that the Solve phase expects.
   */
  private async executeStepNoMemory(
    step: PlannedStep,
    conversation: ConversationState,
    timeoutMs: number = TOOL_TIMEOUT_MS,
  ): Promise<void> {
    step.status = 'running';
    const stepStart = Date.now();

    try {
      const stepLocale = (conversation.metadata?.locale as string) || 'zh';
      const executeWithTimeout = async () => {
        return this.toolExecutor.execute(
          step.toolCall,
          conversation.userId,
          conversation.context,
          stepLocale,
        );
      };

      const result = this.resilience
        ? await this.resilience.withTimeout(
            executeWithTimeout,
            timeoutMs,
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
    } catch (error) {
      step.duration = Date.now() - stepStart;
      step.status = 'failed';
      step.error =
        error instanceof Error ? error.message : 'Tool execution failed';

      this.logger.error(
        `[EXECUTE] Tool ${step.toolCall.name} failed: ${step.error}`,
      );
    }
  }

  /**
   * Append a completed tool step's result to conversation memory.
   *
   * Called after parallel execution completes, in plan-original order,
   * to ensure the Solve phase sees tool results in a deterministic sequence.
   */
  private appendToolResultToMemory(
    step: PlannedStep,
    conversation: ConversationState,
  ): void {
    const resultContent =
      step.status === 'success'
        ? JSON.stringify(step.result?.result)
        : JSON.stringify({
            error: step.result?.error || step.error || 'Tool execution failed',
            ...(step.result?.errorCode && {
              errorCode: step.result.errorCode,
            }),
            ...(step.result?.policy && { policy: step.result.policy }),
          });

    this.memory.addMessage(conversation, {
      role: 'tool',
      content: resultContent,
      toolCallId: step.toolCall.id,
    });
  }

  // ==================== Phase 3: SOLVE ====================

  /**
   * Phase 3: SOLVE -- Synthesize all tool results into a final user-facing response.
   *
   * This is the single source of truth for the Solve phase with built-in
   * empty-content fallback:
   *
   * 1. Streams the LLM response via `callStream`, yielding each text chunk
   * 2. If a successful stream is empty, retry once with a non-streaming call.
   *    Harness stream errors/missing terminals fail without replay.
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
  private async *solvePhaseCore(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    memoryContext: string = '',
    budgetTracker?: AgentRunBudgetTracker,
  ): AsyncGenerator<string> {
    const systemPrompt = this.buildSolvePrompt(
      config,
      conversation,
      memoryContext,
    );
    const messages = this.memory.getRecentMessages(conversation);
    const llmOpts = {
      taskType: 'agent.solve' as const,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      // 故意不传 tools → LLM 只能输出文本
      userId: conversation.userId,
      conversationId: conversation.id,
      agentType,
      runBudget: budgetTracker,
    };

    let fullContent = '';

    // 1. 流式输出
    for await (const chunk of checkedWorkflowStream(
      this.llm.callStream(systemPrompt, messages, llmOpts),
      budgetTracker,
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

    // 3. 兜底：双重失败后返回有意义的消息（含已成功的工具信息）
    if (!fullContent.trim()) {
      const solveLocale = (conversation.metadata?.locale as string) || 'zh';
      // Check which tools succeeded (plan is accessible in runStream scope)
      const succeededTools = conversation.messages
        .filter((m) => m.role === 'tool')
        .map((m) => m.toolCallId)
        .filter(Boolean);

      if (succeededTools.length > 0) {
        fullContent =
          solveLocale === 'en'
            ? `I retrieved some data but couldn't generate a complete response. Please try again.`
            : `我已获取了部分数据，但未能生成完整回复。请重试。`;
      } else {
        fullContent =
          solveLocale === 'en'
            ? 'I was unable to generate a response. Please try again.'
            : '抱歉，我无法生成回复，请稍后重试。';
      }
      yield fullContent;
    }

    // 4. 可观测性：工具结果存在但回复过短
    const hasToolResults = conversation.messages.some((m) => m.role === 'tool');
    if (hasToolResults && fullContent.length > 0 && fullContent.length < 20) {
      this.logger.warn(
        `[${agentType}] Solve output suspiciously short (${fullContent.length} chars) with tool results`,
      );
    }

    // Note: final assistant message persistence is handled by the Orchestrator
    // (collectAndPersistStream / persistAssistantResponse) to avoid double-write.
  }

  // ==================== Phase 4: Chain-of-Verification (CoVE) ====================

  /**
   * Chain-of-Verification: extract verifiable facts from the response,
   * verify each against database tools, and report corrections.
   *
   * Steps:
   * 1. LLM extracts verifiable facts (school names, numbers, dates)
   * 2. Each fact is verified via tool call (parallel execution)
   * 3. Mismatches become corrections for ReSolve
   *
   * Hard limits:
   * - Max 5 verification questions (cost control)
   * - Only verifiable facts (skip subjective claims)
   * - Unknown verification is never reported as a passed check
   */
  private async verificationPhase(
    agentType: AgentType,
    config: AgentConfig,
    solveOutput: string,
    plan: ExecutionPlan,
    conversation: ConversationState,
    locale: string,
    budgetTracker?: AgentRunBudgetTracker,
    remainingToolCalls = 5,
  ): Promise<Awaited<ReturnType<typeof verifySchoolFacts>>> {
    try {
      // Step 1: Extract verifiable facts from the response
      const extractPrompt =
        locale === 'en'
          ? `Extract up to 5 verifiable factual claims from this college admissions response.
Only include claims that can be checked against a school database (acceptance rates, rankings, deadlines, tuition).
Skip subjective opinions or advice.

Response:
${solveOutput.slice(0, 2000)}

Reply in JSON: {"facts": [{"claim": "MIT has a 3.4% acceptance rate", "schoolName": "MIT", "field": "acceptanceRate"}]}`
          : `从以下留学申请回复中提取最多 5 个可验证的事实性声明。
只包含可以通过学校数据库验证的声明（录取率、排名、截止日期、学费）。
跳过主观建议。

回复：
${solveOutput.slice(0, 2000)}

用 JSON 回复：{"facts": [{"claim": "MIT 录取率 3.4%", "schoolName": "MIT", "field": "acceptanceRate"}]}`;

      const verify = canAffordVerification(budgetTracker, extractPrompt);
      if (!verify.affordable) {
        this.logger.log(`Workflow budget ${JSON.stringify(verify.decision)}`);
        return {
          allCorrect: false,
          status: 'unverified',
          unverified: 1,
          verified: 0,
          toolCalls: 0,
          corrections: [],
        };
      }
      const extractResult = await this.llm.call(extractPrompt, [], {
        taskType: 'agent.verify',
        model: config.reflectionModel || 'gpt-5.4-mini',
        temperature: 0,
        maxTokens: 500,
        userId: 'system',
        agentType: `${agentType}_cove_extract`,
        providerOptions: { response_format: { type: 'json_object' } },
        runBudget: budgetTracker,
      });

      const facts = parseVerificationFacts(
        extractJsonFromLlm(extractResult.content),
      );

      if (!facts?.length) {
        return {
          allCorrect: false,
          status: facts ? 'not_applicable' : 'unverified',
          unverified: facts ? 0 : 1,
          verified: 0,
          toolCalls: 0,
          corrections: [],
        };
      }

      return await verifySchoolFacts(
        facts,
        this.toolExecutor,
        conversation,
        locale,
        remainingToolCalls,
      );
    } catch (error) {
      if (this.isBudgetError(error)) throw error;
      this.logger.warn(
        `[${agentType}] CoVE unavailable; factual claims remain unverified`,
      );
      return {
        allCorrect: false,
        status: 'unverified',
        unverified: 1,
        verified: 0,
        toolCalls: 0,
        corrections: [],
      };
    }
  }

  /**
   * Re-run the Solve phase with critique feedback injected into the prompt.
   *
   * The critique feedback is appended to the system prompt so the LLM
   * can correct its output without re-executing tools.
   */
  private async *reSolvePhase(
    agentType: AgentType,
    config: AgentConfig,
    conversation: ConversationState,
    critiqueFeedback: string,
    memoryContext: string = '',
    budgetTracker?: AgentRunBudgetTracker,
  ): AsyncGenerator<string> {
    const locale = (conversation.metadata?.locale as string) || 'zh';
    const basePrompt = this.buildSolvePrompt(
      config,
      conversation,
      memoryContext,
    );

    const correctionSuffix =
      locale === 'en'
        ? `\n\n## Quality Review Feedback\nYour previous response had issues. Please correct:\n${critiqueFeedback}\n\nGenerate a corrected response that addresses all issues above.`
        : `\n\n## 质量审查反馈\n你之前的回复存在问题，请修正：\n${critiqueFeedback}\n\n请生成修正后的回复，解决上述所有问题。`;

    const systemPrompt = basePrompt + correctionSuffix;
    const messages = this.memory.getRecentMessages(conversation);
    const llmOpts = {
      taskType: 'agent.revise' as const,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      userId: conversation.userId,
      conversationId: conversation.id,
      agentType: `${agentType}_resolve`,
      runBudget: budgetTracker,
    };

    let fullContent = '';

    for await (const chunk of checkedWorkflowStream(
      this.llm.callStream(systemPrompt, messages, llmOpts),
      budgetTracker,
    )) {
      if (chunk.type === 'content' && chunk.content) {
        fullContent += chunk.content;
        yield chunk.content;
      }
      if (chunk.type === 'done') break;
    }

    if (!fullContent.trim()) {
      this.logger.warn(
        `[${agentType}] ReSolve streaming empty, retrying non-streaming`,
      );
      const response = await this.llm.call(systemPrompt, messages, llmOpts);
      if (response.content) {
        yield response.content;
      }
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * Emit a string in small chunks as WorkflowStreamEvents, simulating
   * streaming for content that was produced by a non-streaming LLM call
   * (e.g., the Plan-phase fast path).
   *
   * Chunks on CJK sentence boundaries (。！？\n) when possible so that
   * the output reads naturally. Falls back to ~80-char chunks for long
   * runs without punctuation.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async *emitChunked(
    content: string,
    type: 'plan_content' | 'solve_content',
  ): AsyncGenerator<WorkflowStreamEvent> {
    if (!content) return;

    // Split on sentence boundaries (CJK + Western + newlines)
    const sentenceRe = /[^。！？\n.!?]*[。！？\n.!?]+|[^。！？\n.!?]+$/g;
    const segments = content.match(sentenceRe);

    if (!segments) {
      yield { type, content };
      return;
    }

    // Further split long segments into ~80-char chunks
    const MAX_CHUNK = 80;
    for (const segment of segments) {
      if (segment.length <= MAX_CHUNK) {
        yield { type, content: segment };
      } else {
        for (let i = 0; i < segment.length; i += MAX_CHUNK) {
          yield { type, content: segment.slice(i, i + MAX_CHUNK) };
        }
      }
    }
  }

  private isHarnessEnabled(): boolean {
    return this.configService?.get<string>('AI_AGENT_HARNESS_V1') === 'true';
  }

  private isContextEnabled(): boolean {
    return (
      this.isHarnessEnabled() &&
      this.configService?.get<string>('AI_AGENT_CONTEXT_V1') === 'true'
    );
  }

  private getRunBudget(): AgentRunBudgetV1 {
    return getConfiguredRunBudget(this.configService ?? new ConfigService());
  }

  private isBudgetError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message === 'AGENT_TOKEN_BUDGET_EXCEEDED' ||
        error.message === 'AGENT_DURATION_BUDGET_EXCEEDED')
    );
  }

  private getHarnessMode(): AgentHarnessMode {
    return this.configService?.get<AgentHarnessMode>(
      'AI_AGENT_HARNESS_MODE',
      'advisory',
    ) === 'action'
      ? 'action'
      : 'advisory';
  }

  private getToolCallFingerprint(toolCall: ToolCall): string {
    return `${toolCall.name}:${JSON.stringify(canonicalize(toolCall.arguments))}`;
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
   * Build the system prompt for the Plan phase, enriched with enterprise memory
   * when MemoryManagerService is available. Falls back to basic in-memory context.
   */
  private buildPlanPrompt(
    config: AgentConfig,
    conversation: ConversationState,
    memoryContext: string = '',
    harnessEnabled = false,
  ): string {
    const locale = (conversation.metadata?.locale as string) || 'zh';
    const localizedPrompt = getLocalizedSystemPrompt(config, locale);
    const dateLabel =
      locale === 'en' ? '## Current Date\nToday is' : '## 当前时间\n今天是';
    const userInfoLabel =
      locale === 'en' ? '## Current User Info' : '## 当前用户信息';
    const baseContext = this.memory.getContextSummary(conversation.context);
    const uiContext = this.getUiContextSummary(conversation, locale);
    const conversationSummary = this.getConversationContinuitySummary(
      conversation,
      locale,
    );

    return `${localizedPrompt}

${dateLabel} ${this.getCurrentDateString(locale)}

${userInfoLabel}
${baseContext}
${uiContext}${conversationSummary}${memoryContext}${getPlanSystemSuffix(locale, harnessEnabled)}`;
  }

  /**
   * Build the system prompt for the Solve phase, enriched with enterprise memory
   * when MemoryManagerService is available. Falls back to basic in-memory context.
   */
  private buildSolvePrompt(
    config: AgentConfig,
    conversation: ConversationState,
    memoryContext: string = '',
  ): string {
    const locale = (conversation.metadata?.locale as string) || 'zh';
    const localizedPrompt = getLocalizedSystemPrompt(config, locale);
    const dateLabel =
      locale === 'en' ? '## Current Date\nToday is' : '## 当前时间\n今天是';
    const userInfoLabel =
      locale === 'en' ? '## Current User Info' : '## 当前用户信息';
    const baseContext = this.memory.getContextSummary(conversation.context);
    const uiContext = this.getUiContextSummary(conversation, locale);
    const conversationSummary = this.getConversationContinuitySummary(
      conversation,
      locale,
    );

    return `${localizedPrompt}

${dateLabel} ${this.getCurrentDateString(locale)}

${userInfoLabel}
${baseContext}
${uiContext}${conversationSummary}${memoryContext}${getSolveSystemSuffix(locale)}`;
  }

  private getConversationContinuitySummary(
    conversation: ConversationState,
    locale: string,
  ): string {
    const value = conversation.metadata?.conversationContextSummaryV1;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    const summary = value as Record<string, unknown>;
    if (summary.version !== 1 || typeof summary.summary !== 'string') return '';

    const list = (key: string) =>
      Array.isArray(summary[key])
        ? (summary[key] as unknown[])
            .filter((item): item is string => typeof item === 'string')
            .slice(0, 10)
            .join('; ')
        : '';
    const decisions = list('decisions');
    const nextSteps = list('nextSteps');
    const header =
      locale === 'en' ? '\n## Conversation Continuity' : '\n## 对话连续性摘要';
    return `${header}\n${summary.summary}${decisions ? `\n${locale === 'en' ? 'Decisions' : '已确认决定'}: ${decisions}` : ''}${nextSteps ? `\n${locale === 'en' ? 'Unfinished steps' : '未完成事项'}: ${nextSteps}` : ''}`;
  }

  private getUiContextSummary(
    conversation: ConversationState,
    locale: string,
  ): string {
    const summary = conversation.metadata?.lastAgentContextSummary;
    const hint = conversation.metadata?.lastAgentHint as string | undefined;
    if (!summary && !hint) return '';

    const header =
      locale === 'en' ? '\n## Active UI Context' : '\n## 当前界面上下文';
    const hintLine = hint
      ? locale === 'en'
        ? `Routing hint: prefer the ${hint} agent when appropriate.`
        : `路由提示：合适时优先使用 ${hint} agent。`
      : '';

    return `${header}\n${hintLine}${hintLine && summary ? '\n' : ''}${summary || ''}`;
  }

  /**
   * Retrieve enterprise memory context (semantic recall, facts, preferences, decisions)
   * and format it for injection into system prompts. Returns empty string when
   * MemoryManagerService is unavailable or retrieval fails.
   */
  private async getEnterpriseMemoryContext(
    conversation: ConversationState,
    locale: string,
  ): Promise<string> {
    if (!this.memoryManager) return '';

    const lastUserMsg = [...conversation.messages]
      .reverse()
      .find((m) => m.role === 'user');
    if (!lastUserMsg) return '';

    try {
      const context = await this.memoryManager.getRetrievalContext(
        conversation.userId,
        lastUserMsg.content,
        conversation.id,
      );

      if (context.meta?.memoryEnabled === false) return '';

      const summary = this.memoryManager.buildContextSummary(context);
      if (!summary) return '';

      const header =
        locale === 'en' ? '\n## Memory Context' : '\n## 记忆上下文';
      return `${header}\n${summary}`;
    } catch (error) {
      this.logger.warn('Failed to retrieve enterprise memory context', error);
      return '';
    }
  }
}
