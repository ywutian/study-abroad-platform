import type { PaginatedResponse } from './api';
import type { ApplicationAnalysisExperimentCapability } from './ai-agent';

export type SchoolPolicyDimension = 'TESTING' | 'INTL_AID' | 'ROUND' | 'OTHER';
export type SchoolPolicyEvidenceStatus =
  'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type GovernanceEvidenceMode = 'fixture' | 'real' | 'mixed' | 'none';
export type ApplicationAnalysisPolicyStatus =
  'DRAFT' | 'CANDIDATE' | 'SHADOW' | 'ACTIVE' | 'RETIRED';
export type ApplicationAnalysisEvaluationMode = 'GOLD_SET' | 'SHADOW';
export type ApplicationAnalysisEvaluationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type ApplicationAnalysisExperimentStatus =
  'DRAFT' | 'SHADOW' | 'CANARY' | 'ACTIVE' | 'RETIRED';
export type ApplicationAnalysisExperimentEvaluationMode = 'GOLD_SET' | 'SHADOW' | 'CANARY';
export type ApplicationAnalysisExperimentEvaluationStatus =
  'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type ApplicationAnalysisFeedbackCategory =
  | 'UNSAFE_RECOURSE'
  | 'POLICY_MISMATCH'
  | 'MISLEADING_UNCERTAINTY'
  | 'FAIRNESS_CONCERN'
  | 'LOW_ACTIONABILITY';
export type ApplicationAnalysisFeedbackSentiment = 'HELPFUL' | 'NOT_HELPFUL';
export type ApplicationAnalysisExperimentSweepMode =
  'HOURLY_ROLLOUT' | 'NIGHTLY_SHADOW' | 'MANUAL_FULL';
export type ApplicationAnalysisExperimentSweepStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';
export type ApplicationAnalysisExperimentIncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ApplicationAnalysisExperimentIncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface ApplicationAnalysisWorkflowSchoolRef {
  id: string;
  name: string;
  nameZh?: string | null;
  usNewsRank?: number | null;
}

