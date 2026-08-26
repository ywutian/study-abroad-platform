import { AGENT_SEMANTIC_EVAL_CASES } from './agent-semantic-eval.dataset';
import {
  createBlindPacket,
  finalizeBlindReview,
  type SemanticBlindReview,
  type SemanticProductionCapture,
} from './agent-semantic-blind-review';
import {
  SEMANTIC_EVAL_DATASET_VERSION,
  SEMANTIC_EVAL_RUBRIC_VERSION,
} from './agent-semantic-eval.types';

function capture(): SemanticProductionCapture {
  return {
    schemaVersion: 1,
    datasetVersion: SEMANTIC_EVAL_DATASET_VERSION,
    candidate: {
      id: 'hidden-candidate',
      source: 'production_agent',
      version: 'revision',
    },
    repetition: 1,
    complete: true,
    capturedCases: AGENT_SEMANTIC_EVAL_CASES.length,
    items: AGENT_SEMANTIC_EVAL_CASES.map((item) => ({
      caseId: item.id,
      repetition: 1,
      output: 'synthetic output',
      toolNames: [],
      latencyMs: 10,
      httpStatus: 200,
      runStatus: 'COMPLETED',
      runIdHash: 'hash',
    })),
  };
}

function review(): SemanticBlindReview {
  return {
    schemaVersion: 1,
    datasetVersion: SEMANTIC_EVAL_DATASET_VERSION,
    rubricVersion: SEMANTIC_EVAL_RUBRIC_VERSION,
    candidateIdentitySeen: false,
    reviewer: { reviewerType: 'codex', reviewerId: 'independent-codex' },
    items: AGENT_SEMANTIC_EVAL_CASES.map((item) => ({
      caseId: item.id,
      scores: {
        factuality: 3,
        instruction_following: 3,
        relevance_completeness: 3,
        safety_privacy: 3,
        actionability_tone: 3,
      },
      reasonCodes: [],
    })),
  };
}

describe('semantic blind review', () => {
  it('removes candidate identity, revision, latency and run metadata', () => {
    const packet = createBlindPacket(capture());
    expect(packet.candidateIdentityIncluded).toBe(false);
    expect(JSON.stringify(packet)).not.toContain('hidden-candidate');
    expect(JSON.stringify(packet)).not.toContain('revision');
    expect(packet.items[0]).toEqual({
      caseId: AGENT_SEMANTIC_EVAL_CASES[0].id,
      output: 'synthetic output',
      toolNames: [],
    });
  });

  it('joins a complete independent review back to the hidden candidate', () => {
    const submission = finalizeBlindReview(capture(), review());
    expect(submission.candidate.id).toBe('hidden-candidate');
    expect(submission.items).toHaveLength(AGENT_SEMANTIC_EVAL_CASES.length);
    expect(submission.items[0].review.independent).toBe(true);
  });

  it('rejects an incomplete review', () => {
    const incomplete = review();
    incomplete.items.pop();
    expect(() => finalizeBlindReview(capture(), incomplete)).toThrow(
      'INCOMPLETE_CASE_SET',
    );
  });
});
