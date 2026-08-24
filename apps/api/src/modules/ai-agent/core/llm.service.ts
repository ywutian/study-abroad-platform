/**
 * LLM 服务 - Provider-neutral LLM access layer
 *
 * Delegates to ILLMProvider for vendor-specific API calls.
 * Adds resilience (retry, circuit breaker, timeout) and token tracking.
 */

import {
  Injectable,
  Inject,
  Logger,
  Optional,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType, Message, ToolDefinition } from '../types';
import type { ILLMProvider } from '../providers/llm-provider.interface';
import { LLM_PROVIDER_TOKEN } from '../providers/llm-provider.interface';
import {
  LLMMessage,
  LLMToolDefinition,
  LLMChatRequest,
  LLMChatResponse,
  LLMStreamChunk,
} from '../providers/llm-provider.types';
import { estimateModelCost, UNKNOWN_MODEL_PRICING } from '../constants';
import { ResilienceService } from './resilience.service';
import { TokenTrackerService, TokenUsage } from './token-tracker.service';
import { PromptGuardService } from '../security/prompt-guard.service';
import { ToolCall } from '../types';
import { AgentRunBudgetTracker } from './agent-run-context';

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
  usage?: TokenUsage;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
  userId?: string;
  conversationId?: string;
  agentType?: string;
  timeoutMs?: number;
  seed?: number;
  providerOptions?: Record<string, unknown>;
  runBudget?: AgentRunBudgetTracker;
}

/**
 * Simplified message format for one-shot LLM calls (chatSimple).
 * Matches the legacy AiService.chat() contract.
 */
export interface ChatSimpleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatSimpleOptions {
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  timeoutMs?: number;
  userId?: string;
  providerOptions?: Record<string, unknown>;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: Partial<ToolCall>;
  error?: string;
}

