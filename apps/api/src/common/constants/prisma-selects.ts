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
export const SCHOOL_BASIC_SELECT = {
  id: true,
  name: true,
  nameZh: true,
  usNewsRank: true,
  acceptanceRate: true,
  tuition: true,
  city: true,
  state: true,
  logoUrl: true,
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
 * School name + rank — used in essay-prompt listings.
 */
export const SCHOOL_NAME_RANK_SELECT = {
  ...SCHOOL_NAME_SELECT,
  usNewsRank: true,
} as const satisfies Prisma.SchoolSelect;

// Prisma-inferred types
export type SchoolBasicResult = Prisma.SchoolGetPayload<{
  select: typeof SCHOOL_BASIC_SELECT;
}>;

export type UserSummaryResult = Prisma.UserGetPayload<{
  select: typeof USER_SUMMARY_SELECT;
}>;
