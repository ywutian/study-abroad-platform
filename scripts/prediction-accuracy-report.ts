import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  computeBrierScore,
  computeCalibrationCurve,
  computeECE,
  resolveCanonicalPredictionOutcome,
  VERIFIED_OUTCOME_STATUSES,
} from '../packages/shared/src/scoring';
import type { OutcomeLabelStatus as OutcomeStatus } from '../packages/shared/src/scoring';

export type AccuracyCliOptions = {
  days: number;
  minGroup: number;
  priorWeight: number;
  format: 'text' | 'json';
};

type EvaluationRow = {
  predictionId: string;
  schoolId: string;
  schoolName: string;
  probability: number;
  tier: string | null;
  confidence: string | null;
  applicationRound: string | null;
  cohortKey: string | null;
  modelVersion: string;
  label: 0 | 1;
  createdAt: string;
  verifiedStatus: OutcomeStatus;
};

type Aggregate = {
  total: number;
  admits: number;
};

type BaselineChoice = {
  rate: number;
  source: 'school_round_cohort' | 'school_round' | 'school' | 'global';
};

function loadApiEnv() {
  const envPath = path.join(process.cwd(), 'apps/api/.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, valueRaw] = match;
    if (process.env[key] != null) continue;

    let value = valueRaw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv: string[]): AccuracyCliOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  const parsedDays = Number(values.get('days') ?? '365');
  const parsedMinGroup = Number(values.get('min-group') ?? '5');
  const parsedPriorWeight = Number(values.get('prior-weight') ?? '3');
  const format = values.get('format') === 'json' ? 'json' : 'text';

  return {
    days: Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 365,
    minGroup: Number.isFinite(parsedMinGroup) && parsedMinGroup > 0 ? parsedMinGroup : 5,
    priorWeight:
      Number.isFinite(parsedPriorWeight) && parsedPriorWeight >= 0 ? parsedPriorWeight : 3,
    format,
  };
}

function schoolRoundKey(schoolId: string, round: string | null): string {
  return `${schoolId}::${round ?? 'UNKNOWN'}`;
}

