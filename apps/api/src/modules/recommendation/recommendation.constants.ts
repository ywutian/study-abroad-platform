import {
  Prisma,
  SchoolMediaSourceType,
  SchoolMediaStatus,
  SchoolMediaType,
} from '@prisma/client';
import type {
  SchoolPublicMedia,
  SchoolPublicMediaAsset,
} from '@study-abroad/shared';
import { toLegacyTestOptionalFlag } from '@study-abroad/shared/utils';
import { SCHOOL_BASIC_SELECT } from '../../common/constants/prisma-selects';
import { clampPercentRate } from '../../common/utils/percent.util';
import { toPublicSchoolMediaAsset } from '../../common/utils/school-public-media.util';

const RECOMMENDATION_PUBLIC_MEDIA_SOURCE_TYPES: SchoolMediaSourceType[] = [
  SchoolMediaSourceType.OFFICIAL_WEBSITE,
  SchoolMediaSourceType.OFFICIAL_BRAND_PAGE,
  SchoolMediaSourceType.WIKIMEDIA_COMMONS,
  SchoolMediaSourceType.LOGO_API,
  SchoolMediaSourceType.FAVICON_FALLBACK,
  SchoolMediaSourceType.MANUAL_ADMIN,
];

/**
 * School fields for recommendation matching (matchSchoolIds).
 * When adding fields here, also update mapSchoolMeta() below.
 */
export const RECOMMENDATION_SCHOOL_SELECT = {
  ...SCHOOL_BASIC_SELECT,
  aliases: true,
  isPrivate: true,
  hasEarlyDecision: true,
  retentionRate: true,
  mediaAssets: {
    where: {
      status: SchoolMediaStatus.APPROVED,
      isPrimary: true,
      sourceType: { in: RECOMMENDATION_PUBLIC_MEDIA_SOURCE_TYPES },
    },
    select: {
      type: true,
      sourceType: true,
      storageUrl: true,
      originalUrl: true,
      sourcePageUrl: true,
      license: true,
      attribution: true,
      width: true,
      height: true,
    },
  },
} as const satisfies Prisma.SchoolSelect;

export type RecommendationSchoolResult = Prisma.SchoolGetPayload<{
  select: typeof RECOMMENDATION_SCHOOL_SELECT;
}>;

/** Mapped school metadata shape for recommendation responses. */
export type RecommendationSchoolMeta = ReturnType<typeof mapSchoolMeta>;

type RecommendationMediaAsset =
  RecommendationSchoolResult['mediaAssets'][number];

function toPublicMediaAsset(
  asset?: RecommendationMediaAsset,
): SchoolPublicMediaAsset | null {
  return toPublicSchoolMediaAsset(asset);
}

function mapSchoolMedia(
  assets?: RecommendationMediaAsset[] | null,
): SchoolPublicMedia {
  const mediaAssets = assets ?? [];

  return {
    campusCover: toPublicMediaAsset(
      mediaAssets.find((asset) => asset.type === SchoolMediaType.CAMPUS_COVER),
    ),
    logo: toPublicMediaAsset(
      mediaAssets.find((asset) => asset.type === SchoolMediaType.LOGO),
    ),
  };
}

/**
 * Maps matched school to schoolMeta for recommendation response.
 */
export function mapSchoolMeta(school: RecommendationSchoolResult) {
  return {
    nameZh: school.nameZh,
    usNewsRank: school.usNewsRank,
    rankings: school.rankings,
    acceptanceRate: clampPercentRate(school.acceptanceRate),
    city: school.city,
    state: school.state,
    tuition: school.tuition,
    isPrivate: school.isPrivate,
    testingPolicy: school.testingPolicy,
    testOptional: toLegacyTestOptionalFlag({
      testingPolicy: school.testingPolicy,
      testOptional: school.testOptional,
    }),
    hasEarlyDecision: school.hasEarlyDecision ?? undefined,
    retentionRate:
      school.retentionRate != null ? Number(school.retentionRate) : undefined,
    logoUrl: school.logoUrl || undefined,
    media: mapSchoolMedia(school.mediaAssets),
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
