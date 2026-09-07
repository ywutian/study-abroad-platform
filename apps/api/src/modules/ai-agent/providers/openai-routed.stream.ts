import {
  LLMChatRequest,
  LLMChatResponse,
  LLMErrorCode,
  LLMProviderError,
  LLMStreamChunk,
  LLMTokenUsage,
  LLMToolCall,
  LLMStreamFailure,
} from './llm-provider.types';

export function routedError(
  code = LLMErrorCode.INVALID_RESPONSE,
  retryable = false,
  httpStatus?: number,
): LLMProviderError {
  // The status was always captured here and never surfaced: callers log
  // `error.message`, so an upstream 404 and an upstream 400 both read as
  // "Routed OpenAI INVALID_REQUEST". A bare status carries no prompt, no
  // arguments and no credential, so naming it costs nothing and is the
  // difference between "that model is gone" and "we sent a bad request".
  return new LLMProviderError(
    httpStatus === undefined
      ? `Routed OpenAI ${code}`
      : `Routed OpenAI ${code} (HTTP ${httpStatus})`,
    code,
    retryable,
    httpStatus,
  );
}

/** Abort is best-effort at the transport layer; don't rely on it settling I/O. */
async function beforeDeadline<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
  deadline: number,
): Promise<T> {
  const expired = () => routedError(LLMErrorCode.NETWORK_ERROR, true);
  if (signal.aborted || Date.now() >= deadline) throw expired();
  let abort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(expired());
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    const result = await Promise.race([operation(), cancelled]);
    if (signal.aborted || Date.now() >= deadline) throw expired();
    return result;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

function cancelBody(body: { cancel(): Promise<unknown> } | null | undefined) {
  // Cleanup must never keep a completed/failed run waiting on a broken peer.
  try {
    void body?.cancel().catch(() => undefined);
  } catch {
    // AbortController remains the independent transport cleanup mechanism.
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw routedError();
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw routedError();
  return value;
}

/** Routing transport: one choice, exact reported model, tools held until [DONE]. */
export class OpenAIRoutedStream {
  private identified = false;
  private finish?: LLMChatResponse['finishReason'];
  private usage?: LLMTokenUsage;
  private readonly tools = new Map<
    number,
    { id: string; name: string; args: string }
  >();
  complete = false;
  constructor(private readonly request: LLMChatRequest) {}

  consume(frame: string): LLMStreamChunk[] {
    const text = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!text) return [];
    if (this.complete) throw routedError();
    if (text === '[DONE]') {
      if (!this.identified || !this.finish || !this.usage) throw routedError();
      const tools: LLMToolCall[] = [...this.tools.values()].map((entry) => {
        let args: unknown;
        try {
          args = JSON.parse(entry.args);
        } catch {
          throw routedError();
        }
        if (
          !entry.id ||
          !this.request.tools?.some((t) => t.name === entry.name) ||
          this.request.toolChoice === 'none' ||
          (typeof this.request.toolChoice === 'object' &&
            this.request.toolChoice.name !== entry.name)
        )
          throw routedError();
        return { id: entry.id, name: entry.name, arguments: object(args) };
      });
      if (
        new Set(tools.map((t) => t.id)).size !== tools.length ||
        (tools.length > 0 && this.finish !== 'tool_calls') ||
        (this.finish === 'tool_calls' && !tools.length) ||
        (this.finish === 'stop' &&
          !tools.length &&
          (this.request.toolChoice === 'required' ||
            typeof this.request.toolChoice === 'object'))
      )
        throw routedError();
      this.complete = true;
      return [
        ...tools.map((toolCall): LLMStreamChunk => ({
          type: 'tool_call_end',
          toolCall,
        })),
        {
          type: 'done',
          usage: this.usage,
          model: this.request.model,
          finishReason: this.finish,
        },
      ];
    }
    let data: Record<string, unknown>;
    try {
      data = object(JSON.parse(text));
    } catch {
      throw routedError();
    }
    // An HTTP-200 error payload is not proof of a transient server failure.
    // In particular, never retry an embedded authentication/safety error.
    if (data.error) throw routedError();
    if (!this.identified || data.model !== undefined) {
      if (data.model !== this.request.model)
        throw routedError(LLMErrorCode.MODEL_MISMATCH);
      this.identified = true;
    }
    if (data.usage !== undefined && data.usage !== null) {
      const usage = object(data.usage);
      const promptTokens = count(usage.prompt_tokens);
      const completionTokens = count(usage.completion_tokens);
      const totalTokens = count(usage.total_tokens);
      if (count(promptTokens + completionTokens) !== totalTokens)
        throw routedError();
      this.usage = { promptTokens, completionTokens, totalTokens };
    }
    if (!Array.isArray(data.choices) || data.choices.length > 1)
      throw routedError();
    if (!data.choices.length) return [];
    if (this.finish) throw routedError();
    const choice = object(data.choices[0]);
    if (choice.index !== 0) throw routedError();
    const delta = object(choice.delta);
    if (delta.role !== undefined && delta.role !== 'assistant')
      throw routedError();
    if (delta.refusal) throw routedError(LLMErrorCode.CONTENT_FILTER);
    const output: LLMStreamChunk[] = [];
    if (delta.content !== undefined && delta.content !== null) {
      if (typeof delta.content !== 'string') throw routedError();
      if (delta.content)
        output.push({ type: 'content', content: delta.content });
    }
    if (delta.tool_calls !== undefined) {
      if (!Array.isArray(delta.tool_calls)) throw routedError();
      for (const raw of delta.tool_calls) {
        const item = object(raw);
        const index = count(item.index);
        if (index > 31 || (item.type !== undefined && item.type !== 'function'))
          throw routedError();
        const entry = this.tools.get(index) ?? { id: '', name: '', args: '' };
        if (item.id !== undefined) {
          if (typeof item.id !== 'string' || (entry.id && entry.id !== item.id))
            throw routedError();
          entry.id = item.id;
        }
        if (item.function !== undefined) {
          const fn = object(item.function);
          for (const field of ['name', 'arguments'] as const) {
            if (fn[field] !== undefined && typeof fn[field] !== 'string')
              throw routedError();
          }
          entry.name += (fn.name as string | undefined) ?? '';
          entry.args += (fn.arguments as string | undefined) ?? '';
        }
        this.tools.set(index, entry);
      }
    }
    if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
      if (
        typeof choice.finish_reason !== 'string' ||
        !['stop', 'tool_calls', 'length', 'content_filter'].includes(
          choice.finish_reason,
        )
      )
        throw routedError();
      if (choice.finish_reason === 'content_filter')
        throw routedError(LLMErrorCode.CONTENT_FILTER);
      this.finish = choice.finish_reason as LLMChatResponse['finishReason'];
    }
    return output;
  }
}

