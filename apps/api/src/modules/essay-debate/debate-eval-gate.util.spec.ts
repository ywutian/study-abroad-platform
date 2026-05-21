/**
 * Phase 2 V1 PR3 — Day-7 decision-gate unit tests.
 *
 * Synthetic EvaluationRow[] fixtures pass through the gate math directly
 * (no DB, no Nest). Each fixture is hand-tuned so its verdict can be
 * checked by hand, then asserted against `runGate()`. Covers:
 *
 *   1. Clear PASS — high κ, ≥70% evidence rate, lumni > control.
 *   2. FAIL — random ratings drive κ below threshold.
 *   3. FAIL — high κ but evidence rate below threshold.
 *   4. FAIL — lumni SHARP+USEFUL share < ChatGPT control share.
 *   5. FAIL — only one rater (κ undefined → fail closed).
 *   6. PASS-with-warn — no control rows present.
 */
import { EssayDebateRating } from '@prisma/client';
import {
  EvaluationRow,
  computeEvidenceRate,
  computeFleissKappa,
  computeSharpUsefulShare,
  runGate,
} from './debate-eval-gate.util';

function row(
  sessionId: string,
  turnIndex: number,
  evaluatorId: string,
  rating: EssayDebateRating,
  isChatGptControl = false,
  evidenceIntegrity: boolean | null = null,
): EvaluationRow {
  return {
    sessionId,
    turnIndex,
    evaluatorId,
    rating,
    isChatGptControl,
    evidenceIntegrity,
  };
}

describe('debate-eval-gate · Fleiss kappa', () => {
  it('returns null when no rows', () => {
    expect(computeFleissKappa([])).toEqual({
      kappa: null,
      itemCount: 0,
      raterCount: 0,
    });
  });

  it('returns kappa = 1 when every rater agrees on every item', () => {
    const rows: EvaluationRow[] = [];
    for (let item = 0; item < 5; item++) {
      for (const ev of ['e1', 'e2', 'e3']) {
        rows.push(row('s', item, ev, 'SHARP'));
      }
    }
    expect(computeFleissKappa(rows).kappa).toBe(1);
  });

  it('returns kappa below 0.5 for random-like disagreement', () => {
    const rows: EvaluationRow[] = [
      row('s', 0, 'e1', 'SHARP'),
      row('s', 0, 'e2', 'USEFUL'),
      row('s', 0, 'e3', 'GENERIC'),
      row('s', 1, 'e1', 'USEFUL'),
      row('s', 1, 'e2', 'GENERIC'),
      row('s', 1, 'e3', 'SYCOPHANTIC'),
      row('s', 2, 'e1', 'GENERIC'),
      row('s', 2, 'e2', 'SYCOPHANTIC'),
      row('s', 2, 'e3', 'SHARP'),
      row('s', 3, 'e1', 'SYCOPHANTIC'),
      row('s', 3, 'e2', 'SHARP'),
      row('s', 3, 'e3', 'USEFUL'),
    ];
    const k = computeFleissKappa(rows).kappa;
    expect(k).not.toBeNull();
    expect(k!).toBeLessThan(0.5);
  });

  it('returns kappa above 0.5 when ratings cluster', () => {
    const rows: EvaluationRow[] = [
      row('s', 0, 'e1', 'SHARP'),
      row('s', 0, 'e2', 'SHARP'),
      row('s', 0, 'e3', 'USEFUL'),
      row('s', 1, 'e1', 'USEFUL'),
      row('s', 1, 'e2', 'USEFUL'),
      row('s', 1, 'e3', 'USEFUL'),
      row('s', 2, 'e1', 'SHARP'),
      row('s', 2, 'e2', 'SHARP'),
      row('s', 2, 'e3', 'SHARP'),
      row('s', 3, 'e1', 'GENERIC'),
      row('s', 3, 'e2', 'GENERIC'),
      row('s', 3, 'e3', 'GENERIC'),
    ];
    const { kappa, itemCount, raterCount } = computeFleissKappa(rows);
    expect(itemCount).toBe(4);
    expect(raterCount).toBe(3);
    expect(kappa).not.toBeNull();
    expect(kappa!).toBeGreaterThan(0.5);
  });
});

describe('debate-eval-gate · evidence rate', () => {
  it('returns null for empty input', () => {
    expect(computeEvidenceRate([])).toEqual({ rate: null, sampleSize: 0 });
  });

  it('excludes ChatGPT control rows from the denominator', () => {
    const rows: EvaluationRow[] = [
      row('s', 0, 'e1', 'SHARP', false, true),
      row('s', 0, 'e2', 'SHARP', false, true),
      row('s', 0, 'e3', 'SHARP', true, false), // control — excluded
    ];
    expect(computeEvidenceRate(rows)).toEqual({ rate: 1, sampleSize: 2 });
  });

  it('returns 70% rate for 7-true / 3-false (lumni only)', () => {
    const rows: EvaluationRow[] = [];
    for (let i = 0; i < 7; i++) {
      rows.push(row('s', i, 'e1', 'SHARP', false, true));
    }
    for (let i = 7; i < 10; i++) {
      rows.push(row('s', i, 'e1', 'GENERIC', false, false));
    }
    expect(computeEvidenceRate(rows)).toEqual({ rate: 0.7, sampleSize: 10 });
  });

  it('excludes null evidenceIntegrity from the denominator', () => {
    const rows: EvaluationRow[] = [
      row('s', 0, 'e1', 'SHARP', false, true),
      row('s', 0, 'e2', 'SHARP', false, null),
      row('s', 0, 'e3', 'SHARP', false, false),
    ];
    expect(computeEvidenceRate(rows)).toEqual({ rate: 0.5, sampleSize: 2 });
  });
});

