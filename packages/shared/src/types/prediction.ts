import type { SchoolRanking } from '../ranking';

// Prediction

/**
 * Standardized model version hierarchy for PredictionResult.
 * Higher-quality sources never get overwritten by lower-quality ones.
 */
export enum ProbabilitySource {
  /** Rule-based scoring only (calculateOverallScore + logistic sigmoid) */
  STATS_ONLY = 'v1-stats',
  /** AI recommendation anchored to statistical baseline */
  RECOMMENDATION = 'v2-recommendation-anchored',
  /** Full multi-engine ensemble (Stats + AI + Historical + ML) */
  ENSEMBLE = 'v3-enterprise',
}

export interface PredictionRequest {
  schoolIds: string[];
  forceRefresh?: boolean;
}

/**
 * Reasons a profile is not yet eligible to run an admission prediction.
 *
 * Single source of truth for prediction eligibility — consumed identically
 * by the readiness endpoint (`/profiles/me/readiness`), the predict 412
 * backstop (`POST /predictions`), the `/profiles/me/completeness` endpoint,
 * the web UI, and mobile. The predicate that produces these lives in
 * `apps/api/src/modules/profile/prediction-eligibility.util.ts`.
 *
 * - `MISSING_GPA` — no GPA on the profile (the single most predictive input)
 * - `MISSING_BASIC_INFO` — neither target major nor grade is set
 * - `NO_TARGET_SCHOOLS` — the user's school list is empty (no anchor)
 */
export type PredictionBlocker = 'MISSING_GPA' | 'MISSING_BASIC_INFO' | 'NO_TARGET_SCHOOLS';

/** Result of evaluating whether a profile may run an admission prediction. */
export interface PredictionEligibility {
  canRunPrediction: boolean;
  blockers: PredictionBlocker[];
}

export type TierType = 'reach' | 'match' | 'safety' | 'unavailable';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type SchoolTestingPolicy = 'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'UNKNOWN';
export type SchoolIntlAidPolicy = 'NEED_BLIND' | 'NEED_AWARE' | 'UNKNOWN';
export type SchoolRoundContext = 'ED' | 'ED2' | 'EA' | 'REA' | 'SCEA' | 'RD' | 'UC' | 'UNKNOWN';
export type PolicySourceQuality = 'REVIEWED' | 'DERIVED' | 'UNKNOWN';
export type PredictionOutcomeLabelStatus =
  | 'SELF_REPORTED'
  | 'COUNSELOR_VERIFIED'
  | 'DOCUMENT_VERIFIED'
  | 'REQUEST_EVIDENCE'
  | 'REJECTED'
  | 'CONFLICTED'
  | 'CENSORED';

export interface SchoolPolicyContext {
  testingPolicy: SchoolTestingPolicy;
  intlAidPolicy: SchoolIntlAidPolicy;
  roundContext: SchoolRoundContext;
  policySourceQuality: PolicySourceQuality;
}

export interface PredictionSourceSummary {
  label: string;
  detail?: string;
}

export interface PredictionInsufficientData {
  tier: 4;
  reason: string;
}

export interface SchoolPredictionDataQuality {
  officialFields: string[];
  heuristicFields: string[];
  terminalFields: string[];
  staleFields: string[];
  impactedFields: string[];
  summary: 'strong' | 'mixed' | 'limited';
}

export interface PredictionOutcomeLabel {
  id: string;
  result:
    | 'ADMITTED'
    | 'REJECTED'
    | 'WAITLISTED'
    | 'DEFERRED'
    | 'WITHDRAWN'
    | 'UNKNOWN'
    | 'CENSORED';
  status: PredictionOutcomeLabelStatus;
  notes?: string;
  evidenceUrl?: string;
  reportedAt: string;
  resolvedAt?: string;
  round?: string;
}

export interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight?: number;
  detail: string;
  improvement?: string;
}

export interface PredictionComparison {
  gpaPercentile: number;
  testScorePercentile: number;
  activityStrength: 'weak' | 'average' | 'strong';
}

