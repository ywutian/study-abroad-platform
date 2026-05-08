import {
  Rocket,
  Target,
  Shield,
  BarChart3,
  Brain,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from 'lucide-react';
import type { TierType, ConfidenceLevel } from './types';

// ── Tier Styles (aligned with SchoolRecommendation CATEGORY_STYLES) ──────────

export const TIER_CONFIG = {
  reach: {
    icon: Rocket,
    bar: 'bg-destructive',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200',
    barColor: 'bg-rose-500',
  },
  match: {
    icon: Target,
    bar: 'bg-primary',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200',
    barColor: 'bg-blue-500',
  },
  safety: {
    icon: Shield,
    bar: 'bg-success',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200',
    barColor: 'bg-emerald-500',
  },
  unavailable: {
    icon: AlertTriangle,
    bar: 'bg-muted',
    bg: 'bg-muted/40',
    border: 'border-border',
    text: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground border-border',
    barColor: 'bg-muted-foreground',
  },
} as const;

// ── Engine Styles ────────────────────────────────────────────────────────────

export const ENGINE_CONFIG = {
  stats: {
    icon: BarChart3,
    color: 'blue' as const,
    barColor: 'bg-blue-500',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  ai: {
    icon: Brain,
    color: 'purple' as const,
    barColor: 'bg-violet-500',
    textColor: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
  },
  historical: {
    icon: BookOpen,
    color: 'amber' as const,
    barColor: 'bg-amber-500',
    textColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
} as const;

// ── Factor Impact Styles (aligned with ProfileAIAnalysis STATUS_STYLES) ─────

export const IMPACT_CONFIG = {
  positive: {
    icon: TrendingUp,
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  negative: {
    icon: TrendingDown,
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  neutral: {
    icon: Minus,
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
} as const;

// ── Confidence Styles ────────────────────────────────────────────────────────

export const CONFIDENCE_CONFIG = {
  high: {
    border: 'border-emerald-300 dark:border-emerald-700',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  medium: {
    border: 'border-sky-300 dark:border-sky-700',
    text: 'text-sky-600 dark:text-sky-400',
  },
  low: {
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-400',
  },
} as const;

// ── Utility ──────────────────────────────────────────────────────────────────

export function getTierConfig(tier: TierType) {
  return TIER_CONFIG[tier];
}

export function getConfidenceConfig(confidence: ConfidenceLevel) {
  return CONFIDENCE_CONFIG[confidence];
}

import { getProbabilityColorClass } from '@/lib/utils';

/** @deprecated Use getProbabilityColorClass from @/lib/utils instead */
export function getProbabilityColor(prob: number): string {
  return getProbabilityColorClass(prob, '0-1');
}
