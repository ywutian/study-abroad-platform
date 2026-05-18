// API Types & Common Enums

import type { User } from './auth';
import type { AuthTokens } from './auth';
import type {
  FieldProvenance,
  SchoolFieldSource,
  SchoolFieldSources,
  SchoolProvenance,
} from './school-provenance';
import type { PredictionBlocker } from './prediction';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  locale?: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterResponse {
  user: User;
  message: string;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
  };
}

// Data Provenance
export type ProvenanceRecord = SchoolProvenance;

export interface SchoolCommunityRatingSummary {
  count: number;
  safetyAvg: number | null;
  lifeAvg: number | null;
  foodAvg: number | null;
  isPublic: boolean;
}

/** Human-readable labels for school data sources */
export const DATA_SOURCE_LABELS: Record<string, { en: string; zh: string }> = {
  COLLEGE_SCORECARD: { en: 'US Dept. of Education', zh: '美国教育部' },
  URBAN_INSTITUTE: {
    en: 'Urban Institute (Federal Data)',
    zh: 'Urban Institute (联邦教育数据)',
  },
  BIGFUTURE: { en: 'College Board', zh: 'College Board' },
  APPILY: { en: 'Appily (data aggregator)', zh: 'Appily (数据聚合平台)' },
  IPEDS: {
    en: 'US Federal Statistics (IPEDS)',
    zh: '美国联邦教育统计 (IPEDS)',
  },
  MANUAL_ADMIN: { en: 'Platform entry', zh: '平台录入' },
  CLOSURE_V2: { en: 'Verified data review', zh: '核验数据采集' },
  SEED: { en: 'Curated dataset', zh: '整理数据集' },
  SCRAPER: { en: 'School website', zh: '学校官网' },
  'SCRAPER:TAVILY_NICHE': {
    en: 'Niche search index',
    zh: 'Niche 搜索索引',
  },
  'NO_PUBLIC_REAL_DATA:TAVILY_NICHE': {
    en: 'Niche search index checked',
    zh: '已检查 Niche 搜索索引',
  },
};

// Additional enums from Prisma schema
export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum RecommendationLetterStatus {
  NOT_REQUESTED = 'NOT_REQUESTED',
  REQUESTED = 'REQUESTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
}

export enum ApplicationStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
  WITHDRAWN = 'WITHDRAWN',
}

export type ProfileReadinessStatus = 'blocked' | 'attention' | 'ready';
export type ProfileReadinessSeverity = 'critical' | 'warning' | 'info' | 'success';
export type ProfileReadinessGpaSource = 'cumulative' | 'grade_level' | 'semester';
export type ProfileReadinessTestStrategy =
  | 'scores_submitted'
  | 'test_optional_confirmed'
  | 'unknown';
export type ProfileReadinessAnalysisState =
  | 'ready'
  | 'noTargetSchools'
  | 'noPredictions'
  | 'insufficientProfileData'
  | 'notRun';

export interface ProfileReadinessAction {
  key: string;
  href: string;
  labelKey: string;
  severity: ProfileReadinessSeverity;
  targetTab?: string;
}

export interface ProfileReadinessItem {
  key: string;
  labelKey: string;
  score: number;
  status: ProfileReadinessStatus;
  gaps: string[];
  href: string;
  targetTab?: string;
}

export interface ProfileReadinessV1 {
  readinessVersion: 'profile-readiness-v1';
  computedAt: string;
  overall: {
    score: number;
    status: ProfileReadinessStatus;
    blockers: string[];
    warnings: string[];
    nextActions: ProfileReadinessAction[];
    canRunPrediction: boolean;
    /**
     * Specific reasons `canRunPrediction` is false. Empty when the user is
     * eligible. Lets the UI tell the user exactly what to fix instead of a
     * generic message. See `PredictionBlocker`.
     */
    predictionBlockers: PredictionBlocker[];
    canGenerateRecommendation: boolean;
    canRunApplicationAnalysis: boolean;
  };
  profileCompleteness: {
    score: number;
    status: ProfileReadinessStatus;
    gaps: string[];
    gpaAnchor?: {
      value: number;
      scale: number;
      source: ProfileReadinessGpaSource;
    };
    testStrategy: ProfileReadinessTestStrategy;
    counts: {
      testScores: number;
      activities: number;
      awards: number;
    };
  };
  workflowReadiness: {
    score: number;
    status: ProfileReadinessStatus;
    items: ProfileReadinessItem[];
  };
  schoolList: {
    count: number;
    tierCounts: { reach: number; target: number; safety: number };
    missingRoundCount: number;
    missingDeadlineCount: number;
    balanced: boolean;
  };
  predictionDataSupport: {
    previewCount: number;
    authoritativeCount: number;
    freshAuthoritativeCount: number;
    staleCount: number;
    missingSchoolIds: string[];
    lastRunAt?: string;
  };
  timeline: {
    coverageCount: number;
    missingTimelineCount: number;
    pendingTaskCount: number;
    overdueTaskCount: number;
    due7Count: number;
    due30Count: number;
  };
  essays: {
    count: number;
    linkedPromptCount: number;
  };
  resume: {
    count: number;
    latestUpdatedAt?: string;
    latestQualityScore?: number;
    openIssueCount: number;
    evidenceCount: number;
  };
  recommendationLetters: {
    count: number;
    requested: number;
    inProgress: number;
    submitted: number;
    confirmed: number;
    overdue: number;
  };
  applicationAnalysis: {
    state: ProfileReadinessAnalysisState;
    dataQuality?: string;
    targetSchoolCount: number;
    schoolsWithPredictions: number;
    lastRunAt?: string;
  };
  sources: {
    profileUpdatedAt?: string;
    schoolListUpdatedAt?: string;
    predictionUpdatedAt?: string;
    timelineUpdatedAt?: string;
    resumeUpdatedAt?: string;
    recommendationLettersUpdatedAt?: string;
    applicationAnalysisUpdatedAt?: string;
  };
}

export enum MemoryType {
  FACT = 'FACT',
  PREFERENCE = 'PREFERENCE',
  DECISION = 'DECISION',
  SUMMARY = 'SUMMARY',
  FEEDBACK = 'FEEDBACK',
}
