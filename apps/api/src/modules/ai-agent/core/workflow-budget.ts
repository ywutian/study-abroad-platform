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
  replanInputTokens: number;
  replanOutputTokens: number;
}

/** Optional planning must leave room to synthesize the evidence already held. */
export async function withSupplementalBudget<T>(options: {
  budget?: AgentRunBudgetTracker;
  solvePrompt: string;
  replanPrompt: string;
  messages: Message[];
  tools: ToolDefinition[];
  maxTokens: number;
  call: (maxTokens: number) => Promise<T>;
  observe: (decision: SupplementalBudgetDecision) => void;
}): Promise<T | undefined> {
  const { budget, maxTokens } = options;
  if (!budget) return options.call(maxTokens);
  budget.assertWithinDuration();
  const remaining = budget.remainingTokens();
  const solveReservedTokens =
    inputTokens(options.solvePrompt, options.messages) + maxTokens;
  const replanInputTokens = inputTokens(
    options.replanPrompt,
    options.messages,
    options.tools,
  );
  const replanOutputTokens = Math.min(
    maxTokens,
    remaining - solveReservedTokens - replanInputTokens,
  );
  options.observe({
    phase: 'replan',
    decision: replanOutputTokens < 256 ? 'skip_for_solve' : 'allow',
    remainingTokens: remaining,
    solveReservedTokens,
    replanInputTokens,
    replanOutputTokens: Math.max(0, replanOutputTokens),
  });
  if (replanOutputTokens < 256) return undefined;
  const release = budget.holdTokensForLater(solveReservedTokens);
  try {
    return await options.call(replanOutputTokens);
  } finally {
    release();
  }
}
