'use client';

/**
 * Shared types + config for the RankingTab sub-components.
 */

import { Shield, TrendingUp, AlertTriangle } from 'lucide-react';

export type SortMode = 'percentile' | 'score' | 'applicants';

export type CompetitivePosition = 'strong' | 'moderate' | 'challenging';

/**
 * Competitive-position visual config. Every hardcoded Tailwind color carries a
 * `dark:` variant per .claude/rules/frontend.md.
 */
export const POSITION_CONFIG: Record<
  CompetitivePosition,
  { icon: typeof Shield; className: string }
> = {
  strong: {
    icon: Shield,
    className:
      'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  moderate: {
    icon: TrendingUp,
    className:
      'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  challenging: {
    icon: AlertTriangle,
    className:
      'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  },
};
