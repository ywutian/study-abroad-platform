// Prediction feature types — aligned with backend PredictionResultDto / PredictionResponseDto

export interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
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
  confidence: 'low' | 'medium' | 'high';
  tier: 'reach' | 'match' | 'safety';
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
    acceptanceRate?: number;
    graduationRate?: number;
    satAvg?: number;
    sat25?: number;
    sat75?: number;
  };
  crossEngineConsistency?: number;
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
}

export interface SchoolSearchItem {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  acceptanceRate?: string | null;
}

export type TierType = 'reach' | 'match' | 'safety';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
