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

export interface CohortStats {
  count: number;
  gpaMedian?: number;
  gpaP25?: number;
  gpaP75?: number;
  satMedian?: number;
  satP25?: number;
  satP75?: number;
  topTags?: string[];
}

export interface CaseComparison {
  schoolId: string;
  totalCases: number;
  admitted: CohortStats;
  rejected: CohortStats;
  waitlisted?: CohortStats;
  nationalitySubset?: {
    nationality: string;
    admitted: CohortStats;
    rejected: CohortStats;
  };
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
  caseComparison?: CaseComparison;
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
