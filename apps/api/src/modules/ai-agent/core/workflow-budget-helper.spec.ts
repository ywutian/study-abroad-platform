import { AgentRunBudgetTracker } from './agent-run-context';
import { withSupplementalBudget, VERIFY_RESERVE } from './workflow-budget';
import { countTokens } from './token-estimate';

const limits = {
  version: 1 as const,
  maxTokens: 10000,
  maxToolCalls: 16,
  maxSupplementalRounds: 2,
  maxDurationMs: 120000,
};

// Derived, not pinned: the hold is the Solve input plus its requested output,
// so the numbers move with the token count rather than with a char heuristic.
const SOLVE_PROMPT = 'x'.repeat(3000);
const SOLVE_HOLD = countTokens(SOLVE_PROMPT) + 4000;

describe('Supplemental planning reservation', () => {
  it.each([false, true])(
    'releases the exact hold after error=%s',
    async (failure) => {
      const budget = new AgentRunBudgetTracker(limits);
      const observe = jest.fn();
      const execute = withSupplementalBudget({
        budget,
        solvePrompt: SOLVE_PROMPT,
        replanPrompt: 'x'.repeat(1500),
        messages: [],
        tools: [],
        maxTokens: 4000,
        observe,
        call: async (maxTokens) => {
          expect(budget.remainingTokens()).toBe(limits.maxTokens - SOLVE_HOLD);
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
          solveReservedTokens: SOLVE_HOLD,
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
      solvePrompt: SOLVE_PROMPT,
      replanPrompt: '',
      messages: [],
      tools,
      maxTokens: 4000,
      observe,
      call,
    });
    const schema = countTokens(JSON.stringify(tools));
    expect(result).toBe(6000 - SOLVE_HOLD - schema);
    expect(result).toBeLessThan(4000);
    expect(result).toBeGreaterThanOrEqual(256);
    expect(budget.remainingTokens()).toBe(6000);
    expect(observe.mock.calls[0][0].replanInputTokens).toBe(schema);
  });

  // The reserve is only visible when the remaining budget binds, not the
  // maxTokens cap — sizing these from SOLVE_HOLD keeps that true if either moves.
  it('holds verification budget back from optional planning', async () => {
    const headroom = 3000; // below the 4000 cap, so the subtraction shows
    const budget = new AgentRunBudgetTracker({
      ...limits,
      maxTokens: SOLVE_HOLD + headroom,
    });
    const observe = jest.fn();
    const call = jest.fn(async (maxTokens: number) => maxTokens);
    const run = (verifyReserveTokens: number) =>
      withSupplementalBudget({
        budget,
        solvePrompt: SOLVE_PROMPT,
        replanPrompt: '',
        messages: [],
        tools: [],
        maxTokens: 4000,
        verifyReserveTokens,
        observe,
        call,
      });

    expect(await run(0)).toBe(headroom);
    expect(await run(VERIFY_RESERVE)).toBe(headroom - VERIFY_RESERVE);
    expect(observe).toHaveBeenLastCalledWith(
      expect.objectContaining({
        decision: 'allow',
        verifyReservedTokens: VERIFY_RESERVE,
      }),
    );
    // The hold is released either way, so the reserve cannot leak between runs.
    expect(budget.remainingTokens()).toBe(SOLVE_HOLD + headroom);
  });

  it('skips the round that would have eaten the verification budget', async () => {
    // Room for a round without the reserve, not enough once it is held back.
    const headroom = VERIFY_RESERVE + 100;
    const budget = new AgentRunBudgetTracker({
      ...limits,
      maxTokens: SOLVE_HOLD + headroom,
    });
    const observe = jest.fn();
    const call = jest.fn(async (maxTokens: number) => maxTokens);
    const run = (verifyReserveTokens: number) =>
      withSupplementalBudget({
        budget,
        solvePrompt: SOLVE_PROMPT,
        replanPrompt: '',
        messages: [],
        tools: [],
        maxTokens: 4000,
        verifyReserveTokens,
        observe,
        call,
      });

    expect(await run(0)).toBe(headroom); // this is what used to happen
    expect(await run(VERIFY_RESERVE)).toBeUndefined();
    expect(observe).toHaveBeenLastCalledWith(
      expect.objectContaining({ decision: 'skip_for_solve' }),
    );
    // What the skipped round leaves behind is what verification needs.
    expect(budget.remainingTokens()).toBeGreaterThanOrEqual(VERIFY_RESERVE);
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
