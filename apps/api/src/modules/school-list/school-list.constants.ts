import { Prisma, SchoolMediaType, SchoolTier } from '@prisma/client';
import type {
  SchoolPublicMedia,
  SchoolPublicMediaAsset,
} from '@study-abroad/shared';
import { toLegacyTestOptionalFlag } from '@study-abroad/shared/utils';
import { SCHOOL_BASIC_SELECT } from '../../common/constants/prisma-selects';
import { clampPercentRate } from '../../common/utils/percent.util';
import { toPublicSchoolMediaAsset } from '../../common/utils/school-public-media.util';

/**
 * School fields for school-list API responses (getUserSchoolList / addSchool / updateItem).
 * When adding fields here, also update mapSchoolForList() below.
 */
export const SCHOOL_LIST_SCHOOL_SELECT = {
  ...SCHOOL_BASIC_SELECT,
  satAvg: true,
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

type SchoolListMediaAsset = SchoolListSchoolResult['mediaAssets'][number];

function toPublicMediaAsset(
  asset: SchoolListMediaAsset | undefined,
): SchoolPublicMediaAsset | null {
  return toPublicSchoolMediaAsset(asset);
}

function mapSchoolMedia(
  assets?: SchoolListMediaAsset[] | null,
): SchoolPublicMedia {
  const list = assets ?? [];
  return {
    campusCover: toPublicMediaAsset(
      list.find((asset) => asset.type === SchoolMediaType.CAMPUS_COVER),
    ),
    logo: toPublicMediaAsset(
      list.find((asset) => asset.type === SchoolMediaType.LOGO),
    ),
  };
}

/**
 * Maps a Prisma School result to the school-list API response shape.
 * Single source of truth — eliminates 4 duplicate mapping blocks.
 */
export function mapSchoolForList(
  school:
    | SchoolListSchoolResult
    | (Record<string, any> & { mediaAssets?: SchoolListMediaAsset[] }),
) {
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
    testingPolicy: school.testingPolicy,
    testOptional: toLegacyTestOptionalFlag({
      testingPolicy: school.testingPolicy,
      testOptional: school.testOptional,
    }),
    hasEarlyDecision: school.hasEarlyDecision ?? undefined,
    acceptsCommonApp: school.acceptsCommonApp ?? undefined,
    needBlindInternational: school.needBlindInternational ?? null,
    percentNeedMet: school.percentNeedMet
      ? clampPercentRate(school.percentNeedMet)
      : undefined,
    averageAidPackage: school.averageAidPackage || undefined,
    averageNetPrice: school.averageNetPrice || undefined,
    logoUrl: school.logoUrl || undefined,
    media: mapSchoolMedia(school.mediaAssets),
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
 * Map a prediction tier string (`reach` / `match` / `safety`, as produced by
 * `calculateTier` and stored on `PredictionResult.tier`) to the `SchoolTier`
 * enum used on `SchoolListItem`.
 *
 * Returns `null` for `unavailable`, `undefined`, or any unknown value — the
 * caller falls back to the stored `SchoolListItem.tier` in that case.
 */
export function predictionTierToSchoolTier(
  predTier: string | undefined | null,
): SchoolTier | null {
  switch (predTier) {
    case 'safety':
      return SchoolTier.SAFETY;
    case 'match':
      return SchoolTier.TARGET;
    case 'reach':
      return SchoolTier.REACH;
    default:
      return null;
  }
}

/** Display sort rank for a tier: reach first, then match, then safety. */
export const SCHOOL_TIER_SORT_RANK: Record<SchoolTier, number> = {
  [SchoolTier.REACH]: 0,
  [SchoolTier.TARGET]: 1,
  [SchoolTier.SAFETY]: 2,
};

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
