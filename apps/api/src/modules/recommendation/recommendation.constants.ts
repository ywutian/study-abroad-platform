import {
  Prisma,
  SchoolMediaSourceType,
  SchoolMediaStatus,
  SchoolMediaType,
} from '@prisma/client';
import type {
  SchoolFieldSource,
  SchoolPublicMedia,
  SchoolPublicMediaAsset,
} from '@study-abroad/shared';
import {
  normalizeSchoolProvenance,
  toLegacyTestOptionalFlag,
  toSchoolFieldSource,
} from '@study-abroad/shared/utils';
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
 * When adding fields here, also update mapSourcedSchoolMeta() below.
 */
export const RECOMMENDATION_SCHOOL_SELECT = {
  ...SCHOOL_BASIC_SELECT,
  aliases: true,
  isPrivate: true,
  metadata: true,
  updatedAt: true,
  hasEarlyDecision: true,
  retentionRate: true,
  roomAndBoard: true,
  studentOrgsCount: true,
  countriesRepresented: true,
  nicheSafetyGrade: true,
  nicheLifeGrade: true,
  nicheFoodGrade: true,
  nicheOverallGrade: true,
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
export type RecommendationSchoolMeta = ReturnType<typeof mapSourcedSchoolMeta>;

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
export function mapSourcedSchoolMeta(school: RecommendationSchoolResult) {
  const fieldSources = {
    acceptanceRate: getRecommendationFieldSource(school, 'acceptanceRate'),
    retentionRate: getRecommendationFieldSource(school, 'retentionRate'),
    testingPolicy: getRecommendationFieldSource(school, 'testingPolicy'),
  };
  const weakFields = Object.fromEntries(
    Object.entries(fieldSources)
      .filter(([, source]) => !source)
      .map(([field]) => [field, 'hidden_until_field_provenance_exists']),
  );

  return {
    nameZh: school.nameZh,
    usNewsRank: school.usNewsRank,
    rankings: school.rankings,
    acceptanceRate: getRecommendationMetricValue(school, 'acceptanceRate'),
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
    retentionRate: getRecommendationMetricValue(school, 'retentionRate'),
    roomAndBoard: school.roomAndBoard ?? undefined,
    studentOrgsCount: school.studentOrgsCount ?? undefined,
    countriesRepresented: school.countriesRepresented ?? undefined,
    nicheSafetyGrade: school.nicheSafetyGrade ?? undefined,
    nicheLifeGrade: school.nicheLifeGrade ?? undefined,
    nicheFoodGrade: school.nicheFoodGrade ?? undefined,
    nicheOverallGrade: school.nicheOverallGrade ?? undefined,
    logoUrl: school.logoUrl || undefined,
    media: mapSchoolMedia(school.mediaAssets),
    website: school.website || undefined,
    fieldSources,
    weakFields,
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

export function getRecommendationFieldSource(
  school: Pick<RecommendationSchoolResult, 'metadata'>,
  field: string,
): SchoolFieldSource | null {
  const provenance = normalizeSchoolProvenance(
    ((school.metadata as Record<string, unknown> | null | undefined)
      ?.provenance ?? {}) as Record<string, unknown>,
  );
  const source = provenance[field]
    ? toSchoolFieldSource(provenance[field]!)
    : null;
  if (!source) return null;
  if (!source.predictionEligible) return null;
  if (source.staleness === 'STALE') return null;
  if (
    source.realDataStatus &&
    [
      'MANUAL_REVIEW',
      'OFFICIAL_BLANK',
      'OFFICIAL_BLOCKED',
      'NO_PUBLIC_REAL_DATA',
    ].includes(source.realDataStatus)
  ) {
    return null;
  }
  return source;
}

export function getRecommendationMetricValue(
  school: Record<string, unknown> &
    Pick<RecommendationSchoolResult, 'metadata'>,
  field: string,
): number | undefined {
  const source = getRecommendationFieldSource(school, field);
  if (!source) return undefined;
  if (field === 'acceptanceRate' || field === 'graduationRate') {
    return clampPercentRate(school[field]);
  }
  return numberOrUndefined(school[field]);
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const maybe = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(maybe) ? maybe : undefined;
  }
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}
