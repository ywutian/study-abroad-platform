import { ConfigService } from '@nestjs/config';
import { AnthropicProvider } from './anthropic.provider';
import {
  LLMChatRequest,
  LLMErrorCode,
  LLMStreamChunk,
} from './llm-provider.types';
import {
  buildNativeRequest,
  parseNativeResponse,
} from './native-claude.contract';

const MODEL = 'claude-sonnet-5';
const request: LLMChatRequest = {
  model: MODEL,
  systemPrompt: 'Synthetic system',
  messages: [{ role: 'user', content: 'Hello' }],
  maxTokens: 200,
};
const tool = {
  name: 'lookup_school',
  description: 'Synthetic',
  parameters: {
    type: 'object' as const,
    properties: { schoolId: { type: 'string' } },
    required: ['schoolId'],
  },
};
const toolRequest = { ...request, tools: [tool] };
const toolBlock = {
  type: 'tool_use',
  id: 'tool-1',
  name: 'lookup_school',
  input: { schoolId: 'synthetic' },
};

function message(overrides: Record<string, unknown> = {}) {
  return {
    type: 'message',
    role: 'assistant',
    model: MODEL,
    content: [{ type: 'text', text: '你好' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
    ...overrides,
  };
}

function events(toolMode = false): Record<string, unknown>[] {
  return [
    {
      type: 'message_start',
      message: message({
        content: [],
        stop_reason: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      }),
    },
    {
      type: 'content_block_start',
      index: 0,
      content_block: toolMode
        ? { ...toolBlock, input: {} }
        : { type: 'text', text: '' },
    },
    {
      type: 'content_block_delta',
      index: 0,
      delta: toolMode
        ? { type: 'input_json_delta', partial_json: '{"schoolId":' }
        : { type: 'text_delta', text: '你好' },
    },
    ...(toolMode
      ? [
          {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: '"synthetic"}' },
          },
        ]
      : []),
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      delta: { stop_reason: toolMode ? 'tool_use' : 'end_turn' },
      usage: { output_tokens: 5 },
    },
    { type: 'message_stop' },
  ];
}

function streamResponse(items: Record<string, unknown>[], bytewise = false) {
  const data = new TextEncoder().encode(
    items
      .map(
        (item) =>
          `event: ${String(item.type)}\r\ndata: ${JSON.stringify(item)}\r\n\r\n`,
      )
      .join(''),
  );
  let offset = 0;
  const cancel = jest.fn();
  const response = new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === data.length) {
          controller.close();
          return;
        }
        const end = bytewise ? offset + 1 : data.length;
        controller.enqueue(data.slice(offset, end));
        offset = end;
      },
      cancel,
    }),
  );
  return { response, cancel };
}

