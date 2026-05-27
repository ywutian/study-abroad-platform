#!/usr/bin/env -S ts-node --transpile-only
/**
 * Learn prediction coefficients from real AdmissionCase outcomes — Step 1.
 *
 * Goal: surface what the data SAYS about each (gpa_band × test_band × geo ×
 * round) cell's true admit-rate lift over the school's CDS anchor — and
 * compare to the counselor engine's hand-tuned multiplier for the same cell.
 *
 * This is descriptive stats with propensity weighting, NOT yet a fitted
 * regression. The goal at this step is to answer: do the engine's hand-tuned
 * coefficients (gpaBand ×1.3 / testBand ×1.3 / geo ×1.5 etc.) match the data,
 * and where do they diverge?
 *
 * Two-phase script:
 *   Phase A (DB-dependent): pull AdmissionCase + School and dump
 *   a stable training-data JSON to `scripts/training-data/`.
 *   Phase B (offline, deterministic): load the cached JSON, compute per-cell
 *   weighted empirical lift, write a markdown report.
 *
 * Run:
 *   # First time (needs Cloud SQL Proxy + DATABASE_URL):
 *   pnpm --filter api exec tsx scripts/learn-prediction-coefficients.ts --dump
 *   # Subsequent runs (offline, reads cached JSON):
 *   pnpm --filter api exec tsx scripts/learn-prediction-coefficients.ts
 *
 * Output:
 *   apps/api/scripts/training-data/residual-lift-features-<ts>.json   (cached features)
 *   apps/api/scripts/training-data/residual-lift-features-latest.json (latest pointer)
 *   apps/api/verification-report/learned-vs-handtuned-<ts>.md         (report)
 *
 * Why residual log-odds (not raw probability):
 *   target = logit(y) - logit(anchor)
 *   This lets us interpret each band's "lift" independently of the school's
 *   own selectivity. Hand-tuned multipliers like `×1.3 above-75th-percentile`
 *   correspond to log-odds-lift ≈ log(1.3) ≈ +0.26 — directly comparable.
 *
 * Why propensity weights:
 *   AdmissionCase is self-reported, skews prestige-admit (empirical scorer
 *   measured 51% admit at T5 vs ~5% population truth). Without re-weighting,
 *   naive averages over-credit the lift attributed to top profiles. We weight
 *   each row by population_share / sample_share for its (tier, hook) cell.
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

const ROOT_DIR = resolve(__dirname, '..');
const TRAINING_DIR = resolve(ROOT_DIR, 'scripts/training-data');
const REPORT_DIR = resolve(ROOT_DIR, 'verification-report');
const LATEST_CACHE = resolve(
  TRAINING_DIR,
  'residual-lift-features-latest.json',
);

const DUMP = process.argv.includes('--dump');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

interface TrainingRow {
  caseId: string;
  schoolNameNorm: string;
  schoolName: string;
  usNewsRank: number | null;
  // School features
  acceptanceRate: number | null; // percent (e.g. 5.4 for 5.4%)
  intlAcceptanceRate: number | null;
  oosAcceptanceRate: number | null;
  edAcceptanceRate: number | null;
  eaAcceptanceRate: number | null;
  sat25: number | null;
  sat75: number | null;
  gpaDistribution: Record<string, number> | null;
  state: string | null;
  isPrivate: boolean;
  // Profile features
  gpa4: number | null;
  bestSat: number | null;
  applyingTestOptional: boolean;
  isInternational: boolean;
  nationality: string | null;
  highSchoolState: string | null;
  isLegacy: boolean;
  isFirstGen: boolean;
  recruitedAthlete: boolean;
  // Application
  applicationRound: string;
  applicationYear: number;
  // Outcome
  result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED';
  y: number;
}

type GpaBand = 'below_25' | '25_50' | '50_75' | 'above_75' | 'unknown';
type SatBand = 'below_25' | '25_75' | 'above_75' | 'TO' | 'unknown';
type GeoBand =
  | 'intl'
  | 'oos_public'
  | 'in_state_public'
  | 'private'
  | 'unknown';
type RoundBand = 'ED' | 'ED2' | 'EA' | 'REA' | 'RD' | 'unknown';

interface CellStats {
  gpaBand: GpaBand;
  satBand: SatBand;
  geoBand: GeoBand;
  roundBand: RoundBand;
  n: number;
  weightedN: number;
  meanY: number; // unweighted, just for sanity
  weightedMeanY: number; // primary observed probability
  // 95% bootstrap CI for weightedMeanY (B=400 resamples)
  ciLow: number;
  ciHigh: number;
  meanAnchor: number;
  // Probability-domain prediction the engine WOULD output for this cell.
  // Computed by composing the engine's hand-tuned per-axis multipliers and
  // clamping to a sane probability range. Primary metric for "is the engine
  // close to the data?" — independent of log-odds saturation.
  engineP: number;
  probDeltaPp: number; // (weightedMeanY - engineP) × 100
  // Secondary, log-odds-domain. Reported only when both weightedMeanY and
  // meanAnchor are in [0.05, 0.95]; otherwise reported as null/NaN to
  // discourage misinterpretation. (logit saturates near 0 / 1.)
  observedLiftLogOdds: number | null;
  observedLiftMultiplier: number | null;
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function parseRangeMidpoint(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const matches = raw.match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return undefined;
  const values = matches.map(Number).filter(Number.isFinite);
  if (!values.length) return undefined;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function parseJsonArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function normalizeNationality(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase();
  if (['CHINA', 'CN', 'PRC'].includes(upper)) return 'CN';
  if (['INDIA', 'IN'].includes(upper)) return 'IN';
  if (['UNITED STATES', 'USA', 'US'].includes(upper)) return 'US';
  return upper.slice(0, 2);
}

function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object' && v && 'toNumber' in v) {
    try {
      const n = (v as { toNumber: () => number }).toNumber();
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
}

const clamp01 = (x: number) => Math.max(0.01, Math.min(0.99, x));
const logit = (p: number) => Math.log(p / (1 - p));
const safeMean = (xs: number[]) =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
const weightedMean = (vals: number[], weights: number[]) => {
  let num = 0;
  let den = 0;
  for (let i = 0; i < vals.length; i++) {
    num += vals[i] * weights[i];
    den += weights[i];
  }
  return den > 0 ? num / den : 0;
};

// ───────────────────────────────────────────────────────────────────────────
// Phase A — dump training features from DB
// ───────────────────────────────────────────────────────────────────────────

async function dumpFromDb(): Promise<TrainingRow[]> {
  console.log('Pulling AdmissionCase + School from DB...');
  const cases = await prisma.admissionCase.findMany({
    where: {
      result: { in: ['ADMITTED', 'REJECTED', 'WAITLISTED'] },
      year: { gte: 2022 },
    },
    select: {
      id: true,
      year: true,
      round: true,
      result: true,
      gpa9: true,
      gpa10: true,
      gpa11: true,
      gpa12: true,
      gpaScale: true,
      satRange: true,
      actRange: true,
      testScores: true,
      nationality: true,
      demographicTags: true,
      highSchool: { select: { state: true } },
      school: {
        select: {
          nameNorm: true,
          name: true,
          usNewsRank: true,
          acceptanceRate: true,
          intlAcceptanceRate: true,
          oosAcceptanceRate: true,
          edAcceptanceRate: true,
          eaAcceptanceRate: true,
          sat25: true,
          sat75: true,
          gpaDistribution: true,
          state: true,
          isPrivate: true,
        },
      },
    },
  });
  console.log(`  pulled ${cases.length} terminal AdmissionCase rows.`);

  const rows: TrainingRow[] = [];
  for (const c of cases) {
    if (!c.school) continue;
    const s = c.school;

    // GPA: use highest grade available, normalize to 4.0 scale
    const gpaValues = [c.gpa9, c.gpa10, c.gpa11, c.gpa12].filter(
      (g): g is number => g != null,
    );
    if (gpaValues.length === 0 && c.gpa11 == null && c.gpa12 == null) {
      // skip cases with no GPA at all
      continue;
    }
    const gpaRaw = c.gpa11 ?? c.gpa12 ?? gpaValues[gpaValues.length - 1];
    const gpaScale = c.gpaScale ?? 4;
    const gpa4 = gpaRaw != null ? (gpaRaw / gpaScale) * 4.0 : null;

    // SAT: parse range midpoint OR pull from testScores JSON
    const satFromRange = parseRangeMidpoint(c.satRange);
    const satFromTestScores = parseJsonArray(c.testScores)
      .filter((t: { type?: string; score?: number }) => t.type === 'SAT')
      .map((t: { type?: string; score?: number }) => num(t.score))
      .filter((n): n is number => n != null);
    const bestSat =
      satFromRange != null
        ? satFromRange
        : satFromTestScores.length > 0
          ? Math.max(...satFromTestScores)
          : null;

    // Test-optional: no SAT, no ACT
    const applyingTestOptional = bestSat == null && c.actRange == null;

    const tags = c.demographicTags ?? [];
    const nationality = normalizeNationality(c.nationality);
    const isInternational =
      tags.includes('international') ||
      (nationality != null && nationality !== 'US');
    const isFirstGen = tags.includes('first_gen');
    const isLegacy = tags.includes('legacy');
    const recruitedAthlete =
      tags.includes('athlete') || tags.includes('recruited');

    const y =
      c.result === 'ADMITTED' ? 1.0 : c.result === 'WAITLISTED' ? 0.5 : 0.0;

    rows.push({
      caseId: c.id,
      schoolNameNorm: s.nameNorm,
      schoolName: s.name,
      usNewsRank: s.usNewsRank,
      acceptanceRate: num(s.acceptanceRate),
      intlAcceptanceRate: num(s.intlAcceptanceRate),
      oosAcceptanceRate: num(s.oosAcceptanceRate),
      edAcceptanceRate: num(s.edAcceptanceRate),
      eaAcceptanceRate: num(s.eaAcceptanceRate),
      sat25: s.sat25,
      sat75: s.sat75,
      gpaDistribution: s.gpaDistribution as Record<string, number> | null,
      state: s.state,
      isPrivate: s.isPrivate ?? false,
      gpa4,
      bestSat,
      applyingTestOptional,
      isInternational,
      nationality: nationality ?? null,
      highSchoolState: c.highSchool?.state ?? null,
      isLegacy,
      isFirstGen,
      recruitedAthlete,
      applicationRound: (c.round ?? 'RD').toUpperCase(),
      applicationYear: c.year,
      result: c.result as 'ADMITTED' | 'REJECTED' | 'WAITLISTED',
      y,
    });
  }

  mkdirSync(TRAINING_DIR, { recursive: true });
  const versioned = resolve(
    TRAINING_DIR,
    `residual-lift-features-${TIMESTAMP}.json`,
  );
  const payload = {
    generatedAt: new Date().toISOString(),
    cohort: '2022-2026',
    rowCount: rows.length,
    rows,
  };
  writeFileSync(versioned, JSON.stringify(payload, null, 2));
  writeFileSync(LATEST_CACHE, JSON.stringify(payload, null, 2));
  console.log(`  wrote ${rows.length} usable rows → ${versioned}`);
  console.log(`  also wrote → ${LATEST_CACHE}`);
  return rows;
}

function loadCached(): TrainingRow[] {
  if (!existsSync(LATEST_CACHE)) {
    throw new Error(
      `No cached features at ${LATEST_CACHE}. Run with --dump first.`,
    );
  }
  const payload = JSON.parse(readFileSync(LATEST_CACHE, 'utf8'));
  console.log(
    `Loaded ${payload.rowCount} cached rows from ${LATEST_CACHE} (generated ${payload.generatedAt}).`,
  );
  return payload.rows as TrainingRow[];
}

// ───────────────────────────────────────────────────────────────────────────
// Anchor + band derivation
// ───────────────────────────────────────────────────────────────────────────

function computeAnchor(row: TrainingRow): number | null {
  // Round-specific anchor first.
  if (row.applicationRound === 'ED' && row.edAcceptanceRate != null) {
    return row.edAcceptanceRate > 1
      ? row.edAcceptanceRate / 100
      : row.edAcceptanceRate;
  }
  if (row.applicationRound === 'EA' && row.eaAcceptanceRate != null) {
    return row.eaAcceptanceRate > 1
      ? row.eaAcceptanceRate / 100
      : row.eaAcceptanceRate;
  }
  // International applicants
  if (row.isInternational && row.intlAcceptanceRate != null) {
    return row.intlAcceptanceRate > 1
      ? row.intlAcceptanceRate / 100
      : row.intlAcceptanceRate;
  }
  // OOS publics (highSchool state ≠ school state)
  if (
    row.state != null &&
    row.highSchoolState != null &&
    row.state !== row.highSchoolState &&
    row.oosAcceptanceRate != null
  ) {
    return row.oosAcceptanceRate > 1
      ? row.oosAcceptanceRate / 100
      : row.oosAcceptanceRate;
  }
  if (row.acceptanceRate != null) {
    return row.acceptanceRate > 1
      ? row.acceptanceRate / 100
      : row.acceptanceRate;
  }
  return null;
}

function gpaBandFor(row: TrainingRow): GpaBand {
  if (row.gpa4 == null) return 'unknown';

  if (row.gpaDistribution) {
    const bands: Array<{ key: string; lo: number; hi: number }> = [
      { key: '<3.00', lo: 0, hi: 3.0 },
      { key: '3.00-3.24', lo: 3.0, hi: 3.25 },
      { key: '3.25-3.49', lo: 3.25, hi: 3.5 },
      { key: '3.50-3.74', lo: 3.5, hi: 3.75 },
      { key: '3.75-4.00', lo: 3.75, hi: 4.01 },
    ];
    const raw = bands.map((b) => Number(row.gpaDistribution?.[b.key] ?? 0));
    const total = raw.reduce((a, b) => a + b, 0);
    if (total > 0) {
      const norm =
        total > 2 ? raw.map((v) => v / 100) : raw.map((v) => v / total);
      let cum = 0;
      let pct = 0;
      let found = false;
      for (let i = 0; i < bands.length; i++) {
        if (row.gpa4 >= bands[i].hi) {
          cum += norm[i];
        } else if (row.gpa4 >= bands[i].lo) {
          const frac = (row.gpa4 - bands[i].lo) / (bands[i].hi - bands[i].lo);
          pct = cum + norm[i] * frac;
          found = true;
          break;
        } else {
          pct = cum;
          found = true;
          break;
        }
      }
      if (!found) pct = cum;
      if (pct < 0.25) return 'below_25';
      if (pct < 0.5) return '25_50';
      if (pct < 0.75) return '50_75';
      return 'above_75';
    }
  }

  // Fallback: GPA → equivalent-SAT vs school sat25/75
  if (row.sat25 && row.sat75) {
    const equivSat = (row.gpa4 - 2.0) * 100 + 1000;
    if (equivSat < row.sat25) return 'below_25';
    if (equivSat >= row.sat75) return 'above_75';
    const mid = (row.sat25 + row.sat75) / 2;
    return equivSat >= mid ? '50_75' : '25_50';
  }
  return 'unknown';
}

function satBandFor(row: TrainingRow): SatBand {
  if (row.applyingTestOptional || row.bestSat == null) return 'TO';
  if (!row.sat25 || !row.sat75) return 'unknown';
  if (row.bestSat < row.sat25) return 'below_25';
  if (row.bestSat >= row.sat75) return 'above_75';
  return '25_75';
}

function geoBandFor(row: TrainingRow): GeoBand {
  if (row.isInternational) return 'intl';
  // Private schools: geo distinction is muted (no in-state vs OOS).
  // Treat all domestic private applicants as a single bucket.
  if (row.isPrivate) return 'private';
  // Public schools: need both applicant state and school state to decide
  // in-state vs OOS. If the applicant's HS state is unknown, we cannot
  // assign a public-school geo bucket — return 'unknown' rather than
  // silently defaulting to OOS (the v1 bug that broke the v1 report).
  if (!row.state || !row.highSchoolState) return 'unknown';
  if (row.highSchoolState === row.state) return 'in_state_public';
  return 'oos_public';
}

function roundBandFor(row: TrainingRow): RoundBand {
  const r = row.applicationRound;
  if (r === 'ED' || r === 'EARLY_DECISION') return 'ED';
  if (r === 'ED2' || r === 'ED_II') return 'ED2';
  if (r === 'EA' || r === 'EARLY_ACTION') return 'EA';
  if (r === 'REA' || r === 'SCEA') return 'REA';
  if (r === 'RD' || r === 'REGULAR' || r === 'REGULAR_DECISION') return 'RD';
  return 'unknown';
}

// ───────────────────────────────────────────────────────────────────────────
// Propensity weights — correct for self-selection bias by tier
// ───────────────────────────────────────────────────────────────────────────

type Tier = 'T5' | 'T6_20' | 'T21_50' | 'T51_100' | 'T100plus';

function tierFor(row: TrainingRow): Tier {
  const r = row.usNewsRank ?? 999;
  if (r <= 5) return 'T5';
  if (r <= 20) return 'T6_20';
  if (r <= 50) return 'T21_50';
  if (r <= 100) return 'T51_100';
  return 'T100plus';
}

// Rough CDS-derived population admit rate per US-News tier. Crude — refine later
// from actual prediction-closure-latest.json acceptanceRate by tier.
const POPULATION_ADMIT_RATE: Record<Tier, number> = {
  T5: 0.05,
  T6_20: 0.1,
  T21_50: 0.25,
  T51_100: 0.55,
  T100plus: 0.7,
};

function computePropensityWeights(rows: TrainingRow[]): number[] {
  const byTier: Record<string, { n: number; admits: number }> = {};
  for (const r of rows) {
    const t = tierFor(r);
    byTier[t] = byTier[t] || { n: 0, admits: 0 };
    byTier[t].n++;
    byTier[t].admits += r.y;
  }
  const sampleRateByTier: Record<string, number> = {};
  for (const t of Object.keys(byTier)) {
    sampleRateByTier[t] = byTier[t].admits / byTier[t].n;
  }
  const weights = rows.map((r) => {
    const t = tierFor(r);
    const popP = POPULATION_ADMIT_RATE[t];
    const sampP = sampleRateByTier[t];
    const popQ = 1 - popP;
    const sampQ = 1 - sampP;
    const isAdmit = r.y >= 0.5;
    const w = isAdmit
      ? sampP > 0
        ? popP / sampP
        : 1
      : sampQ > 0
        ? popQ / sampQ
        : 1;
    return Math.max(0.05, Math.min(5, w));
  });
  return weights;
}

// ───────────────────────────────────────────────────────────────────────────
// Per-cell descriptive stats
// ───────────────────────────────────────────────────────────────────────────

interface CellAccumulator {
  gpa: GpaBand;
  sat: SatBand;
  geo: GeoBand;
  round: RoundBand;
  ys: number[];
  anchors: number[];
  ws: number[];
}

/**
 * Mulberry32 — fast deterministic PRNG for reproducible bootstrap resampling.
 * Same seed = same CIs across runs.
 */
