/**
 * OpenAI-compatible LLM provider.
 *
 * Wraps the OpenAI Chat Completions API behind the ILLMProvider interface.
 * Also compatible with Azure OpenAI, DeepSeek, and other OpenAI-format APIs.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ILLMProvider } from './llm-provider.interface';
import {
  LLMChatRequest,
  LLMChatResponse,
  LLMStreamChunk,
  LLMMessage,
  LLMToolCall,
  LLMTokenUsage,
  LLMErrorCode,
  LLMProviderError,
} from './llm-provider.types';

import { MODEL_CATALOG } from '../constants';
import {
  streamRoutedOpenAI,
  collectRoutedOpenAI,
} from './openai-routed.stream';

@Injectable()
export class OpenAIProvider implements ILLMProvider {
  readonly providerId = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.baseUrl =
      this.configService.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1';
    this.requestTimeoutMs = this.configService.get<number>(
      'AI_REQUEST_TIMEOUT_MS',
      120_000,
    );
  }

  supportsModel(model: string): boolean {
    return (
      model.startsWith('gpt-') ||
      model.startsWith('deepseek-') ||
      model.startsWith('o1') ||
      model.startsWith('o3') ||
      model.startsWith('o4')
    );
  }

  getContextWindow(model: string): number | undefined {
    // Stays `undefined` for unknown models — the interface contract, and the
    // caller treats it as "don't enforce a limit".
    return MODEL_CATALOG[model]?.contextWindow;
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    if (request.routed) return collectRoutedOpenAI(this.chatStream(request));
    const body = this.buildRequestBody(request, false);

    const response = await this.doFetch(body);
    const data: unknown = await response.json();

    return this.parseResponse(data);
  }

  async *chatStream(request: LLMChatRequest): AsyncGenerator<LLMStreamChunk> {
    if (request.routed) {
      yield* streamRoutedOpenAI({
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        timeoutMs: Math.min(this.requestTimeoutMs, request.timeoutMs ?? 30000),
        body: this.buildRequestBody(request, true),
        request,
      });
      return;
    }
    const body = this.buildRequestBody(request, true);

    let response: Response;
    try {
      response = await this.doFetch(body);
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Fetch failed',
      };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    // Accumulate tool call arguments across chunks
    const toolCalls = new Map<
      number,
      { id?: string; name?: string; argumentsStr: string }
    >();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') {
            // Emit accumulated tool calls (deduplicated by name)
            const seenNames = new Set<string>();
            for (const tc of toolCalls.values()) {
              if (tc.id && tc.name && !seenNames.has(tc.name)) {
                seenNames.add(tc.name);
                yield {
                  type: 'tool_call_end',
                  toolCall: {
                    id: tc.id,
                    name: tc.name,
                    arguments: safeParseJSON(tc.argumentsStr),
                  },
                };
              }
            }
            yield { type: 'done' };
            return;
          }

          try {
            const json = JSON.parse(data) as {
              choices?: Array<{
                delta?: {
                  content?: string;
                  tool_calls?: Array<{
                    index: number;
                    id?: string;
                    function?: { name?: string; arguments?: string };
                  }>;
                };
              }>;
            };
            const delta = json.choices?.[0]?.delta;

            if (delta?.content) {
              yield { type: 'content', content: delta.content };
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                const existing = toolCalls.get(idx) || {
                  argumentsStr: '',
                };
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) {
                  existing.argumentsStr += tc.function.arguments;
                }
                toolCalls.set(idx, existing);
              }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Stream failed',
      };
    }
  }

  // ── Private helpers ──────────────────────────────────────

  /**
   * gpt-5-class and o-series models reject the legacy `max_tokens` parameter
   * (require `max_completion_tokens`) and only support the default temperature.
   */
  private usesCompletionTokenParam(model: string): boolean {
    return (
      /^gpt-5/.test(model) ||
      model.startsWith('o1') ||
      model.startsWith('o3') ||
      model.startsWith('o4')
    );
  }

  private buildRequestBody(
    request: LLMChatRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const messages = this.convertMessages(request);
    const newGenModel = this.usesCompletionTokenParam(request.model);
    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      stream,
    };
    if (request.routed && request.reasoningEffort !== undefined) {
      body.reasoning_effort = request.reasoningEffort;
    }
    if (newGenModel) {
      body.max_completion_tokens = request.maxTokens ?? 4000;
      // gpt-5/o-series only accept the default temperature (1); omit overrides.
      if (request.temperature !== undefined && request.temperature !== 1) {
        // intentionally not sent — API rejects non-default temperature
      }
    } else {
      body.temperature = request.temperature ?? 0.7;
      body.max_tokens = request.maxTokens ?? 4000;
    }

    if (request.tools?.length) {
      body.tools = request.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice =
        typeof request.toolChoice === 'object'
          ? { type: 'function', function: { name: request.toolChoice.name } }
          : request.toolChoice || 'auto';
    }

    // Pass through provider-specific options (denylist reserved keys to prevent overwrites)
    if (request.providerOptions) {
      const reserved = new Set([
        'model',
        'messages',
        'tools',
        'tool_choice',
        'stream',
      ]);
      for (const [key, value] of Object.entries(request.providerOptions)) {
        if (!reserved.has(key)) {
          body[key] = value;
        }
      }
    }

    return body;
  }

  /**
   * Convert provider-neutral messages to OpenAI format.
   * Handles strict ordering: assistant(tool_calls) -> tool -> tool -> ...
   */
  private convertMessages(
    request: LLMChatRequest,
  ): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [
      { role: 'system', content: request.systemPrompt },
    ];

    // Pre-index tool messages by toolCallId
    const toolMsgByCallId = new Map<string, LLMMessage>();
    for (const msg of request.messages) {
      if (msg.role === 'tool' && msg.toolCallId) {
        toolMsgByCallId.set(msg.toolCallId, msg);
      }
    }

    for (const msg of request.messages) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls?.length) {
          result.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          });
          // Immediately append corresponding tool results
          for (const tc of msg.toolCalls) {
            const toolMsg = toolMsgByCallId.get(tc.id);
            if (toolMsg) {
              result.push({
                role: 'tool',
                content: toolMsg.content,
                tool_call_id: tc.id,
              });
            }
          }
        } else {
          result.push({ role: 'assistant', content: msg.content });
        }
      }
      // Standalone tool messages are already appended above
    }

    return result;
  }

  private async doFetch(body: Record<string, unknown>): Promise<Response> {
    if (!this.apiKey) {
      throw new LLMProviderError(
        'OpenAI API key not configured',
        LLMErrorCode.AUTHENTICATION,
        false,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = controller.signal.aborted;
      throw new LLMProviderError(
        timedOut ? 'OpenAI request timed out' : 'OpenAI network request failed',
        LLMErrorCode.NETWORK_ERROR,
        true,
        undefined,
        error instanceof Error ? { cause: error.message } : undefined,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenAI API error ${response.status}: ${errorText}`);
      throw this.classifyError(response.status, errorText);
    }

    return response;
  }

  private parseResponse(value: unknown): LLMChatResponse {
    const data =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const choices = data.choices as Array<Record<string, unknown>>;
    const choice = choices?.[0];
    const message = choice?.message as Record<string, unknown>;

    // Parse tool calls with deduplication
    let toolCalls: LLMToolCall[] | undefined;
    const rawToolCalls = message?.tool_calls as
      Array<Record<string, unknown>> | undefined;
    if (rawToolCalls?.length) {
      const seen = new Set<string>();
      toolCalls = [];
      for (const tc of rawToolCalls) {
        const fn = tc.function as Record<string, string>;
        if (!seen.has(fn.name)) {
          seen.add(fn.name);
          toolCalls.push({
            id: tc.id as string,
            name: fn.name,
            arguments: safeParseJSON(fn.arguments),
          });
        }
      }
    }

    // Parse usage
    let usage: LLMTokenUsage | undefined;
    const rawUsage = data.usage as Record<string, number> | undefined;
    if (rawUsage) {
      usage = {
        promptTokens: rawUsage.prompt_tokens || 0,
        completionTokens: rawUsage.completion_tokens || 0,
        totalTokens: rawUsage.total_tokens || 0,
      };
    }

    const finishReason = choice?.finish_reason as string;

    return {
      content: (message?.content as string) || '',
      toolCalls,
      finishReason:
        finishReason === 'tool_calls'
          ? 'tool_calls'
          : finishReason === 'length'
            ? 'length'
            : finishReason === 'content_filter'
              ? 'content_filter'
              : 'stop',
      usage,
    };
  }

  private classifyError(status: number, body: string): LLMProviderError {
    const isContextLength =
      body.includes('context_length') ||
      body.includes('maximum context length');

    if (status === 401 || status === 403) {
      return new LLMProviderError(
        `Authentication failed: ${status}`,
        LLMErrorCode.AUTHENTICATION,
        false,
        status,
      );
    }
    if (status === 429) {
      return new LLMProviderError(
        'Rate limited',
        LLMErrorCode.RATE_LIMIT,
        true,
        status,
      );
    }
    if (status === 400 && isContextLength) {
      return new LLMProviderError(
        'Context length exceeded',
        LLMErrorCode.CONTEXT_LENGTH,
        false,
        status,
      );
    }
    if (status >= 500) {
      return new LLMProviderError(
        `Server error: ${status}`,
        LLMErrorCode.SERVER_ERROR,
        true,
        status,
      );
    }
    return new LLMProviderError(
      `Request failed: ${status}`,
      LLMErrorCode.INVALID_REQUEST,
      false,
      status,
    );
  }
}

// ── Utility ────────────────────────────────────────────────

function safeParseJSON(
  str: string,
  fallback: Record<string, unknown> = {},
): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(str);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : fallback;
  } catch {
    return fallback;
  }
}
