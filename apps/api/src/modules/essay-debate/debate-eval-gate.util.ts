import { EssayDebateRating } from '@prisma/client';

/**
 * Phase 2 V1 PR3 — Day-7 decision-gate math.
 *
 * Pure functions, no I/O, lifted out of `scripts/debate-eval-gate.ts` so
 * Jest can unit-test them without booting Nest or the DB. The CLI script
 * is a thin wrapper that loads rows from Postgres and pipes them through
 * `runGate()`.
 *
 * Thresholds come from the 7-day plan:
 *   1. Fleiss κ across ≥3 evaluators ≥ 0.5
 *   2. Lumni-only evidence integrity rate ≥ 70%
 *   3. Lumni SHARP+USEFUL share ≥ ChatGPT control SHARP+USEFUL share
 */

export const DEFAULT_KAPPA_THRESHOLD = 0.5;
export const DEFAULT_EVIDENCE_RATE_THRESHOLD = 0.7;

export interface EvaluationRow {
  sessionId: string;
  turnIndex: number;
  evaluatorId: string;
  rating: EssayDebateRating;
  isChatGptControl: boolean;
  evidenceIntegrity: boolean | null;
}

export interface GateResult {
  pass: boolean;
  kappa: number | null;
  kappaItemCount: number;
  kappaRaterCount: number;
  evidenceRate: number | null;
  evidenceSampleSize: number;
  lumniSharpUsefulShare: number | null;
  lumniSampleSize: number;
  controlSharpUsefulShare: number | null;
  controlSampleSize: number;
  reasons: string[];
  thresholds: {
    kappa: number;
    evidenceRate: number;
  };
}

const ALL_RATINGS: EssayDebateRating[] = [
  'SHARP',
  'USEFUL',
  'GENERIC',
  'SYCOPHANTIC',
];

/**
 * Fleiss' κ — generalises Cohen's κ to N raters. Returns null if there
 * aren't enough overlapping ratings to compute it (need ≥2 raters on
 * ≥2 items with equal raters-per-item, per Fleiss 1971).
 *
 * Algorithm:
 *   P_i = (1 / N(N-1)) * (Σ_j n_ij² - N)
 *   P_bar = mean(P_i)
 *   p_j = (1 / NM) * Σ_i n_ij
 *   P_e = Σ_j p_j²
 *   κ = (P_bar - P_e) / (1 - P_e)
 *
 * When raters-per-item varies (e.g. evaluator 5 didn't reach item 17), we
 * keep only the modal-N items — Fleiss assumes equal raters per item.
 */
export function computeFleissKappa(rows: EvaluationRow[]): {
  kappa: number | null;
  itemCount: number;
  raterCount: number;
} {
  if (rows.length === 0) return { kappa: null, itemCount: 0, raterCount: 0 };

  const byItem = new Map<string, Map<string, EssayDebateRating>>();
  for (const r of rows) {
    const k = `${r.sessionId}#${r.turnIndex}`;
    if (!byItem.has(k)) byItem.set(k, new Map());
    byItem.get(k)!.set(r.evaluatorId, r.rating);
  }
  const ratersPerItem = Array.from(byItem.values()).map((m) => m.size);
  if (ratersPerItem.length === 0) {
    return { kappa: null, itemCount: 0, raterCount: 0 };
  }
  const N = mode(ratersPerItem);
  const eligible = Array.from(byItem.entries()).filter(
    ([, raters]) => raters.size === N,
  );
  if (eligible.length < 2 || N < 2) {
    return { kappa: null, itemCount: eligible.length, raterCount: N };
  }

  const M = eligible.length;
  const counts: number[][] = eligible.map(([, raters]) =>
    ALL_RATINGS.map(
      (cat) => Array.from(raters.values()).filter((v) => v === cat).length,
    ),
  );

  const Pi = counts.map((nij) => {
    const sumSq = nij.reduce((acc, n) => acc + n * n, 0);
    return (sumSq - N) / (N * (N - 1));
  });
  const Pbar = Pi.reduce((a, b) => a + b, 0) / M;

  const totalAssignments = N * M;
  const pj = ALL_RATINGS.map((_, j) => {
    const sumCol = counts.reduce((acc, r) => acc + r[j], 0);
    return sumCol / totalAssignments;
  });
  const Pe = pj.reduce((acc, p) => acc + p * p, 0);

  if (1 - Pe === 0) {
    return { kappa: 1, itemCount: M, raterCount: N };
  }
  const kappa = (Pbar - Pe) / (1 - Pe);
  return { kappa, itemCount: M, raterCount: N };
}

