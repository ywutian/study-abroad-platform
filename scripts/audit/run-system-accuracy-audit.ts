#!/usr/bin/env tsx

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPredictionStabilitySmoke } from '../prediction-stability-smoke';
import { runEval } from '../eval/run-eval';
import { runAnalysisQualityAudit } from './analysis-quality-audit';
import { runFactAudit } from './fact-audit';
import { runProbabilityAudit } from './probability-audit';
import { renderAuditReport } from './report';
import { runRuntimeAudit } from './runtime-audit';
import { runGovernanceAudit } from './governance-audit';
import {
  AUDIT_DATE,
  DEFAULT_REPORT_PATH,
  DEFAULT_RUN_ROOT,
  ensureDir,
  runCommand,
  writeJson,
  writeText,
} from './utils';
import type { AgentAuditNote, AgentFinding, AuditVerdict, AuditVerdictArtifact } from './types';

type CliOptions = {
  runRoot: string;
  days: number;
  realSample: number;
  syntheticSet: string;
  truthsetScope: string;
  baseUrl: string;
  token?: string;
};

function parseArgs(argv: string[]): CliOptions {
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
  const realSample = Number(values.get('real-sample') ?? '30');

  return {
    runRoot: values.get('run-root') ?? DEFAULT_RUN_ROOT,
    days: Number.isFinite(days) && days > 0 ? days : 365,
    realSample: Number.isFinite(realSample) && realSample > 0 ? realSample : 30,
    syntheticSet: values.get('synthetic-set') ?? 'v1',
    truthsetScope: values.get('truthset-scope') ?? 'top50-plus-uc',
    baseUrl: values.get('base-url') ?? 'http://localhost:4101/api/v1',
    token: values.get('token') ?? process.env.AUDIT_AUTH_TOKEN,
  };
}

function flattenFindings(notes: AgentAuditNote[]): AgentFinding[] {
  return notes.flatMap((note) => note.findings);
}

function deriveProbabilityVerdict(
  sampleCount: number,
  brierDelta: number | null,
  ece: number | null,
  eceDelta: number | null,
  monotonicityPasses: boolean | null
): AuditVerdict {
  if (sampleCount === 0) return 'insufficient_evidence';
  if (sampleCount < 200) return 'insufficient_evidence';
  if (
    brierDelta == null ||
    ece == null ||
    eceDelta == null ||
    monotonicityPasses == null ||
    brierDelta < 0 ||
    eceDelta < 0 ||
    ece > 0.08 ||
    monotonicityPasses === false
  ) {
    return 'biased_or_defective';
  }
  return 'verified_accurate';
}

function deriveFactVerdict(mismatchCount: number, fieldLevelAccuracy: number | null): AuditVerdict {
  if (fieldLevelAccuracy == null) return 'insufficient_evidence';
  if (mismatchCount > 0) return 'biased_or_defective';
  return 'verified_accurate';
}

function deriveAgentBehaviorVerdict(
  fixtureFails: number,
  liveFails: number,
  liveSkipped: number
): AuditVerdict {
  if (fixtureFails > 0 || liveFails > 0) return 'biased_or_defective';
  if (liveSkipped > 0) return 'insufficient_evidence';
  return 'verified_accurate';
}

function deriveAnalysisVerdict(executedCaseCount: number): AuditVerdict {
  return executedCaseCount > 0 ? 'verified_accurate' : 'insufficient_evidence';
}

function deriveGovernanceVerdict(governanceFindings: AgentFinding[]): AuditVerdict {
  return governanceFindings.length > 0 ? 'biased_or_defective' : 'verified_accurate';
}

function buildVerdict(
  notes: AgentAuditNote[],
  probabilityVerdict: AuditVerdict,
  factVerdict: AuditVerdict,
  analysisVerdict: AuditVerdict,
  agentBehaviorVerdict: AuditVerdict,
  governanceVerdict: AuditVerdict
): AuditVerdictArtifact {
  const findings = flattenFindings(notes);
  const p0Findings = findings.filter((finding) => finding.severity === 'P0');
  const p1Findings = findings.filter((finding) => finding.severity === 'P1');
  const p2Findings = findings.filter((finding) => finding.severity === 'P2');

  const dimensionVerdicts = {
    predictionProbability: probabilityVerdict,
    schoolFacts: factVerdict,
    applicationAnalysis: analysisVerdict,
    agentBehavior: agentBehaviorVerdict,
    governance: governanceVerdict,
    runtimeDataflow: notes.find((note) => note.agent === 'Runtime Auditor')?.findings.length
      ? 'biased_or_defective'
      : 'verified_accurate',
  };

  const overallVerdict: AuditVerdict =
    p0Findings.length > 0 || Object.values(dimensionVerdicts).includes('biased_or_defective')
      ? 'biased_or_defective'
      : Object.values(dimensionVerdicts).includes('insufficient_evidence')
        ? 'insufficient_evidence'
        : 'verified_accurate';

  return {
    overallVerdict,
    dimensionVerdicts,
    blockers: p0Findings.map((finding) => finding.summary),
    p0Findings,
    p1Findings,
    p2Findings,
  };
}

