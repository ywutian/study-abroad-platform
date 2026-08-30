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
 * What verification needs to still be affordable after Solve: the extract
 * prompt at its cap (the zh template plus solveOutput.slice(0, 2000) measures
 * 1726 tokens) plus the 500-token floor canAffordVerification applies.
 */
export const VERIFY_RESERVE = 2226;

export function canAffordVerification(
  budget: AgentRunBudgetTracker | undefined,
  prompt: string,
): boolean {
  budget?.assertWithinDuration();
  return !budget || budget.remainingTokens() >= inputTokens(prompt, []) + 500;
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
