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
  meanY: number;
  weightedMeanY: number;
  meanAnchor: number;
  observedLiftLogOdds: number;
  observedLiftMultiplier: number;
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
  if (!row.state) return 'private';
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

function descriptiveStats(rows: TrainingRow[], weights: number[]): CellStats[] {
  const cells: Record<string, CellAccumulator> = {};

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
    const liftLogOdds = logit(clamp01(wMeanY)) - logit(clamp01(meanAnchor));
    result.push({
      gpaBand: c.gpa,
      satBand: c.sat,
      geoBand: c.geo,
      roundBand: c.round,
      n: c.ys.length,
      weightedN: c.ws.reduce((a, b) => a + b, 0),
      meanY,
      weightedMeanY: wMeanY,
      meanAnchor,
      observedLiftLogOdds: liftLogOdds,
      observedLiftMultiplier: Math.exp(liftLogOdds),
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

  const lines: string[] = [];
  lines.push(`# Learned vs hand-tuned coefficients — ${TIMESTAMP}`);
  lines.push('');
  lines.push(
    `**Sample**: ${totalN} terminal AdmissionCase rows (${totalAdmit} ADMITTED, ${totalReject} REJECTED, ${totalWl} WAITLISTED). Cohort 2022-2026.`,
  );
  lines.push('');
  lines.push(
    `**Method**: each row is bucketed into (gpa_band × sat_band × geo × round). Anchor = school CDS overall rate (or round / intl / OOS override). Weight = population_admit_rate(tier) / sample_admit_rate(tier), capped to [0.05, 5]. Observed lift = logit(weighted mean Y) - logit(mean anchor); expressed as multiplier = exp(lift_log_odds).`,
  );
  lines.push('');
  lines.push(
    `**How to read**: \`observedLift\` is what the data says the combined multiplier for this cell is. \`engineMult\` is the product of the hand-tuned per-axis multipliers. Big gap = engine is mis-calibrated for that cell.`,
  );
  lines.push('');
  lines.push(`## Cells with n ≥ 10 (${cellsWithN10Plus.length} cells)`);
  lines.push('');
  lines.push(
    '| n | weightedN | gpa | sat | geo | round | meanY | wMeanY | meanAnchor | observedLift | engineMult | delta |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cellsWithN10Plus) {
    const engine = engineHandTunedLiftMultiplier(c);
    const delta = c.observedLiftMultiplier - engine;
    lines.push(
      `| ${c.n} | ${c.weightedN.toFixed(1)} | ${c.gpaBand} | ${c.satBand} | ${c.geoBand} | ${c.roundBand} | ${c.meanY.toFixed(2)} | ${c.weightedMeanY.toFixed(2)} | ${c.meanAnchor.toFixed(3)} | ${c.observedLiftMultiplier.toFixed(2)}× | ${engine.toFixed(2)}× | ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} |`,
    );
  }

  lines.push('');
  lines.push(`## Big calibration gaps (cells with n ≥ 10 and |delta| > 0.5)`);
  lines.push('');
  const bigGap = cellsWithN10Plus
    .map((c) => ({
      c,
      delta: c.observedLiftMultiplier - engineHandTunedLiftMultiplier(c),
    }))
    .filter((x) => Math.abs(x.delta) > 0.5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (bigGap.length === 0) {
    lines.push('_No cells with absolute delta > 0.5×._');
  } else {
    for (const { c, delta } of bigGap) {
      const direction =
        delta > 0
          ? 'engine UNDER-credits this cell'
          : 'engine OVER-credits this cell';
      lines.push(
        `- **${c.gpaBand} × ${c.satBand} × ${c.geoBand} × ${c.roundBand}** (n=${c.n}): observed ${c.observedLiftMultiplier.toFixed(2)}× vs engine ${engineHandTunedLiftMultiplier(c).toFixed(2)}× — Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${direction})`,
      );
    }
  }

  lines.push('');
  lines.push('## Per-axis marginal lift (collapsing over other axes)');
  lines.push('');
  lines.push(
    'For each band on a single axis, weighted-average observed lift over all cells containing that band. Compare to the hand-tuned per-axis multiplier.',
  );
  lines.push('');

  const axes: Array<{
    name: string;
    band: keyof CellStats;
    handTuned: Record<string, number>;
  }> = [
    {
      name: 'GPA',
      band: 'gpaBand',
      handTuned: ENGINE_HAND_TUNED.gpa as Record<string, number>,
    },
    {
      name: 'SAT',
      band: 'satBand',
      handTuned: ENGINE_HAND_TUNED.sat as Record<string, number>,
    },
    {
      name: 'Geo',
      band: 'geoBand',
      handTuned: ENGINE_HAND_TUNED.geo as Record<string, number>,
    },
    {
      name: 'Round',
      band: 'roundBand',
      handTuned: ENGINE_HAND_TUNED.round as Record<string, number>,
    },
  ];
  for (const axis of axes) {
    lines.push(`### ${axis.name}`);
    lines.push('');
    lines.push(
      '| band | n cells | total n | weighted-avg observedLift | hand-tuned | delta |',
    );
    lines.push('|---|---|---|---|---|---|');
    const byBand: Record<
      string,
      { cells: number; n: number; lifts: number[]; weights: number[] }
    > = {};
    for (const c of stats) {
      const b = c[axis.band] as string;
      byBand[b] = byBand[b] || { cells: 0, n: 0, lifts: [], weights: [] };
      byBand[b].cells++;
      byBand[b].n += c.n;
      byBand[b].lifts.push(c.observedLiftMultiplier);
      byBand[b].weights.push(c.weightedN);
    }
    for (const band of Object.keys(byBand).sort()) {
      const v = byBand[band];
      const wAvg = weightedMean(v.lifts, v.weights);
      const hand = axis.handTuned[band] ?? 1.0;
      const delta = wAvg - hand;
      lines.push(
        `| ${band} | ${v.cells} | ${v.n} | ${wAvg.toFixed(2)}× | ${hand.toFixed(2)}× | ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Caveats');
  lines.push('');
  lines.push(
    '- **Per-axis marginals are tangled**: the marginal observed lift for `gpa.above_75` includes the lift contributions of whatever sat / geo / round bands those cases came from. The hand-tuned multipliers are designed to be composed multiplicatively, while observed lifts are jointly determined. The marginal table is directional, not literal — only a fitted regression (next PR) can decompose properly.',
  );
  lines.push(
    '- **Self-selection bias is partially uncorrected**. The propensity reweighting is per-tier only; it does not correct for within-tier selection (e.g. who self-reports a rejection vs admit). A full propensity model would condition on more features.',
  );
  lines.push(
    `- **n=${totalN} is small** for multi-dimensional cells. Cells with n < 10 are excluded from the per-cell table. Cells with n < 30 should still be treated as directional, not definitive.`,
  );
  lines.push(
    "- **Anchor resolution is simplified**: this script does not exactly replicate the engine's anchor logic (no CDS-band cell lookup, no `gpaDistribution`-based anchor refinement, no hook adjustments). It uses the school-level CDS admit rate with round / intl / OOS overrides.",
  );
  lines.push(
    '- **Population admit rate per tier is a rough estimate** (T5: 5%, T6-20: 10%, T21-50: 25%, T51-100: 55%, T100+: 70%). Per-school CDS-derived rates would tighten the propensity correction.',
  );
  lines.push(
    '- **Round bucketing**: REA / SCEA are bucketed separately from EA. ED2 is bucketed separately from ED.',
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
