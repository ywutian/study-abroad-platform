// Recommendation
import type { SchoolFieldSource } from './school-provenance';
import type { SchoolTestingPolicy } from './prediction';

export interface SchoolMeta {
  nameZh?: string;
  usNewsRank?: number;
  /** 0–100 percentage (e.g. 4.0 means 4%) */
  acceptanceRate?: number;
  city?: string;
  state?: string;
  tuition?: number;
  isPrivate?: boolean;
  testingPolicy?: SchoolTestingPolicy;
  testOptional?: boolean;
  hasEarlyDecision?: boolean;
  retentionRate?: number;
  logoUrl?: string;
  website?: string;
  fieldSources?: Record<string, SchoolFieldSource | null>;
  weakFields?: Record<string, string>;
}

export interface RecommendedSchool {
  schoolId?: string;
  schoolName: string;
  tier: 'reach' | 'match' | 'safety';
  estimatedProbability: number;
  fitScore: number;
  recommendedMajors?: (string | { name: string; reason: string })[];
  reasons: string[];
  concerns?: string[];
  dataPoints?: string[];
  schoolMeta?: SchoolMeta;
}

export interface RecommendationAnalysis {
  strengths: string[];
  weaknesses: string[];
  improvementTips: string[];
}

export interface SummerProgramRecommendation {
  name: string;
  reason: string;
}

export interface RecommendationResult {
  id: string;
  recommendations: RecommendedSchool[];
  analysis: RecommendationAnalysis;
  summerPrograms?: SummerProgramRecommendation[];
  summary: string;
  tokenUsed: number;
  createdAt: string;
}

export interface RecommendationPreflight {
  canGenerate: boolean;
  points: number;
  profileComplete: boolean;
  missingFields: string[];
  profileSummary?: {
    gpa?: number;
    testCount: number;
    activityCount: number;
  };
}

export interface RecommendationOutcomeMetrics {
  scope: 'recommendation' | 'user';
  recommendationId?: string;
  sampleSize: number;
  insufficientSample: boolean;
  counts: {
    impressions: number;
    added: number;
    removed: number;
    retained: number;
    applied: number;
  };
  rates: {
    addRate: number | null;
    retentionRate: number | null;
    applicationConversionRate: number | null;
  };
}
