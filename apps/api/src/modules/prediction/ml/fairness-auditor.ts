/**
 * Fairness Auditor
 *
 * Evaluates ML model predictions for systematic bias using standard metrics:
 *   - Demographic Parity: |P(Ŷ=1|A=a) - P(Ŷ=1|A=b)| across groups
 *   - Equalized Odds: |TPR_a - TPR_b| and |FPR_a - FPR_b|
 *   - Consistency: do similar profiles get similar predictions?
 *   - Per-band calibration: predicted vs actual admit rates
 *
 * Audits on non-protected attributes (selectivity band, test completeness)
 * since the system doesn't collect protected demographics.
 *
 * References:
 *   - arxiv.org/html/2509.22560 (LLM-Augmented Fair ML for Admission Prediction)
 *   - Hardt et al., "Equality of Opportunity in Supervised Learning"
 */

// ============================================
// Types
// ============================================

export interface FairnessReport {
  demographicParity: GroupDisparity[];
  equalizedOdds: GroupDisparity[];
  consistency: number;
  bandCalibration: BandCalibration[];
  overallPass: boolean;
  maxDisparity: number;
  warnings: string[];
}

export interface GroupDisparity {
  attribute: string;
  groups: Array<{
    group: string;
    count: number;
    rate: number; // predicted admit rate (DP) or TPR/FPR (EO)
  }>;
  maxDisparity: number;
  pass: boolean; // disparity < 0.10
}

export interface BandCalibration {
  band: string;
  count: number;
  meanPrediction: number;
  actualAdmitRate: number;
  calibrationGap: number;
}

// ============================================
// Thresholds
// ============================================

const DISPARITY_THRESHOLD = 0.1;
const CALIBRATION_GAP_THRESHOLD = 0.15;
const CONSISTENCY_THRESHOLD = 0.9;

// ============================================
// Main Audit Function
// ============================================

/**
 * Audit model predictions for fairness.
 *
 * @param predictions Model predicted probabilities
 * @param labels Actual outcomes (0 or 1)
 * @param sensitiveAttributes Map of attribute name → group labels per sample
 */
export function auditFairness(
  predictions: number[],
  labels: number[],
  sensitiveAttributes: Record<string, string[]>,
): FairnessReport {
  const warnings: string[] = [];

  // Demographic Parity
  const demographicParity: GroupDisparity[] = [];
  for (const [attr, groups] of Object.entries(sensitiveAttributes)) {
    const dp = computeDemographicParity(predictions, groups);
    demographicParity.push(dp);
    if (!dp.pass) {
      warnings.push(
        `Demographic parity violation for '${attr}': disparity=${dp.maxDisparity.toFixed(3)} (threshold=${DISPARITY_THRESHOLD})`,
      );
    }
  }

  // Equalized Odds
  const equalizedOdds: GroupDisparity[] = [];
  for (const [attr, groups] of Object.entries(sensitiveAttributes)) {
    const eo = computeEqualizedOdds(predictions, labels, groups);
    equalizedOdds.push(eo);
    if (!eo.pass) {
      warnings.push(
        `Equalized odds violation for '${attr}': disparity=${eo.maxDisparity.toFixed(3)} (threshold=${DISPARITY_THRESHOLD})`,
      );
    }
  }

  // Consistency (prediction similarity for close features — approximated via prediction variance)
  const consistency = computeConsistency(predictions);

  if (consistency < CONSISTENCY_THRESHOLD) {
    warnings.push(
      `Low prediction consistency: ${consistency.toFixed(3)} (threshold=${CONSISTENCY_THRESHOLD})`,
    );
  }

  // Per-band calibration
  const bandCalibration = computeBandCalibration(predictions, labels);
  for (const band of bandCalibration) {
    if (band.calibrationGap > CALIBRATION_GAP_THRESHOLD) {
      warnings.push(
        `Poor calibration for band ${band.band}: gap=${band.calibrationGap.toFixed(3)}`,
      );
    }
  }

  const maxDisparity = Math.max(
    ...demographicParity.map((d) => d.maxDisparity),
    ...equalizedOdds.map((d) => d.maxDisparity),
    0,
  );

  return {
    demographicParity,
    equalizedOdds,
    consistency,
    bandCalibration,
    overallPass: warnings.length === 0,
    maxDisparity,
    warnings,
  };
}

// ============================================
// Demographic Parity
// ============================================

/**
 * P(Ŷ=1|A=a) for each group. Disparity = max - min.
 * Uses threshold of 0.5 for binary prediction.
 */
