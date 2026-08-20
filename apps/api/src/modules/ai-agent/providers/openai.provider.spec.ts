import { ConfigService } from '@nestjs/config';
import { OpenAIProvider } from './openai.provider';
import { LLMErrorCode, LLMProviderError } from './llm-provider.types';

describe('OpenAIProvider contract', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  function createProvider(overrides: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = {
      OPENAI_API_KEY: 'test-key',
      OPENAI_BASE_URL: 'https://openai.example/v1',
      AI_REQUEST_TIMEOUT_MS: 50,
      ...overrides,
    };
    const config = {
      get: jest.fn((key: string, defaultValue?: unknown) =>
        key in values ? values[key] : defaultValue,
      ),
    } as unknown as ConfigService;
    return new OpenAIProvider(config);
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('maps normal content, structured options, tools, and usage', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"ok":true}',
              tool_calls: [
                {
                  id: 'call-1',
                  function: {
                    name: 'get_profile',
                    arguments: '{"fields":["gpa"]}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    });

    const response = await createProvider().chat({
      systemPrompt: 'system',
      messages: [{ role: 'user', content: 'hello' }],
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 100,
      tools: [
        {
          name: 'get_profile',
          description: 'Get profile',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ],
      providerOptions: { response_format: { type: 'json_object' } },
    });

    expect(response).toEqual({
      content: '{"ok":true}',
      toolCalls: [
        {
          id: 'call-1',
          name: 'get_profile',
          arguments: { fields: ['gpa'] },
        },
      ],
      finishReason: 'tool_calls',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(request.body as string);
    expect(body).toEqual(
      expect.objectContaining({
        model: 'gpt-4o',
        temperature: 0.2,
        max_tokens: 100,
        response_format: { type: 'json_object' },
        tool_choice: 'auto',
      }),
    );
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it('assembles streamed content and tool-call argument deltas', async () => {
    const encoder = new TextEncoder();
    const payload = [
      'data: {"choices":[{"delta":{"content":"Hi "}}]}\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"get_profile","arguments":"{\\"field\\":"}}]}}]}\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"gpa\\"}"}}]}}]}\n',
      'data: [DONE]\n',
    ].join('');
    let delivered = false;
    fetchMock.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: jest.fn(async () => {
            if (delivered) return { done: true, value: undefined };
            delivered = true;
            return { done: false, value: encoder.encode(payload) };
          }),
        }),
      },
    });

    const chunks = [];
    for await (const chunk of createProvider().chatStream({
      systemPrompt: 'system',
      messages: [{ role: 'user', content: 'hello' }],
      model: 'gpt-4o',
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toContainEqual({ type: 'content', content: 'Hi ' });
    expect(chunks).toContainEqual({
      type: 'tool_call_end',
      toolCall: {
        id: 'call-1',
        name: 'get_profile',
        arguments: { field: 'gpa' },
      },
    });
    expect(chunks.at(-1)).toEqual({ type: 'done' });
  });

  it.each([
    [401, LLMErrorCode.AUTHENTICATION, false],
    [429, LLMErrorCode.RATE_LIMIT, true],
    [500, LLMErrorCode.SERVER_ERROR, true],
  ])(
    'maps HTTP %s to a stable provider error',
    async (status, code, retryable) => {
      fetchMock.mockResolvedValue({
        ok: false,
        status,
        text: jest.fn().mockResolvedValue('upstream error'),
      });

      await expect(
        createProvider().chat({
          systemPrompt: 'system',
          messages: [],
          model: 'gpt-4o',
        }),
      ).rejects.toMatchObject({ code, retryable, httpStatus: status });
    },
  );

  it('maps transport failures to a retryable network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('connection reset'));

    await expect(
      createProvider().chat({
        systemPrompt: 'system',
        messages: [],
        model: 'gpt-4o',
      }),
    ).rejects.toMatchObject({
      code: LLMErrorCode.NETWORK_ERROR,
      retryable: true,
    });
  });

  it('aborts requests at the configured provider timeout', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );

    const request = createProvider().chat({
      systemPrompt: 'system',
      messages: [],
      model: 'gpt-4o',
    });
    const assertion = expect(request).rejects.toMatchObject({
      code: LLMErrorCode.NETWORK_ERROR,
      retryable: true,
      message: 'OpenAI request timed out',
    });
    await jest.advanceTimersByTimeAsync(51);
    await assertion;
  });

  it('fails locally when no API key is configured', async () => {
    await expect(
      createProvider({ OPENAI_API_KEY: '' }).chat({
        systemPrompt: 'system',
        messages: [],
        model: 'gpt-4o',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<LLMProviderError>>({
        code: LLMErrorCode.AUTHENTICATION,
        retryable: false,
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