export interface SchoolPolicyEvidenceRecord {
  id: string;
  schoolId: string;
  school?: ApplicationAnalysisWorkflowSchoolRef | null;
  policyDimension: SchoolPolicyDimension;
  policyValue: string;
  sourceName: string;
  sourceUrl?: string | null;
  sourcePublishedAt?: string | null;
  sourceQuality?: number | null;
  status: SchoolPolicyEvidenceStatus;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  evidenceMode?: GovernanceEvidenceMode;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalysisPolicyVersionRecord {
  id: string;
  policyKey: string;
  version: string;
  name?: string | null;
  description?: string | null;
  status: ApplicationAnalysisPolicyStatus;
  analysisVersion: string;
  promptVersion?: string | null;
  ruleBundleVersion?: string | null;
  thresholds?: Record<string, unknown> | null;
  rolloutConfig?: Record<string, unknown> | null;
  monitoringConfig?: Record<string, unknown> | null;
  notes?: string | null;
  effectiveFrom?: string | null;
  shadowStartedAt?: string | null;
  activatedAt?: string | null;
  activatedBy?: string | null;
  retiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalysisEvaluationRunRecord {
  id: string;
  policyVersionId: string;
  policyVersion?: Pick<
    ApplicationAnalysisPolicyVersionRecord,
    'id' | 'policyKey' | 'version' | 'status' | 'analysisVersion'
  > | null;
  mode: ApplicationAnalysisEvaluationMode;
  status: ApplicationAnalysisEvaluationStatus;
  scopeSummary?: Record<string, unknown> | null;
  counts?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  failures?: string[] | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalysisReplayCaseResultRecord {
  id: string;
  replayRunId: string;
  runId?: string | null;
  caseId: string;
  sourceType: string;
  status: string;
  traceId?: string | null;
  outputPayload?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  failures?: unknown[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalysisReplayRunRecord {
  id: string;
  analysisVersion: string;
  dataset: string;
  status: string;
  summary?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  failures?: unknown[] | null;
  createdBy?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  caseResults?: ApplicationAnalysisReplayCaseResultRecord[];
}

export interface ApplicationAnalysisExperimentVersionRecord {
  id: string;
  capability: ApplicationAnalysisExperimentCapability;
  version: string;
  policyVersionId?: string | null;
  policyVersion?: Pick<
    ApplicationAnalysisPolicyVersionRecord,
    'id' | 'policyKey' | 'version' | 'status' | 'analysisVersion'
  > | null;
  status: ApplicationAnalysisExperimentStatus;
  methodVersion: string;
  gateConfig?: Record<string, unknown> | null;
  rolloutConfig?: Record<string, unknown> | null;
  monitoringConfig?: Record<string, unknown> | null;
  notes?: string | null;
  shadowStartedAt?: string | null;
  canaryStartedAt?: string | null;
  activatedAt?: string | null;
  retiredAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalysisExperimentEvaluationRunRecord {
  id: string;
  experimentVersionId: string;
  experimentVersion?: Pick<
    ApplicationAnalysisExperimentVersionRecord,
    'id' | 'capability' | 'version' | 'status' | 'methodVersion'
  > | null;
  mode: ApplicationAnalysisExperimentEvaluationMode;
  status: ApplicationAnalysisExperimentEvaluationStatus;
  scopeSummary?: Record<string, unknown> | null;
  counts?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  failures?: string[] | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalysisExperimentSweepRunRecord {
  id: string;
  mode: ApplicationAnalysisExperimentSweepMode;
  status: ApplicationAnalysisExperimentSweepStatus;
  actorId?: string | null;
  lockKey?: string | null;
  summary?: Record<string, unknown> | null;
  failures?: string[] | null;
  startedAt: string;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalysisExperimentIncidentRecord {
  id: string;
  experimentVersionId?: string | null;
  capability?: ApplicationAnalysisExperimentCapability | null;
  type: string;
  severity: ApplicationAnalysisExperimentIncidentSeverity;
  status: ApplicationAnalysisExperimentIncidentStatus;
  title: string;
  message: string;
  details?: Record<string, unknown> | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalysisExposureRecord {
  id: string;
  exposureId: string;
  experimentVersionId: string;
  capability: ApplicationAnalysisExperimentCapability;
  userId: string;
  profileId: string;
  schoolIds: string[];
  locale: string;
  exposurePayload?: Record<string, unknown> | null;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalysisFeedbackRecord {
  id: string;
  exposureRecordId?: string | null;
  applicationAnalysisRunId?: string | null;
  exposureId?: string | null;
  userId: string;
  capability?: ApplicationAnalysisExperimentCapability | null;
  schoolId?: string | null;
  category?: ApplicationAnalysisFeedbackCategory | null;
  sentiment: ApplicationAnalysisFeedbackSentiment;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAnalysisGateSummary {
  ready: boolean;
  thresholds: Record<string, number | boolean>;
  latestEvaluation?: ApplicationAnalysisEvaluationRunRecord | null;
  metrics: Record<string, number | boolean>;
  failures: string[];
}

export interface ApplicationAnalysisExperimentGateSummary {
  ready: boolean;
  thresholds: Record<string, number | boolean>;
  latestEvaluation?: ApplicationAnalysisExperimentEvaluationRunRecord | null;
  metrics: Record<string, number | boolean>;
  failures: string[];
}

export interface ApplicationAnalysisRecoursePreview {
  goal: string;
  recommendedChanges: Array<{
    action: string;
    rationale: string;
    effort: 'low' | 'medium' | 'high';
    timeHorizon: 'now' | 'next90Days' | 'beforeSubmission';
    blockedBy?: string[];
  }>;
  estimatedDirection: 'upside' | 'stabilize' | 'mixed';
  constraints: string[];
  whyNotGuaranteed: string;
}

export interface ApplicationAnalysisUncertaintyPreview {
  probabilityLow?: number;
  probabilityHigh?: number;
  intervalLabel: 'tight' | 'balanced' | 'wide';
  reasons: string[];
}

export interface ApplicationAnalysisFairnessReport {
  status: 'clear' | 'limited' | 'blocked';
  notes: string[];
  appliesTo: string[];
  metrics?: Record<string, number | boolean>;
}

export interface ApplicationAnalysisExperimentSweepSummary {
  runId?: string;
  mode?: ApplicationAnalysisExperimentSweepMode;
  total: number;
  checked: number;
  promotedToCanary: string[];
  stageAdvanced: string[];
  activated: string[];
  retired: string[];
  skipped: Array<{
    id: string;
    reason: string;
  }>;
  incidents?: string[];
}

export interface UpdateApplicationAnalysisExperimentConfigInput {
  rolloutPercentages?: number[];
  minStageHours?: number;
  autoPromote?: boolean;
  autoRetire?: boolean;
  automationPaused?: boolean;
  monitoringThresholds?: Record<string, number>;
}

export interface SubmitApplicationAnalysisFeedbackInput {
  runId?: string;
  exposureId?: string;
  capability?: ApplicationAnalysisExperimentCapability;
  sentiment: ApplicationAnalysisFeedbackSentiment;
  schoolId?: string;
  category?: ApplicationAnalysisFeedbackCategory;
  notes?: string;
}

export type PaginatedApplicationAnalysisEvidenceResponse =
  PaginatedResponse<SchoolPolicyEvidenceRecord>;
export type PaginatedApplicationAnalysisPolicyResponse =
  PaginatedResponse<ApplicationAnalysisPolicyVersionRecord>;
export type PaginatedApplicationAnalysisEvaluationResponse =
  PaginatedResponse<ApplicationAnalysisEvaluationRunRecord>;
export type PaginatedApplicationAnalysisReplayRunResponse =
  PaginatedResponse<ApplicationAnalysisReplayRunRecord>;
export type PaginatedApplicationAnalysisExperimentResponse =
  PaginatedResponse<ApplicationAnalysisExperimentVersionRecord>;
export type PaginatedApplicationAnalysisExperimentEvaluationResponse =
  PaginatedResponse<ApplicationAnalysisExperimentEvaluationRunRecord>;
export type PaginatedApplicationAnalysisExperimentSweepResponse =
  PaginatedResponse<ApplicationAnalysisExperimentSweepRunRecord>;
export type PaginatedApplicationAnalysisExperimentIncidentResponse =
  PaginatedResponse<ApplicationAnalysisExperimentIncidentRecord>;
export type PaginatedApplicationAnalysisExperimentFeedbackResponse =
  PaginatedResponse<ApplicationAnalysisFeedbackRecord>;
