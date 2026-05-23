/**
 * Shared types for the admin /prediction-benchmark surface.
 *
 * Mirrors the backend PredictionBenchmarkService return shapes. Kept here so
 * the web admin UI can typecheck against the same contract.
 */

export interface BenchmarkTestMetric {
  [key: string]: number | string;
}

export interface BenchmarkTestResult {
  name: string;
  passed: boolean;
  details: string;
  metrics: BenchmarkTestMetric;
  failures?: string[];
}

export interface BenchmarkContribution {
  dimension: string;
  studentValue: string | number | boolean | null;
  schoolAnchor: string;
  likelihoodRatio: number;
  weight: number;
  tier: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  deltaPp: number;
  source: string;
}

export interface BenchmarkCaseReplay {
  caseId: string;
  schoolName: string;
  round: string;
  expectedOutcome: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
  predictedProbability: number;
  tier: string;
  confidence: string;
  contributions: BenchmarkContribution[];
}

export interface BenchmarkSummary {
  structuralTestsPassed: number;
  structuralTestsTotal: number;
  casesReplayed: number;
  casesAdmittedMeanProb: number;
  casesAdmittedMaxProb: number;
  casesAdmittedMinProb: number;
}

export interface BenchmarkRunSummary {
  id: string;
  ranAt: string;
  label: string | null;
  engineVersion: string | null;
  testsPassed: number;
  testsTotal: number;
  summary: BenchmarkSummary;
  notes: string | null;
  _count: { comments: number };
}

export interface BenchmarkCommentAuthor {
  id: string;
  email: string;
  role: string;
  profile: { nickname: string | null } | null;
}

export interface BenchmarkComment {
  id: string;
  body: string;
  anchor: string | null;
  createdAt: string;
  author: BenchmarkCommentAuthor;
}

export interface BenchmarkRunDetail {
  id: string;
  ranAt: string;
  label: string | null;
  engineVersion: string | null;
  testsPassed: number;
  testsTotal: number;
  summary: BenchmarkSummary;
  tests: BenchmarkTestResult[];
  cases: BenchmarkCaseReplay[];
  notes: string | null;
  comments: BenchmarkComment[];
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkListResponse {
  runs: BenchmarkRunSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
