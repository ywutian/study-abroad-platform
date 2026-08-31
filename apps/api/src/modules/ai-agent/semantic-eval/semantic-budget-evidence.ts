import { countTokens } from '../core/token-estimate';
import { buildVerificationPrompt } from '../core/workflow-verification';

/** Project an owned synthetic Run in memory; never return its raw fields. */
export function semanticBudgetEvidence(
  summary: unknown,
  output: string,
  locale: string,
) {
  const record =
    summary && typeof summary === 'object'
      ? (summary as Record<string, unknown>)
      : {};
  const budget = record.budget as Record<string, unknown> | undefined;
  const usage = record.usage as Record<string, unknown> | undefined;
  const verification = usage?.verification as
    Record<string, unknown> | undefined;
  const number = (value: unknown): number | null =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
      ? value
      : null;
  const maxTokens = number(budget?.maxTokens);
  const settledOrEstimatedTokens = number(usage?.estimatedTokens);
  const remainingTokens =
    maxTokens === null || settledOrEstimatedTokens === null
      ? null
      : Math.max(0, maxTokens - settledOrEstimatedTokens);
  // This is post-run availability, not proof that verification executed/skipped.
  // For the previous all-skipped sample, the first 2000 chars equal Solve's input.
  const extractRequiredTokens =
    countTokens(buildVerificationPrompt(output, locale)) + 500;
  return {
    evidence: 'owned_run_budget',
    status: remainingTokens === null ? 'unknown' : 'observed',
    maxTokens,
    settledOrEstimatedTokens,
    remainingTokens,
    extractRequiredTokens,
    supplementalRounds: number(usage?.supplementalRounds),
    toolCalls: number(usage?.toolCalls),
    elapsedMs: number(usage?.elapsedMs),
    verification:
      verification &&
      typeof verification.attempted === 'boolean' &&
      typeof verification.outcome === 'string' &&
      [
        'skip_insufficient_budget',
        'verified',
        'conflict',
        'unverified',
        'not_applicable',
        'failed',
      ].includes(verification.outcome)
        ? {
            attempted: verification.attempted,
            outcome: verification.outcome,
            remainingTokens: number(verification.remainingTokens),
            requiredTokens: number(verification.requiredTokens),
            verified: number(verification.verified),
            unverified: number(verification.unverified),
            toolCalls: number(verification.toolCalls),
          }
        : null,
    unverifiedNotice:
      output.includes('部分事实尚未完成独立核验') ||
      output.includes(
        'Some factual claims could not be independently checked.',
      ),
  };
}
