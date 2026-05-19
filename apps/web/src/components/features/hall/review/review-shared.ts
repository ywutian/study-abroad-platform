'use client';

/**
 * Shared types + constants for the Hall qualitative peer-feedback experience.
 *
 * Plan C / batch C2: numeric 1-10 scoring was removed. Untrained peers grading
 * each other on 5 dimensions produced an unreliable competitiveness verdict, so
 * the review is now qualitative-only — a short written note per dimension plus
 * an overall written reflection. No scores are collected or submitted.
 */

import { GraduationCap, BarChart, BookOpen, Trophy } from 'lucide-react';

/** The four feedback dimensions, in form order. */
export const REVIEW_DIMENSIONS = [
  { key: 'academic', icon: GraduationCap, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'test', icon: BarChart, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { key: 'activity', icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { key: 'award', icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-500/10' },
] as const;

export type DimensionKey = (typeof REVIEW_DIMENSIONS)[number]['key'];

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

/** Per-dimension + overall written feedback. */
export interface ReviewComments {
  academic: string;
  test: string;
  activity: string;
  award: string;
  general: string;
}

export const DEFAULT_COMMENTS: ReviewComments = {
  academic: '',
  test: '',
  activity: '',
  award: '',
  general: '',
};

/** Minimum length the overall written feedback must reach before submit. */
export const MIN_RATIONALE_LENGTH = 20;
