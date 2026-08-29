import type { Message } from '../types';
import { countTokens } from './token-estimate';
import type {
  AgentRunBudgetV1,
  AgentRunContextSummaryV1,
  AgentRunUsageV1,
} from './agent-run-state';
import type { TokenUsage } from './token-tracker.service';
import type { ModelRouteAttempt } from '../routing/model-routing.policy';

export interface BudgetReservation {
  inputTokens: number;
  outputTokens: number;
}

export class AgentRunBudgetTracker {
  private estimatedTokens: number;
  private heldTokens = 0;
  private readonly activeStartedAt = Date.now();
  private readonly priorElapsedMs: number;
  private readonly modelAttempts: ModelRouteAttempt[];

  constructor(
    readonly limits: AgentRunBudgetV1,
    initial?: AgentRunUsageV1,
  ) {
    this.estimatedTokens = initial?.estimatedTokens ?? 0;
    this.priorElapsedMs = initial?.elapsedMs ?? 0;
    this.modelAttempts = [...(initial?.modelAttempts ?? [])].slice(-64);
  }

  remainingDurationMs(): number {
    return Math.max(0, this.limits.maxDurationMs - this.elapsedMs());
  }

  remainingTokens(): number {
    return Math.max(
      0,
      this.limits.maxTokens - this.estimatedTokens - this.heldTokens,
    );
  }

  /** Temporary scheduling hold, not consumed usage. Shared by concurrent calls. */
  holdTokensForLater(requested: number): () => void {
    if (!Number.isSafeInteger(requested) || requested < 0)
      throw new Error('AGENT_TOKEN_HOLD_INVALID');
    const held = Math.min(
      requested,
      Math.max(
        0,
        this.limits.maxTokens - this.estimatedTokens - this.heldTokens,
      ),
    );
    this.heldTokens += held;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.heldTokens -= held;
    };
  }

  recordModelAttempt(attempt: ModelRouteAttempt): void {
    this.modelAttempts.push(attempt);
    if (this.modelAttempts.length > 64) this.modelAttempts.shift();
  }

  assertWithinDuration(): void {
    if (this.elapsedMs() > this.limits.maxDurationMs) {
      throw new Error('AGENT_DURATION_BUDGET_EXCEEDED');
    }
  }

  reserveLlmCall(
    systemPrompt: string,
    messages: Array<Pick<Message, 'content'>>,
    requestedOutputTokens: number,
  ): BudgetReservation {
    this.assertWithinDuration();
    const inputTokens =
      countTokens(systemPrompt) +
      messages.reduce((sum, message) => sum + countTokens(message.content), 0);
    const remaining =
      this.limits.maxTokens - this.estimatedTokens - this.heldTokens;
    const outputTokens = Math.min(
      requestedOutputTokens,
      remaining - inputTokens,
    );
    if (outputTokens < 256) {
      throw new Error('AGENT_TOKEN_BUDGET_EXCEEDED');
    }
    this.estimatedTokens += inputTokens + outputTokens;
    return { inputTokens, outputTokens };
  }

  settleLlmCall(
    reservation: BudgetReservation,
    output: string,
    usage?: Pick<TokenUsage, 'totalTokens'>,
  ): void {
    this.estimatedTokens -= reservation.inputTokens + reservation.outputTokens;
    this.estimatedTokens +=
      usage?.totalTokens ?? reservation.inputTokens + countTokens(output);
    if (this.estimatedTokens > this.limits.maxTokens) {
      throw new Error('AGENT_TOKEN_BUDGET_EXCEEDED');
    }
    this.assertWithinDuration();
  }

  /**
   * Settlement for the terminal Solve/Revise answer, which has already been
   * generated, billed by the provider and streamed to the client. Throwing
   * here would discard a complete answer to protect spend that is already
   * spent; the overage is recorded instead, which drives remainingTokens() to
   * zero so every later call — including optional verification — still fails
   * closed. Incomplete streams never reach this point.
   */
  settleTerminalLlmCall(
    reservation: BudgetReservation,
    output: string,
    usage?: Pick<TokenUsage, 'totalTokens'>,
  ): string | undefined {
    try {
      this.settleLlmCall(reservation, output, usage);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : 'AGENT_SETTLE_FAILED';
    }
  }

  settleFailedLlmCall(reservation: BudgetReservation): void {
    try {
      this.settleLlmCall(reservation, '');
    } catch {
      // The next budget check remains fail-closed without masking provider errors.
    }
  }

  snapshot(toolCalls: number, supplementalRounds: number): AgentRunUsageV1 {
    return {
      version: 1,
      estimatedTokens: Math.max(0, Math.ceil(this.estimatedTokens)),
      toolCalls,
      supplementalRounds,
      elapsedMs: this.elapsedMs(),
      ...(this.modelAttempts.length
        ? { modelAttempts: [...this.modelAttempts] }
        : {}),
    };
  }

  private elapsedMs(): number {
    return this.priorElapsedMs + Date.now() - this.activeStartedAt;
  }
}

export function buildAgentRunContextSummary(input: {
  messages: Message[];
  steps: Array<{
    toolCall: { id: string; name: string };
    status: string;
    error?: string;
  }>;
  pendingStepIndex: number;
  approvalState: AgentRunContextSummaryV1['approvalState'];
}): AgentRunContextSummaryV1 {
  const lastUserMessage = [...input.messages]
    .reverse()
    .find((message) => message.role === 'user');
  const taskGoal = (lastUserMessage?.content || '').slice(0, 2000);
  const constraints = taskGoal
    .split(/[。！？.!?\n]+/)
    .map((part) => part.trim())
    .filter((part) =>
      /(?:不要|不能|必须|仅|只|保持|without|must|only|do not|never)/i.test(
        part,
      ),
    )
    .slice(0, 8);
  const completedSteps = input.steps.filter(
    (step) => step.status === 'success' || step.status === 'failed',
  );
  const lastFailed = [...completedSteps]
    .reverse()
    .find((step) => step.status === 'failed');

  return {
    version: 1,
    taskGoal,
    constraints,
    toolResultRefs: completedSteps.map((step) => ({
      toolCallId: step.toolCall.id,
      toolName: step.toolCall.name,
      status: step.status as 'success' | 'failed',
    })),
    approvalState: input.approvalState,
    ...(lastFailed
      ? {
          lastFailure: {
            toolName: lastFailed.toolCall.name,
            reason: (lastFailed.error || 'TOOL_EXECUTION_FAILED').slice(0, 500),
          },
        }
      : {}),
    unfinishedSteps: input.steps
      .slice(input.pendingStepIndex)
      .filter((step) => step.status !== 'success')
      .map((step) => step.toolCall.name),
  };
}
