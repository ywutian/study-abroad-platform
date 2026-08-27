import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER_TOKEN } from '../providers/llm-provider.interface';
import type { ILLMProvider } from '../providers/llm-provider.interface';
import {
  LLMChatRequest,
  LLMChatResponse,
  LLMErrorCode,
  LLMProviderError,
  LLMStreamChunk,
} from '../providers/llm-provider.types';
import { AgentRunBudgetTracker } from '../core/agent-run-context';
import { getConfiguredRunBudget } from '../core/agent-run-settings';
import {
  configuredRoutingSnapshot,
  parseRoutingSnapshot,
  MODEL_TASKS,
  ModelTask,
  ModelRouteAttempt,
  AnalysisSegment,
  analysisSegmentSchema,
} from './model-routing.policy';

export interface RoutedCallOptions {
  taskType?: ModelTask;
  runBudget?: AgentRunBudgetTracker;
  /** Trusted business validator; never supplied by model, Skill or client payload. */
  validateOutput?: (response: LLMChatResponse) => boolean;
  /** Trusted analysis stage for bounded, non-payload audit metadata. */
  segment?: AnalysisSegment;
}
export class ModelRoutingError extends Error {
  constructor(
    readonly code: string,
    readonly routing?: ModelRouteAttempt,
  ) {
    super(code);
  }
}
type RoutedChunk = LLMStreamChunk & { routing?: ModelRouteAttempt };

@Injectable()
export class ModelRouterService {
  private readonly logger = new Logger(ModelRouterService.name);
  constructor(
    private readonly config: ConfigService,
    @Inject(LLM_PROVIDER_TOKEN) private readonly provider: ILLMProvider,
  ) {
    configuredRoutingSnapshot((key) => config.get(key));
  }

  shouldRoute(budget?: AgentRunBudgetTracker): boolean {
    // Legacy checkpoints must never silently join a newly enabled policy.
    return budget
      ? !!budget.limits.routing
      : this.config.get('AI_AGENT_MODEL_ROUTING_V1') === 'true';
  }

  createBudget(): AgentRunBudgetTracker | undefined {
    return this.shouldRoute()
      ? new AgentRunBudgetTracker(getConfiguredRunBudget(this.config))
      : undefined;
  }

  policyHash(): string | undefined {
    return configuredRoutingSnapshot((key) => this.config.get(key))?.hash;
  }

  private prepare(request: LLMChatRequest, options: RoutedCallOptions) {
    const active = configuredRoutingSnapshot((key) => this.config.get(key));
    if (!active) throw new ModelRoutingError('MODEL_ROUTING_DISABLED');
    const budget = options.runBudget ?? this.createBudget()!;
    if (!budget.limits.routing)
      throw new ModelRoutingError('MODEL_ROUTING_SNAPSHOT_MISSING');
    const snapshot = parseRoutingSnapshot(budget.limits.routing);
    const task = options.taskType ?? 'general';
    if (!MODEL_TASKS.includes(task))
      throw new ModelRoutingError('MODEL_ROUTING_TASK_UNKNOWN');
    const route = snapshot.policy.routes[task]!;
    if (
      options.segment !== undefined &&
      (!analysisSegmentSchema.safeParse(options.segment).success ||
        !['analysis.school', 'analysis.portfolio'].includes(task))
    ) {
      throw new ModelRoutingError('MODEL_ROUTING_SEGMENT_DENIED');
    }
    if (this.provider.providerId !== snapshot.policy.provider)
      throw new ModelRoutingError('MODEL_ROUTING_PROVIDER_CHANGED');
    if (
      Object.keys(request.providerOptions ?? {}).some(
        (key) => !['response_format', 'seed'].includes(key),
      )
    )
      throw new ModelRoutingError('MODEL_ROUTING_OPTIONS_DENIED');
    const required = new Set(route.requires);
    required.add('text');
    if (request.tools?.length) required.add('tools');
    if (request.providerOptions?.response_format) required.add('json');
    const models = route.models.map((model) => {
      const frozen = snapshot.policy.models[model],
        current = active.policy.models[model];
      if (
        !frozen ||
        !current ||
        !this.provider.supportsModel(model) ||
        [...required].some(
          (c) =>
            !frozen.capabilities.includes(c) ||
            !current.capabilities.includes(c),
        ) ||
        (route.reasoningEffort !== undefined &&
          (!frozen.reasoningEfforts?.includes(route.reasoningEffort) ||
            !current.reasoningEfforts?.includes(route.reasoningEffort)))
      )
        throw new ModelRoutingError('MODEL_ROUTING_CAPABILITY_DENIED');
      const maxTokens = Math.min(
        request.maxTokens ?? 4000,
        route.maxOutputTokens,
        frozen.maxOutputTokens,
        current.maxOutputTokens,
      );
      const input = Math.ceil(this.accountedInput(request).length / 3);
      if (
        input + maxTokens >
        Math.min(frozen.contextWindow, current.contextWindow)
      )
        throw new ModelRoutingError('MODEL_ROUTING_CONTEXT_EXCEEDED');
      return { model, maxTokens, reasoningEffort: route.reasoningEffort };
    });
    // One deadline across primary and backup, not a fresh timeout per model.
    const deadline =
      Date.now() +
      Math.min(
        request.timeoutMs ?? 30000,
        route.timeoutMs,
        budget.remainingDurationMs(),
      );
    return {
      task,
      snapshot,
      models,
      budget,
      deadline,
      segment: options.segment,
      reasoningEffort: route.reasoningEffort,
    };
  }

