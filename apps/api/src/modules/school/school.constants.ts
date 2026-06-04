/**
 * Schools LIST view projection (`GET /schools?view=list`).
 *
 * The full `/schools` response carries ~103 fields per school (~18 KB each),
 * dominated by `fieldSources` (~8 KB provenance map) and `metadata` (~6 KB raw
 * source data) that list cards never render. Mobile list cards only need the
 * fields below, so the list view drops the rest and cuts the payload ~5x
 * (≈383 KB → ≈70 KB for 20 schools).
 *
 * This is additive: callers that omit `view` (e.g. the web detail/provenance
 * surfaces that DO use `fieldSources`) keep the full response unchanged.
 */
export const SCHOOL_LIST_ITEM_KEYS = [
  'id',
  'name',
  'nameZh',
  'city',
  'state',
  'country',
  'website',
  'acceptanceRate',
  'transferAcceptanceRate',
  'usNewsRank',
  'logoUrl',
  'testingPolicy',
  'testOptional',
  'tuition',
  'media',
  'rankings',
  'communityRatingSummary',
] as const;

/** Pick only the list-card fields from an enriched school object. */
export function toSchoolListItem<T extends Record<string, unknown>>(
  school: T,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of SCHOOL_LIST_ITEM_KEYS) {
    if (key in school) {
      out[key as keyof T] = school[key as keyof T];
    }
  }
  return out;
}
