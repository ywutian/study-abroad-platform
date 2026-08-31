import { ConfigService } from '@nestjs/config';
import { ModelRouterService } from './model-router.service';
import { routingFixture, ROUTING_CASES } from './model-routing.fixtures';
import {
  configuredRoutingSnapshot,
  parseRoutingSnapshot,
  routingPolicySchema,
} from './model-routing.policy';
import {
  LLMProviderError,
  LLMErrorCode,
  LLMChatRequest,
  LLMStreamChunk,
} from '../providers/llm-provider.types';
import { AgentRunBudgetTracker } from '../core/agent-run-context';
import { buildRunCheckpoint } from '../core/workflow-result-builder';
import {
  isAgentRunCheckpoint,
  AgentRunCheckpointV2,
} from '../core/agent-run-state';
import { AgentType, ConversationState } from '../types';
import { readPersistedRunBudget } from '../core/agent-run-settings';
import { PrismaService } from '../../../prisma/prisma.service';

const request: LLMChatRequest = {
  model: 'ignored-default',
  systemPrompt: 'Synthetic',
  messages: [{ role: 'user', content: 'Synthetic' }],
  maxTokens: 500,
};
function setup(policy = routingFixture()) {
  const values: Record<string, unknown> = {
    LLM_PROVIDER: 'openai',
    AI_AGENT_MODEL_ROUTING_V1: 'true',
    AI_AGENT_MODEL_ROUTING_CONFIG: JSON.stringify(policy),
  };
  const config = {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as ConfigService;
  const provider = {
    providerId: 'openai',
    supportsModel: () => true,
    getContextWindow: () => undefined,
    chat: jest.fn(),
    chatStream: jest.fn(),
  };
  provider.chat.mockImplementation(async (req: LLMChatRequest) => ({
    model: req.model,
    content: 'SYNTHETIC_A',
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
  }));
  const router = new ModelRouterService(config, provider);
  return { values, config, provider, router };
}

describe('Task model routing contracts', () => {
  // These are routing contracts, not CI machine-speed tests. A cold tokenizer
  // under coverage can exceed the fixture's 1s deadline before the backup.
  // Deadline tests advance the same clock explicitly below.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('rejects empty ordinary responses and records the validation fallback', async () => {
    const { router, provider } = setup();
    provider.chat.mockResolvedValueOnce({
      model: 'gpt-5.4-mini',
      content: ' ',
      finishReason: 'stop',
      usage: { totalTokens: 20 },
    });
    expect((await router.call(request, {})).routing.reason).toBe(
      'output_validation',
    );
  });
  it('does not reset the route deadline for a backup', async () => {
    const { router, provider } = setup();
    provider.chat.mockImplementationOnce(async () => {
      jest.advanceTimersByTime(routingFixture().routes.general!.timeoutMs + 1);
      throw new LLMProviderError('PRIVATE', LLMErrorCode.NETWORK_ERROR, true);
    });
    await expect(router.call(request, {})).rejects.toThrow('DEADLINE_EXCEEDED');
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });
  it('shares a reservation across concurrent calls and rejects budget fan-out', async () => {
    const { router, provider } = setup();
    const frozen = router.createBudget()!.limits;
    const budget = new AgentRunBudgetTracker({ ...frozen, maxTokens: 700 });
    await Promise.allSettled([
      router.call(request, { runBudget: budget }),
      router.call(request, { runBudget: budget }),
    ]);
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });
  it('allows streaming fallback only before visible output, with a truthful reason', async () => {
    const { router, provider } = setup();
    provider.chatStream.mockImplementation(async function* (
      req: LLMChatRequest,
    ) {
      if (req.model === 'gpt-5.5') yield { type: 'content', content: 'OK' };
      yield {
        type: 'done',
        model: req.model,
        finishReason: 'stop',
        usage: { totalTokens: 20 },
      };
    });
    const chunks = [];
    for await (const chunk of router.stream(request, {})) chunks.push(chunk);
    expect(chunks.at(-1)?.routing?.reason).toBe('output_validation');
    expect(provider.chatStream).toHaveBeenCalledTimes(2);
  });
  it('never retries a streaming content filter refusal', async () => {
    const { router, provider } = setup();
    provider.chatStream.mockImplementation(async function* (
      req: LLMChatRequest,
    ) {
      yield {
        type: 'done',
        model: req.model,
        finishReason: 'content_filter',
        usage: { totalTokens: 20 },
      };
    });
    const consume = async () => {
      for await (const chunk of router.stream(request, {})) void chunk;
    };
    await expect(consume()).rejects.toThrow('CONTENT_FILTER');
    expect(provider.chatStream).toHaveBeenCalledTimes(1);
  });
  it.each(ROUTING_CASES)(
    'routes $task without trusting the supplied model',
    async ({ task, prompt, expected }) => {
      const { router, provider } = setup();
      const result = await router.call(
        { ...request, messages: [{ role: 'user', content: prompt }] },
        { taskType: task },
      );
      expect(result.response.content).toBe(expected);
      expect(result.routing.model).toBe(
        task.startsWith('analysis.') || task === 'agent.verify'
          ? 'gpt-5.5'
          : 'gpt-5.4-mini',
      );
      expect(provider.chat).toHaveBeenCalledTimes(1);
      expect(provider.chat.mock.calls[0][0].routed).toBe(true);
    },
  );
  it('uses default legacy behavior when disabled or restoring a legacy budget', () => {
    const { values, router } = setup();
    const old = new AgentRunBudgetTracker({
      version: 1,
      maxTokens: 10000,
      maxToolCalls: 16,
      maxSupplementalRounds: 2,
      maxDurationMs: 10000,
    });
    expect(router.shouldRoute(old)).toBe(false);
    values.AI_AGENT_MODEL_ROUTING_V1 = 'false';
    expect(router.shouldRoute()).toBe(false);
  });
  it.each([
    'AUTHENTICATION',
    'MODEL_MISMATCH',
    'INVALID_RESPONSE',
    'CONTENT_FILTER',
  ] as const)('does not retry safety failure %s', async (code) => {
    const { router, provider } = setup();
    provider.chat.mockRejectedValue(
      new LLMProviderError('PRIVATE', LLMErrorCode[code], true),
    );
    await expect(router.call(request, {})).rejects.toMatchObject({ code });
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });
  it('uses only the configured backup and preserves tools across retries', async () => {
    const { router, provider } = setup();
    provider.chat.mockRejectedValueOnce(
      new LLMProviderError('PRIVATE', LLMErrorCode.RATE_LIMIT, true),
    );
    const tools = [
      {
        name: 'read_school',
        description: 'Synthetic',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];
    const budget = router.createBudget()!;
    const result = await router.call(
      { ...request, tools },
      { runBudget: budget },
    );
    expect(result.routing).toMatchObject({
      model: 'gpt-5.5',
      reason: 'transient_failure',
      attempt: 2,
    });
    expect(provider.chat.mock.calls.map(([r]) => r.tools)).toEqual([
      tools,
      tools,
    ]);
    expect(budget.snapshot(0, 0).modelAttempts).toHaveLength(2);
    expect(budget.snapshot(0, 0).estimatedTokens).toBeGreaterThan(500);
  });
  it('cannot reset the token budget when changing models', async () => {
    const { router, provider } = setup();
    const initial = router.createBudget()!;
    const budget = new AgentRunBudgetTracker({
      ...initial.limits,
      maxTokens: 520,
    });
    provider.chat.mockRejectedValue(
      new LLMProviderError('PRIVATE', LLMErrorCode.NETWORK_ERROR, true),
    );
    await expect(router.call(request, { runBudget: budget })).rejects.toThrow(
      'AGENT_TOKEN_BUDGET_EXCEEDED',
    );
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });
  it('bounds failed attempts to two and sanitizes unknown exceptions', async () => {
    const { router, provider } = setup();
    provider.chat.mockRejectedValue(
      new LLMProviderError('PRIVATE', LLMErrorCode.SERVER_ERROR, true),
    );
    await expect(router.call(request, {})).rejects.toThrow('SERVER_ERROR');
    expect(provider.chat).toHaveBeenCalledTimes(2);
    provider.chat.mockRejectedValue(new Error('PRIVATE_KEY_AND_USER_INPUT'));
    await expect(router.call(request, {})).rejects.toThrow(
      'MODEL_ROUTING_FAILED',
    );
  });
  it('upgrades on explicit trusted validation failure', async () => {
    const { router, provider } = setup();
    provider.chat.mockResolvedValueOnce({
      model: 'gpt-5.4-mini',
      content: 'bad',
      finishReason: 'stop',
      usage: { totalTokens: 20 },
    });
    const result = await router.call(request, {
      validateOutput: (r) => r.content === 'SYNTHETIC_A',
    });
    expect(result.routing.reason).toBe('output_validation');
    expect(provider.chat).toHaveBeenCalledTimes(2);
  });
  it('rejects task injection, reserved options, and insufficient capability before fetch', async () => {
    const { router, provider, values } = setup();
    await expect(
      router.call(request, { taskType: 'shell' as never }),
    ).rejects.toThrow('TASK_UNKNOWN');
    await expect(
      router.call({ ...request, providerOptions: { max_tokens: 999999 } }, {}),
    ).rejects.toThrow('OPTIONS_DENIED');
    const policy = routingFixture();
    policy.models['gpt-5.4-mini'].capabilities = ['text'];
    values.AI_AGENT_MODEL_ROUTING_CONFIG = JSON.stringify(policy);
    await expect(
      router.call(
        {
          ...request,
          providerOptions: { response_format: { type: 'json_object' } },
        },
        {},
      ),
    ).rejects.toThrow('CAPABILITY_DENIED');
    expect(provider.chat).not.toHaveBeenCalled();
  });
  it('freezes route policy in serialized checkpoints and respects revocation', async () => {
    const { router, values, provider } = setup();
    const original = router.createBudget()!;
    const checkpoint = buildRunCheckpoint({
      agentType: AgentType.ORCHESTRATOR,
      locale: 'en',
      plan: { planningContent: '', steps: [] },
      pendingStepIndex: 0,
      successfulCalls: new Set(),
      scheduledCalls: 0,
      supplementalRounds: 0,
      planMs: 0,
      executeMs: 0,
      startedAt: new Date(),
      conversation: { messages: [] } as unknown as ConversationState,
      budgetTracker: original,
      approvalState: 'waiting',
    });
    const restored = JSON.parse(
      JSON.stringify(checkpoint),
    ) as AgentRunCheckpointV2;
    expect(isAgentRunCheckpoint(restored)).toBe(true);
    for (const attempts of [
      { private: 'data' },
      [{ task: 'shell' }],
      Array(65).fill({}),
    ]) {
      expect(
        isAgentRunCheckpoint({
          ...restored,
          usage: { ...restored.usage, modelAttempts: attempts },
        }),
      ).toBe(false);
    }
    const changed = routingFixture();
    changed.routes.general!.models = ['gpt-5.5'];
    changed.revision = 'new';
    values.AI_AGENT_MODEL_ROUTING_CONFIG = JSON.stringify(changed);
    const budget = new AgentRunBudgetTracker(restored.budget, restored.usage);
    expect(
      (await router.call(request, { runBudget: budget })).routing.model,
    ).toBe('gpt-5.4-mini');
    const corrupt = JSON.parse(JSON.stringify(restored));
    corrupt.budget.routing.hash = 'wrong';
    expect(isAgentRunCheckpoint(corrupt)).toBe(false);
    delete changed.models['gpt-5.4-mini'];
    for (const route of Object.values(changed.routes))
      route.models = ['gpt-5.5'];
    values.AI_AGENT_MODEL_ROUTING_CONFIG = JSON.stringify(changed);
    await expect(router.call(request, { runBudget: budget })).rejects.toThrow(
      'CAPABILITY_DENIED',
    );
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });
  it('keeps persisted snapshots and stops pinned runs on global disable', async () => {
    const { router, values } = setup();
    const budget = router.createBudget()!;
    const prisma = {
      agentRun: {
        findFirst: jest.fn().mockResolvedValue({
          budget: JSON.parse(JSON.stringify(budget.limits)),
        }),
      },
    } as unknown as PrismaService;
    expect(await readPersistedRunBudget(prisma, 'synthetic', 'run')).toEqual(
      budget.limits,
    );
    values.AI_AGENT_MODEL_ROUTING_V1 = 'false';
    expect(router.shouldRoute(budget)).toBe(true);
    await expect(router.call(request, { runBudget: budget })).rejects.toThrow(
      'DISABLED',
    );
  });
  it('does not mix models after streaming output or release pending tools on interruption', async () => {
    const { router, provider } = setup();
    provider.chatStream.mockImplementation(async function* () {
      yield { type: 'content', content: 'partial' };
      yield {
        type: 'tool_call_end',
        toolCall: { id: '1', name: 'read_school', arguments: {} },
      };
      throw new LLMProviderError('PRIVATE', LLMErrorCode.NETWORK_ERROR, true);
    });
    const chunks: LLMStreamChunk[] = [];
    const consume = async () => {
      for await (const c of router.stream(request, {})) chunks.push(c);
    };
    await expect(consume()).rejects.toThrow('NETWORK_ERROR');
    expect(chunks).toEqual([{ type: 'content', content: 'partial' }]);
    expect(provider.chatStream).toHaveBeenCalledTimes(1);
  });
});

