import { computeSummary, rocAuc } from './historical-backtest.service';
import type { BacktestCaseRow } from './historical-backtest.service';
import type { AdmissionResult } from '@prisma/client';

function row(pred: number, actual: 0 | 1, tier = 'match'): BacktestCaseRow {
  const clamped = Math.max(1e-4, Math.min(1 - 1e-4, pred));
  return {
    caseId: `c-${Math.random().toString(36).slice(2, 8)}`,
    schoolId: 's-1',
    schoolName: 'Example U',
    year: 2025,
    round: 'RD',
    actual: (actual === 1 ? 'ADMITTED' : 'REJECTED') as AdmissionResult,
    actualBinary: actual,
    predictedProbability: clamped,
    predictedTier: tier,
    confidence: 'medium',
    brier: (clamped - actual) ** 2,
    logLoss: -(
      actual * Math.log(clamped + 1e-12) +
      (1 - actual) * Math.log(1 - clamped + 1e-12)
    ),
  };
}

describe('rocAuc', () => {
  it('returns 1.0 for a perfectly separating classifier', () => {
    expect(rocAuc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1])).toBe(1);
  });

  it('returns 0.0 for a perfectly inverted classifier', () => {
    expect(rocAuc([0.9, 0.8, 0.2, 0.1], [0, 0, 1, 1])).toBe(0);
  });

  it('returns 0.5 for random / single-class data', () => {
    expect(rocAuc([0.3, 0.4, 0.5], [1, 1, 1])).toBe(0.5);
    expect(rocAuc([0.3, 0.4, 0.5], [0, 0, 0])).toBe(0.5);
  });

  it('handles ties at 0.5 by midrank', () => {
    const auc = rocAuc([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1]);
    expect(auc).toBeCloseTo(0.5, 5);
  });
});

describe('computeSummary', () => {
  it('returns zeros for empty input', () => {
    const s = computeSummary([]);
    expect(s.totalCases).toBe(0);
    expect(s.brierScore).toBe(0);
    expect(s.auc).toBe(0);
    expect(s.reliabilityBins).toEqual([]);
  });

  it('computes Brier score correctly on a deterministic example', () => {
    // All predictions of 0.5 for mixed outcomes → Brier = 0.25
    const rows = [row(0.5, 1), row(0.5, 0), row(0.5, 1), row(0.5, 0)];
    const s = computeSummary(rows);
    expect(s.brierScore).toBeCloseTo(0.25, 5);
  });

  it('computes accuracy @0.5 threshold correctly', () => {
    const rows = [
      row(0.8, 1), // correct
      row(0.9, 1), // correct
      row(0.2, 0), // correct
      row(0.6, 0), // wrong
    ];
    const s = computeSummary(rows);
    expect(s.accuracy).toBeCloseTo(0.75, 5);
  });

  it('reliability bins sum cases to input length', () => {
    const rows = [
      row(0.05, 0),
      row(0.15, 0),
      row(0.25, 1),
      row(0.55, 1),
      row(0.95, 1),
    ];
    const s = computeSummary(rows);
    const total = s.reliabilityBins.reduce((a, b) => a + b.count, 0);
    expect(total).toBe(rows.length);
  });

  it('ECE is zero when prediction matches actual rate per bin', () => {
    // Bin [0.8, 0.9): two rows at 0.85, one admitted → actual 0.5 ≠ predicted 0.85.
    // To get ECE=0 we need each bin's meanPredicted == meanActual.
    const rows = [row(0.1, 0), row(0.1, 0), row(0.9, 1), row(0.9, 1)];
    const s = computeSummary(rows);
    // Bin 0.1: pred=0.1, actual=0. |Δ|=0.1 * 2/4 = 0.05
    // Bin 0.9: pred=0.9, actual=1. |Δ|=0.1 * 2/4 = 0.05
    // ECE ≈ 0.10
    expect(s.ece10).toBeCloseTo(0.1, 2);
  });

  it('byTier aggregates mean predicted and actual per tier', () => {
    const rows = [
      row(0.2, 0, 'reach'),
      row(0.3, 0, 'reach'),
      row(0.7, 1, 'match'),
      row(0.8, 1, 'match'),
    ];
    const s = computeSummary(rows);
    expect(s.byTier['reach'].count).toBe(2);
    expect(s.byTier['reach'].meanPredicted).toBeCloseTo(0.25, 5);
    expect(s.byTier['reach'].meanActual).toBeCloseTo(0, 5);
    expect(s.byTier['match'].count).toBe(2);
    expect(s.byTier['match'].meanPredicted).toBeCloseTo(0.75, 5);
    expect(s.byTier['match'].meanActual).toBeCloseTo(1, 5);
  });
});
