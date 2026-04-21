export type AuditVerdict = 'verified_accurate' | 'insufficient_evidence' | 'biased_or_defective';

export type AgentName =
  | 'Runtime Auditor'
  | 'Fact Auditor'
  | 'Probability Auditor'
  | 'Analysis Quality Auditor'
  | 'Governance Auditor';

export type FindingSeverity = 'P0' | 'P1' | 'P2';

export type TruthSourceType =
  | 'official_admissions_page'
  | 'official_financial_aid_page'
  | 'official_policy_page'
  | 'official_pdf'
  | 'official_system_page'
  | 'local_college_scorecard_snapshot';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type TestingPolicyTruth = 'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'FREE' | 'UNKNOWN';
export type IntlAidPolicyTruth = 'NEED_BLIND' | 'NEED_AWARE' | 'UNKNOWN';

export interface SchoolTruthFacts {
  standardDeadline?: string | null;
  earlyDeadlinePolicy?: string | null;
  testingPolicy?: TestingPolicyTruth | null;
  intlAidPolicy?: IntlAidPolicyTruth | null;
  acceptanceRate?: number | null;
  sat25?: number | null;
  sat75?: number | null;
  act25?: number | null;
  act75?: number | null;
  notes?: string[];
}

export interface SchoolTruthRecord {
  schoolId: string | null;
  schoolName: string;
  facts: SchoolTruthFacts;
  sourceUrl: string;
  retrievedAt: string;
  sourceType: TruthSourceType;
  confidence: ConfidenceLevel;
  scope: 'top50-plus-uc';
}

export interface FactDriftRow {
  schoolName: string;
  surface: 'school_record' | 'analysis_runtime';
  field: 'standardDeadline' | 'earlyDeadlinePolicy' | 'testingPolicy' | 'intlAidPolicy';
  expected: string | number | null;
  actual: string | number | null;
  status: 'match' | 'mismatch' | 'missing_local';
  sourceUrl: string;
  note?: string;
}

export interface PredictionCalibrationBin {
  predictedMean: number;
  actualRate: number;
  count: number;
}

export interface PredictionSliceMetric {
  dimension: 'schoolBand' | 'round' | 'international' | 'aid' | 'modelVersion';
  slice: string;
  count: number;
  admitRate: number | null;
  brier: number | null;
  ece: number | null;
}

export interface PredictionAccuracyArtifact {
  sampleCount: number;
  verdict: AuditVerdict;
  message: string;
  brier: number | null;
  ece: number | null;
  calibrationBins: PredictionCalibrationBin[];
  baselineComparison: {
    baselineBrier: number | null;
    baselineEce: number | null;
    brierDelta: number | null;
    eceDelta: number | null;
    tierMonotonicityPasses: boolean | null;
  };
  sliceMetrics: PredictionSliceMetric[];
  outcomeInventory: Array<{
    status: string;
    result: string;
    count: number;
  }>;
  modelVersions: Record<string, number>;
  realDataOnly: true;
}

export type AnalysisCaseStatus = 'completed' | 'environment_blocked' | 'evidence_insufficient';

export interface AnalysisQualityRecord {
  caseId: string;
  sourceType: 'real' | 'synthetic';
  profileId: string | null;
  schoolNames: string[];
  status: AnalysisCaseStatus;
  factSupportPass: boolean | null;
  policyConsistencyPass: boolean | null;
  probabilityConsistencyPass: boolean | null;
  actionabilityScore: number | null;
  fabricatedInsightPass: boolean | null;
  overconfidence: boolean | null;
  note?: string;
}

export interface AnalysisQualityArtifact {
  status: AnalysisCaseStatus;
  realSampleCount: number;
  syntheticSampleCount: number;
  executedCaseCount: number;
  realPassRate: number | null;
  syntheticPassRate: number | null;
  fabricatedInsightCount: number | null;
  overconfidenceCount: number | null;
  records: AnalysisQualityRecord[];
  endpointProbe: {
    baseUrl: string;
    reachability: 'reachable' | 'auth_blocked' | 'unreachable';
    detail: string;
  };
}

export interface AgentFinding {
  agent: AgentName;
  severity: FindingSeverity;
  category: string;
  summary: string;
  evidence: string;
  affectedSurface: string;
  file: string;
  line: number | null;
}

export interface AgentAuditNote {
  agent: AgentName;
  summary: string;
  findings: AgentFinding[];
  notes: string[];
}

export interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface AuditVerdictArtifact {
  overallVerdict: AuditVerdict;
  dimensionVerdicts: Record<string, AuditVerdict>;
  blockers: string[];
  p0Findings: AgentFinding[];
  p1Findings: AgentFinding[];
  p2Findings: AgentFinding[];
}

export interface FactAuditArtifact {
  scopeSchoolCount: number;
  officialTruthCoverageCount: number;
  fieldLevelAccuracy: number | null;
  schoolLevelMismatchCount: number;
  diffTable: FactDriftRow[];
  truthset: SchoolTruthRecord[];
}
