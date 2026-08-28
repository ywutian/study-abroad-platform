import { AgentRunBudgetTracker } from './agent-run-context';
import { withSupplementalBudget } from './workflow-budget';

const limits = {
  version: 1 as const,
  maxTokens: 10000,
  maxToolCalls: 16,
  maxSupplementalRounds: 2,
  maxDurationMs: 120000,
};

describe('Supplemental planning reservation', () => {
  it.each([false, true])(
    'releases the exact hold after error=%s',
    async (failure) => {
      const budget = new AgentRunBudgetTracker(limits);
      const observe = jest.fn();
      const execute = withSupplementalBudget({
        budget,
        solvePrompt: 'x'.repeat(3000),
        replanPrompt: 'x'.repeat(1500),
        messages: [],
        tools: [],
        maxTokens: 4000,
        observe,
        call: async (maxTokens) => {
          expect(budget.remainingTokens()).toBe(5000);
          expect(maxTokens).toBe(4000);
          const r = budget.reserveLlmCall('x'.repeat(1500), [], maxTokens);
          budget.settleLlmCall(r, 'answer', { totalTokens: 600 });
          if (failure) throw new Error('synthetic provider failure');
          return 'plan';
        },
      });
      if (failure)
        await expect(execute).rejects.toThrow('synthetic provider failure');
      else await expect(execute).resolves.toBe('plan');
      expect(budget.remainingTokens()).toBe(9400);
      expect(budget.snapshot(0, 0).estimatedTokens).toBe(600);
      expect(observe).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'replan',
          decision: 'allow',
          solveReservedTokens: 5000,
        }),
      );
    },
  );

  it('includes the tool schema and caps the optional call without losing the Solve hold', async () => {
    const budget = new AgentRunBudgetTracker({ ...limits, maxTokens: 6000 });
    const observe = jest.fn();
    const call = jest.fn(async (maxTokens: number) => maxTokens);
    const tools = [
      {
        name: 'synthetic',
        description: 'x'.repeat(1800),
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];
    const result = await withSupplementalBudget({
      budget,
      solvePrompt: 'x'.repeat(3000),
      replanPrompt: '',
      messages: [],
      tools,
      maxTokens: 4000,
      observe,
      call,
    });
    expect(result).toBeLessThan(400);
    expect(result).toBeGreaterThanOrEqual(256);
    expect(budget.remainingTokens()).toBe(6000);
    expect(observe.mock.calls[0][0].replanInputTokens).toBeGreaterThan(600);
  });

  it('does not run when another concurrent hold leaves insufficient room', async () => {
    const budget = new AgentRunBudgetTracker(limits);
    const release = budget.holdTokensForLater(7000);
    const call = jest.fn();
    await expect(
      withSupplementalBudget({
        budget,
        solvePrompt: '',
        replanPrompt: '',
        messages: [],
        tools: [],
        maxTokens: 4000,
        observe: jest.fn(),
        call,
      }),
    ).resolves.toBeUndefined();
    expect(call).not.toHaveBeenCalled();
    expect(budget.remainingTokens()).toBe(3000);
    release();
    expect(budget.remainingTokens()).toBe(10000);
  });

  it('does not swallow an expired run budget', async () => {
    const budget = new AgentRunBudgetTracker(limits, {
      version: 1,
      estimatedTokens: 0,
      elapsedMs: 120001,
      toolCalls: 0,
      supplementalRounds: 0,
    });
    const call = jest.fn();
    await expect(
      withSupplementalBudget({
        budget,
        solvePrompt: '',
        replanPrompt: '',
        messages: [],
        tools: [],
        maxTokens: 4000,
        observe: jest.fn(),
        call,
      }),
    ).rejects.toThrow('AGENT_DURATION_BUDGET_EXCEEDED');
    expect(call).not.toHaveBeenCalled();
  });
});
