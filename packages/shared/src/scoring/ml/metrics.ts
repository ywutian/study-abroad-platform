/**
 * ML Evaluation Metrics
 *
 * Pure TypeScript implementations of AUC-ROC, Brier Score,
 * ECE, Log-Loss, calibration curves, and feature importance.
 * Zero external dependencies.
 */

import type { TrainedModel } from './logistic-regression';

// ============================================
// Core Metrics
// ============================================

/**
 * AUC-ROC via sort-and-sweep trapezoidal method.
 * O(N log N) time complexity.
 *
 * Returns 0.5 for random, 1.0 for perfect separation.
 */
export function computeAucRoc(predictions: number[], labels: number[]): number {
  const n = predictions.length;
  if (n === 0) return 0;

  const totalPos = labels.filter((y) => y === 1).length;
  const totalNeg = n - totalPos;
  if (totalPos === 0 || totalNeg === 0) return 0.5;

  const pairs = predictions.map((p, i) => ({ p, y: labels[i] }));
  pairs.sort((a, b) => b.p - a.p);

  let tp = 0,
    fp = 0;
  let auc = 0;
  let prevFpr = 0;
  let prevTpr = 0;

  for (const { y } of pairs) {
    if (y === 1) tp++;
    else fp++;
    const tpr = tp / totalPos;
    const fpr = fp / totalNeg;
    auc += ((fpr - prevFpr) * (tpr + prevTpr)) / 2;
    prevFpr = fpr;
    prevTpr = tpr;
  }

  return auc;
}

/**
 * Brier Score: mean squared error between predicted probabilities and actual outcomes.
 * Range: [0, 1]. Lower is better. Random = 0.25, perfect = 0.
 */
export function computeBrierScore(predictions: number[], labels: number[]): number {
  if (predictions.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    sum += (predictions[i] - labels[i]) ** 2;
  }
  return sum / predictions.length;
}

/**
 * Expected Calibration Error: measures how well predicted probabilities
 * match actual frequencies.
 * Range: [0, 1]. Lower is better. Target: < 0.05.
 */
export function computeECE(predictions: number[], labels: number[], numBins: number = 10): number {
  const n = predictions.length;
  if (n === 0) return 0;

  const binCounts = new Array(numBins).fill(0);
  const binCorrect = new Array(numBins).fill(0);
  const binConfidence = new Array(numBins).fill(0);

  for (let i = 0; i < n; i++) {
    const bin = Math.min(Math.floor(predictions[i] * numBins), numBins - 1);
    binCounts[bin]++;
    binCorrect[bin] += labels[i];
    binConfidence[bin] += predictions[i];
  }

  let ece = 0;
  for (let b = 0; b < numBins; b++) {
    if (binCounts[b] > 0) {
      const accuracy = binCorrect[b] / binCounts[b];
      const confidence = binConfidence[b] / binCounts[b];
      ece += (binCounts[b] / n) * Math.abs(accuracy - confidence);
    }
  }

  return ece;
}

/**
 * Log Loss (binary cross-entropy).
 * Range: [0, +inf). Lower is better.
 */
export function computeLogLoss(predictions: number[], labels: number[]): number {
  const n = predictions.length;
  if (n === 0) return 0;
  const eps = 1e-7;

  let loss = 0;
  for (let i = 0; i < n; i++) {
    const p = Math.max(eps, Math.min(1 - eps, predictions[i]));
    loss += -(labels[i] * Math.log(p) + (1 - labels[i]) * Math.log(1 - p));
  }
  return loss / n;
}

/**
 * Accuracy at threshold 0.5.
 */
export function computeAccuracy(predictions: number[], labels: number[]): number {
  if (predictions.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < predictions.length; i++) {
    if ((predictions[i] >= 0.5 ? 1 : 0) === labels[i]) correct++;
  }
  return correct / predictions.length;
}

// ============================================
// Calibration Curve
// ============================================

export interface CalibrationBin {
  predictedMean: number;
  actualRate: number;
  count: number;
}

/**
 * Compute calibration curve for visualization.
 * Divides predictions into bins and compares average predicted vs actual admit rate.
 */
export function computeCalibrationCurve(
  predictions: number[],
  labels: number[],
  numBins: number = 10
): CalibrationBin[] {
  const bins: CalibrationBin[] = [];
  const n = predictions.length;

  for (let b = 0; b < numBins; b++) {
    const lo = b / numBins;
    const hi = (b + 1) / numBins;

    let count = 0;
    let predSum = 0;
    let labelSum = 0;

    for (let i = 0; i < n; i++) {
      if (
        predictions[i] >= lo &&
        (predictions[i] < hi || (b === numBins - 1 && predictions[i] <= hi))
      ) {
        count++;
        predSum += predictions[i];
        labelSum += labels[i];
      }
    }

    if (count > 0) {
      bins.push({
        predictedMean: predSum / count,
        actualRate: labelSum / count,
        count,
      });
    }
  }

  return bins;
}

// ============================================
// Feature Importance
// ============================================

export interface FeatureImportance {
  feature: string;
  importance: number;
  weight: number;
  direction: 'positive' | 'negative';
}

/**
 * Compute feature importance from a trained logistic regression model.
 * For LR, importance = |weight[i]| * std(feature[i]).
 * This measures how much each feature contributes to prediction variance.
 */
export function computeFeatureImportance(model: TrainedModel): FeatureImportance[] {
  return model.featureNames
    .map((name, i) => {
      const weight = model.weights[i];
      const std = model.featureStds[name] ?? 1;
      const importance = Math.abs(weight) * std;

      return {
        feature: name,
        importance,
        weight,
        direction: weight >= 0 ? ('positive' as const) : ('negative' as const),
      };
    })
    .sort((a, b) => b.importance - a.importance);
}

// ============================================
// Population Stability Index (PSI)
// ============================================

/**
 * PSI measures distribution shift between expected (training) and actual (production).
 * PSI < 0.1: no significant shift
 * PSI 0.1-0.25: moderate shift (investigate)
 * PSI > 0.25: significant shift (retrain recommended)
 */
export function computePSI(expected: number[], actual: number[], numBins: number = 10): number {
  if (expected.length === 0 || actual.length === 0) return 0;

  const eps = 1e-4;
  let psi = 0;

  for (let b = 0; b < numBins; b++) {
    const lo = b / numBins;
    const hi = (b + 1) / numBins;

    const expPct = expected.filter((v) => v >= lo && v < hi).length / expected.length || eps;
    const actPct = actual.filter((v) => v >= lo && v < hi).length / actual.length || eps;

    psi += (actPct - expPct) * Math.log(actPct / expPct);
  }

  return psi;
}
