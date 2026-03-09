/**
 * ML Model Explainability
 *
 * Feature contributions (SHAP-equivalent for linear models) and
 * counterfactual "what-if" analysis.
 */

import type { TrainedModel } from './logistic-regression';

// ============================================
// Types
// ============================================

export interface FeatureContribution {
  feature: string;
  value: number;
  contribution: number;
  direction: 'positive' | 'negative';
}

export interface WhatIfResult {
  currentProb: number;
  newProb: number;
  delta: number;
  changedFeatures: Array<{
    feature: string;
    oldValue: number;
    newValue: number;
    probDelta: number;
  }>;
}

// ============================================
// Feature Contributions
// ============================================

/**
 * Compute per-feature contribution to prediction.
 *
 * For logistic regression, the exact contribution of feature i is:
 *   contribution[i] = weight[i] * (feature[i] - median[i])
 *
 * This is exact for linear models (not an approximation like KernelSHAP).
 * The sum of all contributions + bias term = log-odds of the prediction.
 *
 * @returns Sorted by |contribution| descending (most impactful first)
 */
export function explainPrediction(model: TrainedModel, features: number[]): FeatureContribution[] {
  const contributions: FeatureContribution[] = [];

  for (let i = 0; i < model.featureNames.length; i++) {
    const name = model.featureNames[i];
    const value = features[i] ?? 0;
    const median = model.featureMedians[name] ?? 0;
    const weight = model.weights[i];

    // Contribution in log-odds space
    const contribution = weight * (value - median);

    contributions.push({
      feature: name,
      value,
      contribution,
      direction: contribution >= 0 ? 'positive' : 'negative',
    });
  }

  // Sort by absolute contribution (most impactful first)
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return contributions;
}

/**
 * Get the top N most impactful features for a prediction.
 */
export function getTopContributions(
  model: TrainedModel,
  features: number[],
  topN: number = 5
): FeatureContribution[] {
  return explainPrediction(model, features).slice(0, topN);
}

// ============================================
// Counterfactual "What-If" Analysis
// ============================================

/**
 * Answer: "What would happen if I changed feature X to value Y?"
 *
 * Takes the current feature vector, applies the specified changes,
 * re-runs the model, and returns the probability delta.
 *
 * @param model - Trained model
 * @param currentFeatures - Current feature array (same order as model.featureNames)
 * @param changes - Map of feature name → new value
 * @returns Current probability, new probability, delta, and per-change breakdown
 */
export function whatIf(
  model: TrainedModel,
  currentFeatures: number[],
  changes: Record<string, number>
): WhatIfResult {
  // Current prediction
  const currentProb = predictFromModel(model, currentFeatures);

  // Build modified feature array
  const newFeatures = [...currentFeatures];
  const changedFeatures: WhatIfResult['changedFeatures'] = [];

  for (const [featureName, newValue] of Object.entries(changes)) {
    const idx = model.featureNames.indexOf(featureName);
    if (idx === -1) continue;

    const oldValue = currentFeatures[idx];
    newFeatures[idx] = newValue;

    // Compute individual feature's contribution to probability change
    const singleChange = [...currentFeatures];
    singleChange[idx] = newValue;
    const singleProb = predictFromModel(model, singleChange);

    changedFeatures.push({
      feature: featureName,
      oldValue,
      newValue,
      probDelta: singleProb - currentProb,
    });
  }

  const newProb = predictFromModel(model, newFeatures);

  return {
    currentProb,
    newProb,
    delta: newProb - currentProb,
    changedFeatures,
  };
}

/**
 * Convenience: compute what-if for raw score changes.
 *
 * Maps user-friendly inputs (e.g., "SAT: 1550") to normalized feature values.
 * This bridges the gap between raw scores and model features.
 */
export function whatIfRawScores(
  model: TrainedModel,
  currentFeatures: number[],
  rawChanges: {
    satScore?: number;
    actScore?: number;
    gpa?: number;
    toeflScore?: number;
  }
): WhatIfResult {
  const changes: Record<string, number> = {};

  if (rawChanges.satScore != null) {
    changes['satNorm'] = rawChanges.satScore / 1600;
    changes['hasTestScore'] = 1;
  }
  if (rawChanges.actScore != null) {
    changes['actNorm'] = rawChanges.actScore / 36;
    changes['hasTestScore'] = 1;
  }
  if (rawChanges.gpa != null) {
    changes['gpa4'] = rawChanges.gpa / 4.0;
  }
  if (rawChanges.toeflScore != null) {
    changes['toeflNorm'] = rawChanges.toeflScore / 120;
    changes['hasToefl'] = 1;
  }

  return whatIf(model, currentFeatures, changes);
}

// ============================================
// Helpers
// ============================================

function predictFromModel(model: TrainedModel, features: number[]): number {
  let z = model.bias;
  for (let j = 0; j < model.weights.length; j++) {
    z += model.weights[j] * (features[j] ?? 0);
  }
  const p = 1 / (1 + Math.exp(-z));
  return Math.max(0.05, Math.min(0.95, p));
}
