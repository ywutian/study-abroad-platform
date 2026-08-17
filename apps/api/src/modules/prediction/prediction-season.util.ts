import { resolveApplicationYear } from '@study-abroad/shared';

/**
 * Season identity for PredictionResult writes and current-season reads.
 *
 * Must stay aligned with ApplicationTimeline.applicationYear (Fall entry year,
 * August rollover). Null-year legacy rows are never inferred from createdAt
 * (#568) — callers that need a current row look up this season only.
 */
export function currentPredictionSeason(now: Date = new Date()): number {
  return resolveApplicationYear(now);
}

export function currentSeasonPredictionWhere(
  profileId: string,
  schoolId: string,
  now?: Date,
) {
  return {
    profileId,
    schoolId,
    applicationYear: currentPredictionSeason(now),
  };
}

export function currentSeasonPredictionUniqueWhere(
  profileId: string,
  schoolId: string,
  now?: Date,
) {
  return {
    profileId_schoolId_applicationYear: currentSeasonPredictionWhere(
      profileId,
      schoolId,
      now,
    ),
  };
}
