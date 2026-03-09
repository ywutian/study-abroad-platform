/**
 * Format an acceptance rate for display.
 *
 * The API returns values in the 0–100 convention (e.g. 4.0 means 4%).
 * Legacy code paths may still return 0–1 decimals, so this detects and handles both.
 *
 * @param rate - acceptance rate (0-100 or 0-1)
 * @returns formatted string like "4.0%" or "-" if unavailable
 */
export function formatAcceptanceRate(rate?: number | null): string {
  if (rate == null || rate <= 0) return '-';
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct.toFixed(1)}%`;
}
