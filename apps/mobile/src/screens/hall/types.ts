/**
 * Shared types, constants, and helpers for the Hall of Fame feature.
 */
import { useColors } from '@/utils/theme';

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

export interface HallList {
  id: string;
  title: string;
  description?: string;
  category: string;
  voteCount: number;
  myVote?: 'up' | 'down' | null;
  creator: {
    id: string;
    nickname: string;
    avatarUrl?: string | null;
  };
  itemCount: number;
  createdAt: string;
}

export interface HallListDetail {
  id: string;
  title: string;
  description?: string;
  category: string;
  voteCount: number;
  myVote?: 'up' | 'down' | null;
  creator: {
    id: string;
    nickname: string;
    avatarUrl?: string | null;
  };
  items: { rank: number; name: string; value?: string }[];
}

export interface CreateListDto {
  title: string;
  description?: string;
  category: string;
  items: { name: string; value?: string }[];
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

export type TabKey = 'reviews' | 'ranking' | 'lists' | 'verified';
export type RankingFilter = 'all' | 'admitted' | 'top20' | 'ivy';

export type Colors = ReturnType<typeof useColors>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCORE_LABELS = ['academic', 'test', 'activity', 'award', 'overall'] as const;

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

export const LIST_CATEGORIES = ['tier', 'major', 'location', 'value', 'other'] as const;

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
