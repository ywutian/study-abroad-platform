/**
 * Shared types, constants, and helpers for the Hall (校友广场) feature.
 *
 * Stage 4 — payload-shaped types (HallOverviewPayload, ChinaAdmitTrendEntry,
 * DifficultySignalEntry, ReviewSwipeData, …) are imported from
 * `@study-abroad/shared` and re-exported here so screen code has a single
 * import surface. Mobile-only view types stay local.
 */
import { useColors } from '@/utils/theme';

export type {
  HallOverviewPayload,
  HallOverviewPoints,
  HallOverviewReviewer,
  HallActivityEntry,
  ReviewerLevel,
  ChinaAdmitTrendEntry,
  ChinaAdmitTrendResponse,
  DifficultySignal,
  DifficultySignalEntry,
  DataReliability,
} from '@study-abroad/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewUser {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
}

/**
 * A peer review record.
 *
 * Plan C / C2: numeric 1-10 scoring was removed — peer review is qualitative.
 * Score fields are kept optional for backward compatibility with rows created
 * before the migration; new reviews carry written feedback only and the
 * reviewee never sees a numeric average.
 */
export interface Review {
  id: string;
  profileUser: ReviewUser;
  reviewer: ReviewUser;
  comment?: string;
  academicComment?: string;
  testComment?: string;
  activityComment?: string;
  awardComment?: string;
  tags?: string[];
  helpfulCount: number;
  insightfulCount: number;
  myReaction?: 'helpful' | 'insightful' | null;
  createdAt: string;
}

export interface ReviewsResponse {
  items: Review[];
  total: number;
}

/**
 * Payload for `POST /halls/reviews`.
 *
 * Plan C / C2: numeric score fields removed — the form submits per-dimension
 * and overall written feedback plus optional quick tags.
 */
export interface CreateReviewDto {
  profileUserId: string;
  comment?: string;
  academicComment?: string;
  testComment?: string;
  activityComment?: string;
  awardComment?: string;
  tags?: string[];
  quickTags?: string[];
}

/**
 * Desensitized public profile presented in the Tinder-style review deck.
 * Returned by `GET /halls/public-profiles`.
 */
export interface ReviewProfileCard {
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  grade?: string | null;
  targetMajor?: string | null;
  region?: string | null;
  gpaRange?: string | null;
  satRange?: string | null;
  actRange?: string | null;
  toeflRange?: string | null;
  activityCount: number;
  activityCategories?: string[];
  awardCount: number;
  topAwardTier?: string | null;
  curriculumType?: string | null;
}

export interface RankingResult {
  schoolId: string;
  schoolName: string;
  totalApplicants: number;
  yourRank: number;
  yourScore: number;
  percentile: number;
  breakdown: Record<string, number>;
  // 2026-05 Hall Plan C (C1): `competitivePosition` removed — the
  // strong/moderate/challenging tier collided with prediction's
  // reach/match/safety. Ranking shows a relative percentile only.
}

export interface VerifiedUserDto {
  rank: number;
  userId: string;
  email: string;
  nickname: string;
  avatarUrl?: string | null;
  school: string;
  schoolNameZh?: string;
  major?: string;
  year?: number;
  result: string;
  gpa?: number;
  sat?: number;
  act?: number;
  pointsTotal: number;
}

export interface VerifiedRankingResponse {
  items: VerifiedUserDto[];
  total: number;
  stats?: {
    totalVerified: number;
    avgGpa: number;
    admittedCount: number;
  };
}

/** 4-tab IA (Stage 4): verified default / ranking / review / path. */
export type TabKey = 'verified' | 'ranking' | 'review' | 'path';
export type RankingFilter = 'all' | 'admitted' | 'top20' | 'ivy';

/** The four qualitative feedback dimensions, in form order. */
export type ReviewStep = 'academic' | 'test' | 'activity' | 'award';

export type Colors = ReturnType<typeof useColors>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REVIEW_STEPS: ReviewStep[] = ['academic', 'test', 'activity', 'award'];

/** Optional strength/quality quick tags (i18n key suffix = the raw value). */
export const REVIEW_TAGS = [
  'well-rounded',
  'strong-stem',
  'high-gpa',
  'leadership',
  'creative',
  'community-impact',
  'research-oriented',
  'athletic',
] as const;

/** Minimum length the overall written feedback must reach before submit. */
export const MIN_FEEDBACK_LENGTH = 20;

export const PERCENTILE_COLORS = {
  top10: '#6f7b58',
  top25: '#3b82f6',
  top50: '#f59e0b',
  bottom: '#ef4444',
};

export const RANKING_FILTERS: RankingFilter[] = ['all', 'admitted', 'top20', 'ivy'];

export const RESULT_BADGE_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'secondary'> = {
  ADMITTED: 'success',
  REJECTED: 'error',
  WAITLISTED: 'warning',
  DEFERRED: 'secondary',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getPercentileColor(percentile: number): string {
  if (percentile >= 90) return PERCENTILE_COLORS.top10;
  if (percentile >= 75) return PERCENTILE_COLORS.top25;
  if (percentile >= 50) return PERCENTILE_COLORS.top50;
  return PERCENTILE_COLORS.bottom;
}
