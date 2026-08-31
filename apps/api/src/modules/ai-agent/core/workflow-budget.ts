import type { Message, ToolDefinition } from '../types';
import type { AgentRunBudgetTracker } from './agent-run-context';
import { countTokens } from './token-estimate';

/** Scheduling estimate, not provider usage or a change to the central budget. */
function inputTokens(
  prompt: string,
  messages: Message[],
  tools: ToolDefinition[] = [],
): number {
  return (
    countTokens(prompt) +
    messages.reduce(
      (sum, message) =>
        sum +
        countTokens(message.content) +
        (message.toolCalls
          ? countTokens(JSON.stringify(message.toolCalls))
          : 0),
      0,
    ) +
    (tools.length ? countTokens(JSON.stringify(tools)) : 0)
  );
}

/**
 * Scheduling allowance: a sampled zh extract prompt at the 2000-character
 * cap measured 1726 tokens, plus the 500-token extraction output allowance.
 * This is not a universal token bound for arbitrary Unicode; the actual prompt
 * must still pass canAffordVerification after Solve settles provider usage.
 */
export const VERIFY_RESERVE = 2226;

/** Keep the optional check affordable across Solve, including its fallback.
 * If even the minimum Solve plus this hold cannot fit, preserve answer delivery.
 */
export function holdVerificationForSolve(
  budget: AgentRunBudgetTracker | undefined,
  prompt: string,
  messages: Message[],
  enabled: boolean,
): () => void {
  if (
    !enabled ||
    !budget ||
    budget.remainingTokens() <
      inputTokens(prompt, messages) + 256 + VERIFY_RESERVE
  )
    return () => {};
  return budget.holdTokensForLater(VERIFY_RESERVE);
}

export interface VerificationBudgetDecision {
  phase: 'verify';
  decision: 'allow' | 'skip_insufficient_budget';
  remainingTokens: number;
  requiredTokens: number;
}

/**
 * Returns the decision, not just a boolean: the skip used to log a bare
 * `skip_insufficient_budget`, so a run that never verified could not be told
 * apart from one that missed by a hundred tokens. Reserving room for the check
 * (VERIFY_RESERVE) did not make it affordable in production, and without these
 * two numbers the next step is guesswork.
 */
export function canAffordVerification(
  budget: AgentRunBudgetTracker | undefined,
  prompt: string,
): { affordable: boolean; decision: VerificationBudgetDecision } {
  budget?.assertWithinDuration();
  const requiredTokens = inputTokens(prompt, []) + 500;
  const remainingTokens = budget ? budget.remainingTokens() : Infinity;
  const affordable = !budget || remainingTokens >= requiredTokens;
  return {
    affordable,
    decision: {
      phase: 'verify',
      decision: affordable ? 'allow' : 'skip_insufficient_budget',
      remainingTokens: Number.isFinite(remainingTokens) ? remainingTokens : -1,
      requiredTokens,
    },
  };
}

export interface SupplementalBudgetDecision {
  phase: 'replan';
  decision: 'allow' | 'skip_for_solve';
  remainingTokens: number;
  solveReservedTokens: number;
  verifyReservedTokens: number;
  replanInputTokens: number;
  replanOutputTokens: number;
}

/**
 * Optional planning must leave room to synthesize the evidence already held —
 * and, when the agent verifies its own facts, to check it afterwards.
 *
 * Verification used to take whatever replan left behind, which in production
 * was nothing: every `verify` decision observed over 24h was
 * `skip_insufficient_budget`, so school answers shipped unverified while
 * optional planning spent the budget ahead of them. A hallucination guard that
 * queues behind an optional step is not a guard. Replan now yields instead:
 * it still runs whenever there is room, with a smaller output cap.
 */
export async function withSupplementalBudget<T>(options: {
  budget?: AgentRunBudgetTracker;
  solvePrompt: string;
  replanPrompt: string;
  messages: Message[];
  tools: ToolDefinition[];
  maxTokens: number;
  /** Pass VERIFY_RESERVE when the agent verifies; 0 otherwise. */
  verifyReserveTokens?: number;
  call: (maxTokens: number) => Promise<T>;
  observe: (decision: SupplementalBudgetDecision) => void;
}): Promise<T | undefined> {
  const { budget, maxTokens } = options;
  if (!budget) return options.call(maxTokens);
  budget.assertWithinDuration();
  const remaining = budget.remainingTokens();
  const solveReservedTokens =
    inputTokens(options.solvePrompt, options.messages) + maxTokens;
  const verifyReservedTokens = Math.max(0, options.verifyReserveTokens ?? 0);
  const replanInputTokens = inputTokens(
    options.replanPrompt,
    options.messages,
    options.tools,
  );
  const replanOutputTokens = Math.min(
    maxTokens,
    remaining - solveReservedTokens - verifyReservedTokens - replanInputTokens,
  );
  options.observe({
    phase: 'replan',
    decision: replanOutputTokens < 256 ? 'skip_for_solve' : 'allow',
    remainingTokens: remaining,
    solveReservedTokens,
    verifyReservedTokens,
    replanInputTokens,
    replanOutputTokens: Math.max(0, replanOutputTokens),
  });
  if (replanOutputTokens < 256) return undefined;
  const release = budget.holdTokensForLater(
    solveReservedTokens + verifyReservedTokens,
  );
  try {
    return await options.call(replanOutputTokens);
  } finally {
    release();
  }
}
