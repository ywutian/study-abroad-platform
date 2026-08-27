import {
  LLMChatRequest,
  LLMChatResponse,
  LLMErrorCode,
  LLMProviderError,
  LLMTokenUsage,
  LLMToolCall,
} from './llm-provider.types';

export function nativeError(
  code = LLMErrorCode.INVALID_RESPONSE,
): LLMProviderError {
  // Never attach remote payloads, prompts, tool arguments, or credentials.
  return new LLMProviderError(`Native Claude ${code}`, code, false);
}

export function record(
  value: unknown,
  code = LLMErrorCode.INVALID_RESPONSE,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw nativeError(code);
  return value as Record<string, unknown>;
}

export function parseNativeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw nativeError();
  }
}

export function assertNativeModel(actual: unknown, expected: string): void {
  if (actual !== expected) {
    throw nativeError(LLMErrorCode.MODEL_MISMATCH);
  }
}

function tokenCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw nativeError();
  }
  return value;
}

export function nativeUsage(value: unknown): LLMTokenUsage {
  const usage = record(value);
  const cacheReadTokens = tokenCount(usage.cache_read_input_tokens ?? 0);
  const promptTokens = tokenCount(
    tokenCount(usage.input_tokens) +
      cacheReadTokens +
      tokenCount(usage.cache_creation_input_tokens ?? 0),
  );
  const completionTokens = tokenCount(usage.output_tokens);
  return {
    promptTokens,
    completionTokens,
    totalTokens: tokenCount(promptTokens + completionTokens),
    ...(cacheReadTokens ? { cacheReadTokens } : {}),
  };
}

export function updateNativeUsage(
  current: LLMTokenUsage,
  delta: unknown,
): LLMTokenUsage {
  const completionTokens = tokenCount(record(delta).output_tokens);
  if (completionTokens < current.completionTokens) throw nativeError();
  return {
    ...current,
    completionTokens,
    totalTokens: tokenCount(current.promptTokens + completionTokens),
  };
}

export function nativeFinish(reason: unknown): LLMChatResponse['finishReason'] {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'tool_use':
      return 'tool_calls';
    case 'max_tokens':
      return 'length';
    case 'refusal':
      return 'content_filter';
    default:
      throw nativeError();
  }
}

export function nativeTool(
  block: Record<string, unknown>,
  request: LLMChatRequest,
): LLMToolCall {
  if (
    typeof block.id !== 'string' ||
    !block.id ||
    typeof block.name !== 'string' ||
    !request.tools?.some((tool) => tool.name === block.name) ||
    request.toolChoice === 'none' ||
    (typeof request.toolChoice === 'object' &&
      request.toolChoice.name !== block.name)
  ) {
    throw nativeError();
  }
  return { id: block.id, name: block.name, arguments: record(block.input) };
}

export function validateNativeTools(
  tools: LLMToolCall[],
  finish: LLMChatResponse['finishReason'],
  request: LLMChatRequest,
): void {
  if (
    new Set(tools.map((tool) => tool.id)).size !== tools.length ||
    (tools.length > 0 && finish !== 'tool_calls') ||
    (finish === 'tool_calls' && !tools.length) ||
    (finish === 'stop' &&
      !tools.length &&
      (request.toolChoice === 'required' ||
        typeof request.toolChoice === 'object'))
  )
    throw nativeError();
}

export function parseNativeResponse(
  value: unknown,
  request: LLMChatRequest,
): LLMChatResponse {
  const response = record(value);
  assertNativeModel(response.model, request.model);
  if (
    response.type !== 'message' ||
    response.role !== 'assistant' ||
    !Array.isArray(response.content)
  ) {
    throw nativeError();
  }
  const texts: string[] = [];
  const toolCalls: LLMToolCall[] = [];
  for (const item of response.content) {
    const block = record(item);
    if (block.type === 'text' && typeof block.text === 'string')
      texts.push(block.text);
    else if (block.type === 'tool_use')
      toolCalls.push(nativeTool(block, request));
    else if (block.type !== 'thinking' && block.type !== 'redacted_thinking')
      throw nativeError();
  }
  const finishReason = nativeFinish(response.stop_reason);
  validateNativeTools(toolCalls, finishReason, request);
  return {
    content: texts.join(''),
    finishReason,
    usage: nativeUsage(response.usage),
    ...(toolCalls.length ? { toolCalls } : {}),
  };
}

