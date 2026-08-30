import { ConfigService } from '@nestjs/config';
import { OpenAIProvider } from '../providers/openai.provider';
import { AgentRunBudgetTracker } from './agent-run-context';
import { LLMService, StreamChunk } from './llm.service';
import { Logger } from '@nestjs/common';

const config = {
  get: (key: string, fallback?: unknown) =>
    ({
      OPENAI_CHAT_API_KEY: 'synthetic',
      OPENAI_CHAT_BASE_URL: 'https://relay.example/openai/v1',
      OPENAI_CHAT_MODEL: 'gpt-5.4',
      OPENAI_CHAT_TRANSPORT: 'sse',
    })[key] ?? fallback,
} as ConfigService;

function budget(maxTokens = 24000, elapsedMs = 0) {
  return new AgentRunBudgetTracker(
    {
      version: 1,
      maxTokens,
      maxDurationMs: 120000,
      maxToolCalls: 16,
      maxSupplementalRounds: 2,
    },
    {
      version: 1,
      estimatedTokens: 0,
      elapsedMs,
      toolCalls: 0,
      supplementalRounds: 0,
    },
  );
}
const frame = (content: string) =>
  `data: ${JSON.stringify({ model: 'gpt-5.4', choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`;
const terminal =
  'data: {"model":"gpt-5.4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n' +
  'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\n' +
  'data: [DONE]\n\n';
const response = () => new Response(frame('OK') + terminal);

