/**
 * Shared types, constants, and helpers for the Swipe Prediction Game.
 */
import { Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing } from '@/utils/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwipeCaseDto {
  id: string;
  schoolName: string;
  schoolNameZh?: string;
  year: number;
  round?: string;
  major?: string;
  gpaRange?: string;
  satRange?: string;
  actRange?: string;
  toeflRange?: string;
  tags?: string[];
  isVerified: boolean;
  usNewsRank?: number;
  acceptanceRate?: number;
  activityCount?: number;
  activityHighlights?: string[];
  awardCount?: number;
  highestAwardLevel?: string;
  apCount?: number;
}

export interface SwipeBatchMetaDto {
  totalAvailable: number;
  totalSwiped: number;
  hasMore: boolean;
}

export interface SwipeBatchResultDto {
  cases: SwipeCaseDto[];
  meta: SwipeBatchMetaDto;
}

export interface SwipeResultDto {
  caseId: string;
  prediction: 'admit' | 'reject' | 'waitlist';
  actualResult: string;
  isCorrect: boolean;
  currentStreak: number;
  pointsEarned: number;
  badgeUpgraded: boolean;
  currentBadge: string;
}

export interface SwipeStatsDto {
  totalSwipes: number;
  correctCount: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  badge: string;
  toNextBadge: number;
  dailyChallengeCount: number;
  dailyChallengeTarget: number;
}

export interface LeaderboardEntryDto {
  rank: number;
  userId: string;
  userName?: string;
  accuracy: number;
  totalSwipes: number;
  correctCount?: number;
  badge: string;
  isCurrentUser?: boolean;
}

export interface LeaderboardDto {
  entries: LeaderboardEntryDto[];
  currentUserEntry?: LeaderboardEntryDto;
}

export type PredictionType = 'admit' | 'reject' | 'waitlist';
export type ViewMode = 'game' | 'stats';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
export const SWIPE_DOWN_THRESHOLD = SCREEN_HEIGHT * 0.15;
export const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
export const CARD_HEIGHT = SCREEN_HEIGHT * 0.52;
export const BATCH_SIZE = 5;
export const RELOAD_THRESHOLD = 2;

export const BADGE_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
};

export const BADGE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  bronze: 'shield-outline',
  silver: 'shield-half-outline',
  gold: 'shield',
  platinum: 'diamond-outline',
  diamond: 'diamond',
};

export const BADGE_THRESHOLDS: Record<string, number> = {
  bronze: 0,
  silver: 100,
  gold: 500,
  platinum: 2000,
  diamond: 5000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getTierColor(rank?: number): string {
  if (!rank) return '#6366f1';
  if (rank <= 10) return '#8b5cf6';
  if (rank <= 25) return '#3b82f6';
  if (rank <= 50) return '#10b981';
  if (rank <= 100) return '#f59e0b';
  return '#64748b';
}

export function getTierBgColor(rank?: number): string {
  if (!rank) return '#6366f1' + '12';
  if (rank <= 10) return '#8b5cf6' + '15';
  if (rank <= 25) return '#3b82f6' + '12';
  if (rank <= 50) return '#10b981' + '10';
  if (rank <= 100) return '#f59e0b' + '10';
  return '#64748b' + '10';
}

export function getNextBadge(badge: string): string {
  const normalized = normalizeBadge(badge);
  const order = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const idx = order.indexOf(normalized);
  if (idx < order.length - 1) return order[idx + 1];
  return normalized;
}

export function normalizeBadge(badge?: string | null): string {
  if (!badge) return 'bronze';
  return badge.toLowerCase();
}