describe('Native Claude provider contracts', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  function provider(overrides: Record<string, unknown> = {}) {
    const config = {
      AI_AGENT_NATIVE_CLAUDE_V1: 'true',
      ANTHROPIC_API_KEY: 'synthetic-key',
      ANTHROPIC_BASE_URL: 'https://relay.example/api',
      AI_REQUEST_TIMEOUT_MS: 1000,
      ...overrides,
    };
    return new AnthropicProvider({
      get: (key: string, fallback?: unknown) =>
        key in config ? config[key as keyof typeof config] : fallback,
    } as ConfigService);
  }
  async function collect(
    items: Record<string, unknown>[],
    req = request,
    bytewise = false,
  ) {
    fetchMock.mockResolvedValue(streamResponse(items, bytewise).response);
    const output: LLMStreamChunk[] = [];
    for await (const chunk of provider().chatStream(req)) output.push(chunk);
    return output;
  }
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('maps native text and usage with the original model, not a replacement', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(message())));
    await expect(provider().chat(request)).resolves.toEqual({
      content: '你好',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://relay.example/api/v1/messages',
      expect.objectContaining({
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          'x-api-key': 'synthetic-key',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });

  it.each([undefined, null, 'claude-haiku-4-5-20251001', 'claude-opus-4-8'])(
    'rejects missing/substituted model %s',
    async (model) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(message({ model }))),
      );
      await expect(provider().chat(request)).rejects.toMatchObject({
        code: LLMErrorCode.MODEL_MISMATCH,
        retryable: false,
      });
    },
  );
  it('rejects a swapped stream before any content or tools and cancels it', async () => {
    const items = events();
    items[0] = {
      type: 'message_start',
      message: message({ model: 'claude-haiku-4-5-20251001', content: [] }),
    };
    const output = await collect(items);
    expect(output).toEqual([
      { type: 'error', error: 'Native Claude MODEL_MISMATCH' },
    ]);
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(
      true,
    );
  });
  it('maps declared tool calls, including distinct IDs for the same function', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          message({
            content: [toolBlock, { ...toolBlock, id: 'tool-2' }],
            stop_reason: 'tool_use',
          }),
        ),
      ),
    );
    const result = await provider().chat(toolRequest);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls?.[0]).toEqual({
      id: 'tool-1',
      name: 'lookup_school',
      arguments: { schoolId: 'synthetic' },
    });
  });
  it.each([
    [{ ...toolBlock, name: 'write_arbitrary_file' }],
    [{ ...toolBlock, input: [] }],
    [{ ...toolBlock, id: '' }],
    [toolBlock, toolBlock],
  ])('rejects invalid tool contracts', async (...blocks) => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(message({ content: blocks, stop_reason: 'tool_use' })),
      ),
    );
    await expect(provider().chat(toolRequest)).rejects.toMatchObject({
      code: LLMErrorCode.INVALID_RESPONSE,
    });
  });
  it('rejects tool output when toolChoice is none', () => {
    expect(() =>
      parseNativeResponse(
        message({ content: [toolBlock], stop_reason: 'tool_use' }),
        { ...toolRequest, toolChoice: 'none' },
      ),
    ).toThrow('INVALID_RESPONSE');
  });
  it('rejects tools in a truncated response rather than executing partial work', () => {
    expect(() =>
      parseNativeResponse(
        message({ content: [toolBlock], stop_reason: 'max_tokens' }),
        toolRequest,
      ),
    ).toThrow('INVALID_RESPONSE');
  });
  it('accounts for cached and newly created prompt tokens', () => {
    const output = parseNativeResponse(
      message({
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_creation_input_tokens: 20,
          cache_read_input_tokens: 30,
        },
      }),
      request,
    );
    expect(output.usage).toEqual({
      promptTokens: 60,
      completionTokens: 5,
      totalTokens: 65,
      cacheReadTokens: 30,
    });
  });
  it.each([-1, '5', null, 1.5])('rejects invalid usage %s', (output_tokens) => {
    expect(() =>
      parseNativeResponse(
        message({ usage: { input_tokens: 10, output_tokens } }),
        request,
      ),
    ).toThrow('INVALID_RESPONSE');
  });
  it('handles byte-split UTF-8, CRLF framing, and message_stop', async () => {
    const output = await collect(events(), request, true);
    expect(output).toEqual([
      { type: 'content', content: '你好' },
      {
        type: 'done',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ]);
  });
  it('assembles tool JSON and emits it only after message_stop', async () => {
    const output = await collect(events(true), toolRequest, true);
    expect(output).toEqual([
      {
        type: 'tool_call_end',
        toolCall: {
          id: 'tool-1',
          name: 'lookup_school',
          arguments: { schoolId: 'synthetic' },
        },
      },
      {
        type: 'done',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ]);
  });
  it('does not emit tool results or done for a truncated stream', async () => {
    const output = await collect(events(true).slice(0, -1), toolRequest);
    expect(output).toEqual([
      { type: 'error', error: 'Native Claude INVALID_RESPONSE' },
    ]);
  });
  it.each(['unknown', 'error', 'message_stop'])(
    'fails closed on invalid stream event %s',
    async (type) => {
      const output = await collect([{ type }]);
      expect(output.map((x) => x.type)).toEqual(['error']);
    },
  );
  it('rejects an unclosed block and malformed JSON arguments', async () => {
    const items = events(true).filter((e) => e.type !== 'content_block_stop');
    expect((await collect(items, toolRequest)).map((c) => c.type)).toEqual([
      'error',
    ]);
    const malformed = events(true);
    malformed[2] = {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'input_json_delta', partial_json: 'not-json' },
    };
    expect((await collect(malformed, toolRequest)).map((c) => c.type)).toEqual([
      'error',
    ]);
  });
  it('cancels the stream when a caller stops consuming early', async () => {
    fetchMock.mockResolvedValue(streamResponse(events()).response);
    const iterator = provider().chatStream(request);
    expect((await iterator.next()).value?.type).toBe('content');
    await iterator.return(undefined);
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(
      true,
    );
  });
  it.each([
    [401, LLMErrorCode.AUTHENTICATION, false],
    [403, LLMErrorCode.AUTHENTICATION, false],
    [400, LLMErrorCode.INVALID_REQUEST, false],
    [429, LLMErrorCode.RATE_LIMIT, true],
    [503, LLMErrorCode.SERVER_ERROR, true],
  ])(
    'sanitizes HTTP %s without reading provider error payloads',
    async (status, code, retryable) => {
      fetchMock.mockResolvedValue(
        new Response('PRIVATE_PROVIDER_PAYLOAD', { status: Number(status) }),
      );
      await expect(provider().chat(request)).rejects.toMatchObject({
        code,
        retryable,
        message: `Native Claude HTTP ${status}`,
      });
    },
  );
  it('sanitizes network errors', async () => {
    fetchMock.mockRejectedValue(new Error('PRIVATE_URL_AND_CREDENTIAL'));
    await expect(provider().chat(request)).rejects.toMatchObject({
      message: 'Native Claude transport failed',
      code: LLMErrorCode.NETWORK_ERROR,
    });
  });
  it('aborts stalled response bodies, not just initial headers', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      async (_url: string, init: RequestInit) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init.signal?.addEventListener(
                'abort',
                () => controller.error(new Error('PRIVATE')),
                { once: true },
              );
            },
          }),
        ),
    );
    const result = provider().chat({ ...request, timeoutMs: 20 });
    const assertion = expect(result).rejects.toMatchObject({
      message: 'Native Claude timeout',
    });
    await jest.advanceTimersByTimeAsync(21);
    await assertion;
  });
  it('rejects over-size and malformed JSON bodies', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('x'.repeat(2 * 1024 * 1024 + 1)),
    );
    await expect(provider().chat(request)).rejects.toMatchObject({
      code: LLMErrorCode.INVALID_RESPONSE,
    });
    fetchMock.mockResolvedValueOnce(new Response('not-json-private'));
    await expect(provider().chat(request)).rejects.toMatchObject({
      message: 'Native Claude INVALID_RESPONSE',
    });
  });
  it.each(['false', undefined])(
    'does not fetch with feature flag %s',
    async (flag) => {
      await expect(
        provider({ AI_AGENT_NATIVE_CLAUDE_V1: flag }).chat(request),
      ).rejects.toMatchObject({ code: LLMErrorCode.INVALID_REQUEST });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it.each([
    'http://relay.example',
    'https://user:secret@relay.example',
    'https://relay.example?key=value',
    'https://relay.example/#secret',
  ])('rejects unsafe URL configuration', async (url) => {
    await expect(
      provider({ ANTHROPIC_BASE_URL: url }).chat(request),
    ).rejects.toMatchObject({ code: LLMErrorCode.INVALID_REQUEST });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Native Claude request conversion', () => {
  it('preserves tool histories and merges adjacent user tool results', () => {
    const body = buildNativeRequest(
      {
        ...toolRequest,
        messages: [
          request.messages[0],
          {
            role: 'assistant',
            content: null,
            toolCalls: [{ id: 'id-1', name: tool.name, arguments: {} }],
          },
          { role: 'tool', content: 'synthetic result', toolCallId: 'id-1' },
          { role: 'user', content: 'continue' },
        ],
      },
      false,
    );
    expect(body.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'id-1', name: tool.name, input: {} }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'id-1',
            content: 'synthetic result',
          },
          { type: 'text', text: 'continue' },
        ],
      },
    ]);
  });
  it.each([
    'model',
    'stream',
    'headers',
    'max_tokens',
    'messages',
    'tools',
    'thinking',
  ])('rejects providerOptions override %s', (key) => {
    expect(() =>
      buildNativeRequest(
        { ...request, providerOptions: { [key]: 'synthetic' } },
        false,
      ),
    ).toThrow('INVALID_REQUEST');
  });
  it('translates JSON schema and omits unsupported temperature and seed', () => {
    const schema = {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false,
    };
    const body = buildNativeRequest(
      {
        ...request,
        temperature: 0,
        providerOptions: {
          seed: 42,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'synthetic', strict: true, schema },
          },
        },
      },
      false,
    );
    expect(body.output_config).toEqual({
      format: { type: 'json_schema', schema },
    });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('seed');
  });
  it('uses an explicit JSON instruction for legacy json_object without claiming schema enforcement', () => {
    const body = buildNativeRequest(
      {
        ...request,
        providerOptions: { response_format: { type: 'json_object' } },
      },
      false,
    );
    expect(body.system).toContain('Return a JSON object only');
    expect(body).not.toHaveProperty('output_config');
  });
  it.each(['auto', 'none', 'required'] as const)(
    'maps toolChoice %s',
    (choice) => {
      expect(
        buildNativeRequest({ ...toolRequest, toolChoice: choice }, false)
          .tool_choice,
      ).toEqual({ type: choice === 'required' ? 'any' : choice });
    },
  );
  it('disables thinking for forced native tool selection', () => {
    const body = buildNativeRequest(
      { ...toolRequest, toolChoice: { name: tool.name } },
      true,
    );
    expect(body.tool_choice).toEqual({ type: 'tool', name: tool.name });
    expect(body.thinking).toEqual({ type: 'disabled' });
  });
  it('rejects orphaned results, missing results, and mid-conversation system messages', () => {
    for (const messages of [
      [{ role: 'tool' as const, content: 'result', toolCallId: 'unknown' }],
      [
        ...request.messages,
        {
          role: 'assistant' as const,
          content: null,
          toolCalls: [{ id: '1', name: tool.name, arguments: {} }],
        },
      ],
      [...request.messages, { role: 'system' as const, content: 'move me' }],
    ])
      expect(() => buildNativeRequest({ ...request, messages }, false)).toThrow(
        'INVALID_REQUEST',
      );
  });
});
