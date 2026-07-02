export type BenchmarkProfileInput = {
  gpa?: number;
  gpaScale?: number;
  gpaSystem?: string;
  grade?: string;
  currentSchoolType?: string;
  targetMajor?: string;
  highSchoolId?: string;
  highSchoolName?: string;
  highSchoolTier?: number;
  highSchoolType?: string;
  highSchoolLocation?: string;
  highSchoolRecognition?: number;
  highSchoolAcademicRigor?: number;
  highSchoolPlacementRecord?: number;
  highSchoolStudentQuality?: number;
  highSchoolResources?: number;
  highSchoolGradeInflation?: string;
  isInternational?: boolean;
  nationality?: string;
  educationSystem?: string;
  needsFinancialAid?: boolean;
  isLegacy?: boolean;
  legacySchools?: string[];
  isFirstGen?: boolean;
  essayQualityScore?: number;
  applicationRound?: string;
  locale?: string;
  testScores: Array<{
    type: string;
    score: number;
    subScores?: Record<string, number>;
  }>;
  activities: Array<{
    name?: string;
    category: string;
    role: string;
    description?: string;
    hoursPerWeek?: number;
    weeksPerYear?: number;
  }>;
  awards: Array<{
    level: string;
    name?: string;
    tier?: number;
    competitionName?: string;
  }>;
  assessment?: {
    mbtiType?: string;
    hollandCodes?: string[];
  };
};

export type CompetitorRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type CompetitorPredictionStatus =
  'PENDING' | 'COMPLETED' | 'TIER_ONLY' | 'UNMATCHED' | 'AMBIGUOUS' | 'FAILED' | 'SESSION_ERROR';

export type CompetitorPredictionMatchStatus =
  'matched' | 'matched-tier-only' | 'unmatched' | 'ambiguous' | 'adapter-error' | 'session-error';

export interface BenchmarkProfile {
  id: string;
  label: string;
  cohortTag?: string | null;
  profileJson: BenchmarkProfileInput;
  createdAt: string;
}

export interface CompetitorSourceSummary {
  id: string;
  key: string;
  label: string;
  baseUrl: string;
  enabled: boolean;
  hasSession: boolean;
  supportsNumericProbability: boolean;
}

export interface CompetitorRunSummary {
  id: string;
  profileId: string;
  profileLabel: string;
  sourceId: string;
  sourceKey: string;
  sourceLabel: string;
  status: CompetitorRunStatus;
  startedAt: string;
  finishedAt?: string | null;
  successCount: number;
  errorCount: number;
  processedCount: number;
  note?: string | null;
}

export interface CompetitorRunDetail extends CompetitorRunSummary {
  predictions: Array<{
    id: string;
    schoolKey: string;
    rawSchoolName: string;
    schoolId?: string | null;
    matchType?: string | null;
    probability?: number | null;
    tierLabel?: string | null;
    status: CompetitorPredictionStatus;
    errorMsg?: string | null;
    fetchedAt: string;
  }>;
}

export interface CompetitorPredictionRow {
  schoolKey: string;
  rawSchoolName: string;
  schoolId?: string | null;
  school?: {
    id: string;
    name: string;
    nameZh?: string | null;
  } | null;
  oursProbability?: number | null;
  theirsProbability?: number | null;
  delta?: number | null;
  oursTier?: string | null;
  theirsTier?: string | null;
  tierAgree?: boolean | null;
  matchStatus: CompetitorPredictionMatchStatus;
  externalSource: string;
  note?: string | null;
}

export interface CompetitorBenchmarkSummary {
  totalSchools: number;
  matchedCount: number;
  matchedProbabilityCount: number;
  tierOnlyCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
  adapterErrorCount: number;
  sessionErrorCount: number;
  coverageGapCount: number;
  mae?: number | null;
  meanDelta?: number | null;
  tierAgreementRate?: number | null;
}

export interface CompetitorBenchmarkReport {
  runId: string;
  profileId: string;
  sourceKey: string;
  sourceLabel: string;
  externalSource: string;
  generatedAt: string;
  status: CompetitorRunStatus;
  summary: CompetitorBenchmarkSummary;
  rows: CompetitorPredictionRow[];
}
