import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 根据当前 locale 返回学校的主要显示名称
 * - zh: 优先显示中文名，fallback 到英文名
 * - en: 优先显示英文名，fallback 到中文名
 */
export function getSchoolName(
  school: { name?: string; nameZh?: string | null } | null | undefined,
  locale: string
): string {
  if (!school) return '';
  if (locale === 'zh') {
    return school.nameZh || school.name || '';
  }
  return school.name || school.nameZh || '';
}

/**
 * 根据当前 locale 返回学校的次要显示名称
 * - zh locale: 显示英文名作为副标题（中英双显）
 * - en locale: 不显示中文名（仅英文）
 * 如果主次名称相同则返回 undefined
 */
export function getSchoolSubName(
  school: { name?: string; nameZh?: string | null } | null | undefined,
  locale: string
): string | undefined {
  if (!school) return undefined;
  // English locale: only show English name, no Chinese secondary
  if (locale !== 'zh') return undefined;
  const primary = getSchoolName(school, locale);
  const secondary = school.name;
  if (!secondary || secondary === primary) return undefined;
  return secondary;
}

/**
 * Format an acceptance rate (0–100 convention) for display.
 * Handles both number and string inputs; returns '-' for unavailable values.
 *
 * @param rate - acceptance rate in 0–100 (e.g. 4.0 means 4%)
 * @returns formatted string like "4.0%"
 */
export function formatAcceptanceRate(rate: number | string | null | undefined): string {
  if (rate == null) return '-';
  const n = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (Number.isNaN(n) || n <= 0) return '-';
  let pct: number;
  if (n > 100) pct = n / 100;
  else if (n <= 1) pct = n * 100;
  else pct = n;
  pct = Math.min(100, Math.max(0, pct));
  return `${pct.toFixed(1)}%`;
}

/**
 * Format an admission probability for display.
 * Accepts either 0-1 (PredictionResult.probability) or 0-100
 * (RecommendedSchool.estimatedProbability) and returns a rounded integer %.
 */
export function formatProbability(
  value: number | null | undefined,
  scale: '0-1' | '0-100' = '0-1'
): string {
  if (value == null) return '-';
  const pct = scale === '0-1' ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

/**
 * Unified probability color class.
 * Works with both 0-1 and 0-100 scales.
 */
export function getProbabilityColorClass(value: number, scale: '0-1' | '0-100' = '0-1'): string {
  const pct = scale === '0-1' ? value * 100 : value;
  if (pct >= 60) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 30) return 'text-blue-600 dark:text-blue-400';
  return 'text-rose-600 dark:text-rose-400';
}

export type TierType = 'reach' | 'match' | 'safety';

/**
 * Derive tier from a probability value.
 * Uses the same thresholds as the backend calculateTier defaults.
 */
export function getProbabilityTier(value: number, scale: '0-1' | '0-100' = '0-1'): TierType {
  const pct = scale === '0-1' ? value * 100 : value;
  if (pct >= 60) return 'safety';
  if (pct >= 30) return 'match';
  return 'reach';
}