function writeAgentNotes(runRoot: string, notes: AgentAuditNote[]) {
  for (const note of notes) {
    const filename = `${note.agent.toLowerCase().replace(/\s+/g, '-')}.md`;
    const content = [
      `# ${note.agent}`,
      '',
      note.summary,
      '',
      '## Findings',
      ...(note.findings.length > 0
        ? note.findings.map(
            (finding) =>
              `- ${finding.severity} ${finding.summary}: ${finding.evidence} (${finding.file}${
                finding.line ? `:${finding.line}` : ''
              })`
          )
        : ['- none']),
      '',
      '## Notes',
      ...(note.notes.length > 0 ? note.notes.map((line) => `- ${line}`) : ['- none']),
      '',
    ].join('\n');

    writeText(path.join(runRoot, filename), content);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDir(options.runRoot);
  ensureDir(path.dirname(DEFAULT_REPORT_PATH));

  console.log(`[audit] starting system accuracy audit for ${AUDIT_DATE}`);
  console.log(`[audit] run root: ${options.runRoot}`);

  const readonlyTests = runCommand('pnpm', [
    '--filter',
    'api',
    'test',
    '--',
    '--runInBand',
    'src/modules/prediction/prediction-calibration.service.spec.ts',
    'src/modules/profile/profile-application-analysis.service.spec.ts',
    'src/modules/profile/application-analysis-workflow.service.spec.ts',
  ]);
  writeJson(path.join(options.runRoot, 'readonly-tests.json'), readonlyTests);

  const fixtureAudit = await runEval({
    mode: 'fixtures',
    verbose: false,
    outputDir: options.runRoot,
  });
  const liveAudit = await runEval({
    mode: 'live',
    sample: 5,
    verbose: false,
    baseUrl: options.baseUrl,
    token: options.token,
    outputDir: options.runRoot,
  });

  let smokePassed = false;
  let smokeDetail = 'not run';
  try {
    const smoke = await runPredictionStabilitySmoke({ baseUrl: options.baseUrl });
    smokePassed = smoke.passed;
    smokeDetail = smoke.results.at(-1)?.detail ?? 'see workflow_smoke.json';
    writeJson(path.join(options.runRoot, 'workflow_smoke.json'), smoke);
  } catch (error) {
    smokePassed = false;
    smokeDetail = error instanceof Error ? error.message : String(error);
    writeJson(path.join(options.runRoot, 'workflow_smoke.json'), {
      passed: false,
      detail: smokeDetail,
    });
  }

  const runtimeNote = runRuntimeAudit();
  const governanceNote = runGovernanceAudit();
  const { artifact: factArtifact, note: factNote } = await runFactAudit();
  const { artifact: probabilityArtifact, note: probabilityNote } = await runProbabilityAudit(
    options.days
  );
  const { artifact: analysisArtifact, note: analysisNote } = await runAnalysisQualityAudit(
    options.realSample,
    options.baseUrl,
    options.token
  );

  const notes: AgentAuditNote[] = [
    runtimeNote,
    factNote,
    probabilityNote,
    analysisNote,
    governanceNote,
  ];

  const probabilityVerdict = deriveProbabilityVerdict(
    probabilityArtifact.sampleCount,
    probabilityArtifact.baselineComparison.brierDelta,
    probabilityArtifact.ece,
    probabilityArtifact.baselineComparison.eceDelta,
    probabilityArtifact.baselineComparison.tierMonotonicityPasses
  );
  const factVerdict = deriveFactVerdict(
    factArtifact.schoolLevelMismatchCount,
    factArtifact.fieldLevelAccuracy
  );
  const analysisVerdict = deriveAnalysisVerdict(analysisArtifact.executedCaseCount);
  const agentBehaviorVerdict = deriveAgentBehaviorVerdict(
    fixtureAudit.summary.failed,
    liveAudit.summary.failed,
    liveAudit.summary.skipped
  );
  const governanceVerdict = deriveGovernanceVerdict(governanceNote.findings);

  const verdict = buildVerdict(
    notes,
    probabilityVerdict,
    factVerdict,
    analysisVerdict,
    agentBehaviorVerdict,
    governanceVerdict
  );

  writeJson(path.join(options.runRoot, 'school_truthset.json'), factArtifact.truthset);
  writeJson(path.join(options.runRoot, 'fact_drift.json'), factArtifact);
  writeJson(path.join(options.runRoot, 'prediction_accuracy.json'), probabilityArtifact);
  writeJson(path.join(options.runRoot, 'analysis_quality.json'), analysisArtifact);
  writeJson(
    path.join(options.runRoot, 'agent_findings.json'),
    notes.map((note) => ({
      agent: note.agent,
      summary: note.summary,
      notes: note.notes,
      findings: note.findings,
    }))
  );
  writeJson(path.join(options.runRoot, 'verdict.json'), verdict);
  writeAgentNotes(options.runRoot, notes);

  const report = renderAuditReport({
    verdict,
    probability: probabilityArtifact,
    facts: factArtifact,
    analysis: analysisArtifact,
    notes,
    readonlyTests,
    behaviorAudit: {
      fixtures: {
        passed: fixtureAudit.summary.passed,
        failed: fixtureAudit.summary.failed,
        skipped: fixtureAudit.summary.skipped,
        passRate: fixtureAudit.summary.passRate,
      },
      live: {
        passed: liveAudit.summary.passed,
        failed: liveAudit.summary.failed,
        skipped: liveAudit.summary.skipped,
        passRate: liveAudit.summary.passRate,
      },
    },
    smoke: {
      passed: smokePassed,
      detail: smokeDetail,
    },
  });

  writeText(DEFAULT_REPORT_PATH, report);
  writeText(path.join(options.runRoot, 'report.md'), report);

  console.log(`[audit] report written to ${DEFAULT_REPORT_PATH}`);
  console.log(`[audit] verdict: ${verdict.overallVerdict}`);
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  main().catch((error) => {
    console.error(
      '[system-accuracy-audit] failed:',
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  });
}
