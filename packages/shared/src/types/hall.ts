/**
 * Hall refactor Phase 1 — shared types for the /hall surface.
 * Mirrors the BFF `GET /halls/me/overview` payload + supporting enums.
 *
 * Web + mobile both consume from this barrel via `@study-abroad/shared`.
 * Backend service `HallOverviewService` returns `HallOverviewPayload`-shaped
 * data — keep these in sync.
 */

export type SwipeBadgeTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond';

/**
 * Hall reviewer permission tier (mirrors Prisma ReviewerLevel enum).
 * - L1: any registered user — vote-only on existing reviews
 * - L2: completed own profile ≥80% + passed 3-question qualification quiz
 * - L3: VERIFIED user (admitted to Top 50) — vote weight ×3
 */
export type ReviewerLevel = 'L1' | 'L2' | 'L3';

/**
 * Tinder-style swipe direction for review steps.
 * `up` = unsure (excluded from aggregation to avoid bias).
 */
export type ReviewSwipeDirection = 'left' | 'right' | 'up';

/**
 * Review interaction mode (mirrors Prisma ReviewMethod enum).
 * - CLASSIC: legacy 4-dim slider review (kept for backward compat)
 * - SWIPE: new Tinder-style swipe review
 */
export type ReviewMethod = 'CLASSIC' | 'SWIPE';

/**
 * China Admit Dashboard verification tier (mirrors Prisma VerificationLevel).
 * - L1: self-reported (NOT counted in dashboard stats)
 * - L2: platform-verified (admit letter + email check + admin review)
 * - L3: expert-curated (signed off by former admission officer)
 */
export type VerificationLevel = 'L1' | 'L2' | 'L3';

export interface HallOverviewPoints {
  balance: number;
  todayEarned: number;
}

export interface HallOverviewSwipe {
  badge: SwipeBadgeTier | string;
  totalSwipes: number;
  correctCount: number;
  accuracy: number; // 0-100 integer
  currentStreak: number;
  bestStreak: number;
}

export interface HallOverviewDailyChallenge {
  count: number;
  target: number; // default 10
  completed: boolean;
}

export interface HallOverviewReviewer {
  level: ReviewerLevel;
  credit: number; // 0-100, starts at 100, drops on confirmed reports
  acceptPeerReview: boolean;
  hallAvgRating: number | null;
  hallReviewCount: number;
}

export interface HallActivityEntry {
  action: string; // PointAction enum value (string-erased for transport)
  points: number;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO timestamp
}

export interface HallOverviewPayload {
  points: HallOverviewPoints;
  swipe: HallOverviewSwipe;
  dailyChallenge: HallOverviewDailyChallenge;
  reviewer: HallOverviewReviewer;
  recentActivity: HallActivityEntry[];
}

/**
 * Swipe-mode review metadata captured on the client and persisted to
 * `Review.swipeData` as JSONB.
 */
export interface ReviewSwipeData {
  directionsPerStep: {
    academic?: ReviewSwipeDirection;
    test?: ReviewSwipeDirection;
    activity?: ReviewSwipeDirection;
    award?: ReviewSwipeDirection;
  };
  // Optional client-side context for debugging / future analytics
  totalSteps?: number;
  durationMs?: number;
}

/**
 * Stage 7 — Desensitized profile snapshot consumed by hall surfaces.
 * Hall services MUST read `User.hallPublicProfile` (this shape) instead of
 * the raw `Profile` table to keep PII (real name, school name) out.
 */
export interface HallPublicProfileSnapshot {
  gpaRange: string | null;
  satRange: string | null;
  actRange: string | null;
  toeflRange: string | null;
  grade: string | null;
  targetMajor: string | null;
  region: string | null;
  activityCount: number;
  activityCategories: string[];
  awardCount: number;
  topAwardTier: string | null;
  applicationSeason: string | null;
  curriculumType: string | null;
  snapshotAt: string;
}

/**
 * Stage 7 — Cross-module points redemption (vault consults, memberships,
 * content unlocks).
 */
export type RedemptionType =
  | 'CONSULT_15MIN'
  | 'MEMBERSHIP_MONTHLY'
  | 'CASE_PREMIUM_UNLOCK'
  | 'EXPERT_LIST_UNLOCK'
  | 'PREDICTION_DEEP_DIVE';

export type RedemptionStatus = 'PENDING' | 'FULFILLED' | 'CANCELLED';

export interface RedemptionCatalogItem {
  type: RedemptionType;
  cost: number;
  description: string;
}

export interface RedemptionResult {
  redemptionId: string;
  type: RedemptionType;
  pointsSpent: number;
  newBalance: number;
  status: RedemptionStatus;
}

/**
 * Stage 2 — Aggregated review payload for "I received reviews" UI.
 */
export interface ReviewDimensionAggregate {
  dimension: 'academic' | 'test' | 'activity' | 'award' | 'overall';
  mean: number;
  weightedMean: number;
  trimmedMean: number;
  median: number;
  sampleSize: number;
}

