import { Prisma } from '@prisma/client';

/**
 * Section `content` is a Json column, so Prisma types it as JsonValue. The
 * shape list-style sections use — `{ items: [...] }`, see DEFAULT_SECTIONS —
 * is a convention, not a schema guarantee, so read it through this rather
 * than asserting the object into existence.
 *
 * Returns JsonObject rather than Record<string, unknown> so a narrowed value
 * can flow straight back into a Prisma write without a cast on the way out.
 *
 * NOTE: identical bodies already exist as `toRecord` (school-provenance) and
 * `asRecord` (application-analysis-workflow), 47 call sites between them.
 * Worth collapsing into one common util — not from here, since that changes
 * the return type under both and needs their suites.
 */
export function contentAsRecord(
  content: Prisma.InputJsonValue | Prisma.JsonValue | null | undefined,
): Prisma.JsonObject {
  return content && typeof content === 'object' && !Array.isArray(content)
    ? (content as Prisma.JsonObject)
    : {};
}

/**
 * Format a Prisma DateTime as `YYYY-MM`, tolerating the ISO string that comes
 * back instead of a Date when the profile was served from the Redis cache.
 *
 * This is not defensive padding: `profileService.findByUserId` caches through
 * JSON, so within the 5-minute TTL every date on it IS a string, and the
 * previous `date?.toISOString()` threw for every profile import after the
 * first. See the cache round-trip test in resume.service.spec.ts.
 */
export function toMonth(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 7);
}