/**
 * Evidence-integrity rate over lumni turns (ChatGPT controls excluded).
 * Nulls in evidenceIntegrity drop out of both numerator and denominator
 * (counsellor declined to assess or turn had no evidence to assess).
 */
export function computeEvidenceRate(rows: EvaluationRow[]): {
  rate: number | null;
  sampleSize: number;
} {
  const considered = rows.filter(
    (r) => !r.isChatGptControl && r.evidenceIntegrity !== null,
  );
  if (considered.length === 0) return { rate: null, sampleSize: 0 };
  const truthy = considered.filter((r) => r.evidenceIntegrity === true).length;
  return { rate: truthy / considered.length, sampleSize: considered.length };
}

/**
 * Share of ratings that are SHARP or USEFUL within an arbitrary subset.
 */
export function computeSharpUsefulShare(rows: EvaluationRow[]): {
  share: number | null;
  sampleSize: number;
} {
  if (rows.length === 0) return { share: null, sampleSize: 0 };
  const positive = rows.filter(
    (r) => r.rating === 'SHARP' || r.rating === 'USEFUL',
  ).length;
  return { share: positive / rows.length, sampleSize: rows.length };
}

/**
 * Run the three-part decision gate. Pass iff:
 *   - κ ≥ thresholds.kappa, AND
 *   - evidence integrity rate ≥ thresholds.evidenceRate, AND
 *   - lumni SHARP+USEFUL share ≥ control SHARP+USEFUL share (or no controls)
 *
 * Surfaces specific reasons for any failure plus warnings when control
 * data is missing (gate still passes but should be re-run with controls
 * before flipping the feature flag).
 */
export function runGate(
  rows: EvaluationRow[],
  thresholds: { kappa: number; evidenceRate: number } = {
    kappa: DEFAULT_KAPPA_THRESHOLD,
    evidenceRate: DEFAULT_EVIDENCE_RATE_THRESHOLD,
  },
): GateResult {
  const lumniRows = rows.filter((r) => !r.isChatGptControl);
  const controlRows = rows.filter((r) => r.isChatGptControl);

  const kappaResult = computeFleissKappa(lumniRows);
  const evidence = computeEvidenceRate(rows);
  const lumniShare = computeSharpUsefulShare(lumniRows);
  const controlShare = computeSharpUsefulShare(controlRows);

  const reasons: string[] = [];
  if (kappaResult.kappa === null) {
    reasons.push(
      `κ undefined (not enough overlapping ratings; need ≥2 evaluators on the same items, got ${kappaResult.raterCount} raters × ${kappaResult.itemCount} items)`,
    );
  } else if (kappaResult.kappa < thresholds.kappa) {
    reasons.push(
      `κ=${kappaResult.kappa.toFixed(3)} below threshold ${thresholds.kappa}`,
    );
  }
  if (evidence.rate === null) {
    reasons.push('evidence integrity not assessed in any lumni turn');
  } else if (evidence.rate < thresholds.evidenceRate) {
    reasons.push(
      `evidence integrity rate=${(evidence.rate * 100).toFixed(1)}% below threshold ${(thresholds.evidenceRate * 100).toFixed(0)}%`,
    );
  }
  if (lumniShare.share !== null && controlShare.share !== null) {
    if (lumniShare.share < controlShare.share) {
      reasons.push(
        `lumni SHARP+USEFUL share ${(lumniShare.share * 100).toFixed(1)}% < ChatGPT control ${(controlShare.share * 100).toFixed(1)}% — no improvement over baseline`,
      );
    }
  } else if (controlRows.length === 0) {
    reasons.push(
      'WARN: no ChatGPT-control evaluations present — gate cannot verify lumni beat baseline',
    );
  }

  const kappaOk =
    kappaResult.kappa !== null && kappaResult.kappa >= thresholds.kappa;
  const evidenceOk =
    evidence.rate !== null && evidence.rate >= thresholds.evidenceRate;
  const controlOk =
    controlShare.share === null ||
    lumniShare.share === null ||
    lumniShare.share >= controlShare.share;
  const lumniPresent = lumniRows.length > 0;

  return {
    pass: kappaOk && evidenceOk && controlOk && lumniPresent,
    kappa: kappaResult.kappa,
    kappaItemCount: kappaResult.itemCount,
    kappaRaterCount: kappaResult.raterCount,
    evidenceRate: evidence.rate,
    evidenceSampleSize: evidence.sampleSize,
    lumniSharpUsefulShare: lumniShare.share,
    lumniSampleSize: lumniShare.sampleSize,
    controlSharpUsefulShare: controlShare.share,
    controlSampleSize: controlShare.sampleSize,
    reasons,
    thresholds,
  };
}

