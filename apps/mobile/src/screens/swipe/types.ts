/**
 * Shared types, constants, and helpers for the case study loop.
 */
import { Dimensions } from 'react-native';

import { spacing, withOpacity } from '@/utils/theme';

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

// 2026-05 Hall Plan C (C3): de-gamified. SwipeResult / SwipeStats no longer
// carry points / streak / badge / dailyChallenge fields, and the leaderboard
// types were removed entirely.
export interface SwipeResultDto {
  caseId: string;
  prediction: 'admit' | 'reject' | 'waitlist';
  actualResult: string;
  isCorrect: boolean;
}

export interface SwipeStatsDto {
  totalSwipes: number;
  correctCount: number;
  accuracy: number;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getTierColor(rank?: number): string {
  if (!rank) return '#1d1813';
  if (rank <= 10) return '#6574ff';
  if (rank <= 25) return '#3b82f6';
  if (rank <= 50) return '#6f7b58';
  if (rank <= 100) return '#f59e0b';
  return '#64748b';
}

export function getTierBgColor(rank?: number): string {
  if (!rank) return withOpacity('#1d1813', 0.07);
  if (rank <= 10) return withOpacity('#6574ff', 0.082);
  if (rank <= 25) return withOpacity('#3b82f6', 0.07);
  if (rank <= 50) return withOpacity('#6f7b58', 0.0625);
  if (rank <= 100) return withOpacity('#f59e0b', 0.0625);
  return withOpacity('#64748b', 0.0625);
}