async function collect(stream: AsyncGenerator<StreamChunk>) {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

describe('Harness Solve stream with the real OpenAI transport', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let service: LLMService;
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    service = new LLMService(config, new OpenAIProvider(config));
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('allows a 31-second completion inside the unchanged 120-second Run', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            setTimeout(() => {
              controller.enqueue(
                new TextEncoder().encode(frame('OK') + terminal),
              );
              controller.close();
            }, 31000);
          },
        }),
      ),
    );
    const runBudget = budget();
    const pending = collect(
      service.callStream('synthetic', [], {
        taskType: 'agent.solve',
        runBudget,
        maxTokens: 512,
      }),
    );
    await jest.advanceTimersByTimeAsync(31001);
    const chunks = await pending;
    expect(chunks).toEqual([
      { type: 'content', content: 'OK' },
      { type: 'done' },
    ]);
    expect(runBudget.snapshot(0, 0).estimatedTokens).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a pre-output transport failure once without refunding unknown usage', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('PRIVATE_ERROR'))
      .mockResolvedValueOnce(response());
    const runBudget = budget();
    const chunks = await collect(
      service.callStream('synthetic', [], {
        taskType: 'agent.solve',
        runBudget,
        maxTokens: 512,
      }),
    );
    expect(chunks).toEqual([
      { type: 'content', content: 'OK' },
      { type: 'done' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(runBudget.snapshot(0, 0).estimatedTokens).toBe(2 + 512 + 5);
  });

  it('keeps the full reservation when an attempt fails and retry cannot fit', async () => {
    fetchMock.mockRejectedValue(new TypeError('PRIVATE_ERROR'));
    const runBudget = budget(700);
    const chunks = await collect(
      service.callStream('synthetic', [], {
        taskType: 'agent.solve',
        runBudget,
        maxTokens: 512,
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runBudget.snapshot(0, 0).estimatedTokens).toBe(2 + 512);
    expect(chunks.some((c) => c.type === 'done')).toBe(false);
  });

  it.each([401, 403, 429, 400])('never retries HTTP %i', async (status) => {
    fetchMock.mockResolvedValue(new Response('PRIVATE_BODY', { status }));
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const chunks = await collect(
      service.callStream('PRIVATE_PROMPT', [], {
        taskType: 'agent.solve',
        runBudget: budget(),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(chunks).toEqual([{ type: 'error', error: expect.any(String) }]);
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE');
  });

  it('retries a server failure once and never repeats tools', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(response());
    const chunks = await collect(
      service.callStream('synthetic', [], {
        taskType: 'agent.revise',
        runBudget: budget(),
      }),
    );
    expect(chunks.at(-1)?.type).toBe('done');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls)
      expect(JSON.parse(init.body).tools).toBeUndefined();
  });

  it('does not shorten a server Retry-After instruction', async () => {
    fetchMock.mockResolvedValue(
      new Response('', { status: 503, headers: { 'retry-after': '60' } }),
    );
    const chunks = await collect(
      service.callStream('synthetic', [], {
        taskType: 'agent.solve',
        runBudget: budget(),
      }),
    );
    expect(chunks.at(-1)?.type).toBe('error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('respects an explicit call deadline without retrying the expired stage', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ start() {} })),
    );
    const pending = collect(
      service.callStream('synthetic', [], {
        taskType: 'agent.solve',
        runBudget: budget(),
        timeoutMs: 20,
      }),
    );
    await jest.advanceTimersByTimeAsync(21);
    expect((await pending).some((c) => c.type === 'done')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('uses only the remaining Run time, including previous active time', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ start() {} })),
    );
    const pending = collect(
      service.callStream('synthetic', [], {
        taskType: 'agent.solve',
        runBudget: budget(24000, 119980),
      }),
    );
    await jest.advanceTimersByTimeAsync(21);
    expect((await pending).at(-1)).toEqual({
      type: 'error',
      error: 'AGENT_DURATION_BUDGET_EXCEEDED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('does not override a shorter Provider cap', async () => {
    jest.useFakeTimers();
    const cappedConfig = {
      get: (key: string, fallback?: unknown) =>
        key === 'AI_REQUEST_TIMEOUT_MS' ? 20 : config.get(key, fallback),
    } as ConfigService;
    service = new LLMService(cappedConfig, new OpenAIProvider(cappedConfig));
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ start() {} })),
    );
    const pending = collect(
      service.callStream('synthetic', [], {
        taskType: 'agent.solve',
        runBudget: budget(),
      }),
    );
    await jest.advanceTimersByTimeAsync(21);
    expect((await pending).some((c) => c.type === 'done')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not restart after partial content and reports only safe transport counts', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    let reads = 0;
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          pull(controller) {
            if (reads++ === 0)
              controller.enqueue(
                new TextEncoder().encode(frame('PRIVATE_CONTENT')),
              );
            else controller.error(new Error('PRIVATE_ERROR'));
          },
        }),
      ),
    );
    const chunks = await collect(
      service.callStream('PRIVATE_PROMPT', [], {
        taskType: 'agent.solve',
        runBudget: budget(),
      }),
    );
    expect(chunks[0]).toEqual({ type: 'content', content: 'PRIVATE_CONTENT' });
    expect(chunks.at(-1)?.type).toBe('error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE');
    const evidence = JSON.parse(
      log.mock.calls[0][0].slice('Harness stream '.length),
    );
    expect(evidence).toMatchObject({
      outcome: 'failed',
      outputBytes: 15,
      transport: { phase: 'read', reason: 'transport', emittedBytes: 15 },
    });
  });

  it.each(['bad-json', 'model-mismatch', 'missing-terminal'])(
    'does not retry %s',
    async (kind) => {
      const body =
        kind === 'bad-json'
          ? 'data: broken\n\n'
          : kind === 'model-mismatch'
            ? frame('OK').replace('gpt-5.4', 'wrong-model')
            : frame('OK');
      fetchMock.mockResolvedValue(new Response(body));
      const chunks = await collect(
        service.callStream('synthetic', [], {
          taskType: 'agent.solve',
          runBudget: budget(),
        }),
      );
      expect(chunks.at(-1)?.type).toBe('error');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('delivers a complete answer that overruns on final usage, then fails closed', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    fetchMock.mockResolvedValue(
      new Response(
        frame('OK') +
          terminal
            .replace('"prompt_tokens":3', '"prompt_tokens":24000')
            .replace('"total_tokens":5', '"total_tokens":24002'),
      ),
    );
    const runBudget = budget();
    const chunks = await collect(
      service.callStream('synthetic', [], {
        taskType: 'agent.solve',
        runBudget,
      }),
    );
    // The provider was already billed and the client already holds the text.
    expect(chunks).toContainEqual({ type: 'content', content: 'OK' });
    expect(chunks.at(-1)?.type).toBe('done');
    expect(chunks.some((c) => c.type === 'error')).toBe(false);
    // The overage is recorded, so nothing further in the Run can spend.
    expect(runBudget.remainingTokens()).toBe(0);
    expect(() => runBudget.reserveLlmCall('synthetic', [], 512)).toThrow(
      'AGENT_TOKEN_BUDGET_EXCEEDED',
    );
    expect(
      JSON.parse(log.mock.calls[0][0].slice('Harness stream '.length)),
    ).toMatchObject({
      outcome: 'complete',
      reasonCode: 'AGENT_TOKEN_BUDGET_EXCEEDED',
      // The overrun is only actionable next to what the input cost.
      inputTokens: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves the default 30-second legacy path unchanged without a Run budget', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ start() {} })),
    );
    const pending = collect(
      service.callStream('synthetic', [], { taskType: 'agent.solve' }),
    );
    await jest.advanceTimersByTimeAsync(30001);
    expect((await pending).some((c) => c.type === 'done')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
