/**
 * Hall refactor Phase 1 — shared types for the /hall surface.
 * Mirrors the BFF `GET /halls/me/overview` payload + supporting enums.
 *
 * Web + mobile both consume from this barrel via `@study-abroad/shared`.
 * Backend service `HallOverviewService` returns `HallOverviewPayload`-shaped
 * data — keep these in sync.
 */

/*
 * Hall §7 Decision B: the peer-review subsystem was retired. The review-only
 * shared types (`ReviewerLevel`, `ReviewSwipeDirection`, `ReviewMethod`,
 * `ReviewSwipeData`) were removed along with it.
 */

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

export interface HallActivityEntry {
  action: string; // PointAction enum value (string-erased for transport)
  points: number;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO timestamp
}

/**
 * 2026-05 Hall Plan C (C3): de-gamified. The `swipe` (badge/streak) and
 * `dailyChallenge` fields were removed — the path tab no longer surfaces a
 * casino layer. Hall §7 Decision B: the `reviewer` block was removed when
 * the peer-review subsystem was retired. `points` is retained solely for
 * the Points Center balance.
 */
export interface HallOverviewPayload {
  points: HallOverviewPoints;
  recentActivity: HallActivityEntry[];
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

export interface RedemptionHistoryItem {
  id: string;
  type: RedemptionType;
  pointsSpent: number;
  status: RedemptionStatus;
  createdAt: string;
}

/*
 * 2026-05 Hall Plan C (C2b): `ReviewDimensionAggregate` and
 * `AggregatedReviewPayload` were removed. Numeric review scoring was retired
 * from the UI, so serving aggregate dimension means/medians made the API a
 * second competitiveness authority — removed along with the
 * `/halls/reviews/:profileUserId/aggregate` endpoint.
 */

/**
 * Challenge attempt persistence payload (Hall 学长之路 multi-school predictions).
 * Returned by `POST /halls/swipe/challenge` after persisting to
 * `ChallengeAttempt` table.
 *
 * 2026-05 Hall Plan C (C3): de-gamified. `rewardEarned` was removed — the
 * challenge no longer awards points. The attempt is still persisted so the
 * per-school debrief history stays available.
 */
export interface ChallengeAttemptResult {
  attemptId: string;
  correct: number;
  total: number;
  accuracy: number; // 0-100 integer
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
  /**
   * Change in admit RATE across the compared window, in percentage POINTS
   * (e.g. 42% → 30% = -12). Hall Plan C (C4): previously this was a change
   * in raw admit count, which was dominated by how many cases were
   * submitted that year — a sampling artifact, not real selectivity.
   */
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
