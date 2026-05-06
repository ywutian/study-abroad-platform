import { Injectable, Logger } from '@nestjs/common';
import type { AdmissionResult, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PredictionService } from '../prediction.service';
import { admissionCaseToProfileInput } from './case-to-profile-input';

export interface BacktestFilter {
  /** Restrict to cases in these years. */
  years?: number[];
  /** Restrict to specific schools. */
  schoolIds?: string[];
  /** Restrict to cases with one of these outcomes. Default: ADMITTED + REJECTED. */
  results?: AdmissionResult[];
  /** Require `isVerified=true` (default: true). */
  requireVerified?: boolean;
  /** Require reviewStatus = APPROVED (default: true). */
  requireApproved?: boolean;
  /** Sampling limit. */
  limit?: number;
}

export interface BacktestCaseRow {
  caseId: string;
  schoolId: string;
  schoolName: string;
  year: number;
  round?: string | null;
  actual: AdmissionResult;
  actualBinary: 0 | 1;
  predictedProbability: number;
  predictedTier: string;
  confidence: string;
  selectivityBand?: string;
  brier: number;
  logLoss: number;
}

export interface ReliabilityBin {
  lower: number;
  upper: number;
  count: number;
  meanPredicted: number;
  meanActual: number;
  ece: number; // |predicted - actual| * (count / total)
}

export interface BacktestSummary {
  totalCases: number;
  brierScore: number;
  logLoss: number;
  accuracy: number;
  auc: number;
  ece10: number;
  reliabilityBins: ReliabilityBin[];
  byTier: Record<
    string,
    { count: number; meanPredicted: number; meanActual: number }
  >;
}

export interface BacktestOutput {
  filter: BacktestFilter;
  summary: BacktestSummary;
  rows: BacktestCaseRow[];
}

/**
 * Replays historical admission cases through the live prediction pipeline
 * and measures calibration quality (Brier, log-loss, AUC, ECE) against
 * actual outcomes.
 *
 * Only `ADMITTED` / `REJECTED` cases count — `WAITLISTED` / `DEFERRED`
 * are excluded by default because their outcomes aren't a clean 0/1 label.
 *
 * Persistence is bypassed: every prediction goes through
 * `PredictionService.previewPredict`, so backtest runs don't pollute the
 * live `PredictionResult` table or memory system.
 */
@Injectable()
export class HistoricalBacktestService {
  private readonly logger = new Logger(HistoricalBacktestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prediction: PredictionService,
  ) {}

  async run(filter: BacktestFilter = {}): Promise<BacktestOutput> {
    const where: Prisma.AdmissionCaseWhereInput = {
      isVerified: filter.requireVerified !== false ? true : undefined,
      reviewStatus: filter.requireApproved !== false ? 'APPROVED' : undefined,
      result: { in: filter.results ?? ['ADMITTED', 'REJECTED'] },
      ...(filter.years && filter.years.length > 0
        ? { year: { in: filter.years } }
        : {}),
      ...(filter.schoolIds && filter.schoolIds.length > 0
        ? { schoolId: { in: filter.schoolIds } }
        : {}),
    };

    const cases = await this.prisma.admissionCase.findMany({
      where,
      include: { school: true, highSchool: true },
      take: filter.limit,
      orderBy: { year: 'desc' },
    });

    this.logger.log(`Backtest: loaded ${cases.length} cases`);

    const rows: BacktestCaseRow[] = [];
    for (const c of cases) {
      try {
        const profileInput = admissionCaseToProfileInput(c as any);
        const { results } = await this.prediction.previewPredict(profileInput, [
          c.schoolId,
        ]);
        const r = results[0];
        if (!r) continue;

        const actualBinary: 0 | 1 = c.result === 'ADMITTED' ? 1 : 0;
        const pred = clamp01(r.probability ?? 0);
        const brier = (pred - actualBinary) ** 2;
        const logLoss = -(
          actualBinary * Math.log(pred + 1e-12) +
          (1 - actualBinary) * Math.log(1 - pred + 1e-12)
        );

        rows.push({
          caseId: c.id,
          schoolId: c.schoolId,
          schoolName: c.school?.name ?? c.schoolId,
          year: c.year,
          round: c.round,
          actual: c.result,
          actualBinary,
          predictedProbability: pred,
          predictedTier: r.tier,
          confidence: r.confidence,
          selectivityBand: (r as any).selectivityBand,
          brier,
          logLoss,
        });
      } catch (err) {
        this.logger.warn(`Backtest: case ${c.id} failed`, err as any);
      }
    }

    return {
      filter,
      rows,
      summary: computeSummary(rows),
    };
  }
}

