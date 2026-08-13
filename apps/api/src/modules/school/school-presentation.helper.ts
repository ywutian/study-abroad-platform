import type {
  SchoolCommunityRatingSummary,
  SchoolFieldSources,
  SchoolPublicMedia,
  SchoolTestingPolicy,
} from '@study-abroad/shared';
import {
  toLegacyTestOptionalFlag,
  toSchoolFieldSource,
} from '@study-abroad/shared/utils';
import {
  buildNormalizedSchoolProvenance,
  toRecord,
} from './school-provenance.helpers';
import { clampPercentRate } from '../../common/utils/percent.util';
import type { SchoolMediaSourceType, SchoolMediaType } from '@prisma/client';

interface PublicSchoolMediaAssetRow {
  type: SchoolMediaType;
  sourceType: SchoolMediaSourceType;
  storageUrl: string | null;
  originalUrl: string | null;
  sourcePageUrl: string | null;
  license: string | null;
  attribution: string | null;
  width: number | null;
  height: number | null;
}

function normalizeRankingSourceForDisplay(source: unknown): unknown {
  return source === 'US_NEWS' ? 'US News' : source;
}

export type SchoolWithPresentation<T> = T & {
  fieldSources: SchoolFieldSources;
  communityRatingSummary: SchoolCommunityRatingSummary;
};

export function createEmptyCommunitySummary(): SchoolCommunityRatingSummary {
  return {
    count: 0,
    safetyAvg: null,
    lifeAvg: null,
    foodAvg: null,
    isPublic: false,
  };
}

export function buildFieldSources<T extends Record<string, unknown>>(
  school: T,
): SchoolFieldSources {
  const provenance = buildNormalizedSchoolProvenance(school);
  return Object.fromEntries(
    Object.entries(provenance)
      .filter(([, entry]) => Boolean(entry))
      .map(([field, entry]) => [field, toSchoolFieldSource(entry!)]),
  );
}

export function enrichSchoolPresentation<
  T extends Record<string, unknown> & {
    mediaAssets?: PublicSchoolMediaAssetRow[] | null;
    acceptanceRate?: unknown;
    graduationRate?: unknown;
    testOptional?: boolean | null;
  },
>(
  school: T,
  communityRatingSummary: SchoolCommunityRatingSummary,
  buildMedia: (
    assets?: PublicSchoolMediaAssetRow[] | null,
  ) => SchoolPublicMedia,
): SchoolWithPresentation<T> {
  const { mediaAssets, ...schoolBase } = school;
  const metadata = {
    ...toRecord(schoolBase.metadata),
    provenance: buildNormalizedSchoolProvenance(schoolBase),
  };
  const testingPolicy =
    (schoolBase as { testingPolicy?: SchoolTestingPolicy | null })
      .testingPolicy ?? 'UNKNOWN';
  return {
    ...schoolBase,
    rankings: Array.isArray(schoolBase.rankings)
      ? schoolBase.rankings.map((ranking) => {
          if (typeof ranking !== 'object' || ranking === null) return null;
          const record = ranking as Record<string, unknown>;
          return {
            ...record,
            source: normalizeRankingSourceForDisplay(
              typeof record.source === 'string' ? record.source : undefined,
            ),
          };
        })
      : schoolBase.rankings,
    acceptanceRate:
      clampPercentRate(schoolBase.acceptanceRate) ?? schoolBase.acceptanceRate,
    gpaDistribution: schoolBase.gpaDistribution ?? null,
    programRates: schoolBase.programRates ?? null,
    graduationRate:
      clampPercentRate(schoolBase.graduationRate) ?? schoolBase.graduationRate,
    testingPolicy,
    testOptional: toLegacyTestOptionalFlag({
      testingPolicy,
      testOptional:
        typeof schoolBase.testOptional === 'boolean'
          ? schoolBase.testOptional
          : null,
    }),
    media: buildMedia(mediaAssets),
    metadata,
    fieldSources: buildFieldSources({ ...schoolBase, metadata }),
    communityRatingSummary,
  } as unknown as SchoolWithPresentation<T>;
}
