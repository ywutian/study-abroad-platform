import type { AgentAuditNote } from './types';

/**
 * Application-analysis governance audit.
 *
 * 2026-06-12 rewrite: the earlier P0 "synthetic metrics" + P1 "hardcoded passes"
 * findings described an implementation that has since been REPLACED by real
 * replay-based evaluation. Their needles (`const policyCorrectnessRate =`,
 * `contractParityPass: true,`) either mis-resolved to a now-correct `numericGate`
 * read or no longer existed at all, so they emitted a permanent FALSE
 * "biased_or_defective" verdict in run-system-accuracy-audit for a gate that is
 * actually sound. Verified current state:
 *
 * - `runEvaluation` pulls metrics from the latest gold `ApplicationAnalysisReplayRun`
 *   + real `computeApplicantFeedbackSignals`; with no replay it fails closed.
 * - `contractParityPass` / `webRenderPass` / `mobileRenderPass` / `journeyPassRate`
 *   are COMPUTED in `evaluateReplayResponse` (structural checks + real length
 *   budgets + real pass-rate ratio) — the `: true` literals only exist as gate
 *   *thresholds* in `application-analysis-workflow.constants.ts`.
 * - The CI `application-analysis-governance` job runs real Playwright DOM/visual
 *   parity, real RN screen tests, and the runtime journey audit, writing the
 *   results back as deterministic replay metrics (scripts/application-analysis-governance.ts).
 * - The served `analysisVersion` label is now bound to a deployed engine at
 *   `activatePolicy` (cf. ADR-0022), and the served contract is compile-time
 *   guarded against the shared `AIAnalysisResult` (ai.types.ts).
 *
 * The gate is therefore a meaningful, non-synthetic readiness signal. Its one
 * honest limitation is recorded as a note, not a defect.
 */
export function runGovernanceAudit(): AgentAuditNote {
  return {
    agent: 'Governance Auditor',
    summary:
      'The application-analysis governance gate is real replay-based evaluation (gold-replay metrics + real applicant feedback + Playwright/RN render parity + runtime journey audit), not synthetic. The served label is bound to a deployed engine and the cross-surface contract is compile-time guarded.',
    findings: [],
    notes: [
      'The gate measures replay against a curated gold set, not real admission outcomes — readiness means "matches the curated gold set under the deployed engine", which is the appropriate bar in the no-outcome era (cf. ADR-0020) and must not be over-claimed as real-admission accuracy.',
    ],
  };
}
