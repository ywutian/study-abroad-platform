import {
  Prisma,
  DataReviewStatus,
  SchoolMediaSourceType,
  SchoolMediaStatus,
} from '@prisma/client';

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

export const SCHOOL_PUBLIC_MEDIA_SOURCE_TYPES: SchoolMediaSourceType[] = [
  SchoolMediaSourceType.OFFICIAL_WEBSITE,
  SchoolMediaSourceType.OFFICIAL_BRAND_PAGE,
  SchoolMediaSourceType.WIKIMEDIA_COMMONS,
  SchoolMediaSourceType.LOGO_API,
  SchoolMediaSourceType.FAVICON_FALLBACK,
  SchoolMediaSourceType.MANUAL_ADMIN,
];

export const SCHOOL_PUBLIC_MEDIA_SELECT = {
  type: true,
  sourceType: true,
  storageUrl: true,
  originalUrl: true,
  sourcePageUrl: true,
  license: true,
  attribution: true,
  width: true,
  height: true,
} as const satisfies Prisma.SchoolMediaAssetSelect;

export const SCHOOL_PUBLIC_MEDIA_RELATION_SELECT = {
  where: {
    status: SchoolMediaStatus.APPROVED,
    isPrimary: true,
    sourceType: { in: SCHOOL_PUBLIC_MEDIA_SOURCE_TYPES },
  },
  select: SCHOOL_PUBLIC_MEDIA_SELECT,
} as const;

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
  mediaAssets: SCHOOL_PUBLIC_MEDIA_RELATION_SELECT,
} as const satisfies Prisma.SchoolSelect;

/**
 * User summary fields — shared across forum, peer-review, team, hall.
 * Note: chat module has its own USER_SELECT (includes email) — leave it unchanged.
 */
export const USER_SUMMARY_SELECT = {
  id: true,
  role: true,
  reviewerLevel: true, // Hall refactor Phase 1: surface L1/L2/L3 to all consumers (admin UI, hall reviewer badges, etc.)
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
  oosAcceptanceRate: true,
  inStateAcceptanceRate: true,
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
