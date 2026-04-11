import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPredictionAccuracyReport,
  runPredictionAccuracyReport,
} from './prediction-accuracy-report';
import {
  renderPredictionStabilitySmoke,
  runPredictionStabilitySmoke,
} from './prediction-stability-smoke';

type GateCliOptions = {
  days: number;
  minVerified: number;
  maxEce: number;
  schoolQuery: string;
  round: string;
  baseUrl: string;
};

function parseArgs(argv: string[]): GateCliOptions {
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

  const days = Number(values.get('days') ?? '365');
  const minVerified = Number(values.get('min-verified') ?? '200');
  const maxEce = Number(values.get('max-ece') ?? '0.08');

  return {
    days: Number.isFinite(days) && days > 0 ? days : 365,
    minVerified: Number.isFinite(minVerified) && minVerified > 0 ? minVerified : 200,
    maxEce: Number.isFinite(maxEce) && maxEce > 0 ? maxEce : 0.08,
    schoolQuery: values.get('school-query') ?? 'Wisconsin',
    round: values.get('round') ?? 'EA',
    baseUrl: values.get('base-url') ?? 'http://localhost:4101/api/v1',
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [accuracyReport, smokeReport] = await Promise.all([
    runPredictionAccuracyReport({ days: options.days }),
    runPredictionStabilitySmoke({
      baseUrl: options.baseUrl,
      schoolQuery: options.schoolQuery,
      round: options.round,
    }),
  ]);

  const workflowStatus = smokeReport.passed ? 'PASS' : 'FAIL';

  let accuracyStatus: 'PASS' | 'CHECK' | 'FAIL' = 'CHECK';
  let accuracySummary = 'verified outcomes are not yet sufficient';
  let verifiedSummary = `0/${options.minVerified}`;

  if (accuracyReport.sampleCount === 0) {
    accuracyStatus = 'CHECK';
    accuracySummary = '0 verified ADMITTED/REJECTED outcomes';
    verifiedSummary = `0/${options.minVerified}`;
  } else if (accuracyReport.sampleCount < options.minVerified) {
    accuracyStatus = 'CHECK';
    accuracySummary = `${accuracyReport.sampleCount}/${options.minVerified} verified outcomes`;
    verifiedSummary = `${accuracyReport.sampleCount}/${options.minVerified}`;
  } else {
    verifiedSummary = `${accuracyReport.sampleCount}/${options.minVerified}`;
    const beatsBaseline =
      accuracyReport.improvement.brierDelta >= 0 && accuracyReport.improvement.eceDelta >= 0;
    const ecePass = accuracyReport.modelMetrics.ece <= options.maxEce;
    const monotonicityPass = accuracyReport.tierMonotonicity.passes;

    if (beatsBaseline && ecePass && monotonicityPass) {
      accuracyStatus = 'PASS';
      accuracySummary = `Brier Δ ${accuracyReport.improvement.brierDelta.toFixed(4)}, ECE ${accuracyReport.modelMetrics.ece.toFixed(4)}`;
    } else {
      accuracyStatus = 'FAIL';
      accuracySummary = `baseline comparison or calibration threshold failed`;
    }
  }

  const gateStatus =
    workflowStatus === 'PASS' && accuracyStatus === 'PASS'
      ? 'PASS'
      : workflowStatus === 'FAIL' || accuracyStatus === 'FAIL'
        ? 'FAIL'
        : 'CHECK';

  console.log('Prediction Gate');
  console.log(`- workflow: ${workflowStatus}`);
  console.log(`- accuracy: ${accuracyStatus}`);
  console.log(`- verified-samples: ${verifiedSummary}`);
  console.log(`- overall: ${gateStatus}`);
  console.log('');
  console.log(`Workflow summary: ${smokeReport.results.at(-1)?.detail ?? 'see steps below'}`);
  console.log(`Accuracy summary: ${accuracySummary}`);
  console.log('');
  console.log(renderPredictionStabilitySmoke(smokeReport));
  console.log('');
  console.log(renderPredictionAccuracyReport(accuracyReport));

  if (gateStatus === 'FAIL') {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  main().catch((error) => {
    console.error('[prediction-gate] failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
