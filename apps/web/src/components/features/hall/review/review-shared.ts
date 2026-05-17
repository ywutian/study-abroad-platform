'use client';

/**
 * Shared types + constants for the Hall review experience (classic + swipe).
 *
 * Both the classic wizard and the Tinder swipe wizard accumulate scores into the
 * same `ReviewScores` / `ReviewComments` shape so the orchestrator can submit
 * through a single `useSubmitReview` call regardless of the chosen mode.
 */

import { GraduationCap, BarChart, BookOpen, Trophy } from 'lucide-react';
import type { ReviewSwipeDirection } from '@/hooks/use-hall-api';

/** The four scored dimensions, in wizard step order. */
export const REVIEW_DIMENSIONS = [
  { key: 'academic', icon: GraduationCap, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'test', icon: BarChart, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { key: 'activity', icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { key: 'award', icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-500/10' },
] as const;

export type DimensionKey = (typeof REVIEW_DIMENSIONS)[number]['key'];

/** Optional strength/weakness quick tags (i18n key suffix = the raw value). */
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

export interface ReviewScores {
  academic: number;
  test: number;
  activity: number;
  award: number;
  overall: number;
}

export interface ReviewComments {
  academic: string;
  test: string;
  activity: string;
  award: string;
  general: string;
}

export const DEFAULT_SCORES: ReviewScores = {
  academic: 5,
  test: 5,
  activity: 5,
  award: 5,
  overall: 5,
};

export const DEFAULT_COMMENTS: ReviewComments = {
  academic: '',
  test: '',
  activity: '',
  award: '',
  general: '',
};

/** Minimum rationale length the backend / UX expects before submit. */
export const MIN_RATIONALE_LENGTH = 5;

/** Weighted overall: academic 0.3 / test 0.2 / activity 0.3 / award 0.2. */
export function computeOverall(s: ReviewScores): number {
  return (
    Math.round((s.academic * 0.3 + s.test * 0.2 + s.activity * 0.3 + s.award * 0.2) * 10) / 10
  );
}

/**
 * Swipe direction → base dimension score (1-10), then nudged by drag confidence.
 *   right = impressive  → high band
 *   up    = unsure      → mid band
 *   left  = not_enough  → low band
 * Confidence (0-100) shifts the score within the band so a hard swipe scores
 * more decisively than a tentative one.
 */
export function swipeToScore(direction: ReviewSwipeDirection, confidence: number): number {
  const c = Math.min(100, Math.max(0, confidence)) / 100;
  if (direction === 'right') return Math.round(7 + c * 3); // 7-10
  if (direction === 'up') return 5; // unsure → neutral midpoint
  return Math.round(4 - c * 3); // left: 1-4
}
