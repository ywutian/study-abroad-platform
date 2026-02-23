/**
 * Locale utility functions for i18n support.
 * Pure functions with no framework dependencies.
 */

/** Get display name for a school based on locale */
export function getSchoolDisplayName(
  school: { name: string; nameZh?: string | null },
  locale: string
): string {
  return locale === 'zh' ? school.nameZh || school.name : school.name || school.nameZh || '';
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
