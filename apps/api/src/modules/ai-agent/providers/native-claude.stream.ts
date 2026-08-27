import {
  LLMChatRequest,
  LLMChatResponse,
  LLMErrorCode,
  LLMStreamChunk,
  LLMTokenUsage,
  LLMToolCall,
} from './llm-provider.types';
import {
  assertNativeModel,
  nativeError,
  nativeFinish,
  nativeTool,
  nativeUsage,
  parseNativeJson,
  record,
  updateNativeUsage,
  validateNativeTools,
} from './native-claude.contract';

type Block = {
  type: string;
  stopped: boolean;
  value: Record<string, unknown>;
  arguments: string;
};

/** Validate protocol order; no executable tool escapes an incomplete message. */
export class NativeClaudeStream {
  private started = false;
  private stopped = false;
  private usage?: LLMTokenUsage;
  private finish?: LLMChatResponse['finishReason'];
  private readonly blocks = new Map<number, Block>();

  constructor(private readonly request: LLMChatRequest) {}

  get complete(): boolean {
    return this.stopped;
  }

  consume(value: unknown): LLMStreamChunk[] {
    const event = record(value);
    if (this.stopped) throw nativeError();
    if (event.type === 'error') throw nativeError(LLMErrorCode.SERVER_ERROR);
    if (event.type === 'ping') return [];
    if (event.type === 'message_start') {
      if (this.started) throw nativeError();
      const message = record(event.message);
      assertNativeModel(message.model, this.request.model);
      if (
        message.type !== 'message' ||
        message.role !== 'assistant' ||
        !Array.isArray(message.content) ||
        message.content.length
      )
        throw nativeError();
      this.usage = nativeUsage(message.usage);
      this.started = true;
      return [];
    }
    if (!this.started) throw nativeError();
    if (event.type === 'message_delta') {
      if (this.finish) throw nativeError();
      const reason = record(event.delta).stop_reason;
      if (reason !== undefined && reason !== null) {
        if ([...this.blocks.values()].some((block) => !block.stopped))
          throw nativeError();
        this.finish = nativeFinish(reason);
      }
      if (event.usage !== undefined)
        this.usage = updateNativeUsage(this.usage!, event.usage);
      return [];
    }
    if (event.type === 'message_stop') {
      if (
        !this.finish ||
        !this.usage ||
        [...this.blocks.values()].some((block) => !block.stopped)
      )
        throw nativeError();
      const tools: LLMToolCall[] = [];
      for (const block of this.blocks.values()) {
        if (block.type !== 'tool_use') continue;
        const input = block.arguments
          ? parseNativeJson(block.arguments)
          : block.value.input;
        tools.push(nativeTool({ ...block.value, input }, this.request));
      }
      validateNativeTools(tools, this.finish, this.request);
      this.stopped = true;
      return [
        ...tools.map((toolCall): LLMStreamChunk => ({
          type: 'tool_call_end',
          toolCall,
        })),
        { type: 'done', usage: this.usage },
      ];
    }
    if (
      this.finish ||
      !Number.isSafeInteger(event.index) ||
      (event.index as number) < 0
    )
      throw nativeError();
    const index = event.index as number;
    if (event.type === 'content_block_start') {
      if (
        this.blocks.has(index) ||
        [...this.blocks.values()].some((block) => !block.stopped)
      )
        throw nativeError();
      const block = record(event.content_block);
      if (
        typeof block.type !== 'string' ||
        !['text', 'tool_use', 'thinking', 'redacted_thinking'].includes(
          block.type,
        )
      )
        throw nativeError();
      if (block.type === 'text' && typeof block.text !== 'string')
        throw nativeError();
      if (block.type === 'tool_use') nativeTool(block, this.request);
      this.blocks.set(index, {
        type: block.type,
        stopped: false,
        value: block,
        arguments: '',
      });
      return block.type === 'text' && block.text
        ? [{ type: 'content', content: block.text as string }]
        : [];
    }
    const block = this.blocks.get(index);
    if (!block || block.stopped) throw nativeError();
    if (event.type === 'content_block_stop') {
      block.stopped = true;
      return [];
    }
    if (event.type !== 'content_block_delta') throw nativeError();
    const delta = record(event.delta);
    if (
      delta.type === 'text_delta' &&
      block.type === 'text' &&
      typeof delta.text === 'string'
    ) {
      return [{ type: 'content', content: delta.text }];
    }
    if (
      delta.type === 'input_json_delta' &&
      block.type === 'tool_use' &&
      typeof delta.partial_json === 'string'
    ) {
      if (Object.keys(record(block.value.input)).length) throw nativeError();
      block.arguments += delta.partial_json;
      return [];
    }
    if (
      block.type === 'thinking' &&
      ['thinking_delta', 'signature_delta'].includes(String(delta.type))
    )
      return [];
    throw nativeError();
  }
}

/** SSE framing, independent of transport byte boundaries (including UTF-8). */
export function parseNativeEvent(frame: string): unknown {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  return data ? parseNativeJson(data) : undefined;
}