function makeRng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bootstrap 95% CI for weighted mean of `ys` using weights `ws`.
 *
 * Method: standard non-parametric bootstrap on (y_i, w_i) pairs sampled
 * UNIFORMLY with replacement, recomputing the weighted mean of each resample.
 *
 * Earlier versions sampled proportionally to weights AND then applied weights
 * again in the resample mean — that double-counted the weights, biasing the
 * CI away from the point estimate. The v2 fix: sample uniformly, then apply
 * the same weighted-mean formula used for the point estimate. Result: CI
 * always brackets the point estimate (modulo tail-percentile rounding).
 */
function bootstrapCI(
  ys: number[],
  ws: number[],
  B = 400,
  seed = 17,
): [number, number] {
  const n = ys.length;
  if (n === 0) return [0, 0];
  const rng = makeRng(seed);
  const means: number[] = new Array(B);
  for (let b = 0; b < B; b++) {
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      // Uniform draw from [0, n) with replacement — standard non-parametric
      // bootstrap. NOT weighted sampling (that double-counts).
      const idx = Math.floor(rng() * n);
      num += ys[idx] * ws[idx];
      den += ws[idx];
    }
    means[b] = den > 0 ? num / den : 0;
  }
  means.sort((a, b) => a - b);
  const lo = means[Math.floor(0.025 * B)];
  const hi = means[Math.floor(0.975 * B)];
  return [lo, hi];
}