function schoolRoundCohortKey(
  schoolId: string,
  round: string | null,
  cohortKey: string | null
): string {
  return `${schoolId}::${round ?? 'UNKNOWN'}::${cohortKey ?? 'UNKNOWN'}`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function increment(map: Map<string, Aggregate>, key: string, label: 0 | 1) {
  const current = map.get(key) ?? { total: 0, admits: 0 };
  current.total += 1;
  current.admits += label;
  map.set(key, current);
}

function leaveOneOutRate(
  aggregate: Aggregate,
  rowLabel: 0 | 1,
  globalRate: number,
  priorWeight: number
): { count: number; rate: number } {
  const count = Math.max(aggregate.total - 1, 0);
  const admits = Math.max(aggregate.admits - rowLabel, 0);
  const smoothedRate = (admits + globalRate * priorWeight) / (count + priorWeight);
  return { count, rate: smoothedRate };
}

function selectBaseline(
  row: EvaluationRow,
  globalAggregate: Aggregate,
  bySchool: Map<string, Aggregate>,
  bySchoolRound: Map<string, Aggregate>,
  bySchoolRoundCohort: Map<string, Aggregate>,
  minGroup: number,
  priorWeight: number
): BaselineChoice {
  const globalRate = globalAggregate.admits / globalAggregate.total;
  const candidates: Array<BaselineChoice & { count: number }> = [];

  if (row.cohortKey) {
    const group = bySchoolRoundCohort.get(
      schoolRoundCohortKey(row.schoolId, row.applicationRound, row.cohortKey)
    );
    if (group) {
      const loo = leaveOneOutRate(group, row.label, globalRate, priorWeight);
      candidates.push({
        rate: loo.rate,
        source: 'school_round_cohort',
        count: loo.count,
      });
    }
  }

  const roundGroup = bySchoolRound.get(schoolRoundKey(row.schoolId, row.applicationRound));
  if (roundGroup) {
    const loo = leaveOneOutRate(roundGroup, row.label, globalRate, priorWeight);
    candidates.push({
      rate: loo.rate,
      source: 'school_round',
      count: loo.count,
    });
  }

  const schoolGroup = bySchool.get(row.schoolId);
  if (schoolGroup) {
    const loo = leaveOneOutRate(schoolGroup, row.label, globalRate, priorWeight);
    candidates.push({
      rate: loo.rate,
      source: 'school',
      count: loo.count,
    });
  }

  const firstQualified = candidates.find((candidate) => candidate.count >= minGroup);
  if (firstQualified) {
    return { rate: firstQualified.rate, source: firstQualified.source };
  }

  return {
    rate: globalRate,
    source: 'global',
  };
}

export type AccuracyReport =
  | {
      windowDays: number;
      sampleCount: 0;
      verdict: 'insufficient_verified_outcomes';
      message: string;
      outcomeInventory: Array<{
        status: string;
        result: string;
        count: number;
      }>;
    }
  | {
      windowDays: number;
      sampleCount: number;
      admittedCount: number;
      rejectedCount: number;
      modelMetrics: {
        brier: number;
        ece: number;
      };
      baselineMetrics: {
        brier: number;
        ece: number;
      };
      improvement: {
        brierDelta: number;
        eceDelta: number;
      };
      tierMonotonicity: {
        passes: boolean;
        tiers: Array<{
          tier: string;
          count: number;
          admitRate: number | null;
        }>;
      };
      confidenceSummary: Array<{
        confidence: string;
        count: number;
        admitRate: number | null;
      }>;
      baselineSourceMix: Record<string, number>;
      modelVersions: Record<string, number>;
      calibrationBins: Array<{
        predictedMean: number;
        actualRate: number;
        count: number;
      }>;
    };

export async function runPredictionAccuracyReport(
  partialOptions: Partial<AccuracyCliOptions> = {}
): Promise<AccuracyReport> {
  loadApiEnv();
  const options: AccuracyCliOptions = {
    days: partialOptions.days ?? 365,
    minGroup: partialOptions.minGroup ?? 5,
    priorWeight: partialOptions.priorWeight ?? 3,
    format: partialOptions.format ?? 'text',
  };
  const prisma = new PrismaClient();

  try {
    const cutoff = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
    const outcomeInventory = await prisma.predictionOutcomeLabelRecord.groupBy({
      by: ['status', 'result'],
      where: {
        createdAt: { gte: cutoff },
        result: { in: ['ADMITTED', 'REJECTED'] },
      },
      _count: {
        _all: true,
      },
    });

    const predictions = await prisma.predictionResult.findMany({
      where: {
        createdAt: { gte: cutoff },
        outcomeLabelRecords: {
          some: {
            status: { in: VERIFIED_OUTCOME_STATUSES },
            result: { in: ['ADMITTED', 'REJECTED'] },
          },
        },
      },
      select: {
        id: true,
        schoolId: true,
        probability: true,
        tier: true,
        confidence: true,
        applicationRound: true,
        cohortKey: true,
        modelVersion: true,
        createdAt: true,
        outcomeLabelRecords: {
          select: {
            result: true,
            status: true,
            isFinal: true,
            createdAt: true,
            resolvedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const schoolIds = [...new Set(predictions.map((item) => item.schoolId))];
    const schools = schoolIds.length
      ? await prisma.school.findMany({
          where: { id: { in: schoolIds } },
          select: { id: true, name: true, nameZh: true },
        })
      : [];
    const schoolMap = new Map(
      schools.map((school) => [school.id, school.name || school.nameZh || school.id])
    );

    const rows: EvaluationRow[] = predictions
      .map((prediction) => {
        const canonical = resolveCanonicalPredictionOutcome(prediction.outcomeLabelRecords);
        if (!canonical.eligibleForCalibration || !canonical.canonicalRecord) {
          return null;
        }

        return {
          predictionId: prediction.id,
          schoolId: prediction.schoolId,
          schoolName: schoolMap.get(prediction.schoolId) ?? prediction.schoolId,
          probability: Number(prediction.probability),
          tier: prediction.tier,
          confidence: prediction.confidence,
          applicationRound: prediction.applicationRound,
          cohortKey: prediction.cohortKey,
          modelVersion: prediction.modelVersion,
          label: canonical.canonicalRecord.result === 'ADMITTED' ? 1 : 0,
          createdAt: prediction.createdAt.toISOString(),
          verifiedStatus: canonical.canonicalRecord.status as OutcomeStatus,
        } satisfies EvaluationRow;
      })
      .filter((row): row is EvaluationRow => Boolean(row));

    if (rows.length === 0) {
      return {
        windowDays: options.days,
        sampleCount: 0,
        verdict: 'insufficient_verified_outcomes',
        message: 'No verified ADMITTED/REJECTED outcomes were found in the selected window.',
        outcomeInventory: outcomeInventory.map((item) => ({
          status: item.status,
          result: item.result,
          count: item._count._all,
        })),
      };
    }

    const globalAggregate: Aggregate = { total: 0, admits: 0 };
    const bySchool = new Map<string, Aggregate>();
    const bySchoolRound = new Map<string, Aggregate>();
    const bySchoolRoundCohort = new Map<string, Aggregate>();

    for (const row of rows) {
      globalAggregate.total += 1;
      globalAggregate.admits += row.label;
      increment(bySchool, row.schoolId, row.label);
      increment(bySchoolRound, schoolRoundKey(row.schoolId, row.applicationRound), row.label);
      if (row.cohortKey) {
        increment(
          bySchoolRoundCohort,
          schoolRoundCohortKey(row.schoolId, row.applicationRound, row.cohortKey),
          row.label
        );
      }
    }

    const modelPredictions = rows.map((row) => row.probability);
    const labels = rows.map((row) => row.label);
    const baselinePredictions = rows.map((row) =>
      selectBaseline(
        row,
        globalAggregate,
        bySchool,
        bySchoolRound,
        bySchoolRoundCohort,
        options.minGroup,
        options.priorWeight
      )
    );

    const modelBrier = computeBrierScore(modelPredictions, labels);
    const modelEce = computeECE(modelPredictions, labels, 10);
    const baselineBrier = computeBrierScore(
      baselinePredictions.map((item) => item.rate),
      labels
    );
    const baselineEce = computeECE(
      baselinePredictions.map((item) => item.rate),
      labels,
      10
    );

    const tierSummary = ['reach', 'match', 'safety'].map((tier) => {
      const subset = rows.filter((row) => row.tier === tier);
      const admits = subset.reduce((sum, row) => sum + row.label, 0);
      return {
        tier,
        count: subset.length,
        admitRate: subset.length ? admits / subset.length : null,
      };
    });

    const monotonicityHolds =
      tierSummary.every((item) => item.count > 0) &&
      (tierSummary[0].admitRate ?? 0) < (tierSummary[1].admitRate ?? 0) &&
      (tierSummary[1].admitRate ?? 0) < (tierSummary[2].admitRate ?? 0);

    const confidenceSummary = ['low', 'medium', 'high'].map((confidence) => {
      const subset = rows.filter((row) => row.confidence === confidence);
      const admits = subset.reduce((sum, row) => sum + row.label, 0);
      return {
        confidence,
        count: subset.length,
        admitRate: subset.length ? admits / subset.length : null,
      };
    });

    const baselineSourceMix = baselinePredictions.reduce<Record<string, number>>((acc, item) => {
      acc[item.source] = (acc[item.source] ?? 0) + 1;
      return acc;
    }, {});

    const modelVersions = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.modelVersion] = (acc[row.modelVersion] ?? 0) + 1;
      return acc;
    }, {});

    const calibrationBins = computeCalibrationCurve(modelPredictions, labels, 10).map((bin) => ({
      predictedMean: Number(bin.predictedMean.toFixed(4)),
      actualRate: Number(bin.actualRate.toFixed(4)),
      count: bin.count,
    }));

    return {
      windowDays: options.days,
      sampleCount: rows.length,
      admittedCount: labels.reduce((sum, label) => sum + label, 0),
      rejectedCount: rows.length - labels.reduce((sum, label) => sum + label, 0),
      modelMetrics: {
        brier: Number(modelBrier.toFixed(6)),
        ece: Number(modelEce.toFixed(6)),
      },
      baselineMetrics: {
        brier: Number(baselineBrier.toFixed(6)),
        ece: Number(baselineEce.toFixed(6)),
      },
      improvement: {
        brierDelta: Number((baselineBrier - modelBrier).toFixed(6)),
        eceDelta: Number((baselineEce - modelEce).toFixed(6)),
      },
      tierMonotonicity: {
        passes: monotonicityHolds,
        tiers: tierSummary.map((item) => ({
          ...item,
          admitRate: item.admitRate == null ? null : Number(item.admitRate.toFixed(4)),
        })),
      },
      confidenceSummary: confidenceSummary.map((item) => ({
        ...item,
        admitRate: item.admitRate == null ? null : Number(item.admitRate.toFixed(4)),
      })),
      baselineSourceMix,
      modelVersions,
      calibrationBins,
    };
  } finally {
    await prisma.$disconnect();
  }
}

export function renderPredictionAccuracyReport(report: AccuracyReport): string {
  const lines: string[] = ['Prediction Accuracy Report', `Window: last ${report.windowDays} days`];

  if (report.sampleCount === 0) {
    lines.push(
      'Verified samples: 0 (no COUNSELOR_VERIFIED / DOCUMENT_VERIFIED ADMITTED/REJECTED outcomes)'
    );
    if (report.outcomeInventory.length > 0) {
      lines.push('');
      lines.push('Outcome inventory');
      for (const item of report.outcomeInventory) {
        lines.push(`- ${item.status} / ${item.result}: ${item.count}`);
      }
    }
    return lines.join('\n');
  }

  lines.push(`Verified samples: ${report.sampleCount}`);
  lines.push(`Outcomes: ${report.admittedCount} admitted / ${report.rejectedCount} rejected`);
  lines.push('');
  lines.push(
    `Model Brier: ${report.modelMetrics.brier.toFixed(4)} | Baseline Brier: ${report.baselineMetrics.brier.toFixed(4)} | Delta: ${report.improvement.brierDelta.toFixed(4)}`
  );
  lines.push(
    `Model ECE:   ${report.modelMetrics.ece.toFixed(4)} | Baseline ECE:   ${report.baselineMetrics.ece.toFixed(4)} | Delta: ${report.improvement.eceDelta.toFixed(4)}`
  );
  lines.push('');
  lines.push('Tier monotonicity');
  for (const item of report.tierMonotonicity.tiers) {
    lines.push(
      `- ${item.tier}: ${item.count} samples, admit rate ${
        item.admitRate == null ? 'n/a' : formatPct(item.admitRate)
      }`
    );
  }
  lines.push(`- result: ${report.tierMonotonicity.passes ? 'PASS' : 'CHECK'}`);
  lines.push('');
  lines.push('Confidence buckets');
  for (const item of report.confidenceSummary) {
    lines.push(
      `- ${item.confidence}: ${item.count} samples, admit rate ${
        item.admitRate == null ? 'n/a' : formatPct(item.admitRate)
      }`
    );
  }
  lines.push('');
  lines.push('Baseline source mix');
  for (const [source, count] of Object.entries(report.baselineSourceMix)) {
    lines.push(`- ${source}: ${count}`);
  }
  lines.push('');
  lines.push('Model versions');
  for (const [version, count] of Object.entries(report.modelVersions)) {
    lines.push(`- ${version}: ${count}`);
  }
  lines.push('');
  lines.push('Calibration bins');
  for (const bin of report.calibrationBins) {
    lines.push(
      `- predicted ${formatPct(bin.predictedMean)} vs actual ${formatPct(bin.actualRate)} (${bin.count} samples)`
    );
  }
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await runPredictionAccuracyReport(options);

  if (options.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderPredictionAccuracyReport(report));
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  main().catch((error) => {
    console.error(
      '[prediction-accuracy-report] failed:',
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  });
}
