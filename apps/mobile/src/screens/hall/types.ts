/**
 * Shared types, constants, and helpers for the Hall (校友广场) feature.
 *
 * Stage 4 — payload-shaped types (HallOverviewPayload, ChinaAdmitTrendEntry,
 * DifficultySignalEntry, …) are imported from `@study-abroad/shared` and
 * re-exported here so screen code has a single import surface. Mobile-only
 * view types stay local.
 *
 * Hall §7 Decision B: the review types (HallOverviewReviewer, ReviewerLevel,
 * Review, ReviewsResponse, CreateReviewDto, ReviewProfileCard, ReviewStep,
 * REVIEW_*) were removed when the peer-review subsystem was retired.
 */
import { useColors } from '@/utils/theme';

export type {
  HallOverviewPayload,
  HallOverviewPoints,
  HallActivityEntry,
  ChinaAdmitTrendEntry,
  ChinaAdmitTrendResponse,
  DifficultySignal,
  DifficultySignalEntry,
  DataReliability,
} from '@study-abroad/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

/**
 * 3-tab IA: verified default / ranking / path.
 * Hall §7 Decision B: the `review` tab was removed.
 */
export type TabKey = 'verified' | 'ranking' | 'path';
export type RankingFilter = 'all' | 'admitted' | 'top20' | 'ivy';

export type Colors = ReturnType<typeof useColors>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

/**
 * Maps a percentile to a semantic theme color (resolved via useColors so the
 * tier accent stays correct in dark mode — no hardcoded hex).
 *   top decile  -> success   (>=90)
 *   top quartile-> info      (>=75)
 *   top half    -> warning   (>=50)
 *   below       -> error
 */
export function getPercentileColor(percentile: number, c: Colors): string {
  if (percentile >= 90) return c.success;
  if (percentile >= 75) return c.info;
  if (percentile >= 50) return c.warning;
  return c.error;
}
