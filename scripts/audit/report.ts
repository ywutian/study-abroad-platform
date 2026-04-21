import {
  OFFICIAL_SCHOOL_TRUTH_OVERRIDES,
  OFFICIAL_SOURCE_RETRIEVED_AT,
} from './data/curated-school-truths';
import type {
  AgentAuditNote,
  AnalysisQualityArtifact,
  AuditVerdictArtifact,
  CommandResult,
  FactAuditArtifact,
  PredictionAccuracyArtifact,
} from './types';

type BehaviorAuditSummary = {
  fixtures: {
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
  };
  live: {
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
  };
};

type SmokeSummary = {
  passed: boolean;
  detail: string;
};

export type AuditReportInputs = {
  verdict: AuditVerdictArtifact;
  probability: PredictionAccuracyArtifact;
  facts: FactAuditArtifact;
  analysis: AnalysisQualityArtifact;
  notes: AgentAuditNote[];
  readonlyTests: CommandResult;
  behaviorAudit: BehaviorAuditSummary;
  smoke: SmokeSummary;
};

function verdictLabel(value: string): string {
  switch (value) {
    case 'verified_accurate':
      return '已验证准确';
    case 'insufficient_evidence':
      return '证据不足无法宣称准确';
    case 'biased_or_defective':
      return '明确存在偏差/缺陷';
    default:
      return value;
  }
}

