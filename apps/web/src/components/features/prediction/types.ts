// Prediction feature types — aligned with backend PredictionResultDto / PredictionResponseDto
//
// Base types imported from @study-abroad/shared.
// Only UI-specific types remain local.

export type {
  PredictionFactor,
  PredictionResult,
  PredictionResponse,
  PredictionComparison,
  EngineScores,
  TierType,
  ConfidenceLevel,
} from '@study-abroad/shared';

export interface SchoolSearchItem {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  /** 0–100 percentage (e.g. 4.0 means 4%) */
  acceptanceRate?: number | null;
  rankings?: { source: string; list: string; rank: number; year: number }[];
}
