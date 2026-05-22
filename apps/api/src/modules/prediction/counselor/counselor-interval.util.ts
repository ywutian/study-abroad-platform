/**
 * counselor-interval.util.ts — honest confidence + probability interval.
 *
 * WHY
 * ---
 * The served counselor prediction used to carry a hardcoded `confidence:
 * 'medium'` and a flat `probability ± 0.05` interval. Both were fake precision:
 * the confidence ignored how much the engine actually knew, and a flat ±5pp
 * band is statistically wrong for a probability (it can imply 0% at a 4%
 * school, and a symmetric additive band misrepresents uncertainty near the
 * extremes).
 *
 * This module derives BOTH from real signals:
 *  - `confidence` from the anchor tier (CDS admit-band cell vs school-wide
 *    rate) and the count of missing profile inputs.
 *  - the interval in LOG-ODDS space, so it is relative and asymmetric — tight
 *    near 50%, appropriately wide near 0/1 — with a width that grows as
 *    confidence drops, plus a minimum-width floor (no deceptively narrow band
 *    while the engine is uncalibrated against real outcomes).
 *
 * See docs/PREDICTION_ACCURACY_DECISION_2026-05-22.md (Phase 1).
 */
import { logit, invLogit } from '@study-abroad/shared/scoring';

export type CounselorConfidence = 'low' | 'medium' | 'high';

/**
 * Derive confidence from real engine signals.
 *
 * @param anchorTier      counselor anchor tier — 1 = CDS admit-band cell
 *                        (stat-specific, most precise), 2 = school-wide
 *                        acceptance rate, 3 = sparse, 4 = insufficient.
 * @param missingFieldCount  number of profile inputs the engine had to skip.
 */
export function deriveCounselorConfidence(
  anchorTier: number,
  missingFieldCount: number,
): CounselorConfidence {
  if (anchorTier === 1 && missingFieldCount <= 2) return 'high';
  if (anchorTier <= 2 && missingFieldCount <= 4) return 'medium';
  return 'low';
}

/**
 * Logit half-width by confidence — a wider band when the engine knows less.
 *
 * This IS the interval-width floor (decision record 2026-05-22, Q3-c: "零校准
 * 期区间宽度有下限"): expressed in log-odds space, not as an absolute ±pp band.
 * `high = 0.35` is the narrowest the engine will ever claim — enough to forbid
 * a pseudo-precise band, while staying relative/asymmetric at every
 * probability (an absolute-pp floor would re-flatten the band near 0/1, which
 * is the exact dishonesty this module exists to remove).
 *
 * These are uncertainty-tier estimates, NOT regression-fit constants; they
 * will be replaced by an empirically-calibrated interval once the outcome
 * flywheel produces verified results (see decision record, Phase 5).
 */
const LOGIT_HALF_WIDTH: Record<CounselorConfidence, number> = {
  high: 0.35,
  medium: 0.55,
  low: 0.85,
};

/** Upper clamp matches the engine's served-probability ceiling. */
const PROBABILITY_CEILING = 0.98;

/**
 * Honest probability interval, computed in log-odds space.
 *
 * Relative and asymmetric by construction: at p=4% it yields roughly 2–7%
 * (medium), never 0–9%; at p=40% it widens appropriately. Width scales with
 * confidence; the minimum width is the `high`-confidence logit half-width.
 */
export function deriveCounselorInterval(
  probability: number,
  confidence: CounselorConfidence,
): { low: number; high: number } {
  if (!Number.isFinite(probability) || probability <= 0) {
    return { low: 0, high: 0 };
  }
  const k = LOGIT_HALF_WIDTH[confidence];
  const center = logit(probability);
  return {
    low: Math.max(0, invLogit(center - k)),
    high: Math.min(PROBABILITY_CEILING, invLogit(center + k)),
  };
}