describe('Routing policy gate', () => {
  it.each([
    'unknown_task',
    'duplicate_model',
    'missing_model',
    'unknown_field',
    'capability',
    'three_attempts',
  ])('rejects %s', (mutation) => {
    const policy = routingFixture();
    if (mutation === 'unknown_task')
      (policy.routes as Record<string, unknown>).shell = policy.routes.general;
    if (mutation === 'duplicate_model')
      policy.routes.general!.models = ['gpt-5.5', 'gpt-5.5'];
    if (mutation === 'missing_model')
      policy.routes.general!.models = ['gpt-unavailable'];
    if (mutation === 'unknown_field')
      Object.assign(policy, { apiKey: 'synthetic' });
    if (mutation === 'capability') {
      policy.routes.general!.requires = ['tools'];
      policy.models['gpt-5.4-mini'].capabilities = ['text'];
    }
    if (mutation === 'three_attempts')
      policy.routes.general!.models = ['gpt-5.4-mini', 'gpt-5.5', 'gpt-5.4'];
    expect(routingPolicySchema.safeParse(policy).success).toBe(false);
  });
  it('rejects incomplete configuration and tampered snapshot hashes', () => {
    expect(() =>
      configuredRoutingSnapshot((key) =>
        key === 'AI_AGENT_MODEL_ROUTING_V1' ? 'true' : undefined,
      ),
    ).toThrow('CONFIG_INVALID');
    expect(() =>
      parseRoutingSnapshot({
        version: 1,
        hash: 'invalid',
        policy: routingFixture(),
      }),
    ).toThrow('SNAPSHOT_INVALID');
  });
});
