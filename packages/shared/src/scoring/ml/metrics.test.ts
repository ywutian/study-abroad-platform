import { describe, it, expect } from 'vitest';
import {
  computeAucRoc,
  computeBrierScore,
  computeECE,
  computeLogLoss,
  computeAccuracy,
  computeCalibrationCurve,
  computePSI,
} from './metrics';

describe('computeAucRoc', () => {
  it('is 1 for perfect separation and 0 when fully inverted', () => {
    const preds = [0.9, 0.8, 0.2, 0.1];
    expect(computeAucRoc(preds, [1, 1, 0, 0])).toBeCloseTo(1, 10);
    expect(computeAucRoc(preds, [0, 0, 1, 1])).toBeCloseTo(0, 10);
  });

  it('falls back to 0.5 when one class is absent', () => {
    // AUC is undefined with no negatives (or no positives) — must not divide by
    // zero and must not look like a good score.
    expect(computeAucRoc([0.9, 0.8], [1, 1])).toBe(0.5);
    expect(computeAucRoc([0.9, 0.8], [0, 0])).toBe(0.5);
  });

  it('returns 0 for empty input', () => {
    expect(computeAucRoc([], [])).toBe(0);
  });
});

describe('computeBrierScore', () => {
  it('is 0 when perfect and 1 when maximally wrong', () => {
    expect(computeBrierScore([1, 0], [1, 0])).toBe(0);
    expect(computeBrierScore([0, 1], [1, 0])).toBe(1);
  });

  it('is the mean squared error', () => {
    // (0.5-1)^2 + (0.5-0)^2 = 0.5, over 2 samples.
    expect(computeBrierScore([0.5, 0.5], [1, 0])).toBeCloseTo(0.25, 10);
  });
});

describe('computeECE', () => {
  it('is 0 when confidence matches outcome', () => {
    expect(computeECE([0, 0], [0, 0])).toBeCloseTo(0, 10);
  });

  it('equals the confidence gap when fully overconfident', () => {
    // Both land in the top bin: accuracy 0, confidence 0.95.
    expect(computeECE([0.95, 0.95], [0, 0])).toBeCloseTo(0.95, 10);
  });
});

describe('computeLogLoss', () => {
  it('stays finite for a confidently wrong prediction', () => {
    // Unclamped this is -log(0) = Infinity, which would poison any average
    // built on top of it.
    const loss = computeLogLoss([0], [1]);
    expect(Number.isFinite(loss)).toBe(true);
    expect(loss).toBeGreaterThan(10);
  });

  it('is near 0 when confidently right', () => {
    expect(computeLogLoss([1, 0], [1, 0])).toBeCloseTo(0, 5);
  });
});

describe('computeAccuracy', () => {
  it('thresholds at 0.5 inclusive', () => {
    expect(computeAccuracy([0.6, 0.4], [1, 0])).toBe(1);
    expect(computeAccuracy([0.5], [1])).toBe(1);
    expect(computeAccuracy([0.49], [1])).toBe(0);
  });
});

describe('computeCalibrationCurve', () => {
  it('bins every sample exactly once', () => {
    const preds = [0.05, 0.15, 0.95, 1];
    const bins = computeCalibrationCurve(preds, [0, 0, 1, 1]);
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(preds.length);
  });

  it('drops empty bins and reports per-bin rates', () => {
    const bins = computeCalibrationCurve([0.05, 0.05], [1, 0]);
    expect(bins).toEqual([{ predictedMean: 0.05, actualRate: 0.5, count: 2 }]);
  });
});

describe('computePSI', () => {
  it('is 0 for identical distributions', () => {
    const dist = [0.05, 0.15, 0.25, 0.35, 0.45];
    expect(computePSI(dist, dist)).toBeCloseTo(0, 10);
  });

  it('exceeds the 0.25 "significant shift" threshold when the mass moves', () => {
    const before = [0.05, 0.05, 0.05, 0.05];
    const after = [0.95, 0.95, 0.95, 0.95];
    expect(computePSI(before, after)).toBeGreaterThan(0.25);
  });

  it('returns 0 when either side is empty', () => {
    expect(computePSI([], [0.5])).toBe(0);
    expect(computePSI([0.5], [])).toBe(0);
  });
});
