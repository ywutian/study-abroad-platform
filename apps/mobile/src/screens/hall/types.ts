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

/**
 * Mirrors `VerifiedUserDto` in apps/api (hall/dto/verified-ranking.dto.ts).
 *
 * This type had drifted to an older contract entirely — it declared `userId`,
 * `email`, `nickname`, `avatarUrl`, `gpa`, `sat` and `pointsTotal`, none of
 * which this endpoint has sent for some time, and the response wrapper read
 * `items` where the API returns `users`. The tab therefore rendered its empty
 * state unconditionally, which is why the drift went unnoticed.
 *
 * The identity fields are absent by design, not by omission: this leaderboard
 * is built from ANONYMOUS / VERIFIED_ONLY cases while GET /forum/posts
 * publishes author.id beside profile.realName, so a userId — or an avatar URL,
 * which joins just as well — hands over the key that undoes the masking. Each
 * row is a case; `userName` is a label derived from the case id. Do not add a
 * user-scoped field back to this type without re-reading that endpoint.
 */
export interface VerifiedUserDto {
  rank: number;
  caseId: string;
  userName?: string;
  gpaRange?: string;
  satRange?: string;
  actRange?: string;
  toeflRange?: string;
  schoolName: string;
  schoolNameZh?: string;
  schoolRank?: number;
  result: string;
  year: number;
  round?: string;
  major?: string;
  isVerified: boolean;
  verifiedAt?: string;
}

export interface VerifiedRankingResponse {
  users: VerifiedUserDto[];
  stats?: {
    totalVerified: number;
    totalAdmitted: number;
    topSchoolsCount: number;
    ivyCount: number;
  };
  total: number;
  hasMore: boolean;
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
