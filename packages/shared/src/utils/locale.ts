/**
 * Locale utility functions for i18n support.
 * Pure functions with no framework dependencies.
 */

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../constants';

const BCP47_LOCALE_MAP: Record<SupportedLocale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
};

function normalizeLocaleToken(value: string): SupportedLocale | null {
  const token = value.trim().toLowerCase().replace('_', '-');
  if (!token) return null;
  if ((SUPPORTED_LOCALES as readonly string[]).includes(token)) {
    return token as SupportedLocale;
  }
  if (token.startsWith('zh')) return 'zh';
  if (token.startsWith('en')) return 'en';
  return null;
}

export function isSupportedLocale(locale: unknown): locale is SupportedLocale {
  return typeof locale === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export function normalizeLocale(
  locale: unknown,
  fallback: SupportedLocale = DEFAULT_LOCALE
): SupportedLocale {
  if (Array.isArray(locale)) {
    for (const item of locale) {
      const normalized = normalizeLocale(item, fallback);
      if (normalized !== fallback || normalizeLocaleToken(String(item)) === fallback) {
        return normalized;
      }
    }
    return fallback;
  }

  if (typeof locale !== 'string') return fallback;

  for (const part of locale.split(',')) {
    const token = part.split(';')[0] ?? '';
    const normalized = normalizeLocaleToken(token);
    if (normalized) return normalized;
  }

  return fallback;
}

export function toBcp47(locale: unknown, fallback: SupportedLocale = DEFAULT_LOCALE): string {
  return BCP47_LOCALE_MAP[normalizeLocale(locale, fallback)];
}

/** Get display name for a school based on locale */
export function getSchoolDisplayName(
  school: { name: string; nameZh?: string | null },
  locale: string
): string {
  return normalizeLocale(locale) === 'zh'
    ? school.nameZh || school.name
    : school.name || school.nameZh || '';
}

/**
 * Canonical school name normalization.
 *
 * ALL ingestion paths MUST use this for lookups to ensure consistent
 * deduplication. This matches the DB trigger `trg_school_name_norm`
 * which auto-populates the `nameNorm` column.
 */
export function normalizeSchoolName(name: string): string {
  return name.toLowerCase().trim();
}
