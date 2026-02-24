/**
 * LLM 服务 - Provider-neutral LLM access layer
 *
 * Delegates to ILLMProvider for vendor-specific API calls.
 * Adds resilience (retry, circuit breaker, timeout) and token tracking.
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
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
import {
  ResilienceService,
  CircuitOpenError,
  TimeoutError,
} from './resilience.service';
import { TokenTrackerService, TokenUsage } from './token-tracker.service';
import { ToolCall } from '../types';

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

  constructor(
    private configService: ConfigService,
    @Inject(LLM_PROVIDER_TOKEN) private provider: ILLMProvider,
    @Optional() private resilience?: ResilienceService,
    @Optional() private tokenTracker?: TokenTrackerService,
  ) {
    this.defaultModel =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
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

    this.logger.log(
      `LLM call started: provider=${this.provider.providerId}, model=${model}, messages=${messages.length}, timeout=${timeoutMs}ms`,
    );

    const executeCall = async (): Promise<LLMResponse> => {
      const request = this.buildRequest(systemPrompt, messages, options, model);
      const response = await this.provider.chat(request);
      const result = this.toInternalResponse(response);

      // Token tracking
      if (this.tokenTracker && options.userId && response.usage) {
        const usage: TokenUsage = {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          model,
          estimatedCost: 0,
        };
        result.usage = usage;

        await this.tokenTracker.trackUsage(options.userId, usage, {
          conversationId: options.conversationId,
          agentType: options.agentType as AgentType | undefined,
        });
      }

      return result;
    };

    // With resilience: retry + circuit breaker + timeout
    if (this.resilience) {
      return this.resilience.execute('llm', executeCall, {
        retry: LLM_CONFIG.retryConfig,
        circuit: LLM_CONFIG.circuitConfig,
        timeoutMs,
      });
    }

    return executeCall();
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
    const request = this.buildRequest(systemPrompt, messages, options, model);

    try {
      for await (const chunk of this.provider.chatStream(request)) {
        yield this.adaptStreamChunk(chunk);
      }
    } catch (error) {
      this.logger.error('LLM stream failed', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Stream failed',
      };
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

  // ── Private helpers ──────────────────────────────────────

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

    return {
      systemPrompt,
      messages: llmMessages,
      model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      tools,
      toolChoice: tools?.length ? 'auto' : undefined,
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
