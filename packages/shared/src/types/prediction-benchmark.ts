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

/**
 * Snapshot of the applicant profile that was fed into the M3 engine for
 * a case replay. Surfaced to admin co-reviewers so they can question
 * whether the synthetic profile matches a realistic applicant.
 */
export interface BenchmarkProfileSnapshot {
  source: 'real-user' | 'synthetic';
  gpa: number | null;
  gpaScale: number | null;
  satTotal: number | null;
  actComposite: number | null;
  toefl: number | null;
  applicationRound: string | null;
  targetMajor: string | null;
  isInternational: boolean;
  isFirstGeneration: boolean;
  isRecruitedAthlete: boolean;
  legacyAtSchools: string[];
  activityCount: number;
  awardCount: number;
  topAwardLevel: string | null;
  apCount: number | null;
  gpaTrend: string | null;
  testOptional: boolean;
}

/**
 * Snapshot of the school's anchor data that the M3 engine actually read
 * when computing the prediction. The `dataTier` field is critical for
 * co-review: it tells the team whether the hook % was real (HIGH) vs
 * Claude-inferred (MEDIUM) vs global-fallback (LOW).
 */
export interface BenchmarkSchoolAnchorSnapshot {
  schoolId: string;
  acceptanceRate: number | null;
  edAcceptanceRate: number | null;
  eaAcceptanceRate: number | null;
  intlAcceptanceRate: number | null;
  sat25: number | null;
  sat75: number | null;
  act25: number | null;
  act75: number | null;
  hasGpaDistribution: boolean;
  legacyClassPct: number | null;
  athleteClassPct: number | null;
  firstGenClassPct: number | null;
  legacyAdmitMultiplier: number | null;
  athleteAdmitMultiplier: number | null;
  // Data-quality flags. HIGH = official CDS / SFFA, MEDIUM = Claude-inferred
  // peer pattern, LOW = global fallback. NULL means no anchor row at all.
  admitProfileConfidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  admitProfileSource: string | null;
  admitProfileCycleYear: number | null;
  cdsBandCount: number;
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
  // Input data snapshots (added 2026-05-23 for co-review visibility — let
  // admins audit whether the test inputs themselves are realistic).
  profileSnapshot?: BenchmarkProfileSnapshot;
  schoolAnchorSnapshot?: BenchmarkSchoolAnchorSnapshot;
}

/**
 * Aggregate tier breakdown across all schools touched by the run.
 * Lets reviewers see at a glance "this run used 8 HIGH-tier + 92 MEDIUM-tier
 * school anchors" — and therefore know which schools' results to scrutinize.
 */
export interface BenchmarkDataSourceBreakdown {
  // Schools whose anchor data was actually read by this run
  schoolsUsed: number;
  byTier: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    UNFLAGGED: number;
  };
  // Total CDS bands across used schools (more bands = stronger Path A signal)
  cdsBandsAvailable: number;
  // GlobalAdmitBaseline rows the engine fell back to (for the no-anchor case)
  globalBaselinesUsed: number;
}

export interface BenchmarkSummary {
  structuralTestsPassed: number;
  structuralTestsTotal: number;
  casesReplayed: number;
  casesAdmittedMeanProb: number;
  casesAdmittedMaxProb: number;
  casesAdmittedMinProb: number;
  // Added 2026-05-23 — tier breakdown of input data quality
  dataSources?: BenchmarkDataSourceBreakdown;
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
