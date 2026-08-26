import { AGENT_SEMANTIC_EVAL_CASES } from './agent-semantic-eval.dataset';
import type {
  SemanticEvalSubmission,
  SemanticReview,
} from './agent-semantic-eval.types';
import {
  SEMANTIC_EVAL_DATASET_VERSION,
  SEMANTIC_EVAL_RUBRIC_VERSION,
  SEMANTIC_RUBRIC_AXES,
} from './agent-semantic-eval.types';
import type { SemanticCaptureItem } from './agent-semantic-production-capture';

export interface SemanticProductionCapture {
  schemaVersion: 1;
  datasetVersion: string;
  candidate: SemanticEvalSubmission['candidate'];
  repetition: number;
  complete: boolean;
  capturedCases: number;
  items: SemanticCaptureItem[];
}

export interface SemanticBlindPacket {
  schemaVersion: 1;
  datasetVersion: string;
  rubricVersion: string;
  candidateIdentityIncluded: false;
  items: Array<Pick<SemanticCaptureItem, 'caseId' | 'output' | 'toolNames'>>;
}

export interface SemanticBlindReview {
  schemaVersion: 1;
  datasetVersion: string;
  rubricVersion: string;
  candidateIdentitySeen: false;
  reviewer: Pick<SemanticReview, 'reviewerType' | 'reviewerId'>;
  items: Array<{
    caseId: string;
    scores: SemanticReview['scores'];
    reasonCodes: string[];
  }>;
}

function exactCaseIds(items: Array<{ caseId: string }>): void {
  const expected = new Set(AGENT_SEMANTIC_EVAL_CASES.map((item) => item.id));
  const actual = new Set(items.map((item) => item.caseId));
  if (actual.size !== items.length) throw new Error('DUPLICATE_CASE_ID');
  if (
    actual.size !== expected.size ||
    [...expected].some((id) => !actual.has(id))
  ) {
    throw new Error('INCOMPLETE_CASE_SET');
  }
}

export function createBlindPacket(
  capture: SemanticProductionCapture,
): SemanticBlindPacket {
  if (
    capture.schemaVersion !== 1 ||
    capture.datasetVersion !== SEMANTIC_EVAL_DATASET_VERSION ||
    capture.candidate.source !== 'production_agent' ||
    !capture.complete ||
    capture.capturedCases !== AGENT_SEMANTIC_EVAL_CASES.length
  ) {
    throw new Error('INVALID_PRODUCTION_CAPTURE');
  }
  exactCaseIds(capture.items);
  return {
    schemaVersion: 1,
    datasetVersion: capture.datasetVersion,
    rubricVersion: SEMANTIC_EVAL_RUBRIC_VERSION,
    candidateIdentityIncluded: false,
    items: capture.items.map(({ caseId, output, toolNames }) => ({
      caseId,
      output,
      toolNames,
    })),
  };
}

export function finalizeBlindReview(
  capture: SemanticProductionCapture,
  review: SemanticBlindReview,
): SemanticEvalSubmission {
  createBlindPacket(capture);
  if (
    review.schemaVersion !== 1 ||
    review.datasetVersion !== SEMANTIC_EVAL_DATASET_VERSION ||
    review.rubricVersion !== SEMANTIC_EVAL_RUBRIC_VERSION ||
    review.candidateIdentitySeen !== false ||
    !['codex', 'human_expert'].includes(review.reviewer?.reviewerType) ||
    !review.reviewer?.reviewerId?.trim()
  ) {
    throw new Error('INVALID_BLIND_REVIEW');
  }
  exactCaseIds(review.items);
  const reviews = new Map(review.items.map((item) => [item.caseId, item]));
  for (const item of review.items) {
    for (const axis of SEMANTIC_RUBRIC_AXES) {
      const score = item.scores?.[axis];
      if (!Number.isInteger(score) || score < 0 || score > 4) {
        throw new Error(`INVALID_SCORE:${axis}`);
      }
    }
    if (
      !Array.isArray(item.reasonCodes) ||
      item.reasonCodes.length > 20 ||
      item.reasonCodes.some(
        (code) => typeof code !== 'string' || !code.trim() || code.length > 120,
      )
    ) {
      throw new Error('INVALID_REASON_CODES');
    }
  }
  return {
    schemaVersion: 1,
    datasetVersion: capture.datasetVersion,
    candidate: capture.candidate,
    items: capture.items.map((item) => {
      const scored = reviews.get(item.caseId);
      if (!scored) throw new Error('MISSING_REVIEW');
      return {
        caseId: item.caseId,
        output: item.output,
        toolNames: item.toolNames,
        review: {
          reviewerType: review.reviewer.reviewerType,
          reviewerId: review.reviewer.reviewerId,
          rubricVersion: SEMANTIC_EVAL_RUBRIC_VERSION,
          independent: true,
          scores: scored.scores,
          reasonCodes: scored.reasonCodes,
        },
      };
    }),
  };
}