function pct(value: number | null | undefined): string {
  return value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function renderFindingList(lines: AuditVerdictArtifact['p0Findings']): string {
  if (lines.length === 0) return '- none';
  return lines
    .map(
      (finding) =>
        `- ${finding.severity} ${finding.summary}: ${finding.evidence} (${finding.affectedSurface})`
    )
    .join('\n');
}

function renderFactDiffTable(facts: FactAuditArtifact): string {
  const rows = facts.diffTable.slice(0, 12);
  if (rows.length === 0) return '_No official-source diff rows were generated._';

  const header =
    '| School | Surface | Field | Expected | Actual | Status |\n| --- | --- | --- | --- | --- | --- |';
  const body = rows
    .map(
      (row) =>
        `| ${row.schoolName} | ${row.surface} | ${row.field} | ${String(row.expected ?? '')} | ${String(row.actual ?? '')} | ${row.status} |`
    )
    .join('\n');
  return `${header}\n${body}`;
}

function renderSliceHighlights(probability: PredictionAccuracyArtifact): string {
  if (probability.sliceMetrics.length === 0) {
    return '- No verified slice metrics were available.';
  }

  return probability.sliceMetrics
    .slice(0, 10)
    .map(
      (metric) =>
        `- ${metric.dimension}:${metric.slice} -> n=${metric.count}, admitRate=${pct(metric.admitRate)}, Brier=${metric.brier?.toFixed(4) ?? 'n/a'}, ECE=${metric.ece?.toFixed(4) ?? 'n/a'}`
    )
    .join('\n');
}

export function renderAuditReport(input: AuditReportInputs): string {
  const officialSources = OFFICIAL_SCHOOL_TRUTH_OVERRIDES.map(
    (record) => `- [${record.schoolName}](${record.sourceUrl})`
  ).join('\n');
  const runtimeNote = input.notes.find((note) => note.agent === 'Runtime Auditor');
  const factNote = input.notes.find((note) => note.agent === 'Fact Auditor');
  const governanceNote = input.notes.find((note) => note.agent === 'Governance Auditor');
  const analysisNote = input.notes.find((note) => note.agent === 'Analysis Quality Auditor');

  return `# System Accuracy Audit - ${OFFICIAL_SOURCE_RETRIEVED_AT}

## Executive Verdict

- Overall verdict: **${verdictLabel(input.verdict.overallVerdict)}**
- Prediction probability: **${verdictLabel(input.verdict.dimensionVerdicts.predictionProbability)}**
- School facts: **${verdictLabel(input.verdict.dimensionVerdicts.schoolFacts)}**
- Application analysis content: **${verdictLabel(input.verdict.dimensionVerdicts.applicationAnalysis)}**
- Agent/tool behavior: **${verdictLabel(input.verdict.dimensionVerdicts.agentBehavior)}**
- Governance: **${verdictLabel(input.verdict.dimensionVerdicts.governance)}**

## What Is Actually Verified

- Existing readonly specs still pass: \`${input.readonlyTests.command}\` -> exit code ${input.readonlyTests.exitCode}.
- Prediction accuracy headline only accepts COUNSELOR_VERIFIED / DOCUMENT_VERIFIED ADMITTED or REJECTED outcomes.
- Official-source truth was collected for ${input.facts.officialTruthCoverageCount} schools inside the Top 50 + UC scope.
- Fixture-based agent behavior assertions now enforce tools, keywords, forbidden content, and JSON fields.

## What Is Unverified

- Probability accuracy cannot be published when verified outcome sample is ${input.probability.sampleCount}.
- Application-analysis content quality remains ${verdictLabel(input.verdict.dimensionVerdicts.applicationAnalysis)} because sampled real and synthetic cases could not be replayed through a deterministic harness.
- Live tool-routing assertions remain partially unverified because the current agent endpoint does not expose tool-call traces in audit mode.

## School Fact Drift Matrix

- Scope schools in audit target: ${input.facts.scopeSchoolCount}
- Official truth coverage inside scope: ${input.facts.officialTruthCoverageCount}
- Official-source field accuracy: ${pct(input.facts.fieldLevelAccuracy)}
- Schools with at least one mismatch: ${input.facts.schoolLevelMismatchCount}

${renderFactDiffTable(input.facts)}

## Prediction Accuracy

- Verified sample count: ${input.probability.sampleCount}
- Verdict: ${verdictLabel(input.probability.verdict)}
- Message: ${input.probability.message}
- Brier: ${input.probability.brier?.toFixed(4) ?? 'n/a'}
- ECE: ${input.probability.ece?.toFixed(4) ?? 'n/a'}
- Baseline Brier: ${input.probability.baselineComparison.baselineBrier?.toFixed(4) ?? 'n/a'}
- Baseline ECE: ${input.probability.baselineComparison.baselineEce?.toFixed(4) ?? 'n/a'}
- Tier monotonicity: ${String(input.probability.baselineComparison.tierMonotonicityPasses ?? 'n/a')}

${renderSliceHighlights(input.probability)}

## Application Analysis Quality

- Endpoint probe: ${input.analysis.endpointProbe.reachability} (${input.analysis.endpointProbe.detail})
- Real sampled cases: ${input.analysis.realSampleCount}
- Synthetic sampled cases: ${input.analysis.syntheticSampleCount}
- Executed cases: ${input.analysis.executedCaseCount}
- Real pass rate: ${pct(input.analysis.realPassRate)}
- Synthetic pass rate: ${pct(input.analysis.syntheticPassRate)}
- Fabricated insight count: ${input.analysis.fabricatedInsightCount ?? 'n/a'}
- Overconfidence count: ${input.analysis.overconfidenceCount ?? 'n/a'}

## Agent/Eval Coverage Gaps

- Fixture behavior audit: ${input.behaviorAudit.fixtures.passed} passed / ${input.behaviorAudit.fixtures.failed} failed / ${input.behaviorAudit.fixtures.skipped} skipped (pass rate ${pct(input.behaviorAudit.fixtures.passRate)}).
- Live behavior audit: ${input.behaviorAudit.live.passed} passed / ${input.behaviorAudit.live.failed} failed / ${input.behaviorAudit.live.skipped} skipped (pass rate ${pct(input.behaviorAudit.live.passRate)}).
- Workflow smoke: ${input.smoke.passed ? 'PASS' : 'FAIL'} (${input.smoke.detail})
- ${runtimeNote?.summary ?? 'Runtime audit note unavailable.'}
- ${analysisNote?.summary ?? 'Analysis quality note unavailable.'}

## Governance Authenticity

- ${governanceNote?.summary ?? 'Governance note unavailable.'}
- ${factNote?.summary ?? 'Fact note unavailable.'}

## P0/P1/P2 Findings

### P0

${renderFindingList(input.verdict.p0Findings)}

### P1

${renderFindingList(input.verdict.p1Findings)}

### P2

${renderFindingList(input.verdict.p2Findings)}

## Recommended Fix Queue

- P0: Replace synthetic application-analysis gate metrics with scored gold-set execution and real render/journey checks.
- P0: Stop publishing any probability-accuracy claim until verified admit/reject outcomes exist in meaningful volume.
- P1: Invalidate both school calibration and Platt caches when calibration state changes.
- P1: Gate ML tier promotion on verified outcomes instead of raw actualResult.
- P1: Add a deterministic replay harness for \`/profiles/me/ai-analysis\` so sampled real and synthetic cases can be scored offline.
- P1: Align UC testing semantics across School data, analysis runtime, and user-facing tools.
- P2: Persist selectivityBand so slice analysis and post-hoc calibration audits are reproducible.

## Official Sources Used

${officialSources}
`;
}
