import type { SchoolRanking } from '@/lib/utils/ranking';

// Prediction feature types — aligned with backend PredictionResultDto / PredictionResponseDto.
//
// Shared types are the source of truth for prediction responses. This file only
// re-exports them locally for feature-level imports.

export type {
  PredictionFactor,
  PredictionOutcomeLabel,
  PredictionOutcomeLabelStatus,
  PredictionSourceSummary,
  PredictionPublicExplanation,
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
  rankings?: SchoolRanking[];
}
