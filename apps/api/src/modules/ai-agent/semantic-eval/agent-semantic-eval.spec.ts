import {
  AGENT_SEMANTIC_EVAL_CASES,
  SEMANTIC_SCENARIOS,
} from './agent-semantic-eval.dataset';
import {
  createCodexReferenceSubmission,
  evaluateSemanticSubmission,
  runStaticCalibration,
  validateSemanticEvalDataset,
} from './agent-semantic-eval';
import {
  AGENTIC_SECURITY_RISKS,
  SEMANTIC_EVAL_CATEGORIES,
} from './agent-semantic-eval.types';

describe('agent semantic evaluation', () => {
  it('freezes 56 scenario families into 280 reviewed language variants', () => {
    expect(SEMANTIC_SCENARIOS).toHaveLength(56);
    expect(AGENT_SEMANTIC_EVAL_CASES).toHaveLength(280);
    expect(validateSemanticEvalDataset()).toEqual([]);
    expect(
      new Set(AGENT_SEMANTIC_EVAL_CASES.map((item) => item.category)).size,
    ).toBe(SEMANTIC_EVAL_CATEGORIES.length);
    const coveredRisks = new Set(
      AGENT_SEMANTIC_EVAL_CASES.flatMap((item) => item.securityRisks ?? []),
    );
    expect(coveredRisks).toEqual(new Set(AGENTIC_SECURITY_RISKS));
  });

  it('accepts the Codex reference packet without claiming independent or expert review', () => {
    const report = evaluateSemanticSubmission(createCodexReferenceSubmission());
    expect(report.gate).toEqual({ passed: true, failures: [] });
    expect(report.metrics).toMatchObject({
      hardGatePassRate: 1,
      macroSemanticScore: 1,
      independentReviewRate: 0,
      humanExpertReviewRate: 0,
    });
  });

  it('calibrates passing cases and diverse negative controls', () => {
    const calibration = runStaticCalibration();
    expect(calibration).toMatchObject({
      passingCandidateAccuracy: 1,
      failingCandidateRejectionRate: 1,
      negativeControlCounts: { emptyOutput: 280 },
    });
    expect(calibration.negativeControlCount).toBeGreaterThan(600);
  });

  it('hard-fails a critical privacy leak and stores no raw leak in the report', () => {
    const submission = createCodexReferenceSubmission();
    const target = submission.items.find((item) =>
      item.caseId.startsWith('route-orchestrator-injection'),
    )!;
    target.output = 'SECRET_CANARY_91';
    const report = evaluateSemanticSubmission(submission);
    expect(report.gate.passed).toBe(false);
    expect(report.gate.failures).toContain('CRITICAL_HARD_GATE_FAILURE');
    expect(JSON.stringify(report)).not.toContain('SECRET_CANARY_91');
  });

  it('requires an independent review for production Agent evidence', () => {
    const submission = createCodexReferenceSubmission();
    submission.candidate.source = 'production_agent';
    const report = evaluateSemanticSubmission(submission);
    expect(report.gate.failures).toContain('PRODUCTION_REVIEW_NOT_INDEPENDENT');
  });

  it('rejects incomplete, duplicate and mismatched packets deterministically', () => {
    const submission = createCodexReferenceSubmission();
    submission.datasetVersion = 'stale';
    submission.items = [submission.items[0], submission.items[0]];
    const report = evaluateSemanticSubmission(submission);
    expect(report.gate.failures).toEqual(
      expect.arrayContaining([
        'DATASET_VERSION_MISMATCH',
        'INCOMPLETE_REVIEW_PACKET',
      ]),
    );
    expect(
      report.gate.failures.some((failure) =>
        failure.startsWith('DUPLICATE_SUBMISSION_CASE:'),
      ),
    ).toBe(true);
  });
});
