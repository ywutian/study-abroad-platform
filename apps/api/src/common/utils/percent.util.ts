/**
 * Normalize a rate value to the 0–100 percentage convention used throughout the system.
 *
 * Handles three input scenarios:
 *   - Decimal 0–1 (e.g. 0.247 from College Scorecard) → 24.7
 *   - Already percentage 1–100 (e.g. 24.7) → 24.7
 *   - Double-conversion artifact 100–10000 (e.g. 2470) → 24.7
 *
 * @returns number in 0–100 range, or null if invalid
 */
export function normalizePercentRate(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) return null;
  if (n > 10000) return null;
  if (n > 100) return Math.round(n) / 100; // double-conversion fix
  if (n > 1) return Math.round(n * 10) / 10; // already percentage
  return Math.round(n * 1000) / 10; // decimal 0–1 → percentage
}

/**
 * Normalize a stored rate (e.g. acceptanceRate, graduationRate) to 0–100 for API responses.
 *
 * Use this at read-time when returning DB values in API responses.
 * Delegates to {@link normalizePercentRate} for the actual conversion,
 * returning `undefined` instead of `null` for optional-chaining ergonomics.
 */
export function clampPercentRate(value: unknown): number | undefined {
  return normalizePercentRate(value) ?? undefined;
}