export interface EngineScores {
  stats: number;
  ai?: number;
  historical?: number;
  ml?: number;
  memoryAdjustment?: number;
  weights: Record<string, number>;
  fusionMethod: string;
  crossEngineConsistency?: number;
  mlModelTier?: number;
  mlContributions?: Array<{
    feature: string;
    contribution: number;
    direction: 'positive' | 'negative';
  }>;
}

export interface PredictionPublicExplanation {
  headline: string;
  reasons: string[];
  nextAction?: string;
  dataSupportLabel: string;
  dataSupportLevel: 'strong' | 'moderate' | 'limited';
  caveats: string[];
  source: 'rules' | 'llm';
  generatedAt?: string;
}

export interface PredictionResult {
  /** PredictionResult row ID. Present for persisted predictions; omitted for dry-run previews. */
  id?: string;
  authority?: 'AUTHORITATIVE' | 'PREVIEW';
  schoolId: string;
  schoolName: string;
  probability: number | null;
  probabilityLow?: number;
  probabilityHigh?: number;
  confidence: ConfidenceLevel;
  tier: TierType;
  factors: PredictionFactor[];
  suggestions: string[];
  comparison?: PredictionComparison;
  engineScores?: EngineScores;
  fromCache?: boolean;
  cachedAt?: string;
  modelVersion?: string;
  servedPolicyVersionId?: string;
  source?: string;
  actualResult?: string;
  cohortKey?: string;
  roundContext?: string;
  predictionMethod?: 'fusion' | 'counselor' | 'insufficient_data';
  sourceSummary?: PredictionSourceSummary[];
  uncertaintyReasons?: string[];
  confidenceReason?: string;
  publicExplanation?: PredictionPublicExplanation;
  insufficientData?: PredictionInsufficientData;
  latestOutcomeLabel?: PredictionOutcomeLabel;
  policyContext?: SchoolPolicyContext;
  schoolMeta?: {
    usNewsRank?: number;
    rankings?: SchoolRanking[];
    /** 0–100 percentage (e.g. 4.0 means 4%) */
    acceptanceRate?: number;
    /** 0–100 percentage — international-specific acceptance rate */
    intlAcceptanceRate?: number;
    /** 0–100 percentage — out-of-state freshman acceptance rate */
    oosAcceptanceRate?: number;
    /** 0–100 percentage — share of international students */
    intlStudentPct?: number;
    needBlindInternational?: boolean | null;
    /** 0–100 percentage */
    graduationRate?: number;
    satAvg?: number;
    sat25?: number;
    sat75?: number;
    dataQuality?: SchoolPredictionDataQuality;
  };
  majorBreakdown?: MajorBreakdown;
  communityInsight?: {
    /** 0–1 ratio (e.g. 0.35 means 35% admit rate) — convert to % for display */
    majorAdmitRate: number;
    totalCases: number;
    major: string;
  };
  crossEngineConsistency?: number;

  // v5 ML-Primary fields (optional, backward compatible)
  pipelineTier?: number;
  calibrationMethod?: string;
  baseRate?: number;
  hookShifts?: Array<{ hookType: string; logOddsShift: number; source: string }>;
  quotaDisclosure?: string;
}

export interface MajorBreakdown {
  majorName: string;
  majorNameZh?: string;
  cipCode: string;
  competitiveness: number;
  /** 0–100 percentage — estimated acceptance rate for this major */
  acceptanceRateEstimate?: number;
  modifier: number;
  /** 0–1 probability (e.g. 0.35 means 35% chance) */
  adjustedProbability: number;
}

export interface PredictionResponse {
  results: PredictionResult[];
  processingTime?: number;
  dataCompleteness?: number;
  memoryContext?: {
    previousPredictions: number;
    knownPreferences: string[];
    dataPoints: number;
  };
  validationSummary?: {
    violations: string[];
    warnings: string[];
  };
  /** Set when user selected any UC school and backend expanded to all 9 UC campuses */
  ucComparisonExpanded?: boolean;
}
