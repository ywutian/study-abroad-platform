/** Numeric diagnostics only. Unknown provider usage is never inferred. */
export const BUDGET_CALL_PHASES = [
  'agent.plan',
  'agent.replan',
  'agent.solve',
  'agent.revise',
  'agent.verify',
  'other',
] as const;
export interface BudgetCallEvidence {
  phase: (typeof BUDGET_CALL_PHASES)[number];
  estimatedInputTokens: number | null;
  outputLimitTokens: number | null;
  heldTokens: number | null;
  reportedInputTokens: number | null;
  reportedOutputTokens: number | null;
  reportedTotalTokens: number | null;
}

export const UNVERIFIED_REASONS = [
  'tool_limit',
  'lookup_failed',
  'field_missing',
  'source_unusable',
  'claim_uncomparable',
  'tool_exception',
] as const;
export type UnverifiedReason = (typeof UNVERIFIED_REASONS)[number];
export type UnverifiedReasons = Partial<Record<UnverifiedReason, number>>;

export function evidenceNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export function projectBudgetCalls(value: unknown): BudgetCallEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-16).flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const phase = record.phase as BudgetCallEvidence['phase'];
    if (!BUDGET_CALL_PHASES.includes(phase)) return [];
    return [
      {
        phase,
        estimatedInputTokens: evidenceNumber(record.estimatedInputTokens),
        outputLimitTokens: evidenceNumber(record.outputLimitTokens),
        heldTokens: evidenceNumber(record.heldTokens),
        reportedInputTokens: evidenceNumber(record.reportedInputTokens),
        reportedOutputTokens: evidenceNumber(record.reportedOutputTokens),
        reportedTotalTokens: evidenceNumber(record.reportedTotalTokens),
      },
    ];
  });
}

export function projectUnverifiedReasons(value: unknown): UnverifiedReasons {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    UNVERIFIED_REASONS.flatMap((reason) => {
      const count = evidenceNumber(record[reason]);
      return count === null || count === 0 ? [] : [[reason, count]];
    }),
  );
}
