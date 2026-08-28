import { ConfigService } from '@nestjs/config';
import { AGENT_CONFIGS } from '../config/agents.config';
import { TOOLS } from '../config/tools.config';
import { AGENT_SEMANTIC_EVAL_CASES } from '../semantic-eval/agent-semantic-eval.dataset';
import { AgentType, type ConversationState } from '../types';
import { PrismaService } from '../../../prisma/prisma.service';
import { MemoryService } from './memory.service';
import { ToolPolicyService } from './tool-policy.service';
import type { LLMOptions, LLMResponse, StreamChunk } from './llm.service';
import {
  WorkflowEngineService,
  type WorkflowLlmClient,
  type WorkflowStreamEvent,
} from './workflow-engine.service';

const school = AGENT_CONFIGS[AgentType.SCHOOL];
const tools = TOOLS.filter((tool) => school.tools.includes(tool.name));

function fixture(
  options: {
    evidenceChars?: number;
    stream?: 'error' | 'partial-error' | 'missing-done' | 'partial-missing';
    budget?: number;
    enabled?: boolean;
  } = {},
) {
  const conversation: ConversationState = {
    id: 'synthetic-conversation',
    userId: 'synthetic-user',
    context: { userId: 'synthetic-user' },
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: { locale: 'zh' },
    messages: [
      {
        id: 'synthetic-message',
        role: 'user',
        timestamp: new Date(),
        content: AGENT_SEMANTIC_EVAL_CASES.find(
          (c) => c.id === 'route-school-compare-v1',
        )!.input,
      },
    ],
  };
  const config = new ConfigService({
    AI_AGENT_HARNESS_V1: options.enabled === false ? 'false' : 'true',
    AI_AGENT_CONTEXT_V1: 'true',
    AI_AGENT_HARNESS_MODE: 'advisory',
    AI_AGENT_MAX_TOKENS_PER_RUN: options.budget ?? 24000,
  });
  // Real message projection and budget accounting, synthetic provider/tool data.
  const memory = new MemoryService({} as PrismaService);
  const charges: Array<{ phase: string; input: number; total: number }> = [];
  const charge = (
    system: string,
    messages: ConversationState['messages'],
    opts: LLMOptions,
  ) => {
    const tracker = opts.runBudget;
    if (!tracker) return;
    const reservation = tracker.reserveLlmCall(
      system,
      messages,
      opts.maxTokens ?? 4000,
    );
    tracker.settleLlmCall(reservation, 'synthetic answer', {
      totalTokens: reservation.inputTokens + 100,
    });
    charges.push({
      phase: opts.taskType ?? 'unknown',
      input: reservation.inputTokens,
      total: tracker.snapshot(0, 0).estimatedTokens,
    });
  };
  const call = jest.fn<
    ReturnType<WorkflowLlmClient['call']>,
    Parameters<WorkflowLlmClient['call']>
  >(async (system, messages, opts = {}): Promise<LLMResponse> => {
    charge(system, messages, opts);
    if (opts.taskType === 'agent.plan')
      return {
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'synthetic-tool',
            name: 'compare_schools',
            arguments: { schoolIds: ['synthetic-a', 'synthetic-b'] },
          },
        ],
      };
    return {
      content: opts.taskType === 'agent.verify' ? '{"facts":[]}' : '',
      finishReason: 'stop',
    };
  });
  const callStream = jest.fn<
    ReturnType<WorkflowLlmClient['callStream']>,
    Parameters<WorkflowLlmClient['callStream']>
  >(async function* (system, messages, opts = {}): AsyncGenerator<StreamChunk> {
    charge(system, messages, opts);
    if (options.stream?.startsWith('partial'))
      yield { type: 'content', content: 'unfinished' };
    if (options.stream?.endsWith('error')) {
      yield { type: 'error', error: 'synthetic-private-provider-detail' };
      return;
    }
    if (options.stream?.includes('missing')) return;
    yield {
      type: 'content',
      content: 'Synthetic comparison with source-backed limitations.',
    };
    yield { type: 'done' };
  });
  const execute = jest.fn().mockResolvedValue({
    success: true,
    duration: 1,
    result: {
      comparison: [
        {
          name: 'Synthetic A',
          source: 'https://example.invalid/source',
          evidence: 'x'.repeat(options.evidenceChars ?? 0),
        },
      ],
    },
  });
  const service = new WorkflowEngineService(
    { call, callStream },
    { execute },
    memory,
    undefined,
    undefined,
    undefined,
    new ToolPolicyService(),
    config,
  );
  return { service, call, callStream, execute, conversation, charges };
}

async function collect(f: ReturnType<typeof fixture>, reflection = false) {
  const events: WorkflowStreamEvent[] = [];
  for await (const event of f.service.runStream(
    AgentType.SCHOOL,
    { ...school, enableReflection: reflection },
    f.conversation,
    tools,
  ))
    events.push(event);
  return events;
}

