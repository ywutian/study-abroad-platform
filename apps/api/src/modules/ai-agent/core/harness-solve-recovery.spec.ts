import type { ILLMProvider } from '../providers/llm-provider.interface';
import {
  LLMChatRequest,
  LLMErrorCode,
  LLMProviderError,
  LLMStreamChunk,
} from '../providers/llm-provider.types';
import { AgentRunBudgetTracker } from './agent-run-context';
import { harnessSolveStream, isHarnessSolve } from './harness-solve-stream';

const request: LLMChatRequest = {
  model: 'gpt-5.4',
  systemPrompt: 'synthetic',
  messages: [],
  maxTokens: 512,
  timeoutMs: 120000,
};
const transient = () =>
  new LLMProviderError('PRIVATE_ERROR', LLMErrorCode.NETWORK_ERROR, true);
const done: LLMStreamChunk = {
  type: 'done',
  usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
};
async function collect(stream: AsyncGenerator<LLMStreamChunk>) {
  const chunks: LLMStreamChunk[] = [];
  try {
    for await (const c of stream) chunks.push(c);
  } catch (error) {
    chunks.push({ type: 'error', error: (error as Error).message });
  }
  return chunks;
}

describe('Tool-free Solve recovery boundaries', () => {
  let provider: jest.Mocked<ILLMProvider>;
  let budget: AgentRunBudgetTracker;
  let observe: jest.Mock;
  beforeEach(() => {
    provider = {
      providerId: 'openai',
      chat: jest.fn(),
      chatStream: jest.fn(),
      supportsModel: jest.fn(),
      getContextWindow: jest.fn(),
    };
    budget = new AgentRunBudgetTracker({
      version: 1,
      maxTokens: 24000,
      maxDurationMs: 120000,
      maxToolCalls: 16,
      maxSupplementalRounds: 2,
    });
    observe = jest.fn();
  });
  afterEach(() => jest.useRealTimers());
  const stream = () =>
    harnessSolveStream({
      provider,
      request,
      budget,
      observe,
      phase: 'agent.solve',
    });

  it('does not enable recovery for legacy, tool-bearing, non-Solve or other providers', () => {
    expect(isHarnessSolve(provider, { taskType: 'agent.solve' })).toBe(false);
    expect(
      isHarnessSolve(provider, { taskType: 'agent.verify', runBudget: budget }),
    ).toBe(false);
    expect(
      isHarnessSolve(
        { ...provider, providerId: 'anthropic' },
        { taskType: 'agent.solve', runBudget: budget },
      ),
    ).toBe(false);
    expect(
      isHarnessSolve(provider, {
        taskType: 'agent.solve',
        runBudget: budget,
        tools: [
          {
            name: 'synthetic',
            description: 'synthetic',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        ],
      }),
    ).toBe(false);
    expect(
      isHarnessSolve(provider, { taskType: 'agent.solve', runBudget: budget }),
    ).toBe(true);
  });

  it('attempts at most twice and conservatively retains both failed reservations', async () => {
    provider.chatStream.mockImplementation(async function* () {
      yield* [];
      throw transient();
    });
    expect((await collect(stream())).at(-1)).toEqual({
      type: 'error',
      error: 'NETWORK_ERROR',
    });
    expect(provider.chatStream).toHaveBeenCalledTimes(2);
    // Two fully retained reservations: countTokens('synthetic') + maxTokens.
    expect(budget.snapshot(0, 0).estimatedTokens).toBe(2 * (2 + 512));
    expect(JSON.stringify(observe.mock.calls)).not.toContain('PRIVATE');
  });

  it('keeps the same deadline, model and inputs across attempts', async () => {
    jest.useFakeTimers();
    provider.chatStream
      .mockImplementationOnce(async function* () {
        yield* [];
        await new Promise((r) => setTimeout(r, 5000));
        throw transient();
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'content', content: 'OK' };
        yield done;
      });
    const pending = collect(
      harnessSolveStream({
        provider,
        request: { ...request, timeoutMs: 10000 },
        budget,
        observe,
        phase: 'agent.solve',
      }),
    );
    await jest.advanceTimersByTimeAsync(5251);
    expect((await pending).at(-1)?.type).toBe('done');
    expect(provider.chatStream.mock.calls.map(([r]) => r.timeoutMs)).toEqual([
      10000, 4750,
    ]);
    for (const [r] of provider.chatStream.mock.calls)
      expect(r).toMatchObject({
        model: request.model,
        systemPrompt: request.systemPrompt,
        messages: request.messages,
      });
  });

  it('does not begin after the Run deadline', async () => {
    jest.useFakeTimers();
    await jest.advanceTimersByTimeAsync(120001);
    expect((await collect(stream())).at(-1)).toEqual({
      type: 'error',
      error: 'AGENT_DURATION_BUDGET_EXCEEDED',
    });
    expect(provider.chatStream).not.toHaveBeenCalled();
    expect(budget.snapshot(0, 0).estimatedTokens).toBe(0);
  });

  it.each(['tool_call_start', 'tool_call_delta', 'tool_call_end'] as const)(
    'does not retry or expose unexpected %s',
    async (type) => {
      provider.chatStream.mockImplementation(async function* () {
        yield { type, toolCall: { name: 'PRIVATE_TOOL' } };
        throw transient();
      });
      const chunks = await collect(stream());
      expect(chunks).toEqual([{ type: 'error', error: 'AGENT_STREAM_FAILED' }]);
      expect(provider.chatStream).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(observe.mock.calls)).not.toContain('PRIVATE');
    },
  );

  it.each([
    LLMErrorCode.AUTHENTICATION,
    LLMErrorCode.RATE_LIMIT,
    LLMErrorCode.MODEL_MISMATCH,
    LLMErrorCode.INVALID_RESPONSE,
    LLMErrorCode.CONTENT_FILTER,
  ])('never retries %s even if marked retryable', async (code) => {
    provider.chatStream.mockImplementation(async function* () {
      yield* [];
      throw new LLMProviderError('PRIVATE', code, true);
    });
    expect((await collect(stream())).at(-1)).toEqual({
      type: 'error',
      error: code,
    });
    expect(provider.chatStream).toHaveBeenCalledTimes(1);
  });

  it('does not retry untyped or error-chunk failures', async () => {
    for (const source of [
      async function* (): AsyncGenerator<LLMStreamChunk> {
        yield* [];
        throw new Error('PRIVATE');
      },
      async function* (): AsyncGenerator<LLMStreamChunk> {
        yield { type: 'error', error: 'NETWORK_ERROR' };
      },
    ]) {
      provider.chatStream.mockReset().mockImplementation(source);
      expect((await collect(stream())).at(-1)).toEqual({
        type: 'error',
        error: 'AGENT_STREAM_FAILED',
      });
      expect(provider.chatStream).toHaveBeenCalledTimes(1);
    }
  });

  it('does not expose done or retry if the source fails after done', async () => {
    provider.chatStream.mockImplementation(async function* () {
      yield done;
      throw transient();
    });
    const chunks = await collect(stream());
    expect(chunks).toEqual([{ type: 'error', error: 'NETWORK_ERROR' }]);
    expect(provider.chatStream).toHaveBeenCalledTimes(1);
  });

  it('treats missing terminal as nonretryable', async () => {
    provider.chatStream.mockImplementation(async function* () {});
    expect((await collect(stream())).at(-1)).toEqual({
      type: 'error',
      error: 'AGENT_STREAM_INCOMPLETE',
    });
    expect(provider.chatStream).toHaveBeenCalledTimes(1);
  });

  it('closes the source and keeps the reservation on consumer cancellation', async () => {
    const closed = jest.fn();
    provider.chatStream.mockImplementation(async function* () {
      try {
        yield { type: 'content', content: 'OK' };
        yield done;
      } finally {
        closed();
      }
    });
    const source = stream();
    await source.next();
    await source.return(undefined);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(provider.chatStream).toHaveBeenCalledTimes(1);
    expect(budget.snapshot(0, 0).estimatedTokens).toBe(2 + 512);
    expect(observe).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'cancelled' }),
    );
  });

  it('projects diagnostics instead of logging arbitrary error details', async () => {
    const diagnostic = {
      phase: 'read' as const,
      reason: 'deadline' as const,
      elapsedMs: 10,
      receivedBytes: 20,
      emittedBytes: 0,
      firstByteMs: 1,
      private: 'PRIVATE_EXTRA',
    };
    provider.chatStream.mockImplementation(async function* () {
      yield* [];
      throw new LLMProviderError(
        'PRIVATE_MESSAGE',
        LLMErrorCode.NETWORK_ERROR,
        true,
        undefined,
        { private: 'PRIVATE_DETAILS' },
        diagnostic,
      );
    });
    await collect(stream());
    expect(provider.chatStream).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(observe.mock.calls)).not.toContain('PRIVATE');
    expect(observe.mock.calls[0][0].transport).toEqual({
      phase: 'read',
      reason: 'deadline',
      elapsedMs: 10,
      receivedBytes: 20,
      emittedBytes: 0,
      firstByteMs: 1,
    });
  });
});