  async call(
    request: LLMChatRequest,
    options: RoutedCallOptions,
  ): Promise<{ response: LLMChatResponse; routing: ModelRouteAttempt }> {
    const plan = this.prepare(request, options);
    let reason: ModelRouteAttempt['reason'] = 'primary';
    for (const [index, model] of plan.models.entries()) {
      const timeoutMs = plan.deadline - Date.now();
      if (timeoutMs <= 0)
        throw new ModelRoutingError('MODEL_ROUTING_DEADLINE_EXCEEDED');
      const reservation = plan.budget.reserveLlmCall(
        this.accountedInput(request),
        [],
        model.maxTokens,
      );
      const started = Date.now();
      let tokens = reservation.inputTokens + reservation.outputTokens;
      let settled = false;
      try {
        const response = await this.provider.chat({
          ...request,
          ...model,
          maxTokens: reservation.outputTokens,
          timeoutMs,
          routed: true,
        });
        if (response.model !== model.model)
          throw new LLMProviderError(
            'MODEL_MISMATCH',
            LLMErrorCode.MODEL_MISMATCH,
            false,
          );
        if (
          !response.usage ||
          !Number.isSafeInteger(response.usage.totalTokens) ||
          response.usage.totalTokens < 0
        )
          throw new ModelRoutingError('MODEL_ROUTING_USAGE_MISSING');
        tokens = response.usage.totalTokens;
        settled = true;
        plan.budget.settleLlmCall(
          reservation,
          response.content,
          response.usage,
        );
        if (response.finishReason === 'content_filter')
          throw new ModelRoutingError('MODEL_ROUTING_CONTENT_FILTER');
        if (
          response.finishReason === 'length' ||
          (!response.content.trim() && !response.toolCalls?.length) ||
          options.validateOutput?.(response) === false
        )
          throw new ModelRoutingError('MODEL_ROUTING_OUTPUT_INVALID');
        const routing = this.record(
          plan,
          model.model,
          index,
          reason,
          'success',
          'OK',
          tokens,
          started,
        );
        return { response, routing };
      } catch (error) {
        // On unknown/failed usage retain the full reservation conservatively.
        const code = this.errorCode(error);
        const routing = this.record(
          plan,
          model.model,
          index,
          reason,
          'failure',
          code,
          tokens,
          started,
        );
        if (!this.canRetry(error) || index + 1 >= plan.models.length)
          throw new ModelRoutingError(code, routing);
        reason = settled ? 'output_validation' : 'transient_failure';
      }
    }
    throw new ModelRoutingError('MODEL_ROUTING_NO_RESULT');
  }