export async function* streamRoutedOpenAI(input: {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  body: Record<string, unknown>;
  request: LLMChatRequest;
}): AsyncGenerator<LLMStreamChunk> {
  const controller = new AbortController();
  const started = Date.now();
  const deadline = started + input.timeoutMs;
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let phase: LLMStreamFailure['phase'] = 'protocol';
  let bytes = 0,
    emittedBytes = 0;
  let firstByteMs: number | null = null;
  let retryAfterRequested = false;
  try {
    const url = new URL(input.baseUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw routedError(LLMErrorCode.INVALID_REQUEST);
    if (!input.apiKey.trim()) throw routedError(LLMErrorCode.AUTHENTICATION);
    url.pathname = url.pathname.replace(/\/$/, '') + '/chat/completions';
    phase = 'connect';
    const response = await beforeDeadline(
      () =>
        fetch(url, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${input.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...input.body,
            stream: true,
            stream_options: { include_usage: true },
          }),
        }),
      controller.signal,
      deadline,
    );
    if (!response.ok) {
      retryAfterRequested = response.headers.has('retry-after');
      cancelBody(response.body);
      const status = response.status;
      const code =
        status === 401
          ? LLMErrorCode.AUTHENTICATION
          : status === 403
            ? LLMErrorCode.PERMISSION_DENIED
            : status === 429
              ? LLMErrorCode.RATE_LIMIT
              : status >= 500
                ? LLMErrorCode.SERVER_ERROR
                : LLMErrorCode.INVALID_REQUEST;
      throw routedError(code, status === 429 || status >= 500, status);
    }
    reader = response.body?.getReader();
    if (!reader) throw routedError();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const decode = (bytes?: Uint8Array, stream = false): string => {
      try {
        return decoder.decode(bytes, { stream });
      } catch {
        throw routedError();
      }
    };
    const state = new OpenAIRoutedStream(input.request);
    let buffer = '';
    function* consume(frame: string): Generator<LLMStreamChunk> {
      phase = 'protocol';
      for (const chunk of state.consume(frame)) {
        if (chunk.content)
          emittedBytes += Buffer.byteLength(chunk.content, 'utf8');
        yield chunk;
      }
      phase = 'read';
    }
    while (true) {
      phase = 'read';
      const next = await beforeDeadline(
        () => reader!.read(),
        controller.signal,
        deadline,
      );
      if (next.done) {
        buffer += decode();
        break;
      }
      bytes += next.value.byteLength;
      if (firstByteMs === null && next.value.byteLength)
        firstByteMs = Date.now() - started;
      if (bytes > 2 * 1024 * 1024) throw routedError();
      buffer += decode(next.value, true);
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        yield* consume(frame);
        if (state.complete) return;
      }
    }
    if (buffer.trim()) yield* consume(buffer);
    phase = 'protocol';
    if (!state.complete) throw routedError();
  } catch (error) {
    const failure =
      error instanceof LLMProviderError
        ? error
        : routedError(LLMErrorCode.NETWORK_ERROR, true);
    const reason: LLMStreamFailure['reason'] =
      failure.code === LLMErrorCode.NETWORK_ERROR
        ? controller.signal.aborted || Date.now() >= deadline
          ? 'deadline'
          : 'transport'
        : failure.httpStatus
          ? 'http'
          : 'protocol';
    throw new LLMProviderError(
      // Re-wrapping the stream failure dropped the status from the message
      // while keeping it on the object, so the one line callers actually log
      // lost it. Same reasoning as routedError() above.
      failure.httpStatus === undefined
        ? `Routed OpenAI ${failure.code}`
        : `Routed OpenAI ${failure.code} (HTTP ${failure.httpStatus})`,
      failure.code,
      failure.retryable,
      failure.httpStatus,
      undefined,
      {
        phase,
        reason,
        elapsedMs: Date.now() - started,
        receivedBytes: bytes,
        emittedBytes,
        firstByteMs,
        ...(retryAfterRequested ? { retryAfterRequested: true } : {}),
      },
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) {
      cancelBody(reader);
      reader.releaseLock();
    }
  }
}

export async function collectRoutedOpenAI(
  stream: AsyncIterable<LLMStreamChunk>,
): Promise<LLMChatResponse> {
  let content = '';
  const toolCalls: LLMToolCall[] = [];
  let done: LLMStreamChunk | undefined;
  for await (const chunk of stream) {
    if (chunk.type === 'error') throw routedError();
    if (chunk.type === 'content') content += chunk.content ?? '';
    if (chunk.type === 'tool_call_end')
      toolCalls.push(chunk.toolCall as LLMToolCall);
    if (chunk.type === 'done') done = chunk;
  }
  if (!done?.model || !done.finishReason || !done.usage) throw routedError();
  return {
    content,
    ...(toolCalls.length ? { toolCalls } : {}),
    model: done.model,
    usage: done.usage,
    finishReason: done.finishReason,
  };
}