// LLM 调用配置
const LLM_CONFIG = {
  defaultTimeoutMs: 30000,
  retryConfig: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 8000,
    retryableErrors: [
      '429',
      '500',
      '502',
      '503',
      '504',
      'ECONNRESET',
      'ETIMEDOUT',
    ],
  },
  circuitConfig: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenRequests: 2,
  },
};

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly defaultModel: string;
  /** Models already warned about, so an unknown model logs once, not per call. */
  private readonly warnedUnknownModels = new Set<string>();

  constructor(
    private configService: ConfigService,
    @Inject(LLM_PROVIDER_TOKEN) private provider: ILLMProvider,
    @Optional() private resilience?: ResilienceService,
    @Optional() private tokenTracker?: TokenTrackerService,
    @Optional() private promptGuard?: PromptGuardService,
  ) {
    this.defaultModel =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-5.4-mini';
  }

  /**
   * Non-streaming LLM call with resilience protection.
   */
  async call(
    systemPrompt: string,
    messages: Message[],
    options: LLMOptions = {},
  ): Promise<LLMResponse> {
    const model = options.model || this.defaultModel;
    const timeoutMs = options.timeoutMs || LLM_CONFIG.defaultTimeoutMs;
    const reservation = options.runBudget?.reserveLlmCall(
      systemPrompt,
      messages,
      options.maxTokens ?? 4000,
    );
    const effectiveOptions = reservation
      ? { ...options, maxTokens: reservation.outputTokens }
      : options;

    this.logger.log(
      `LLM call started: provider=${this.provider.providerId}, model=${model}, messages=${messages.length}, timeout=${timeoutMs}ms`,
    );

    // Pre-flight: reject if input likely exceeds model context window
    const contextWindow = this.provider.getContextWindow(model);
    if (contextWindow) {
      const totalChars =
        systemPrompt.length +
        messages.reduce((s, m) => s + m.content.length, 0);
      const estimatedTokens = Math.ceil(totalChars / 3); // ~3 chars/token average
      if (estimatedTokens > contextWindow * 0.8) {
        throw new HttpException(
          {
            statusCode: 400,
            message: `Input too long (~${estimatedTokens} tokens, model capacity: ${contextWindow}). Please shorten your message.`,
            code: 'CONTEXT_WINDOW_EXCEEDED',
          },
          400,
        );
      }
    }

    const callStartTime = Date.now();

    const executeCall = async (): Promise<LLMResponse> => {
      const request = this.buildRequest(
        systemPrompt,
        messages,
        effectiveOptions,
        model,
      );
      const response = await this.provider.chat(request);
      const result = this.toInternalResponse(response);

      // Usage belongs to the provider response even when the caller deliberately
      // omits a userId (for example, synthetic offline evaluations). Persistence
      // remains user-scoped, but callers can still enforce cost gates.
      if (response.usage) {
        const usage: TokenUsage = {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          model,
          estimatedCost: this.estimateCost(
            model,
            response.usage.promptTokens,
            response.usage.completionTokens,
          ),
        };
        result.usage = usage;

        if (this.tokenTracker && options.userId) {
          await this.tokenTracker.trackUsage(options.userId, usage, {
            conversationId: options.conversationId,
            agentType: options.agentType as AgentType | undefined,
            inputPreview: systemPrompt.slice(0, 500),
            outputPreview: result.content.slice(0, 1000),
            latencyMs: Date.now() - callStartTime,
            finishReason: result.finishReason,
            messageCount: messages.length,
          });
        }
      }

      return result;
    };

    // With resilience: retry + circuit breaker + timeout
    let response: LLMResponse;
    try {
      response = this.resilience
        ? await this.resilience.execute('llm', executeCall, {
            retry: LLM_CONFIG.retryConfig,
            circuit: LLM_CONFIG.circuitConfig,
            timeoutMs,
          })
        : await executeCall();
    } catch (error) {
      if (reservation) options.runBudget?.settleFailedLlmCall(reservation);
      throw error;
    }
    if (reservation && options.runBudget) {
      options.runBudget.settleLlmCall(
        reservation,
        response.content,
        response.usage,
      );
    }
    return response;
  }

  /**
   * Streaming LLM call.
   *
   * Adapts provider StreamChunk format to internal StreamChunk format
   * for backward compatibility with OrchestratorService and AgentRunnerService.
   */
  async *callStream(
    systemPrompt: string,
    messages: Message[],
    options: LLMOptions = {},
  ): AsyncGenerator<StreamChunk> {
    const model = options.model || this.defaultModel;
    const reservation = options.runBudget?.reserveLlmCall(
      systemPrompt,
      messages,
      options.maxTokens ?? 4000,
    );
    const request = this.buildRequest(
      systemPrompt,
      messages,
      reservation
        ? { ...options, maxTokens: reservation.outputTokens }
        : options,
      model,
    );
    let output = '';

    try {
      for await (const chunk of this.provider.chatStream(request)) {
        if (chunk.type === 'content' && chunk.content) output += chunk.content;
        yield this.adaptStreamChunk(chunk);
      }
    } catch (error) {
      this.logger.error('LLM stream failed', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Stream failed',
      };
    } finally {
      if (reservation && options.runBudget) {
        options.runBudget.settleLlmCall(reservation, output);
      }
    }
  }

  /**
   * Get LLM service health status.
   */
  async getServiceStatus(): Promise<{
    isHealthy: boolean;
    circuitState?: string;
  }> {
    if (this.resilience) {
      const status = await this.resilience.getCircuitStatus('llm');
      return {
        isHealthy: !status.isOpen,
        circuitState: status.state,
      };
    }
    return { isHealthy: true };
  }

  /**
   * Simplified one-shot LLM call for domain services.
   *
   * Extracts the system message from the array, forwards the rest as user/assistant
   * messages, and returns just the content string. Provides the same convenience
   * as the former AiService.chat() with full resilience + token tracking.
   */
  async chatSimple(
    messages: ChatSimpleMessage[],
    options?: ChatSimpleOptions,
  ): Promise<string> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const otherMsgs: Message[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: m.role,
        content: m.content,
        timestamp: new Date(),
      }));

    const result = await this.call(systemMsg?.content || '', otherMsgs, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      timeoutMs: options?.timeoutMs,
      userId: options?.userId,
      seed: options?.seed,
      providerOptions: options?.providerOptions,
    });

    return result.content;
  }

  /**
   * Guarded one-shot LLM call. Runs PromptGuard on user-role messages
   * before forwarding to chatSimple(). Throws 400 if prompt injection detected.
   *
   * Use for any call where messages contain user-supplied content
   * (essay text, profile descriptions, etc.).
   */
  async chatSimpleGuarded(
    messages: ChatSimpleMessage[],
    options?: ChatSimpleOptions,
  ): Promise<string> {
    if (this.promptGuard) {
      const userMessages = messages.filter((m) => m.role === 'user');
      for (const msg of userMessages) {
        const result = await this.promptGuard.analyze(msg.content, {
          userId: options?.userId,
          strictMode: false,
        });
        if (result.blocked) {
          throw new HttpException(
            {
              statusCode: 400,
              message: 'Input blocked by security check',
              code: 'PROMPT_GUARD_BLOCK',
            },
            400,
          );
        }
        if (result.sanitizedInput && result.sanitizedInput !== msg.content) {
          msg.content = result.sanitizedInput;
        }
      }
    }
    return this.chatSimple(messages, options);
  }

  // ── Private helpers ──────────────────────────────────────

  /**
   * Estimate USD cost from token counts. Prices live in `MODEL_CATALOG`.
   *
   * An unknown model is costed at the flagship rate and warned about once —
   * the previous silent fallback to gpt-4o-mini rates is what made prod's
   * gpt-5.4-mini spend read 5-7.5× too low.
   */
  private estimateCost(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const { cost, known } = estimateModelCost(
      model,
      promptTokens,
      completionTokens,
    );

    if (!known && !this.warnedUnknownModels.has(model)) {
      this.warnedUnknownModels.add(model);
      this.logger.warn(
        `Model "${model}" is not in MODEL_CATALOG — costing it at the flagship rate ` +
          `($${UNKNOWN_MODEL_PRICING.input}/$${UNKNOWN_MODEL_PRICING.output} per 1M tokens). ` +
          `Add it to ai-agent/constants.ts so spend is reported accurately.`,
      );
    }

    return cost;
  }

  private buildRequest(
    systemPrompt: string,
    messages: Message[],
    options: LLMOptions,
    model: string,
  ): LLMChatRequest {
    const llmMessages: LLMMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls?.map((tc) => ({
        id: tc.id || '',
        name: tc.name,
        arguments: tc.arguments || {},
      })),
      toolCallId: msg.toolCallId,
    }));

    const tools: LLMToolDefinition[] | undefined = options.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const mergedProviderOptions: Record<string, unknown> = {
      ...options.providerOptions,
    };
    if (options.seed !== undefined) {
      mergedProviderOptions.seed = options.seed;
    }

    return {
      systemPrompt,
      messages: llmMessages,
      model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      tools,
      toolChoice: tools?.length ? 'auto' : undefined,
      ...(Object.keys(mergedProviderOptions).length > 0 && {
        providerOptions: mergedProviderOptions,
      }),
    };
  }

  private toInternalResponse(response: LLMChatResponse): LLMResponse {
    return {
      content: response.content,
      toolCalls: response.toolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
      })),
      finishReason:
        response.finishReason === 'tool_calls'
          ? 'tool_calls'
          : response.finishReason === 'length'
            ? 'length'
            : 'stop',
    };
  }

  /**
   * Adapt provider stream chunk format to internal StreamChunk format.
   */
  private adaptStreamChunk(chunk: LLMStreamChunk): StreamChunk {
    switch (chunk.type) {
      case 'content':
        return { type: 'content', content: chunk.content };
      case 'tool_call_end':
        return {
          type: 'tool_call',
          toolCall: chunk.toolCall
            ? {
                id: chunk.toolCall.id,
                name: chunk.toolCall.name,
                arguments: chunk.toolCall.arguments,
              }
            : undefined,
        };
      case 'done':
        return { type: 'done' };
      case 'error':
        return { type: 'error', error: chunk.error };
      // tool_call_start and tool_call_delta are internal to provider; skip
      default:
        return { type: 'content' };
    }
  }
}
