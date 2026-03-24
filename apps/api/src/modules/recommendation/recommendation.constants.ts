import { Prisma } from '@prisma/client';
import { SCHOOL_BASIC_SELECT } from '../../common/constants/prisma-selects';
import { clampPercentRate } from '../../common/utils/percent.util';

/**
 * School fields for recommendation matching (matchSchoolIds).
 * When adding fields here, also update mapSchoolMeta() below.
 */
export const RECOMMENDATION_SCHOOL_SELECT = {
  ...SCHOOL_BASIC_SELECT,
  aliases: true,
  isPrivate: true,
  testOptional: true,
  hasEarlyDecision: true,
  retentionRate: true,
} as const satisfies Prisma.SchoolSelect;

export type RecommendationSchoolResult = Prisma.SchoolGetPayload<{
  select: typeof RECOMMENDATION_SCHOOL_SELECT;
}>;

/** Mapped school metadata shape for recommendation responses. */
export type RecommendationSchoolMeta = ReturnType<typeof mapSchoolMeta>;

/**
 * Maps matched school to schoolMeta for recommendation response.
 */
export function mapSchoolMeta(school: RecommendationSchoolResult) {
  return {
    nameZh: school.nameZh,
    usNewsRank: school.usNewsRank,
    acceptanceRate: clampPercentRate(school.acceptanceRate),
    city: school.city,
    state: school.state,
    tuition: school.tuition,
    isPrivate: school.isPrivate,
    testOptional: school.testOptional ?? undefined,
    hasEarlyDecision: school.hasEarlyDecision ?? undefined,
    retentionRate:
      school.retentionRate != null ? Number(school.retentionRate) : undefined,
    logoUrl: school.logoUrl || undefined,
    website: school.website || undefined,
    sourceUrls: {
      collegeScorecardUrl: school.scorecardId
        ? `https://collegescorecard.ed.gov/school/?${school.scorecardId}`
        : undefined,
      ipedsUrl: school.ipedsId
        ? `https://nces.ed.gov/ipeds/datacenter/institutionprofile.aspx?unitId=${school.ipedsId}`
        : undefined,
      websiteUrl: school.website || undefined,
    },
  };
}