function formatBanner(pass: boolean): string {
  const bar = '═'.repeat(64);
  if (pass) {
    return `\n${bar}\n  PASS — DEBATE EVAL GATE\n${bar}`;
  }
  return `\n${bar}\n  FAIL — DEBATE EVAL GATE\n${bar}`;
}

function fmtRow(label: string, value: string, note?: string): string {
  const pad = label.padEnd(36, ' ');
  return `  ${pad}${value}${note ? `   (${note})` : ''}`;
}

function fmtNum(n: number | null, digits = 3): string {
  if (n === null) return 'n/a';
  return n.toFixed(digits);
}

function fmtPct(n: number | null): string {
  if (n === null) return 'n/a';
  return `${(n * 100).toFixed(1)}%`;
}

export function formatVerdict(result: GateResult): string {
  const lines: string[] = [];
  lines.push(formatBanner(result.pass));
  lines.push('');
  lines.push(
    fmtRow(
      `kappa (Fleiss, >= ${result.thresholds.kappa})`,
      fmtNum(result.kappa),
      `${result.kappaRaterCount} raters x ${result.kappaItemCount} items`,
    ),
  );
  lines.push(
    fmtRow(
      `evidence integrity (>= ${fmtPct(result.thresholds.evidenceRate)})`,
      fmtPct(result.evidenceRate),
      `n=${result.evidenceSampleSize}`,
    ),
  );
  lines.push(
    fmtRow(
      'lumni SHARP+USEFUL share',
      fmtPct(result.lumniSharpUsefulShare),
      `n=${result.lumniSampleSize}`,
    ),
  );
  lines.push(
    fmtRow(
      'control SHARP+USEFUL share',
      fmtPct(result.controlSharpUsefulShare),
      `n=${result.controlSampleSize}`,
    ),
  );
  lines.push('');
  if (result.reasons.length > 0) {
    lines.push('  Reasons:');
    for (const r of result.reasons) lines.push(`    - ${r}`);
  } else {
    lines.push('  All three thresholds met.');
  }
  lines.push('');
  if (result.pass) {
    lines.push(
      '  Next: flip `essay_debate_enabled` feature flag to { percentage: 10 }',
    );
    lines.push('  via the admin UI for canary rollout.');
  } else {
    lines.push(
      '  Next: do NOT enable the feature flag. Iterate on the prompt or',
    );
    lines.push('  context loader and re-run the eval before retrying.');
  }
  return lines.join('\n');
}

/** Statistical mode for integer arrays — small helper, no deps. */
function mode(arr: number[]): number {
  const counts = new Map<number, number>();
  for (const n of arr) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = arr[0];
  let bestCount = 0;
  for (const [k, v] of counts) {
    if (v > bestCount || (v === bestCount && k > best)) {
      best = k;
      bestCount = v;
    }
  }
  return best;
}