function descriptiveStats(rows: TrainingRow[], weights: number[]): CellStats[] {
  const cells: Record<string, CellAccumulator> = {};

  // Invariant: every anchor in (0, 1); every weight in [0.05, 5].
  for (let i = 0; i < rows.length; i++) {
    const a = computeAnchor(rows[i]);
    if (a == null) continue;
    if (a <= 0 || a >= 1 || !Number.isFinite(a)) {
      throw new Error(
        `INVARIANT VIOLATED: anchor=${a} for case ${rows[i].caseId} @ ${rows[i].schoolNameNorm}`,
      );
    }
    if (weights[i] < 0.05 || weights[i] > 5 || !Number.isFinite(weights[i])) {
      throw new Error(
        `INVARIANT VIOLATED: weight=${weights[i]} for case ${rows[i].caseId} (must be in [0.05, 5])`,
      );
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const anchor = computeAnchor(r);
    if (anchor == null) continue;
    const gpa = gpaBandFor(r);
    const sat = satBandFor(r);
    const geo = geoBandFor(r);
    const round = roundBandFor(r);
    const key = `${gpa}|${sat}|${geo}|${round}`;
    if (!cells[key]) {
      cells[key] = { gpa, sat, geo, round, ys: [], anchors: [], ws: [] };
    }
    cells[key].ys.push(r.y);
    cells[key].anchors.push(anchor);
    cells[key].ws.push(weights[i]);
  }

  const result: CellStats[] = [];
  for (const key of Object.keys(cells)) {
    const c = cells[key];
    const meanY = safeMean(c.ys);
    const wMeanY = weightedMean(c.ys, c.ws);
    const meanAnchor = safeMean(c.anchors);

    // Engine probability prediction for this cell — anchor × hand-tuned product, capped to [0.01, 0.99]
    const engineMult =
      ENGINE_HAND_TUNED.gpa[c.gpa] *
      ENGINE_HAND_TUNED.sat[c.sat] *
      ENGINE_HAND_TUNED.geo[c.geo] *
      ENGINE_HAND_TUNED.round[c.round];
    const engineP = Math.max(0.01, Math.min(0.99, meanAnchor * engineMult));
    const probDeltaPp = (wMeanY - engineP) * 100;

    // Log-odds-domain comparison ONLY when both probabilities are in [0.05, 0.95]
    // — outside this range logit saturates and the multiplier is misleading.
    let observedLiftLogOdds: number | null = null;
    let observedLiftMultiplier: number | null = null;
    if (
      wMeanY >= 0.05 &&
      wMeanY <= 0.95 &&
      meanAnchor >= 0.05 &&
      meanAnchor <= 0.95
    ) {
      observedLiftLogOdds = logit(wMeanY) - logit(meanAnchor);
      observedLiftMultiplier = Math.exp(observedLiftLogOdds);
    }

    // Bootstrap CI for weighted mean Y. Sanity-check: the point estimate must
    // fall within ±5pp of the 95% CI (some slack for tail-percentile rounding
    // on small n; if the gap is bigger the bootstrap method is wrong).
    const [ciLow, ciHigh] = c.ys.length >= 5 ? bootstrapCI(c.ys, c.ws) : [0, 1];
    if (c.ys.length >= 5 && (wMeanY < ciLow - 0.05 || wMeanY > ciHigh + 0.05)) {
      throw new Error(
        `INVARIANT VIOLATED: bootstrap CI [${ciLow.toFixed(3)}, ${ciHigh.toFixed(3)}] does not bracket point estimate ${wMeanY.toFixed(3)} for cell ${c.gpa}|${c.sat}|${c.geo}|${c.round} (n=${c.ys.length}). Bootstrap method bug.`,
      );
    }

    // Sanity invariant — final stats must be in valid ranges
    if (wMeanY < 0 || wMeanY > 1) {
      throw new Error(
        `INVARIANT VIOLATED: weightedMeanY=${wMeanY} for cell ${key} (must be in [0, 1])`,
      );
    }
    if (engineP < 0 || engineP > 1) {
      throw new Error(`INVARIANT VIOLATED: engineP=${engineP} for cell ${key}`);
    }

    result.push({
      gpaBand: c.gpa,
      satBand: c.sat,
      geoBand: c.geo,
      roundBand: c.round,
      n: c.ys.length,
      weightedN: c.ws.reduce((a, b) => a + b, 0),
      meanY,
      weightedMeanY: wMeanY,
      ciLow,
      ciHigh,
      meanAnchor,
      engineP,
      probDeltaPp,
      observedLiftLogOdds,
      observedLiftMultiplier,
    });
  }
  return result.sort((a, b) => b.n - a.n);
}

// ───────────────────────────────────────────────────────────────────────────
// Engine hand-tuned multipliers — mirrors counselor-modifiers.ts at 2026-05-27
// ───────────────────────────────────────────────────────────────────────────

const ENGINE_HAND_TUNED: {
  gpa: Record<GpaBand, number>;
  sat: Record<SatBand, number>;
  geo: Record<GeoBand, number>;
  round: Record<RoundBand, number>;
} = {
  gpa: {
    below_25: 0.5,
    '25_50': 0.85,
    '50_75': 1.1,
    above_75: 1.3,
    unknown: 1.0,
  },
  sat: {
    below_25: 0.5,
    '25_75': 1.0,
    above_75: 1.3,
    TO: 0.85,
    unknown: 1.0,
  },
  geo: {
    intl: 0.4,
    oos_public: 0.7,
    in_state_public: 1.5,
    private: 1.0,
    unknown: 1.0,
  },
  round: {
    ED: 2.5,
    ED2: 1.8,
    EA: 1.2,
    REA: 1.2,
    RD: 1.0,
    unknown: 1.0,
  },
};

function engineHandTunedLiftMultiplier(c: CellStats): number {
  return (
    ENGINE_HAND_TUNED.gpa[c.gpaBand] *
    ENGINE_HAND_TUNED.sat[c.satBand] *
    ENGINE_HAND_TUNED.geo[c.geoBand] *
    ENGINE_HAND_TUNED.round[c.roundBand]
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Report
// ───────────────────────────────────────────────────────────────────────────

function writeReport(stats: CellStats[], rows: TrainingRow[]) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const path = resolve(REPORT_DIR, `learned-vs-handtuned-${TIMESTAMP}.md`);

  const totalN = rows.length;
  const totalAdmit = rows.filter((r) => r.y === 1).length;
  const totalReject = rows.filter((r) => r.y === 0).length;
  const totalWl = rows.filter((r) => r.y === 0.5).length;
  const cellsWithN10Plus = stats.filter((c) => c.n >= 10);
  const cellsWithN30Plus = stats.filter((c) => c.n >= 30);

  // Geo bucket distribution — sanity check that the v1 bug ("everything →
  // oos_public") is fixed. v2 expects ~5 buckets with roughly proportional
  // counts.
  const geoDist: Record<string, number> = {};
  for (const r of rows) {
    const a = computeAnchor(r);
    if (a == null) continue;
    const g = geoBandFor(r);
    geoDist[g] = (geoDist[g] || 0) + 1;
  }

  const lines: string[] = [];
  lines.push(`# Learned vs hand-tuned coefficients — ${TIMESTAMP}`);
  lines.push('');
  lines.push(
    `**Sample**: ${totalN} terminal AdmissionCase rows (${totalAdmit} ADMITTED, ${totalReject} REJECTED, ${totalWl} WAITLISTED). Cohort 2022-2026.`,
  );
  lines.push('');
  lines.push(
    '**Geo bucket distribution** (sanity check — v1 had all rows in `oos_public` due to bucketing bug):',
  );
  lines.push('');
  for (const g of Object.keys(geoDist).sort()) {
    lines.push(`- \`${g}\`: ${geoDist[g]} rows`);
  }
  lines.push('');
  lines.push(
    '**Method**: each row is bucketed into (gpa_band × sat_band × geo × round). Anchor = school CDS overall rate (or round / intl / OOS override). Weight = `population_admit_rate(tier) / sample_admit_rate(tier)`, capped to [0.05, 5]. The 95% CI on `observed_p` is computed by 400-iteration weighted bootstrap with a deterministic seed (Mulberry32) for reproducibility.',
  );
  lines.push('');
  lines.push('**Primary metric — `probDelta_pp`** (probability domain):');
  lines.push('');
  lines.push('```');
  lines.push(
    'engine_p = clamp(anchor × engine_handtuned_multiplier_product, 0.01, 0.99)',
  );
  lines.push('probDelta_pp = (observed_p - engine_p) × 100');
  lines.push('```');
  lines.push('');
  lines.push(
    'Positive `probDelta_pp` means engine **under-predicts** for this cell. Negative means engine **over-predicts**.',
  );
  lines.push('');
  lines.push(
    '**Secondary metric — `obsLift_×`** (log-odds multiplier): reported only when both `observed_p` and `anchor` are in [0.05, 0.95]. Outside that range logit saturates and the multiplier becomes uninterpretable (e.g. v1 reported 129× for cells where observed_p was 0.97 — a logit artifact, not a real 129× lift).',
  );
  lines.push('');
  lines.push(
    `## Cells with n ≥ 30 (high-confidence: ${cellsWithN30Plus.length} cells)`,
  );
  lines.push('');
  lines.push(
    '| n | gpa | sat | geo | round | anchor | observed_p (95% CI) | engine_p | probDelta_pp | obsLift_× | engineLift_× |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cellsWithN30Plus) {
    const obsLiftStr =
      c.observedLiftMultiplier != null
        ? `${c.observedLiftMultiplier.toFixed(2)}×`
        : '—';
    const engineLift = engineHandTunedLiftMultiplier(c);
    lines.push(
      `| ${c.n} | ${c.gpaBand} | ${c.satBand} | ${c.geoBand} | ${c.roundBand} | ${(c.meanAnchor * 100).toFixed(1)}% | ${(c.weightedMeanY * 100).toFixed(1)}% (${(c.ciLow * 100).toFixed(0)}-${(c.ciHigh * 100).toFixed(0)}) | ${(c.engineP * 100).toFixed(1)}% | ${c.probDeltaPp >= 0 ? '+' : ''}${c.probDeltaPp.toFixed(1)} | ${obsLiftStr} | ${engineLift.toFixed(2)}× |`,
    );
  }
  lines.push('');
  lines.push(
    `## Cells with 10 ≤ n < 30 (directional: ${cellsWithN10Plus.length - cellsWithN30Plus.length} cells)`,
  );
  lines.push('');
  lines.push(
    '| n | gpa | sat | geo | round | anchor | observed_p (95% CI) | engine_p | probDelta_pp | obsLift_× | engineLift_× |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cellsWithN10Plus) {
    if (c.n >= 30) continue;
    const obsLiftStr =
      c.observedLiftMultiplier != null
        ? `${c.observedLiftMultiplier.toFixed(2)}×`
        : '—';
    const engineLift = engineHandTunedLiftMultiplier(c);
    lines.push(
      `| ${c.n} | ${c.gpaBand} | ${c.satBand} | ${c.geoBand} | ${c.roundBand} | ${(c.meanAnchor * 100).toFixed(1)}% | ${(c.weightedMeanY * 100).toFixed(1)}% (${(c.ciLow * 100).toFixed(0)}-${(c.ciHigh * 100).toFixed(0)}) | ${(c.engineP * 100).toFixed(1)}% | ${c.probDeltaPp >= 0 ? '+' : ''}${c.probDeltaPp.toFixed(1)} | ${obsLiftStr} | ${engineLift.toFixed(2)}× |`,
    );
  }
  lines.push('');
  lines.push('## Top calibration gaps (n ≥ 30, |probDelta_pp| > 10)');
  lines.push('');
  const bigGap = cellsWithN30Plus
    .filter((c) => Math.abs(c.probDeltaPp) > 10)
    .sort((a, b) => Math.abs(b.probDeltaPp) - Math.abs(a.probDeltaPp));
  if (bigGap.length === 0) {
    lines.push('_No high-confidence cells with |probDelta_pp| > 10._');
  } else {
    for (const c of bigGap) {
      const direction =
        c.probDeltaPp > 0 ? 'engine UNDER-predicts' : 'engine OVER-predicts';
      lines.push(
        `- **${c.gpaBand} × ${c.satBand} × ${c.geoBand} × ${c.roundBand}** (n=${c.n}): observed ${(c.weightedMeanY * 100).toFixed(1)}% vs engine ${(c.engineP * 100).toFixed(1)}% — Δ ${c.probDeltaPp >= 0 ? '+' : ''}${c.probDeltaPp.toFixed(1)}pp (${direction}); 95% CI ${(c.ciLow * 100).toFixed(0)}-${(c.ciHigh * 100).toFixed(0)}%`,
      );
    }
  }

  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push(
    '- **Per-axis marginal table intentionally dropped from v2.** Marginal averages over the 4 axes are jointly determined — collapsing them produces misleading numbers (v1 reported `gpa.25_50` lift 10× because those cells happened to co-occur with strong SAT). Only fitted regression (Step 2) can decompose per-axis cleanly.',
  );
  lines.push(
    '- **Self-selection bias is partially uncorrected.** Propensity reweighting is per-tier only; does not condition on within-tier features. A full propensity model (Step 2) will condition on more axes.',
  );
  lines.push(
    `- **n=${totalN} usable rows** for 4-dimensional cells. Cells with n < 30 are in the "directional" table, not the high-confidence one.`,
  );
  lines.push(
    '- **Anchor resolution is simplified** — school-level CDS rate with round / intl / OOS overrides. No CDS-band cell lookup, no `gpaDistribution`-based anchor refinement, no hook log-odds shifts.',
  );
  lines.push(
    '- **Population admit rate per tier is a rough estimate** (T5: 5%, T6-20: 10%, T21-50: 25%, T51-100: 55%, T100+: 70%). Per-school CDS-derived rates would tighten the propensity correction.',
  );
  lines.push(
    '- **Round bucketing**: REA / SCEA bucketed separately from EA. ED2 separately from ED.',
  );
  lines.push(
    '- **Bootstrap CI uses a deterministic seed** (Mulberry32, seed=17) for reproducibility — same data → same CIs across runs.',
  );
  lines.push(
    '- **Invariants enforced at runtime**: every anchor ∈ (0, 1); every weight ∈ [0.05, 5]; every observed_p ∈ [0, 1]; every engine_p ∈ [0, 1]. Script throws on violation.',
  );

  writeFileSync(path, lines.join('\n'));
  console.log(`Wrote report → ${path}`);
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  let rows: TrainingRow[];
  if (DUMP) {
    rows = await dumpFromDb();
  } else {
    if (!existsSync(LATEST_CACHE)) {
      console.error(
        `No cached features at ${LATEST_CACHE}. Run with --dump first (requires DATABASE_URL).`,
      );
      process.exit(1);
    }
    rows = loadCached();
  }

  console.log(`Computing propensity weights...`);
  const weights = computePropensityWeights(rows);
  const wMin = Math.min(...weights);
  const wMax = Math.max(...weights);
  console.log(
    `  weight range: [${wMin.toFixed(2)}, ${wMax.toFixed(2)}] (capped at [0.05, 5])`,
  );

  console.log(`Computing per-cell descriptive stats...`);
  const stats = descriptiveStats(rows, weights);
  console.log(`  ${stats.length} unique cells`);
  console.log(`  ${stats.filter((c) => c.n >= 10).length} cells with n ≥ 10`);

  writeReport(stats, rows);

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
