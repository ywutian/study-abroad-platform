import { ConfigService } from '@nestjs/config';
import { OpenAIProvider } from './openai.provider';
import {
  LLMChatRequest,
  LLMErrorCode,
  LLMStreamChunk,
} from './llm-provider.types';

const request: LLMChatRequest = {
  model: 'gpt-5.4-mini',
  systemPrompt: 'Synthetic',
  messages: [{ role: 'user', content: 'Synthetic' }],
  routed: true,
  timeoutMs: 1000,
  maxTokens: 500,
};
function payload(
  delta: Record<string, unknown>,
  finish_reason: string | null = null,
) {
  return {
    model: request.model,
    choices: [{ index: 0, delta, finish_reason }],
  };
}
function events(tool = false): Array<Record<string, unknown> | string> {
  return [
    payload({ role: 'assistant' }),
    ...(tool
      ? [
          payload({
            tool_calls: [
              {
                index: 0,
                id: 'tool_1',
                type: 'function',
                function: { name: 'read_', arguments: '{"id":' },
              },
            ],
          }),
          payload({
            tool_calls: [
              {
                index: 0,
                function: { name: 'school', arguments: '"SYNTHETIC"}' },
              },
            ],
          }),
        ]
      : [payload({ content: '你好' })]),
    payload({}, tool ? 'tool_calls' : 'stop'),
    {
      choices: [],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
    },
    '[DONE]',
  ];
}
function response(
  items: Array<Record<string, unknown> | string>,
  bytewise = false,
) {
  const text = items
    .map(
      (i) => `data: ${typeof i === 'string' ? i : JSON.stringify(i)}\r\n\r\n`,
    )
    .join('');
  const bytes = new TextEncoder().encode(text);
  let pos = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (pos >= bytes.length) {
          controller.close();
          return;
        }
        const end = bytewise ? pos + 1 : bytes.length;
        controller.enqueue(bytes.slice(pos, end));
        pos = end;
      },
    }),
  );
}
describe('Routed OpenAI transport', () => {
  let fetchMock: jest.Mock;
  const original = global.fetch;
  const provider = new OpenAIProvider({
    get: (key: string, fallback?: unknown) =>
      ({
        OPENAI_API_KEY: 'synthetic',
        OPENAI_BASE_URL: 'https://relay.example/openai/v1',
      })[key] ?? fallback,
  } as ConfigService);
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
  });
  afterEach(() => {
    global.fetch = original;
    jest.useRealTimers();
  });

  it('aggregates streaming-only GPT for ordinary callers with verified model and usage', async () => {
    fetchMock.mockResolvedValue(response(events(), true));
    expect(await provider.chat(request)).toEqual({
      content: '你好',
      model: request.model,
      finishReason: 'stop',
      usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: 500,
    });
    expect(init.signal?.aborted).toBe(true);
  });
  it('does not reclassify embedded authentication errors or corrupt UTF-8 as retryable network errors', async () => {
    for (const res of [
      response([
        { error: { type: 'authentication_error', message: 'PRIVATE' } },
      ]),
      new Response(new Uint8Array([0xff])),
    ]) {
      fetchMock.mockResolvedValue(res);
      await expect(provider.chat(request)).rejects.toMatchObject({
        code: LLMErrorCode.INVALID_RESPONSE,
        retryable: false,
      });
    }
  });
  it('validates split tool names, IDs, arguments and final state before returning tools', async () => {
    fetchMock.mockResolvedValue(response(events(true), true));
    const result = await provider.chat({
      ...request,
      tools: [
        {
          name: 'read_school',
          description: 'Synthetic',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ],
    });
    expect(result.toolCalls).toEqual([
      { id: 'tool_1', name: 'read_school', arguments: { id: 'SYNTHETIC' } },
    ]);
  });
  it.each([undefined, 'gpt-5.5'])(
    'blocks absent or swapped model %s before streaming content',
    async (model) => {
      const items = events();
      items[0] = { ...payload({ role: 'assistant' }), model };
      fetchMock.mockResolvedValue(response(items));
      const output: LLMStreamChunk[] = [];
      await expect(
        (async () => {
          for await (const c of provider.chatStream(request)) output.push(c);
        })(),
      ).rejects.toMatchObject({ code: LLMErrorCode.MODEL_MISMATCH });
      expect(output).toEqual([]);
    },
  );
  it.each([
    'missing_done',
    'missing_finish',
    'missing_usage',
    'wrong_tool',
    'invalid_json',
    'bad_usage',
    'two_choices',
    'truncated_tool',
  ])('fails closed on %s', async (mutation) => {
    let items = events(
      mutation.includes('tool') || mutation === 'invalid_json',
    );
    if (mutation === 'missing_done') items = items.slice(0, -1);
    if (mutation === 'missing_finish') items = items.filter((_, i) => i !== 2);
    if (mutation === 'missing_usage') items = items.filter((_, i) => i !== 3);
    if (mutation === 'invalid_json')
      items[2] = payload({
        tool_calls: [
          { index: 0, function: { name: 'school', arguments: 'NOT_JSON' } },
        ],
      });
    if (mutation === 'truncated_tool') items[3] = payload({}, 'length');
    if (mutation === 'bad_usage')
      items[3] = {
        choices: [],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 1 },
      };
    if (mutation === 'two_choices')
      items[1] = {
        model: request.model,
        choices: [
          { index: 0, delta: {} },
          { index: 1, delta: {} },
        ],
      };
    fetchMock.mockResolvedValue(response(items));
    await expect(
      provider.chat({
        ...request,
        tools:
          mutation === 'wrong_tool'
            ? []
            : [
                {
                  name: 'read_school',
                  description: 'synthetic',
                  parameters: { type: 'object', properties: {}, required: [] },
                },
              ],
      }),
    ).rejects.toMatchObject({ code: LLMErrorCode.INVALID_RESPONSE });
  });
  it.each([
    [401, LLMErrorCode.AUTHENTICATION],
    [429, LLMErrorCode.RATE_LIMIT],
    [503, LLMErrorCode.SERVER_ERROR],
  ])('sanitizes HTTP %s', async (status, code) => {
    fetchMock.mockResolvedValue(
      new Response('PRIVATE_CREDENTIAL', { status: Number(status) }),
    );
    await expect(provider.chat(request)).rejects.toMatchObject({
      code,
      message: `Routed OpenAI ${code}`,
    });
  });
  it('cancels the transport when the consumer stops early', async () => {
    fetchMock.mockResolvedValue(response(events()));
    const iterator = provider.chatStream(request);
    expect((await iterator.next()).value?.type).toBe('content');
    await iterator.return(undefined);
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(
      true,
    );
  });
  it('bounds the entire body read by the deadline', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      async (_url: unknown, init: RequestInit) =>
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
    const assertion = expect(
      provider.chat({ ...request, timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: LLMErrorCode.NETWORK_ERROR });
    await jest.advanceTimersByTimeAsync(11);
    await assertion;
  });
  it.each(['fetch', 'read', 'cancel'])(
    'settles when %s never resolves even after transport abort',
    async (phase) => {
      jest.useFakeTimers();
      const never = () => new Promise<never>(() => undefined);
      if (phase === 'fetch') fetchMock.mockImplementation(never);
      else {
        const bytes = new TextEncoder().encode(
          events()
            .map(
              (item) =>
                `data: ${typeof item === 'string' ? item : JSON.stringify(item)}\n\n`,
            )
            .join(''),
        );
        fetchMock.mockResolvedValue(
          new Response(
            new ReadableStream({
              start(controller) {
                if (phase === 'cancel') controller.enqueue(bytes);
              },
              cancel: never,
            }),
          ),
        );
      }
      let settled = false;
      let errorCode: unknown;
      const pending = provider.chat({ ...request, timeoutMs: 10 }).then(
        () => {
          settled = true;
        },
        (error: unknown) => {
          settled = true;
          errorCode =
            error instanceof Error && 'code' in error
              ? error.code
              : 'UNEXPECTED';
        },
      );
      await jest.advanceTimersByTimeAsync(20);
      expect(settled).toBe(true);
      await pending;
      expect(errorCode).toBe(
        phase === 'cancel' ? undefined : LLMErrorCode.NETWORK_ERROR,
      );
      expect(jest.getTimerCount()).toBe(0);
    },
  );
  it('preserves authentication errors when response-body cancellation hangs', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          cancel: () => new Promise<never>(() => undefined),
        }),
        { status: 401 },
      ),
    );
    await expect(provider.chat(request)).rejects.toMatchObject({
      code: LLMErrorCode.AUTHENTICATION,
      retryable: false,
    });
  });
  it('rejects late success even if the timer callback has not run yet', async () => {
    jest.useFakeTimers();
    let resolveFetch!: (value: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const assertion = expect(
      provider.chat({ ...request, timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: LLMErrorCode.NETWORK_ERROR });
    jest.setSystemTime(Date.now() + 100);
    resolveFetch(response(events()));
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });
  it('does not change legacy non-streaming transport when routing is off', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'legacy' }, finish_reason: 'stop' }],
        }),
      ),
    );
    await provider.chat({ ...request, routed: false });
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
        .stream,
    ).toBe(false);
  });
});
