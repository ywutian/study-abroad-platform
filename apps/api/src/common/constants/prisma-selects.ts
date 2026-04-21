import { Prisma, DataReviewStatus } from '@prisma/client';

/**
 * Shared WHERE clause for approved case queries — use everywhere cases are exposed to non-admin users.
 */
export const CASE_REVIEW_APPROVED_WHERE = {
  reviewStatus: {
    in: [
      DataReviewStatus.AUTO_APPROVED,
      DataReviewStatus.APPROVED,
    ] as DataReviewStatus[],
  },
};

/**
 * School basic fields — shared across school-list, recommendation, hall, case, swipe.
 * When adding fields here, also update mapSchoolBasic() in common/mappers/school.mapper.ts.
 */
export const SCHOOL_RANKING_SELECT = {
  source: true,
  list: true,
  rank: true,
  year: true,
  sourceUrl: true,
} as const satisfies Prisma.SchoolRankingSelect;

export const SCHOOL_BASIC_SELECT = {
  id: true,
  name: true,
  nameZh: true,
  usNewsRank: true,
  acceptanceRate: true,
  testingPolicy: true,
  testOptional: true,
  tuition: true,
  city: true,
  state: true,
  logoUrl: true,
  website: true,
  scorecardId: true,
  ipedsId: true,
  transferAcceptanceRate: true,
  rankings: { select: SCHOOL_RANKING_SELECT },
} as const satisfies Prisma.SchoolSelect;

/**
 * User summary fields — shared across forum, peer-review, team, hall.
 * Note: chat module has its own USER_SELECT (includes email) — leave it unchanged.
 */
export const USER_SUMMARY_SELECT = {
  id: true,
  role: true,
  profile: { select: { realName: true, avatarUrl: true } },
} as const satisfies Prisma.UserSelect;

/**
 * Minimal school fields — used across case, team, essay-prompt for display names only.
 */
export const SCHOOL_NAME_SELECT = {
  id: true,
  name: true,
  nameZh: true,
} as const satisfies Prisma.SchoolSelect;

/**
 * School name + rank + rankings — used in essay-prompt listings, case detail, etc.
 */
export const SCHOOL_NAME_RANK_SELECT = {
  ...SCHOOL_NAME_SELECT,
  usNewsRank: true,
  rankings: { select: SCHOOL_RANKING_SELECT },
} as const satisfies Prisma.SchoolSelect;

/**
 * School fields needed to contextualize prediction results on dashboard/mobile surfaces.
 */
export const SCHOOL_PREDICTION_CONTEXT_SELECT = {
  ...SCHOOL_NAME_RANK_SELECT,
  acceptanceRate: true,
  intlAcceptanceRate: true,
  intlStudentPct: true,
  needBlindInternational: true,
} as const satisfies Prisma.SchoolSelect;

// Prisma-inferred types
export type SchoolBasicResult = Prisma.SchoolGetPayload<{
  select: typeof SCHOOL_BASIC_SELECT;
}>;

export type UserSummaryResult = Prisma.UserGetPayload<{
  select: typeof USER_SUMMARY_SELECT;
}>;