describe('debate-eval-gate · SHARP+USEFUL share', () => {
  it('returns null for empty input', () => {
    expect(computeSharpUsefulShare([])).toEqual({
      share: null,
      sampleSize: 0,
    });
  });

  it('counts SHARP and USEFUL but not GENERIC or SYCOPHANTIC', () => {
    const rows: EvaluationRow[] = [
      row('s', 0, 'e1', 'SHARP'),
      row('s', 0, 'e2', 'USEFUL'),
      row('s', 0, 'e3', 'GENERIC'),
      row('s', 0, 'e4', 'SYCOPHANTIC'),
    ];
    expect(computeSharpUsefulShare(rows)).toEqual({
      share: 0.5,
      sampleSize: 4,
    });
  });
});

describe('debate-eval-gate · runGate end-to-end', () => {
  it('PASS — high kappa, >=70% evidence, lumni > control', () => {
    const rows: EvaluationRow[] = [];
    for (let item = 0; item < 5; item++) {
      for (const ev of ['e1', 'e2', 'e3']) {
        rows.push(row(`lumni-${item}`, 0, ev, 'SHARP', false, true));
      }
    }
    rows.push(row('lumni-extra', 0, 'e1', 'GENERIC', false, false));
    rows.push(row('lumni-extra', 0, 'e2', 'GENERIC', false, false));
    rows.push(row('lumni-extra', 0, 'e3', 'GENERIC', false, false));
    for (let item = 0; item < 4; item++) {
      for (const ev of ['e1', 'e2', 'e3']) {
        rows.push(row(`ctl-${item}`, 0, ev, 'GENERIC', true));
      }
    }
    const result = runGate(rows);
    expect(result.pass).toBe(true);
    expect(result.kappa).not.toBeNull();
    expect(result.kappa!).toBeGreaterThanOrEqual(0.5);
    expect(result.evidenceRate).not.toBeNull();
    expect(result.evidenceRate!).toBeGreaterThanOrEqual(0.7);
    expect(result.lumniSharpUsefulShare).not.toBeNull();
    expect(result.controlSharpUsefulShare).not.toBeNull();
    expect(result.lumniSharpUsefulShare!).toBeGreaterThanOrEqual(
      result.controlSharpUsefulShare!,
    );
  });

  it('FAIL — random ratings → kappa too low', () => {
    const rows: EvaluationRow[] = [
      row('s', 0, 'e1', 'SHARP', false, true),
      row('s', 0, 'e2', 'GENERIC', false, true),
      row('s', 0, 'e3', 'SYCOPHANTIC', false, true),
      row('s', 1, 'e1', 'USEFUL', false, true),
      row('s', 1, 'e2', 'SYCOPHANTIC', false, true),
      row('s', 1, 'e3', 'SHARP', false, true),
      row('s', 2, 'e1', 'GENERIC', false, true),
      row('s', 2, 'e2', 'SHARP', false, true),
      row('s', 2, 'e3', 'USEFUL', false, true),
    ];
    const result = runGate(rows);
    expect(result.pass).toBe(false);
    expect(
      result.reasons.some((r) => r.includes('kappa') || r.includes('κ')),
    ).toBe(true);
  });

  it('FAIL — strong kappa but evidence rate <70%', () => {
    const rows: EvaluationRow[] = [];
    for (let item = 0; item < 5; item++) {
      const integrity = item < 1; // 1/5 = 20%
      for (const ev of ['e1', 'e2', 'e3']) {
        rows.push(row(`s-${item}`, 0, ev, 'SHARP', false, integrity));
      }
    }
    const result = runGate(rows);
    expect(result.pass).toBe(false);
    expect(result.evidenceRate).not.toBeNull();
    expect(result.evidenceRate!).toBeLessThan(0.7);
    expect(result.reasons.some((r) => r.includes('evidence integrity'))).toBe(
      true,
    );
  });

  it('FAIL — lumni SHARP+USEFUL share below control', () => {
    const rows: EvaluationRow[] = [];
    for (let item = 0; item < 4; item++) {
      for (const ev of ['e1', 'e2', 'e3']) {
        rows.push(row(`l-${item}`, 0, ev, 'GENERIC', false, true));
      }
    }
    for (let item = 0; item < 4; item++) {
      for (const ev of ['e1', 'e2', 'e3']) {
        rows.push(row(`c-${item}`, 0, ev, 'SHARP', true));
      }
    }
    const result = runGate(rows);
    expect(result.pass).toBe(false);
    expect(
      result.reasons.some((r) => r.includes('no improvement over baseline')),
    ).toBe(true);
  });

  it('FAIL — only one rater (kappa undefined)', () => {
    const rows: EvaluationRow[] = [
      row('s', 0, 'e1', 'SHARP', false, true),
      row('s', 1, 'e1', 'SHARP', false, true),
    ];
    const result = runGate(rows);
    expect(result.pass).toBe(false);
    expect(result.kappa).toBeNull();
    expect(
      result.reasons.some((r) => r.includes('not enough overlapping ratings')),
    ).toBe(true);
  });

  it('PASS-with-warn when no ChatGPT-control rows exist', () => {
    const rows: EvaluationRow[] = [];
    for (let item = 0; item < 5; item++) {
      for (const ev of ['e1', 'e2', 'e3']) {
        rows.push(row(`s-${item}`, 0, ev, 'SHARP', false, true));
      }
    }
    const result = runGate(rows);
    expect(result.pass).toBe(true);
    expect(
      result.reasons.some((r) => r.includes('no ChatGPT-control evaluations')),
    ).toBe(true);
  });
});
