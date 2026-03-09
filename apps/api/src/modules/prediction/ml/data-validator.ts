/**
 * Training Data Validator
 *
 * Validates individual training records and overall dataset quality.
 * Catches data errors before they corrupt model training.
 */

import type { FeatureVector } from '@study-abroad/shared/scoring';

// ============================================
// Record-Level Validation
// ============================================

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

/**
 * Validate a single training record.
 * Returns warnings for suspicious data (record still usable but flagged).
 */
export function validateTrainingRecord(
  features: FeatureVector,
  label: number,
): ValidationResult {
  const warnings: string[] = [];

  // GPA range check
  if (!isNaN(features.gpa4)) {
    if (features.gpa4 < 0 || features.gpa4 > 1.25) {
      warnings.push(
        `GPA out of range: ${(features.gpa4 * 4).toFixed(2)} (expected 0-5.0)`,
      );
    }
  }

  // SAT range check
  if (!isNaN(features.satNorm)) {
    if (features.satNorm < 0.25 || features.satNorm > 1.0) {
      warnings.push(
        `SAT score suspicious: ${Math.round(features.satNorm * 1600)}`,
      );
    }
  }

  // ACT range check
  if (!isNaN(features.actNorm)) {
    if (features.actNorm < 0.3 || features.actNorm > 1.0) {
      warnings.push(
        `ACT score suspicious: ${Math.round(features.actNorm * 36)}`,
      );
    }
  }

  // TOEFL range check
  if (!isNaN(features.toeflNorm)) {
    if (features.toeflNorm < 0.5 || features.toeflNorm > 1.0) {
      warnings.push(
        `TOEFL score suspicious: ${Math.round(features.toeflNorm * 120)}`,
      );
    }
  }

  // Unusual admission: ultra-selective school + very low scores
  if (label === 1 && features.selectivity > 0.9) {
    if (!isNaN(features.gpa4) && features.gpa4 < 0.7) {
      warnings.push(
        'Admitted to ultra-selective school with low GPA — verify data',
      );
    }
    if (!isNaN(features.satNorm) && features.satNorm < 0.8) {
      warnings.push(
        'Admitted to ultra-selective school with low SAT — verify data',
      );
    }
  }

  // Unusual rejection: low-selectivity school + very high scores
  if (label === 0 && features.selectivity < 0.2) {
    if (
      !isNaN(features.gpa4) &&
      features.gpa4 > 0.95 &&
      !isNaN(features.satNorm) &&
      features.satNorm > 0.95
    ) {
      warnings.push(
        'Rejected from low-selectivity school with top scores — verify data',
      );
    }
  }

  // Label validation
  if (label !== 0 && label !== 1) {
    warnings.push(`Invalid label: ${label} (expected 0 or 1)`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// ============================================
// Dataset-Level Validation
// ============================================

export interface DatasetValidation {
  totalSamples: number;
  validSamples: number;
  warningCount: number;
  classBalance: {
    positive: number;
    negative: number;
    ratio: number;
  };
  featureCoverage: Record<string, number>; // % non-NaN per feature
  issues: string[];
}

/**
 * Validate an entire training dataset.
 */
export function validateDataset(
  features: FeatureVector[],
  labels: number[],
): DatasetValidation {
  const issues: string[] = [];
  let warningCount = 0;
  let validCount = 0;

  // Per-record validation
  for (let i = 0; i < features.length; i++) {
    const result = validateTrainingRecord(features[i], labels[i]);
    if (result.valid) validCount++;
    warningCount += result.warnings.length;
  }

  // Class balance
  const positive = labels.filter((y) => y === 1).length;
  const negative = labels.length - positive;
  const ratio =
    labels.length > 0 ? Math.min(positive, negative) / labels.length : 0;

  if (ratio < 0.05) {
    issues.push(
      `Severe class imbalance: minority class is only ${(ratio * 100).toFixed(1)}%`,
    );
  } else if (ratio < 0.1) {
    issues.push(
      `Class imbalance: minority class is ${(ratio * 100).toFixed(1)}% (target ≥10%)`,
    );
  }

  // Feature coverage
  const featureCoverage: Record<string, number> = {};
  if (features.length > 0) {
    const keys = Object.keys(features[0]) as (keyof FeatureVector)[];
    for (const key of keys) {
      const nonNaN = features.filter((f) => !isNaN(f[key])).length;
      featureCoverage[key] = nonNaN / features.length;
    }

    // Warn about features with very low coverage
    for (const [key, coverage] of Object.entries(featureCoverage)) {
      if (
        coverage < 0.2 &&
        !key.startsWith('has') &&
        !key.startsWith('round')
      ) {
        issues.push(
          `Feature '${key}' has only ${(coverage * 100).toFixed(0)}% coverage`,
        );
      }
    }
  }

  // Minimum sample check
  if (features.length < 50) {
    issues.push(
      `Insufficient data: ${features.length} samples (minimum 50 for Tier 1)`,
    );
  }

  return {
    totalSamples: features.length,
    validSamples: validCount,
    warningCount,
    classBalance: { positive, negative, ratio },
    featureCoverage,
    issues,
  };
}
