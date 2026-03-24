import { Prisma } from '@prisma/client';
import { SCHOOL_BASIC_SELECT } from '../../common/constants/prisma-selects';
import { clampPercentRate } from '../../common/utils/percent.util';

/**
 * School fields for school-list API responses (getUserSchoolList / addSchool / updateItem).
 * When adding fields here, also update mapSchoolForList() below.
 */
export const SCHOOL_LIST_SCHOOL_SELECT = {
  ...SCHOOL_BASIC_SELECT,
  satAvg: true,
  testOptional: true,
  hasEarlyDecision: true,
  acceptsCommonApp: true,
  needBlindInternational: true,
  percentNeedMet: true,
  averageAidPackage: true,
  averageNetPrice: true,
} as const satisfies Prisma.SchoolSelect;

export type SchoolListSchoolResult = Prisma.SchoolGetPayload<{
  select: typeof SCHOOL_LIST_SCHOOL_SELECT;
}>;

/**
 * Maps a Prisma School result to the school-list API response shape.
 * Single source of truth — eliminates 4 duplicate mapping blocks.
 */
export function mapSchoolForList(school: SchoolListSchoolResult) {
  return {
    id: school.id,
    name: school.name,
    nameZh: school.nameZh || undefined,
    usNewsRank: school.usNewsRank || undefined,
    acceptanceRate: school.acceptanceRate
      ? clampPercentRate(school.acceptanceRate)
      : undefined,
    satAvg: school.satAvg || undefined,
    tuition: school.tuition || undefined,
    city: school.city || undefined,
    state: school.state || undefined,
    testOptional: school.testOptional ?? undefined,
    hasEarlyDecision: school.hasEarlyDecision ?? undefined,
    acceptsCommonApp: school.acceptsCommonApp ?? undefined,
    needBlindInternational: school.needBlindInternational || false,
    percentNeedMet: school.percentNeedMet
      ? clampPercentRate(school.percentNeedMet)
      : undefined,
    averageAidPackage: school.averageAidPackage || undefined,
    averageNetPrice: school.averageNetPrice || undefined,
    logoUrl: school.logoUrl || undefined,
    website: school.website || undefined,
    scorecardId: school.scorecardId || undefined,
    ipedsId: school.ipedsId || undefined,
    transferAcceptanceRate: school.transferAcceptanceRate
      ? clampPercentRate(school.transferAcceptanceRate)
      : undefined,
    rankings: school.rankings || [],
  };
}

/**
 * Extended school select for AI recommendations — includes SAT/ACT/graduation metrics
 * used for scoring calculations (not all exposed in response).
 */
export const AI_RECOMMENDATION_SCHOOL_SELECT = {
  ...SCHOOL_LIST_SCHOOL_SELECT,
  sat25: true,
  sat75: true,
  actAvg: true,
  act25: true,
  act75: true,
  graduationRate: true,
  averageNetPrice: true,
  retentionRate: true,
} as const satisfies Prisma.SchoolSelect;
