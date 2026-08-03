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
export function contentAsRecord(content: unknown): Prisma.JsonObject {
  return content && typeof content === 'object' && !Array.isArray(content)
    ? content
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

/**
 * `Array.isArray(x)` on an `unknown` narrows to `any[]`, not `unknown[]` — so a
 * single guard silently reopens every element access downstream. This keeps the
 * elements unknown; pair it with contentAsRecord to read fields off them.
 */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

/** Narrow a JsonValue field to a number, for values that get written back into
 *  another Json column — `unknown` is not assignable to Prisma's input type. */
export function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

/** Same, for strings. */
export function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Narrow a JsonValue to a member of a Prisma enum, or undefined. Restoring a
 * snapshot writes stored JSON back into enum columns; without this, a value
 * from an older schema reaches Postgres and fails there instead of here.
 */
export function enumOrUndefined<T extends Record<string, string>>(
  value: unknown,
  enumObject: T,
): T[keyof T] | undefined {
  return typeof value === 'string' && Object.values(enumObject).includes(value)
    ? (value as T[keyof T])
    : undefined;
}

/**
 * Prisma's InputJsonValue has no `undefined`, but an object built from optional
 * fields does. JSON.stringify drops those keys — exactly what Postgres would
 * store — so round-trip the value instead of asserting the mismatch away.
 */
export function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