function clamp01(x: number): number {
  return Math.max(1e-4, Math.min(1 - 1e-4, x));
}

export function computeSummary(rows: BacktestCaseRow[]): BacktestSummary {
  const n = rows.length;
  if (n === 0) {
    return {
      totalCases: 0,
      brierScore: 0,
      logLoss: 0,
      accuracy: 0,
      auc: 0,
      ece10: 0,
      reliabilityBins: [],
      byTier: {},
    };
  }

  const brier = mean(rows.map((r) => r.brier));
  const logLoss = mean(rows.map((r) => r.logLoss));
  const accuracy =
    rows.filter(
      (r) =>
        (r.predictedProbability >= 0.5 && r.actualBinary === 1) ||
        (r.predictedProbability < 0.5 && r.actualBinary === 0),
    ).length / n;

  const auc = rocAuc(
    rows.map((r) => r.predictedProbability),
    rows.map((r) => r.actualBinary),
  );

  const reliabilityBins = reliability(rows, 10);
  const ece10 = reliabilityBins.reduce((s, b) => s + b.ece, 0);

  const byTier: Record<
    string,
    { count: number; meanPredicted: number; meanActual: number }
  > = {};
  for (const r of rows) {
    const key = r.predictedTier ?? 'unknown';
    if (!byTier[key])
      byTier[key] = { count: 0, meanPredicted: 0, meanActual: 0 };
    byTier[key].count += 1;
    byTier[key].meanPredicted += r.predictedProbability;
    byTier[key].meanActual += r.actualBinary;
  }
  for (const key of Object.keys(byTier)) {
    const b = byTier[key];
    b.meanPredicted /= b.count;
    b.meanActual /= b.count;
  }

  return {
    totalCases: n,
    brierScore: brier,
    logLoss,
    accuracy,
    auc,
    ece10,
    reliabilityBins,
    byTier,
  };
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function reliability(rows: BacktestCaseRow[], bins: number): ReliabilityBin[] {
  const total = rows.length;
  const width = 1 / bins;
  const out: ReliabilityBin[] = [];
  for (let i = 0; i < bins; i += 1) {
    const lower = i * width;
    const upper = i === bins - 1 ? 1.0001 : (i + 1) * width;
    const members = rows.filter(
      (r) => r.predictedProbability >= lower && r.predictedProbability < upper,
    );
    if (members.length === 0) {
      out.push({
        lower,
        upper,
        count: 0,
        meanPredicted: 0,
        meanActual: 0,
        ece: 0,
      });
      continue;
    }
    const mp = mean(members.map((r) => r.predictedProbability));
    const ma = mean(members.map((r) => r.actualBinary));
    out.push({
      lower,
      upper,
      count: members.length,
      meanPredicted: mp,
      meanActual: ma,
      ece: Math.abs(mp - ma) * (members.length / total),
    });
  }
  return out;
}

/**
 * ROC-AUC via the Mann-Whitney-U identity. Expects scores in [0,1] and
 * binary labels 0/1. Returns 0.5 if only one class is present.
 */
export function rocAuc(scores: number[], labels: (0 | 1)[]): number {
  const n = scores.length;
  if (n === 0) return 0.5;
  const pos: number[] = [];
  const neg: number[] = [];
  for (let i = 0; i < n; i += 1) {
    (labels[i] === 1 ? pos : neg).push(scores[i]);
  }
  if (pos.length === 0 || neg.length === 0) return 0.5;
  // Rank-sum
  const indexed = scores
    .map((s, i) => ({ s, label: labels[i] }))
    .sort((a, b) => a.s - b.s);
  let rank = 1;
  let i = 0;
  let posRankSum = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].s === indexed[i].s) j += 1;
    const avgRank = (rank + rank + (j - i)) / 2;
    for (let k = i; k <= j; k += 1) {
      if (indexed[k].label === 1) posRankSum += avgRank;
    }
    rank += j - i + 1;
    i = j + 1;
  }
  const nPos = pos.length;
  const nNeg = neg.length;
  const u = posRankSum - (nPos * (nPos + 1)) / 2;
  return u / (nPos * nNeg);
}
