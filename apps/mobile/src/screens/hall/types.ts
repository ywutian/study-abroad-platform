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
  HallOverviewSwipe,
  HallOverviewDailyChallenge,
  HallOverviewReviewer,
  HallActivityEntry,
  SwipeBadgeTier,
  ReviewerLevel,
  ReviewSwipeDirection,
  ReviewSwipeData,
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

export interface Review {
  id: string;
  profileUser: ReviewUser;
  reviewer: ReviewUser;
  academicScore: number;
  testScore: number;
  activityScore: number;
  awardScore: number;
  overallScore: number;
  comment?: string;
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

export interface CreateReviewDto {
  profileUserId: string;
  academicScore: number;
  testScore: number;
  activityScore: number;
  awardScore: number;
  overallScore: number;
  comment?: string;
  tags?: string[];
  method?: 'CLASSIC' | 'SWIPE';
  swipeData?: import('@study-abroad/shared').ReviewSwipeData;
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
  competitivePosition: string;
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

/** Tinder-style review swipe step dimensions (overall is derived). */
export type ReviewStep = 'academic' | 'test' | 'activity' | 'award';

export type Colors = ReturnType<typeof useColors>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCORE_LABELS = ['academic', 'test', 'activity', 'award', 'overall'] as const;

export const REVIEW_STEPS: ReviewStep[] = ['academic', 'test', 'activity', 'award'];

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

/**
 * Swipe direction → 1-10 score mapping for the Tinder review deck.
 *  right = strong (9) · left = weak (3) · up = unsure (excluded from average).
 */
export const SWIPE_SCORE: Record<'left' | 'right' | 'up', number> = {
  left: 3,
  right: 9,
  up: 5,
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

export function averageScore(r: Review): number {
  return (
    Math.round(
      ((r.academicScore + r.testScore + r.activityScore + r.awardScore + r.overallScore) / 5) * 10
    ) / 10
  );
}

export function getScoreColor(score: number): string {
  if (score >= 8) return '#6f7b58';
  if (score >= 6) return '#3b82f6';
  if (score >= 4) return '#f59e0b';
  return '#ef4444';
}