type NativeMessage = {
  role: 'user' | 'assistant';
  content: Record<string, unknown>[];
};

export function buildNativeRequest(
  request: LLMChatRequest,
  stream: boolean,
): Record<string, unknown> {
  const invalid = () => nativeError(LLMErrorCode.INVALID_REQUEST);
  if (
    !/^claude-[a-z0-9-]{1,80}$/.test(request.model) ||
    !Number.isSafeInteger(request.maxTokens ?? 4000) ||
    (request.maxTokens ?? 4000) < 1
  )
    throw invalid();
  const messages: NativeMessage[] = [];
  const systems = [request.systemPrompt];
  const pendingTools = new Set<string>();
  const historyIds = new Set<string>();
  for (const msg of request.messages) {
    if (msg.role === 'system') {
      if (messages.length) throw invalid(); // Do not silently move mid-turn instructions.
      if (msg.content) systems.push(msg.content);
      continue;
    }
    const content: Record<string, unknown>[] = [];
    if (msg.role === 'tool') {
      if (!msg.toolCallId || !pendingTools.delete(msg.toolCallId))
        throw invalid();
      content.push({
        type: 'tool_result',
        tool_use_id: msg.toolCallId,
        content: msg.content ?? '',
      });
    } else {
      if (pendingTools.size) throw invalid();
      if (msg.content) content.push({ type: 'text', text: msg.content });
      if (msg.toolCalls?.length) {
        if (msg.role !== 'assistant') throw invalid();
        for (const tool of msg.toolCalls) {
          if (!tool.id || !tool.name || historyIds.has(tool.id))
            throw invalid();
          historyIds.add(tool.id);
          pendingTools.add(tool.id);
          content.push({
            type: 'tool_use',
            id: tool.id,
            name: tool.name,
            input: tool.arguments,
          });
        }
      }
    }
    if (!content.length) throw invalid();
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    const last = messages.at(-1);
    if (last?.role === role) last.content.push(...content);
    else messages.push({ role, content });
  }
  if (
    !messages.length ||
    messages[0].role !== 'user' ||
    messages.at(-1)?.role !== 'user' ||
    pendingTools.size
  )
    throw invalid();
  const options = request.providerOptions ?? {};
  // seed has no native equivalent; it never weakens safety or changes routing.
  if (
    Object.keys(options).some(
      (key) => key !== 'response_format' && key !== 'seed',
    )
  )
    throw invalid();
  const body: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.maxTokens ?? 4000,
    messages,
    stream,
  };
  if (options.response_format !== undefined) {
    const format = record(
      options.response_format,
      LLMErrorCode.INVALID_REQUEST,
    );
    if (format.type === 'json_object') {
      systems.push(
        'Return a JSON object only. Do not include Markdown fences or surrounding prose.',
      );
    } else if (format.type === 'json_schema') {
      const definition = record(
        format.json_schema,
        LLMErrorCode.INVALID_REQUEST,
      );
      body.output_config = {
        format: {
          type: 'json_schema',
          schema: record(definition.schema, LLMErrorCode.INVALID_REQUEST),
        },
      };
    } else throw invalid();
  }
  body.system = systems.filter(Boolean).join('\n\n');
  if (request.tools?.length) {
    if (
      new Set(request.tools.map((tool) => tool.name)).size !==
      request.tools.length
    )
      throw invalid();
    body.tools = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
    const choice = request.toolChoice ?? 'auto';
    if (typeof choice === 'object') {
      if (!request.tools.some((tool) => tool.name === choice.name))
        throw invalid();
      body.tool_choice = { type: 'tool', name: choice.name };
    } else body.tool_choice = { type: choice === 'required' ? 'any' : choice };
    if (choice === 'required' || typeof choice === 'object')
      body.thinking = { type: 'disabled' };
  } else if (
    request.toolChoice &&
    request.toolChoice !== 'none' &&
    request.toolChoice !== 'auto'
  )
    throw invalid();
  // Do not forward temperature: recent Claude models reject this legacy option.
  return body;
}
