import type { Message } from '../types';
import {
  AgentRunBudgetTracker,
  buildAgentRunContextSummary,
} from './agent-run-context';

const budget = {
  version: 1 as const,
  maxTokens: 1000,
  maxToolCalls: 16,
  maxSupplementalRounds: 2,
  maxDurationMs: 10000,
};

describe('Agent run context boundaries', () => {
  it('records provider input/output separately from the request limit and hold', () => {
    const tracker = new AgentRunBudgetTracker({ ...budget, maxTokens: 24000 });
    const release = tracker.holdTokensForLater(2226);
    const reservation = tracker.reserveLlmCall('synthetic', [], 500);
    tracker.settleLlmCall(
      reservation,
      'private-output',
      {
        promptTokens: 3100,
        completionTokens: 463,
        totalTokens: 3563,
      },
      'agent.verify',
    );
    release();
    expect(tracker.snapshot(0, 0).budgetCalls).toEqual([
      {
        phase: 'agent.verify',
        estimatedInputTokens: reservation.inputTokens,
        outputLimitTokens: 500,
        heldTokens: 2226,
        reportedInputTokens: 3100,
        reportedOutputTokens: 463,
        reportedTotalTokens: 3563,
      },
    ]);
    expect(tracker.remainingTokens()).toBe(24000 - 3563);
    expect(JSON.stringify(tracker.snapshot(0, 0))).not.toContain('private-');
  });

  it('keeps unknown usage unknown and preserves evidence when settlement rejects an overrun', () => {
    const tracker = new AgentRunBudgetTracker(budget);
    const reservation = tracker.reserveLlmCall('synthetic', [], 500);
    expect(() =>
      tracker.settleLlmCall(
        reservation,
        '',
        { totalTokens: 1200 },
        'agent.solve',
      ),
    ).toThrow('AGENT_TOKEN_BUDGET_EXCEEDED');
    expect(tracker.snapshot(0, 0).budgetCalls?.[0]).toMatchObject({
      phase: 'agent.solve',
      reportedInputTokens: null,
      reportedOutputTokens: null,
      reportedTotalTokens: 1200,
    });
    expect(tracker.remainingTokens()).toBe(0);
  });

  it('bounds and copies settled-call evidence across resume without retaining extra fields', () => {
    const tracker = new AgentRunBudgetTracker({ ...budget, maxTokens: 24000 });
    for (let i = 0; i < 20; i++) {
      const reservation = tracker.reserveLlmCall('synthetic', [], 500);
      tracker.settleLlmCall(reservation, 'x', undefined, 'private-phase');
    }
    const snapshot = tracker.snapshot(0, 0);
    expect(snapshot.budgetCalls).toHaveLength(16);
    expect(snapshot.budgetCalls?.[0]).toMatchObject({
      phase: 'other',
      reportedTotalTokens: null,
    });
    const resumed = new AgentRunBudgetTracker(
      { ...budget, maxTokens: 24000 },
      snapshot,
    );
    snapshot.budgetCalls![0].reportedTotalTokens = 999;
    expect(
      resumed.snapshot(0, 0).budgetCalls?.[0].reportedTotalTokens,
    ).toBeNull();
  });

  it('enforces and records the per-run token budget', () => {
    const tracker = new AgentRunBudgetTracker(budget);
    const reservation = tracker.reserveLlmCall('system', [], 500);
    tracker.settleLlmCall(reservation, 'answer', {
      totalTokens: 120,
    });

    expect(tracker.snapshot(2, 1)).toMatchObject({
      estimatedTokens: 120,
      toolCalls: 2,
      supplementalRounds: 1,
    });
    expect(() => tracker.reserveLlmCall('x'.repeat(6000), [], 500)).toThrow(
      'AGENT_TOKEN_BUDGET_EXCEEDED',
    );
  });

  it('reserves Chinese input at its real token cost, not chars/3', () => {
    const tracker = new AgentRunBudgetTracker(budget);
    const zh =
      '请比较这两所大学的录取难度、专业实力和奖学金政策，并给出选校建议。';
    const reservation = tracker.reserveLlmCall(zh, [{ content: zh }], 256);

    // chars/3 claimed 11 tokens per copy where o200k_base charges 26, which is
    // what let a reservation clear and settlement then overrun the Run budget.
    expect(reservation.inputTokens).toBeGreaterThan(
      2 * Math.ceil(zh.length / 3),
    );
  });

  it('includes prior active time when enforcing the duration budget', () => {
    const tracker = new AgentRunBudgetTracker(budget, {
      version: 1,
      estimatedTokens: 0,
      toolCalls: 0,
      supplementalRounds: 0,
      elapsedMs: 10001,
    });

    expect(() => tracker.assertWithinDuration()).toThrow(
      'AGENT_DURATION_BUDGET_EXCEEDED',
    );
  });

  it('stores references and unfinished work without tool arguments or results', () => {
    const messages: Message[] = [
      {
        id: 'message-1',
        role: 'user',
        content: '请完成选校，但不要修改档案，必须先让我确认。',
        timestamp: new Date(),
      },
    ];
    const context = buildAgentRunContextSummary({
      messages,
      steps: [
        {
          toolCall: { id: 'call-1', name: 'search_schools' },
          status: 'success',
        },
        {
          toolCall: { id: 'call-2', name: 'update_profile' },
          status: 'pending',
        },
      ],
      pendingStepIndex: 1,
      approvalState: 'waiting',
    });

    expect(context).toMatchObject({
      version: 1,
      approvalState: 'waiting',
      toolResultRefs: [
        {
          toolCallId: 'call-1',
          toolName: 'search_schools',
          status: 'success',
        },
      ],
      unfinishedSteps: ['update_profile'],
    });
    expect(context.constraints[0]).toContain('不要修改档案');
    expect(JSON.stringify(context)).not.toContain('arguments');
    expect(JSON.stringify(context)).not.toContain('result');
  });
});
