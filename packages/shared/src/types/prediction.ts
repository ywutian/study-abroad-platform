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
  profileId: string;
  targetSchools: string[];
}

export type TierType = 'reach' | 'match' | 'safety';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

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
  memoryAdjustment?: number;
  weights: Record<string, number>;
  fusionMethod: string;
  crossEngineConsistency?: number;
}

export interface PredictionResult {
  schoolId: string;
  schoolName: string;
  probability: number;
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
  source?: string;
  actualResult?: string;
  schoolMeta?: {
    usNewsRank?: number;
    /** 0–100 percentage (e.g. 4.0 means 4%) */
    acceptanceRate?: number;
    /** 0–100 percentage — international-specific acceptance rate */
    intlAcceptanceRate?: number;
    /** 0–100 percentage — share of international students */
    intlStudentPct?: number;
    needBlindInternational?: boolean;
    /** 0–100 percentage */
    graduationRate?: number;
    satAvg?: number;
    sat25?: number;
    sat75?: number;
  };
  majorBreakdown?: MajorBreakdown;
  communityInsight?: {
    /** 0–1 ratio (e.g. 0.35 means 35% admit rate) — convert to % for display */
    majorAdmitRate: number;
    totalCases: number;
    major: string;
  };
  crossEngineConsistency?: number;
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
