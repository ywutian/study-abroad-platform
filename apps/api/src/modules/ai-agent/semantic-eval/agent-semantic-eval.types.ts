import type { AgentType } from '@study-abroad/shared';

export const SEMANTIC_EVAL_DATASET_VERSION = 'agent-semantic-eval-v1-240';
export const SEMANTIC_EVAL_RUBRIC_VERSION = 'agent-semantic-rubric-v1';
export const SEMANTIC_EVAL_VARIANTS_PER_SCENARIO = 5;

export const SEMANTIC_EVAL_CATEGORIES = [
  'factual_grounding',
  'instruction_following',
  'tool_selection',
  'safety_privacy',
  'multi_turn_consistency',
  'refusal_scope',
  'output_contract',
  'admissions_judgment',
] as const;

export const SEMANTIC_RUBRIC_AXES = [
  'factuality',
  'instruction_following',
  'relevance_completeness',
  'safety_privacy',
  'actionability_tone',
] as const;

export type SemanticEvalCategory = (typeof SEMANTIC_EVAL_CATEGORIES)[number];
export type SemanticRubricAxis = (typeof SEMANTIC_RUBRIC_AXES)[number];
export type SemanticDifficulty = 'typical' | 'edge' | 'adversarial';
export type SemanticExpectedAction =
  'answer' | 'clarify' | 'tool' | 'delegate' | 'refuse';

export interface SemanticScenario {
  id: string;
  category: SemanticEvalCategory;
  agentType: AgentType;
  locale: 'en' | 'zh';
  difficulty: SemanticDifficulty;
  input: string;
  contextMessages?: ReadonlyArray<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  expectedAction: SemanticExpectedAction;
  expectedTools?: readonly string[];
  forbiddenTools?: readonly string[];
  requiredConceptGroups?: ReadonlyArray<readonly string[]>;
  forbiddenOutput?: readonly string[];
  referenceOutline: readonly string[];
  critical: boolean;
}

export interface SemanticEvalCase extends SemanticScenario {
  scenarioId: string;
  variation: number;
  rubricWeights: Record<SemanticRubricAxis, number>;
  provenance: {
    author: 'codex';
    reviewer: 'codex';
    reviewMode: 'self_reviewed';
    humanExpertReviewed: false;
    rubricVersion: string;
  };
}

export interface SemanticReview {
  reviewerType: 'codex' | 'human_expert';
  reviewerId: string;
  rubricVersion: string;
  independent: boolean;
  scores: Record<SemanticRubricAxis, number>;
  reasonCodes: string[];
}

export interface SemanticSubmissionItem {
  caseId: string;
  output: string;
  toolNames: string[];
  review: SemanticReview;
}

export interface SemanticEvalSubmission {
  schemaVersion: 1;
  datasetVersion: string;
  candidate: {
    id: string;
    source: 'production_agent' | 'codex_reference' | 'other';
    version: string;
  };
  items: SemanticSubmissionItem[];
}

export interface SemanticCaseResult {
  caseIdHash: string;
  outputHash: string;
  category: SemanticEvalCategory;
  agentType: AgentType;
  locale: 'en' | 'zh';
  difficulty: SemanticDifficulty;
  hardGatePassed: boolean;
  semanticScore: number;
  reasonCodes: string[];
  reviewerType: SemanticReview['reviewerType'];
  independentReview: boolean;
}

export interface SemanticEvalReport {
  schemaVersion: 1;
  datasetVersion: string;
  rubricVersion: string;
  execution: 'offline_review_packet';
  sensitiveDataIncluded: false;
  candidate: {
    idHash: string;
    source: SemanticEvalSubmission['candidate']['source'];
    versionHash: string;
  };
  coverage: {
    scenarioFamilies: number;
    caseCount: number;
    reviewedCases: number;
    agentTypeCount: number;
    localeCount: number;
    difficultyCounts: Record<SemanticDifficulty, number>;
    categoryCounts: Record<SemanticEvalCategory, number>;
  };
  metrics: {
    hardGatePassRate: number;
    macroSemanticScore: number;
    categoryScores: Record<SemanticEvalCategory, number>;
    independentReviewRate: number;
    humanExpertReviewRate: number;
  };
  calibration?: {
    passingCandidateAccuracy: number;
    failingCandidateRejectionRate: number;
    negativeControlCount: number;
    negativeControlCounts: {
      emptyOutput: number;
      missingTool: number;
      forbiddenTool: number;
      forbiddenOutput: number;
      missingConcept: number;
    };
  };
  gate: {
    passed: boolean;
    failures: string[];
  };
  cases: SemanticCaseResult[];
}