export interface AggregatedReviewPayload {
  reviewCount: number;
  inProgress: boolean;
  progressTarget: number;
  acceptingReviews: boolean;
  dimensions: {
    academic: ReviewDimensionAggregate;
    test: ReviewDimensionAggregate;
    activity: ReviewDimensionAggregate;
    award: ReviewDimensionAggregate;
    overall: ReviewDimensionAggregate;
  };
  distribution: Record<string, number[]>;
  topTags: Array<{ tag: string; count: number }>;
  methodBreakdown: Record<ReviewMethod, number>;
}

/**
 * Challenge attempt persistence payload (Hall 学长之路 multi-school predictions).
 * Returned by `POST /halls/swipe/challenge` after persisting to
 * `ChallengeAttempt` table.
 */
export interface ChallengeAttemptResult {
  attemptId: string;
  correct: number;
  total: number;
  accuracy: number; // 0-100 integer
  rewardEarned: number; // 0 if daily limit already hit
  results: Array<{
    caseId: string;
    schoolName?: string;
    guess: string;
    actual: string;
    isCorrect: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Hall refactor Stage 3 — Verified China Admit Dashboard
// ---------------------------------------------------------------------------

/**
 * Data reliability rating shown on every China Admit Card.
 *  A — verified case >= 5 (high confidence)
 *  B — verified case >= 3 (medium)
 *  C — verified case 1-2 (low, advisory only)
 *  D — no verified case (number hidden, fallback copy shown)
 */
export type DataReliability = 'A' | 'B' | 'C' | 'D';

/** Year-over-year admission difficulty signal for a school. */
export type DifficultySignal = 'stable' | 'declining' | 'surging';

/**
 * Provenance of the admit-rate figure shown on a card.
 *
 * - `PLATFORM_VERIFIED`: aggregated from `AdmissionCase` rows with
 *   `verificationLevel ≥ L2` and `reviewStatus = APPROVED`. The
 *   high-trust path; only shown when sample size ≥ 1.
 * - `OFFICIAL_CDS`: pulled from `School.acceptanceRate` (and optionally
 *   `SchoolCdsAdmitBand` aggregates) — the school's own Common Data Set
 *   release. Used as a fallback when verified China-specific cases are
 *   too sparse. **School-wide, not Chinese-mainland-specific.** The UI
 *   must label this clearly so users don't confuse it for the granular
 *   verified figure.
 *
 * Future Open Doors / IIE enrollment data would add another value here.
 */
export type ChinaAdmitDataSource = 'PLATFORM_VERIFIED' | 'OFFICIAL_CDS';

/**
 * School-wide acceptance fallback shown when verified-China sample size
 * is below the reliability threshold. The UI MUST render this with a
 * visible "Official CDS / 全美录取率" badge so users know it's not the
 * granular Chinese-mainland figure.
 */
export interface ChinaAdmitCdsFallback {
  /** School-wide admit rate, 0..1 fraction (e.g. 0.034 = 3.4%). */
  acceptanceRate: number | null;
  /** Cycle year of the CDS number (typically last completed cycle). */
  cycleYear: number | null;
  /** Always 'OFFICIAL_CDS' for now; reserved for future Open Doors etc. */
  dataSource: ChinaAdmitDataSource;
  /** Optional source URL (school CDS page, USNews) for click-through. */
  sourceUrl?: string;
}

/** One school's China-mainland admit count over recent years. */
export interface ChinaAdmitTrendEntry {
  schoolId: string;
  schoolName: string;
  schoolNameZh?: string;
  schoolRank?: number;
  /** Per-year admitted count, ascending by year. */
  yearly: Array<{ year: number; admitted: number; total: number }>;
  reliability: DataReliability;
  /** Total verified ADMITTED cases backing this card. */
  sampleSize: number;
  /**
   * School-wide CDS fallback. Null when neither
   * `School.acceptanceRate` nor any `SchoolCdsAdmitBand` row exists for
   * this school. When non-null, the UI surfaces it under a visible
   * "Official CDS" badge so it can't be mistaken for the granular
   * Chinese-mainland figure.
   */
  cdsFallback?: ChinaAdmitCdsFallback | null;
}

export interface ChinaAdmitTrendResponse {
  schools: ChinaAdmitTrendEntry[];
  lastUpdated: string; // ISO date
}

/** Difficulty signal entry for a single school. */
export interface DifficultySignalEntry {
  schoolId: string;
  schoolName: string;
  schoolNameZh?: string;
  signal: DifficultySignal;
  /** Percentage change in admit count across the compared window. */
  changePct: number;
  sampleSize: number;
}

/** ED vs RD admission comparison for a single school in one cycle. */
export interface EdRdComparisonEntry {
  schoolId: string;
  schoolName: string;
  schoolNameZh?: string;
  edAdmitted: number;
  rdAdmitted: number;
  /** ED share of total admits, 0-100 integer. null when no admits. */
  edSharePct: number | null;
  /** Qualitative ED tilt label derived from edSharePct. */
  edTilt: 'ed_favored' | 'balanced' | 'rd_favored' | 'insufficient';
  sampleSize: number;
}

export interface EdRdComparisonResponse {
  year: number;
  schools: EdRdComparisonEntry[];
}
