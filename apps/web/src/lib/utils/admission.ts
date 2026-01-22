/**
 * Admission-related utility functions and constants
 * Shared across essay gallery, case cards, and case detail pages
 */

// ─── Result Types ───────────────────────────────────────────────────────────

export type AdmissionResultType = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';

export interface ResultStyleConfig {
  bg: string;
  text: string;
  border: string;
  barColor: string;
  dotColor: string;
}

export const RESULT_STYLES: Record<AdmissionResultType, ResultStyleConfig> = {
  ADMITTED: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    barColor: 'bg-emerald-500',
    dotColor: 'bg-emerald-500',
  },
  REJECTED: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20',
    barColor: 'bg-rose-500',
    dotColor: 'bg-rose-500',
  },
  WAITLISTED: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    barColor: 'bg-amber-500',
    dotColor: 'bg-amber-500',
  },
  DEFERRED: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20',
    barColor: 'bg-blue-500',
    dotColor: 'bg-blue-500',
  },
};

/**
 * Get the color bar class for a result type (used for top borders on cards)
 */
export function getResultBarColor(result: string): string {
  return RESULT_STYLES[result as AdmissionResultType]?.barColor || 'bg-muted';
}

/**
 * Get the badge class string for a result type
 */
export function getResultBadgeClass(result: string): string {
  const style = RESULT_STYLES[result as AdmissionResultType];
  if (!style) return 'bg-muted text-muted-foreground border-border';
  return `${style.bg} ${style.text} ${style.border}`;
}

// ─── Essay Type Styles ──────────────────────────────────────────────────────

export type EssayTypeKey = 'COMMON_APP' | 'UC' | 'SUPPLEMENTAL' | 'WHY_SCHOOL' | 'OTHER';

export const ESSAY_TYPE_STYLES: Record<EssayTypeKey, string> = {
  COMMON_APP: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  UC: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  SUPPLEMENTAL: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  WHY_SCHOOL: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  OTHER: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

/**
 * Get the badge class for an essay type
 */
export function getEssayTypeBadgeClass(type?: string): string {
  if (!type) return '';
  return ESSAY_TYPE_STYLES[type as EssayTypeKey] || ESSAY_TYPE_STYLES.OTHER;
}

// ─── Verified Badge Styles ──────────────────────────────────────────────────

/** Verified badge uses sky color to differentiate from admitted (emerald) */
export const VERIFIED_BADGE_CLASS =
  'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';

// ─── Translation Helpers ────────────────────────────────────────────────────

const RESULT_KEY_MAP: Record<string, string> = {
  ADMITTED: 'admitted',
  REJECTED: 'rejected',
  WAITLISTED: 'waitlisted',
  DEFERRED: 'deferred',
};

/**
 * Get the translated label for an admission result
 * @param result - The result enum value (e.g. 'ADMITTED')
 * @param t - Translation function scoped to 'cases' namespace
 */
export function getResultLabel(result: string, t: (key: string) => string): string {
  const key = RESULT_KEY_MAP[result];
  return key ? t(`result.${key}`) : result;
}

const ESSAY_TYPE_KEY_MAP: Record<string, string> = {
  COMMON_APP: 'commonApp',
  UC: 'uc',
  SUPPLEMENTAL: 'supplemental',
  WHY_SCHOOL: 'whySchool',
  OTHER: 'other',
};

/**
 * Get the translated label for an essay type
 * @param type - The essay type enum value (e.g. 'COMMON_APP')
 * @param t - Translation function scoped to 'essayGallery' namespace
 */
export function getEssayTypeLabel(type: string | undefined, t: (key: string) => string): string {
  if (!type) return '';
  const key = ESSAY_TYPE_KEY_MAP[type];
  return key ? t(`essayTypes.${key}`) : type;
}
