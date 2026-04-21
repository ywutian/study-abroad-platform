import { PrismaClient } from '@prisma/client';
import {
  computeBrierScore,
  computeECE,
  resolveCanonicalPredictionOutcome,
  VERIFIED_OUTCOME_STATUSES,
} from '../../packages/shared/src/scoring';
import { runPredictionAccuracyReport } from '../prediction-accuracy-report';
import { loadApiEnv } from './utils';
import type {
  AgentAuditNote,
  AgentFinding,
  PredictionAccuracyArtifact,
  PredictionSliceMetric,
} from './types';

type SliceDimension = PredictionSliceMetric['dimension'];

type VerifiedRow = {
  probability: number;
  label: 0 | 1;
  round: string;
  modelVersion: string;
  international: string;
  aid: string;
  schoolBand: string;
};

function bucketSchoolBand(rank: number | null): string {
  if (rank == null) return 'unknown';
  if (rank <= 10) return 'top_10';
  if (rank <= 25) return 'top_25';
  if (rank <= 50) return 'top_50';
  return 'other';
}

function buildSliceMetrics(rows: VerifiedRow[]): PredictionSliceMetric[] {
  const dimensions: Array<[SliceDimension, (row: VerifiedRow) => string]> = [
    ['schoolBand', (row) => row.schoolBand],
    ['round', (row) => row.round],
    ['international', (row) => row.international],
    ['aid', (row) => row.aid],
    ['modelVersion', (row) => row.modelVersion],
  ];

  const metrics: PredictionSliceMetric[] = [];
  for (const [dimension, accessor] of dimensions) {
    const buckets = new Map<string, VerifiedRow[]>();
    for (const row of rows) {
      const key = accessor(row);
      const current = buckets.get(key) ?? [];
      current.push(row);
      buckets.set(key, current);
    }

    for (const [slice, bucketRows] of buckets.entries()) {
      const probabilities = bucketRows.map((row) => row.probability);
      const labels = bucketRows.map((row) => row.label);
      metrics.push({
        dimension,
        slice,
        count: bucketRows.length,
        admitRate: bucketRows.length
          ? labels.reduce((sum, value) => sum + value, 0) / bucketRows.length
          : null,
        brier: bucketRows.length ? computeBrierScore(probabilities, labels) : null,
        ece: bucketRows.length ? computeECE(probabilities, labels) : null,
      });
    }
  }

  return metrics.sort(
    (left, right) =>
      left.dimension.localeCompare(right.dimension) ||
      right.count - left.count ||
      left.slice.localeCompare(right.slice)
  );
}

