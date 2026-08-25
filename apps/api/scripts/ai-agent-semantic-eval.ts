import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  assertSemanticEvalReport,
  createCodexReferenceSubmission,
  evaluateSemanticSubmission,
  runStaticCalibration,
} from '../src/modules/ai-agent/semantic-eval/agent-semantic-eval';
import { parseSemanticEvalSubmission } from '../src/modules/ai-agent/semantic-eval/agent-semantic-eval.schema';

function option(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function loadSubmission(path: string | undefined) {
  if (!path) return createCodexReferenceSubmission();
  const raw = await readFile(resolve(path), 'utf8');
  return parseSemanticEvalSubmission(JSON.parse(raw) as unknown);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const submission = await loadSubmission(option(args, '--submission'));
  const report = evaluateSemanticSubmission(submission);
  const calibration = runStaticCalibration();
  report.calibration = calibration;
  if (
    calibration.passingCandidateAccuracy !== 1 ||
    calibration.failingCandidateRejectionRate !== 1
  ) {
    report.gate.failures.push('STATIC_CALIBRATION_FAILED');
    report.gate.passed = false;
  }
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = option(args, '--output');
  if (outputPath) {
    const absolutePath = resolve(outputPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, serialized, {
      encoding: 'utf8',
      mode: 0o600,
    });
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        datasetVersion: report.datasetVersion,
        candidate: report.candidate,
        coverage: report.coverage,
        metrics: report.metrics,
        calibration: report.calibration,
        gate: report.gate,
        reportPath: outputPath ? resolve(outputPath) : null,
      },
      null,
      2,
    )}\n`,
  );
  assertSemanticEvalReport(report);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
