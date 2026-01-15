/**
 * LLM 服务 - 封装 OpenAI API 调用（支持流式输出）
 *
 * 集成弹性服务：重试、熔断、超时、Token 追踪
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Message, ToolCall, ToolDefinition } from '../types';
import { toOpenAIFormat } from '../config/tools.config';
import {
  ResilienceService,
  CircuitOpenError,
  TimeoutError,
} from './resilience.service';
import { TokenTrackerService, TokenUsage } from './token-tracker.service';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  OpenAIToolCall,
  parseToolArguments,
  safeParseJSON,
} from './types';

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
  userId?: string; // 用于 Token 追踪
  conversationId?: string; // 用于 Token 追踪
  agentType?: string; // 用于 Token 追踪
  timeoutMs?: number; // 自定义超时
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
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(
    private configService: ConfigService,
    @Optional() private resilience?: ResilienceService,
    @Optional() private tokenTracker?: TokenTrackerService,
  ) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.baseUrl =
      this.configService.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1';
    this.defaultModel =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
  }

  /**
   * 调用 LLM（带弹性保护）
   */
  async call(
    systemPrompt: string,
    messages: Message[],
    options: LLMOptions = {},
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      this.logger.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || this.defaultModel;
    const timeoutMs = options.timeoutMs || LLM_CONFIG.defaultTimeoutMs;

    this.logger.log(
      `LLM call started: model=${model}, messages=${messages.length}, timeout=${timeoutMs}ms`,
    );

    // 使用弹性服务包装调用
    const executeCall = async (): Promise<LLMResponse> => {
      const openaiMessages = this.convertMessages(systemPrompt, messages);
      const tools = options.tools ? toOpenAIFormat(options.tools) : undefined;

      const body: ChatCompletionRequest = {
        model,
        messages: openaiMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4000,
      };

      if (tools && tools.length > 0) {
        body.tools = tools as ChatCompletionRequest['tools'];
        body.tool_choice = 'auto';
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`LLM API error: ${error}`);
        throw new Error(`LLM API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const result = this.parseResponse(data);

      // Token 追踪
      if (this.tokenTracker && options.userId) {
        const usage = this.tokenTracker.parseUsageFromResponse(data, model);
        result.usage = usage;

        await this.tokenTracker.trackUsage(options.userId, usage, {
          conversationId: options.conversationId,
          agentType: options.agentType,
        });
      }

      return result;
    };

    // 如果有弹性服务，使用完整保护
    if (this.resilience) {
      return this.resilience.execute('llm', executeCall, {
        retry: LLM_CONFIG.retryConfig,
        circuit: LLM_CONFIG.circuitConfig,
        timeoutMs,
      });
    }

    // 无弹性服务，直接调用
    return executeCall();
  }

  /**
   * 获取 LLM 服务状态
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
   * 转换消息格式
   *
   * 注意：OpenAI API 要求 tool 消息必须紧跟在包含 tool_calls 的 assistant 消息之后
   * 顺序必须是：assistant (with tool_calls) -> tool -> tool -> ... -> user/assistant
   */
  private convertMessages(
    systemPrompt: string,
    messages: Message[],
  ): ChatMessage[] {
    const result: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

    // 跟踪已经添加的 assistant 消息的 tool_call_ids
    // 只有在 assistant 消息添加后，对应的 tool 消息才能添加
    const activatedToolCallIds = new Set<string>();

    // 收集所有 tool 消息，按 tool_call_id 分组
    const toolMessages = new Map<string, Message>();
    for (const msg of messages) {
      if (msg.role === 'tool' && msg.toolCallId) {
        toolMessages.set(msg.toolCallId, msg);
      }
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls?.length) {
          // Assistant 消息带 tool_calls
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

          // 激活这些 tool_call_ids，并立即添加对应的 tool 消息
          for (const tc of msg.toolCalls) {
            activatedToolCallIds.add(tc.id);
            const toolMsg = toolMessages.get(tc.id);
            if (toolMsg) {
              result.push({
                role: 'tool',
                content: toolMsg.content,
                tool_call_id: tc.id,
              });
            }
          }
        } else {
          // 普通 assistant 消息
          result.push({
            role: 'assistant',
            content: msg.content,
          });
        }
      }
      // 跳过独立的 tool 消息（已在 assistant 消息处理时添加）
      // 跳过 system 消息（已在开头添加）
    }

    return result;
  }

  /**
   * 解析响应
   */
  private parseResponse(data: ChatCompletionResponse): LLMResponse {
    const choice = data.choices[0];
    const message = choice.message;

    // 解析工具调用并去重（同名工具只保留第一个）
    let toolCalls = message.tool_calls?.map((tc: OpenAIToolCall) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: parseToolArguments(tc.function.arguments),
    }));

    // 去重：按工具名去重，保留第一个调用
    if (toolCalls && toolCalls.length > 1) {
      const seen = new Set<string>();
      const originalCount = toolCalls.length;
      toolCalls = toolCalls.filter((tc) => {
        if (seen.has(tc.name)) {
          return false;
        }
        seen.add(tc.name);
        return true;
      });
      if (toolCalls.length < originalCount) {
        this.logger.warn(
          `Deduplicated tool calls: ${originalCount} -> ${toolCalls.length}`,
        );
      }
    }

    return {
      content: message.content || '',
      toolCalls,
      finishReason:
        choice.finish_reason === 'tool_calls'
          ? 'tool_calls'
          : choice.finish_reason === 'length'
            ? 'length'
            : 'stop',
    };
  }

  /**
   * 流式调用 LLM
   */
  async *callStream(
    systemPrompt: string,
    messages: Message[],
    options: LLMOptions = {},
  ): AsyncGenerator<StreamChunk> {
    if (!this.apiKey) {
      yield { type: 'error', error: 'OpenAI API key not configured' };
      return;
    }

    const openaiMessages = this.convertMessages(systemPrompt, messages);
    const tools = options.tools ? toOpenAIFormat(options.tools) : undefined;

    const body: ChatCompletionRequest = {
      model: options.model || this.defaultModel,
      messages: openaiMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4000,
      stream: true,
    };

    if (tools && tools.length > 0) {
      body.tools = tools as ChatCompletionRequest['tools'];
      body.tool_choice = 'auto';
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`LLM API error: ${error}`);
        yield { type: 'error', error: `API error: ${response.status}` };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      // 存储工具调用的原始字符串，最后一起解析
      const toolCalls: Map<
        number,
        { id?: string; name?: string; argumentsStr: string }
      > = new Map();

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
            // 解析并返回完成的工具调用（按工具名去重，保留第一个）
            const seenToolNames = new Set<string>();
            const allToolCalls = Array.from(toolCalls.values());
            const originalCount = allToolCalls.filter(
              (tc) => tc.id && tc.name,
            ).length;

            for (const tc of allToolCalls) {
              if (tc.id && tc.name) {
                if (seenToolNames.has(tc.name)) {
                  continue; // 跳过同名重复调用
                }
                seenToolNames.add(tc.name);
                const parsedArgs = safeParseJSON(tc.argumentsStr, {});
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: tc.id,
                    name: tc.name,
                    arguments: parsedArgs,
                  },
                };
              }
            }

            if (seenToolNames.size < originalCount) {
              this.logger.warn(
                `Stream deduplicated tool calls: ${originalCount} -> ${seenToolNames.size}`,
              );
            }

            yield { type: 'done' };
            return;
          }

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;

            if (delta?.content) {
              yield { type: 'content', content: delta.content };
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                const existing = toolCalls.get(idx) || { argumentsStr: '' };

                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                // 累积参数字符串，不立即解析
                if (tc.function?.arguments) {
                  existing.argumentsStr += tc.function.arguments;
                }

                toolCalls.set(idx, existing);
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      this.logger.error('LLM stream failed', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Stream failed',
      };
    }
  }
}
