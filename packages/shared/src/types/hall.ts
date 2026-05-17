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