describe('Workflow budget scheduling with real accounting', () => {
  it.each([false, true])(
    'preserves Solve budget for large evidence (reflection=%s)',
    async (reflection) => {
      const f = fixture({ evidenceChars: 42000 });
      const events = await collect(f, reflection);
      expect(events.filter((e) => e.type === 'error')).toEqual([]);
      const result = events.find((e) => e.type === 'done')?.result;
      expect(result?.message).toContain('Synthetic comparison');
      expect(result?.usage?.estimatedTokens).toBeLessThanOrEqual(24000);
      expect(result?.usage?.supplementalRounds).toBe(0);
      expect(f.charges.map((entry) => entry.phase)).toEqual(
        reflection
          ? ['agent.plan', 'agent.solve', 'agent.verify']
          : ['agent.plan', 'agent.solve'],
      );
      expect(f.charges.at(-1)?.total).toBeLessThan(17000);
      expect(
        f.call.mock.calls.filter(([, , o]) => o?.taskType === 'agent.replan'),
      ).toHaveLength(0);
      expect(f.execute).toHaveBeenCalledTimes(1);
      expect(
        f.conversation.messages.find((m) => m.role === 'tool')?.content,
      ).toContain('x'.repeat(42000));
      expect(
        f.callStream.mock.calls[0][1].find((m) => m.role === 'tool')?.content,
      ).toContain('https://example.invalid/source');
    },
  );

  it('retains optional planning when evidence fits', async () => {
    const f = fixture();
    const events = await collect(f);
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(
      f.call.mock.calls.filter(([, , o]) => o?.taskType === 'agent.replan'),
    ).toHaveLength(1);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it('marks optional verification as unverified when only Solve fits', async () => {
    const f = fixture({ evidenceChars: 66000 });
    const events = await collect(f, true);
    expect(events.some((e) => e.type === 'error')).toBe(false);
    const result = events.find((e) => e.type === 'done')?.result;
    expect(result?.message).toContain('部分事实尚未完成独立核验');
    expect(result?.usage?.estimatedTokens).toBeLessThanOrEqual(24000);
    expect(
      f.call.mock.calls.some(([, , o]) => o?.taskType === 'agent.verify'),
    ).toBe(false);
  });

  it('still permits two bounded supplemental rounds with sufficient budget', async () => {
    const f = fixture();
    const original = f.call.getMockImplementation()!;
    let rounds = 0;
    f.call.mockImplementation(async (prompt, messages, opts) => {
      const result = await original(prompt, messages, opts);
      if (opts?.taskType !== 'agent.replan') return result;
      rounds += 1;
      return {
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: `synthetic-extra-${rounds}`,
            name: 'compare_schools',
            arguments: { schoolIds: [`synthetic-extra-${rounds}`] },
          },
        ],
      };
    });
    const events = await collect(f);
    const result = events.find((e) => e.type === 'done')?.result;
    expect(result?.usage?.supplementalRounds).toBe(2);
    expect(result?.usage?.estimatedTokens).toBeLessThanOrEqual(24000);
    expect(f.execute).toHaveBeenCalledTimes(3);
    expect(rounds).toBe(2);
  });

  it('rejects a low-budget initial plan before any tool executes', async () => {
    const f = fixture({ budget: 700 });
    const events = await collect(f);
    expect(events.find((e) => e.type === 'error')?.error).toBe(
      'AGENT_TOKEN_BUDGET_EXCEEDED',
    );
    expect(events.some((e) => e.type === 'done')).toBe(false);
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.callStream).not.toHaveBeenCalled();
  });

  it.each([
    'error',
    'partial-error',
    'missing-done',
    'partial-missing',
  ] as const)(
    'fails closed for %s without replaying the solve or tools',
    async (stream) => {
      const f = fixture({ stream });
      const events = await collect(f);
      expect(events.some((e) => e.type === 'done')).toBe(false);
      expect(events.find((e) => e.type === 'error')?.error).toMatch(
        /^AGENT_STREAM_(FAILED|INCOMPLETE)$/,
      );
      expect(JSON.stringify(events)).not.toContain(
        'synthetic-private-provider-detail',
      );
      expect(f.callStream).toHaveBeenCalledTimes(1);
      expect(
        f.call.mock.calls.filter(([, , o]) => o?.taskType === 'agent.solve'),
      ).toHaveLength(0);
      expect(f.execute).toHaveBeenCalledTimes(1);
    },
  );

  it('still rejects a task when Solve itself cannot fit', async () => {
    const f = fixture({ evidenceChars: 90000 });
    const events = await collect(f);
    expect(events.some((e) => e.type === 'done')).toBe(false);
    expect(events.find((e) => e.type === 'error')?.error).toBe(
      'AGENT_TOKEN_BUDGET_EXCEEDED',
    );
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it('leaves the legacy flag-off path unchanged', async () => {
    const f = fixture({ enabled: false, stream: 'partial-error' });
    const events = await collect(f);
    expect(events.find((e) => e.type === 'done')?.result?.message).toBe(
      'unfinished',
    );
    expect(f.call.mock.calls.every(([, , o]) => !o?.runBudget)).toBe(true);
  });
});
