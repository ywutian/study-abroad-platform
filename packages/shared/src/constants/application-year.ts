/**
 * Which application season a moment in time belongs to.
 *
 * A US application season is named for the ENTRY year, not the year you apply:
 * someone applying in October 2026 is applying for Fall 2027. August is the
 * rollover — Common App opens on the 1st — so from August onward "this season"
 * means next calendar year.
 *
 * Extracted because this one-liner had three independent copies
 * (`profile-readiness.service.ts`, `ai-agent/tools/timeline-tools.service.ts`,
 * `school-list.service.ts`) and a fourth was about to be written for
 * `PredictionResult.applicationYear`. Three copies of a date rule is three
 * chances for one of them to drift across the August boundary and disagree
 * with the other two for five months a year.
 */
export function resolveApplicationYear(now: Date = new Date()): number {
  // getMonth() is 0-indexed: 7 = August.
  return now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
}
