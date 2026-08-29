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