export async function runProbabilityAudit(days: number): Promise<{
  artifact: PredictionAccuracyArtifact;
  note: AgentAuditNote;
}> {
  loadApiEnv();
  const overall = await runPredictionAccuracyReport({ days, format: 'json' });
  const prisma = new PrismaClient();

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
        schoolId: true,
        probability: true,
        applicationRound: true,
        modelVersion: true,
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
        profile: {
          select: {
            needsFinancialAid: true,
            citizenship: true,
            countryOfResidence: true,
          },
        },
      },
    });

    const schoolIds = [...new Set(predictions.map((prediction) => prediction.schoolId))];
    const schools = schoolIds.length
      ? await prisma.school.findMany({
          where: { id: { in: schoolIds } },
          select: {
            id: true,
            usNewsRank: true,
          },
        })
      : [];
    const schoolRankMap = new Map(schools.map((school) => [school.id, school.usNewsRank]));

    const verifiedRows: VerifiedRow[] = predictions
      .map((prediction) => {
        const canonical = resolveCanonicalPredictionOutcome(prediction.outcomeLabelRecords);
        if (!canonical.eligibleForCalibration || !canonical.canonicalRecord) {
          return null;
        }

        const isInternational =
          Boolean(prediction.profile.citizenship) &&
          Boolean(prediction.profile.countryOfResidence) &&
          prediction.profile.citizenship !== 'US' &&
          prediction.profile.countryOfResidence !== 'US';

        return {
          probability: Number(prediction.probability),
          label: canonical.canonicalRecord.result === 'ADMITTED' ? 1 : 0,
          round: prediction.applicationRound ?? 'UNKNOWN',
          modelVersion: prediction.modelVersion,
          international: isInternational ? 'international' : 'domestic_or_unknown',
          aid:
            prediction.profile.needsFinancialAid === true
              ? 'needs_aid'
              : prediction.profile.needsFinancialAid === false
                ? 'no_aid'
                : 'aid_unknown',
          schoolBand: bucketSchoolBand(schoolRankMap.get(prediction.schoolId) ?? null),
        };
      })
      .filter((row): row is VerifiedRow => Boolean(row));

    const sliceMetrics = buildSliceMetrics(verifiedRows);

    const artifact: PredictionAccuracyArtifact =
      overall.sampleCount === 0
        ? {
            sampleCount: 0,
            verdict: 'insufficient_evidence',
            message: overall.message,
            brier: null,
            ece: null,
            calibrationBins: [],
            baselineComparison: {
              baselineBrier: null,
              baselineEce: null,
              brierDelta: null,
              eceDelta: null,
              tierMonotonicityPasses: null,
            },
            sliceMetrics,
            outcomeInventory: overall.outcomeInventory,
            modelVersions: {},
            realDataOnly: true,
          }
        : {
            sampleCount: overall.sampleCount,
            verdict: overall.sampleCount < 200 ? 'insufficient_evidence' : 'verified_accurate',
            message:
              overall.sampleCount < 200
                ? `Verified outcomes exist (${overall.sampleCount}) but remain below the 200-sample audit floor.`
                : 'Verified outcome metrics are available for calibration analysis.',
            brier: overall.modelMetrics.brier,
            ece: overall.modelMetrics.ece,
            calibrationBins: overall.calibrationBins,
            baselineComparison: {
              baselineBrier: overall.baselineMetrics.brier,
              baselineEce: overall.baselineMetrics.ece,
              brierDelta: overall.improvement.brierDelta,
              eceDelta: overall.improvement.eceDelta,
              tierMonotonicityPasses: overall.tierMonotonicity.passes,
            },
            sliceMetrics,
            outcomeInventory: [],
            modelVersions: overall.modelVersions,
            realDataOnly: true,
          };

    const findings: AgentFinding[] = [];
    if (artifact.sampleCount === 0) {
      findings.push({
        agent: 'Probability Auditor',
        severity: 'P0',
        category: 'insufficient_truth',
        summary: 'Verified admit/reject outcomes are absent in the last audit window',
        evidence:
          'prediction-accuracy-report returned 0 counselor/document-verified ADMITTED/REJECTED rows in the selected 365-day window.',
        affectedSurface: 'probability calibration claims',
        file: `${process.cwd()}/scripts/prediction-accuracy-report.ts`,
        line: null,
      });
    } else if (artifact.sampleCount < 200) {
      findings.push({
        agent: 'Probability Auditor',
        severity: 'P1',
        category: 'sample_floor',
        summary: 'Verified outcome sample is below the audit floor',
        evidence: `Only ${artifact.sampleCount} verified outcomes are available; the audit floor is 200.`,
        affectedSurface: 'headline probability accuracy',
        file: `${process.cwd()}/scripts/prediction-gate.ts`,
        line: null,
      });
    }

    return {
      artifact,
      note: {
        agent: 'Probability Auditor',
        summary:
          artifact.sampleCount === 0
            ? 'Headline probability accuracy is currently unverified because the verified-outcome sample is empty.'
            : 'Verified-outcome calibration metrics are available, but sample size still determines whether the result is publishable.',
        findings,
        notes: [
          'Headline accuracy only counts COUNSELOR_VERIFIED / DOCUMENT_VERIFIED ADMITTED or REJECTED outcomes.',
          'Self-reported outcomes remain visible in outcome inventory but are excluded from headline calibration evidence.',
        ],
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}