  async *stream(
    request: LLMChatRequest,
    options: RoutedCallOptions,
  ): AsyncGenerator<RoutedChunk> {
    if (options.validateOutput)
      throw new ModelRoutingError('MODEL_ROUTING_STREAM_VALIDATOR_UNSUPPORTED');
    const plan = this.prepare(request, options);
    let reason: ModelRouteAttempt['reason'] = 'primary';
    for (const [index, model] of plan.models.entries()) {
      const timeoutMs = plan.deadline - Date.now();
      if (timeoutMs <= 0)
        throw new ModelRoutingError('MODEL_ROUTING_DEADLINE_EXCEEDED');
      const reservation = plan.budget.reserveLlmCall(
        this.accountedInput(request),
        [],
        model.maxTokens,
      );
      const started = Date.now();
      let emitted = false,
        recorded = false;
      let output = '',
        tokens = reservation.inputTokens + reservation.outputTokens;
      const tools: RoutedChunk[] = [];
      try {
        let done: LLMStreamChunk | undefined;
        for await (const chunk of this.provider.chatStream({
          ...request,
          ...model,
          maxTokens: reservation.outputTokens,
          timeoutMs,
          routed: true,
        })) {
          if (chunk.type === 'error')
            throw new ModelRoutingError('MODEL_ROUTING_STREAM_FAILED');
          if (chunk.type === 'tool_call_end') tools.push(chunk);
          if (chunk.type === 'content' && chunk.content) {
            emitted = true;
            output += chunk.content;
            yield chunk;
          }
          if (chunk.type === 'done') done = chunk;
        }
        if (done?.model !== model.model)
          throw new LLMProviderError(
            'MODEL_MISMATCH',
            LLMErrorCode.MODEL_MISMATCH,
            false,
          );
        if (!done?.usage || !done.finishReason)
          throw new ModelRoutingError('MODEL_ROUTING_STREAM_INCOMPLETE');
        tokens = done.usage.totalTokens;
        plan.budget.settleLlmCall(reservation, output, done.usage);
        if (done.finishReason === 'content_filter')
          throw new ModelRoutingError('MODEL_ROUTING_CONTENT_FILTER');
        if (done.finishReason === 'length' || (!output.trim() && !tools.length))
          throw new ModelRoutingError('MODEL_ROUTING_OUTPUT_INVALID');
        const routing = this.record(
          plan,
          model.model,
          index,
          reason,
          'success',
          'OK',
          tokens,
          started,
        );
        recorded = true;
        yield* tools;
        yield { ...done, routing };
        return;
      } catch (error) {
        const code = this.errorCode(error);
        const routing = this.record(
          plan,
          model.model,
          index,
          reason,
          'failure',
          code,
          tokens,
          started,
        );
        recorded = true;
        if (emitted || !this.canRetry(error) || index + 1 >= plan.models.length)
          throw new ModelRoutingError(code, routing);
        reason =
          code === 'MODEL_ROUTING_OUTPUT_INVALID'
            ? 'output_validation'
            : 'transient_failure';
      } finally {
        if (!recorded)
          this.record(
            plan,
            model.model,
            index,
            reason,
            'failure',
            'CANCELLED',
            tokens,
            started,
          );
      }
    }
  }

  private canRetry(error: unknown): boolean {
    return error instanceof ModelRoutingError
      ? error.code === 'MODEL_ROUTING_OUTPUT_INVALID'
      : error instanceof LLMProviderError &&
          error.retryable &&
          [
            LLMErrorCode.NETWORK_ERROR,
            LLMErrorCode.RATE_LIMIT,
            LLMErrorCode.SERVER_ERROR,
          ].includes(error.code);
  }

  private accountedInput(request: LLMChatRequest): string {
    return JSON.stringify({
      system: request.systemPrompt,
      messages: request.messages,
      tools: request.tools,
      options: request.providerOptions,
    });
  }
  private errorCode(error: unknown): string {
    if (error instanceof ModelRoutingError || error instanceof LLMProviderError)
      return error.code;
    if (
      error instanceof Error &&
      [
        'AGENT_TOKEN_BUDGET_EXCEEDED',
        'AGENT_DURATION_BUDGET_EXCEEDED',
      ].includes(error.message)
    )
      return error.message;
    return 'MODEL_ROUTING_FAILED';
  }
  private record(
    plan: ReturnType<ModelRouterService['prepare']>,
    model: string,
    index: number,
    reason: ModelRouteAttempt['reason'],
    outcome: ModelRouteAttempt['outcome'],
    code: string,
    tokens: number,
    started: number,
  ): ModelRouteAttempt {
    const attempt: ModelRouteAttempt = {
      task: plan.task,
      policyHash: plan.snapshot.hash,
      model,
      attempt: index + 1,
      reason,
      outcome,
      code,
      tokens,
      latencyMs: Date.now() - started,
      ...(plan.segment ? { segment: plan.segment } : {}),
      ...(plan.reasoningEffort
        ? { reasoningEffort: plan.reasoningEffort }
        : {}),
    };
    plan.budget.recordModelAttempt(attempt);
    this.logger.log(JSON.stringify(attempt));
    return attempt;
  }
}
