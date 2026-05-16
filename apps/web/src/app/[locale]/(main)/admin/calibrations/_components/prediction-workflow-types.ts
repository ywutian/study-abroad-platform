'use client';

export interface WorkflowSchoolRef {
  id: string;
  name: string;
  nameZh?: string | null;
  usNewsRank?: number | null;
}

export interface WorkflowHighSchoolRef {
  id: string;
  name: string;
  tier?: number | null;
}

export interface PredictionWorkflowObservation {
  id: string;
  schoolId?: string | null;
  school?: WorkflowSchoolRef | null;
  highSchoolId?: string | null;
  highSchool?: WorkflowHighSchoolRef | null;
  cohortKey?: string | null;
  round?: string | null;
  metricType: string;
  sourceType: string;
  sourceName: string;
  qualityScore?: number | null;
  observationStage: string;
  status: string;
  reviewAt?: string | null;
  expiresAt?: string | null;
  observedAt: string;
  year?: number | null;
  notes?: string | null;
}

export interface PredictionWorkflowPolicy {
  id: string;
  policyKey: string;
  version: string;
  name?: string | null;
  description?: string | null;
  status: string;
  priorSetVersion?: string | null;
  driftSetVersion?: string | null;
  relationshipSetVersion?: string | null;
  calibrationVersion?: string | null;
  numericCoreVersion?: string | null;
  explanationSchemaVersion?: string | null;
  thresholds?: Record<string, unknown> | null;
  monitoringConfig?: Record<string, unknown> | null;
  shadowStartedAt?: string | null;
  activatedAt?: string | null;
  retiredAt?: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface PredictionSignalSummary {
  priors: Array<{
    id: string;
    school: WorkflowSchoolRef;
    cohortKey: string;
    round: string;
    priorRate: string;
    confidence?: string | null;
    sampleCount?: number | null;
    reviewAt?: string | null;
    expiresAt?: string | null;
  }>;
  drifts: Array<{
    id: string;
    school: WorkflowSchoolRef;
    cohortKey?: string | null;
    round?: string | null;
    signalType?: string | null;
    driftMultiplier?: string | null;
    confidence?: string | null;
    reviewAt?: string | null;
    expiresAt?: string | null;
  }>;
  relationships: Array<{
    id: string;
    targetSchool: WorkflowSchoolRef;
    sourceHighSchool?: WorkflowHighSchoolRef | null;
    relationshipType: string;
    signalStrength?: string | null;
    maxImpactCap?: string | null;
    confidence?: string | null;
    reviewAt?: string | null;
    expiresAt?: string | null;
  }>;
  counts: {
    priors: number;
    drifts: number;
    relationships: number;
  };
}

export interface PredictionPolicyGateSummary {
  ready: boolean;
  thresholds: Record<string, number>;
  counts: {
    shadowPredictions: number;
    resolvedLabels: number;
    cohorts: Record<string, number>;
  };
  shadowMetrics: Record<string, unknown>;
  failures: string[];
}

export interface PredictionWorkflowOutcome {
  id: string;
  result: string;
  status: string;
  notes?: string;
  evidenceUrl?: string;
  round?: string;
  isFinal: boolean;
  reportedAt: string;
  resolvedAt?: string;
  predictionResultId: string;
  schoolId: string;
  school?: WorkflowSchoolRef | null;
  profileId: string;
  policyVersionId?: string;
  applicationRound?: string;
  applicationYear?: number;
  cohortKey?: string;
  latestOutcomeLabel?: {
    id: string;
    result: string;
    status: string;
    notes?: string;
    evidenceUrl?: string;
    reportedAt: string;
    resolvedAt?: string;
    round?: string;
  };
  canonicalOutcomeLabel?: string;
  calibrationEligible: boolean;
  suspiciousFlags?: string[];
  reviewPriority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

// 2026-05: Was duplicating @study-abroad/shared's PaginatedResponse<T>
// (identical shape). Removed — calibrations tabs now import the shared
// type directly so any future change happens in one place.
