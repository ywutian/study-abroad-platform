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