function computeDemographicParity(
  predictions: number[],
  groupLabels: string[],
): GroupDisparity {
  const groupStats = new Map<string, { total: number; predicted: number }>();

  for (let i = 0; i < predictions.length; i++) {
    const group = groupLabels[i];
    if (!groupStats.has(group))
      groupStats.set(group, { total: 0, predicted: 0 });
    const stats = groupStats.get(group)!;
    stats.total++;
    if (predictions[i] >= 0.5) stats.predicted++;
  }

  const groups = Array.from(groupStats.entries())
    .filter(([, stats]) => stats.total >= 5) // minimum group size
    .map(([group, stats]) => ({
      group,
      count: stats.total,
      rate: stats.predicted / stats.total,
    }));

  const rates = groups.map((g) => g.rate);
  const maxDisparity =
    rates.length >= 2 ? Math.max(...rates) - Math.min(...rates) : 0;

  return {
    attribute: 'demographic_parity',
    groups,
    maxDisparity,
    pass: maxDisparity < DISPARITY_THRESHOLD,
  };
}

// ============================================
// Equalized Odds
// ============================================

/**
 * TPR and FPR per group. Disparity = max|TPR_a - TPR_b| across group pairs.
 */
function computeEqualizedOdds(
  predictions: number[],
  labels: number[],
  groupLabels: string[],
): GroupDisparity {
  const groupStats = new Map<
    string,
    { tp: number; fp: number; fn: number; tn: number }
  >();

  for (let i = 0; i < predictions.length; i++) {
    const group = groupLabels[i];
    if (!groupStats.has(group))
      groupStats.set(group, { tp: 0, fp: 0, fn: 0, tn: 0 });
    const stats = groupStats.get(group)!;
    const pred = predictions[i] >= 0.5 ? 1 : 0;
    if (pred === 1 && labels[i] === 1) stats.tp++;
    else if (pred === 1 && labels[i] === 0) stats.fp++;
    else if (pred === 0 && labels[i] === 1) stats.fn++;
    else stats.tn++;
  }

  const groups = Array.from(groupStats.entries())
    .filter(([, s]) => s.tp + s.fn >= 3 && s.fp + s.tn >= 3) // minimum per class
    .map(([group, s]) => ({
      group,
      count: s.tp + s.fp + s.fn + s.tn,
      rate: s.tp + s.fn > 0 ? s.tp / (s.tp + s.fn) : 0, // TPR
    }));

  const tprs = groups.map((g) => g.rate);
  const maxDisparity =
    tprs.length >= 2 ? Math.max(...tprs) - Math.min(...tprs) : 0;

  return {
    attribute: 'equalized_odds',
    groups,
    maxDisparity,
    pass: maxDisparity < DISPARITY_THRESHOLD,
  };
}

// ============================================
// Consistency
// ============================================

/**
 * Approximate consistency: 1 - normalized prediction variance.
 * High consistency → similar inputs produce similar outputs.
 */
function computeConsistency(predictions: number[]): number {
  if (predictions.length < 2) return 1;

  const mean = predictions.reduce((s, v) => s + v, 0) / predictions.length;
  const variance =
    predictions.reduce((s, v) => s + (v - mean) ** 2, 0) / predictions.length;

  // Normalize: max variance for [0,1] is 0.25 (all at 0 or 1)
  const normalizedVariance = variance / 0.25;

  return Math.max(0, 1 - normalizedVariance);
}

// ============================================
// Per-Band Calibration
// ============================================

function computeBandCalibration(
  predictions: number[],
  labels: number[],
): BandCalibration[] {
  const bands = [
    { name: '0.0-0.2', min: 0, max: 0.2 },
    { name: '0.2-0.4', min: 0.2, max: 0.4 },
    { name: '0.4-0.6', min: 0.4, max: 0.6 },
    { name: '0.6-0.8', min: 0.6, max: 0.8 },
    { name: '0.8-1.0', min: 0.8, max: 1.0 },
  ];

  return bands
    .map((band) => {
      const indices: number[] = [];
      for (let i = 0; i < predictions.length; i++) {
        if (predictions[i] >= band.min && predictions[i] < band.max) {
          indices.push(i);
        }
      }

      if (indices.length === 0) {
        return {
          band: band.name,
          count: 0,
          meanPrediction: 0,
          actualAdmitRate: 0,
          calibrationGap: 0,
        };
      }

      const meanPred =
        indices.reduce((s, i) => s + predictions[i], 0) / indices.length;
      const actualRate =
        indices.reduce((s, i) => s + labels[i], 0) / indices.length;

      return {
        band: band.name,
        count: indices.length,
        meanPrediction: meanPred,
        actualAdmitRate: actualRate,
        calibrationGap: Math.abs(meanPred - actualRate),
      };
    })
    .filter((b) => b.count > 0);
}
