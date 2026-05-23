import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type {
  SchoolCommunityRatingSummary,
  SchoolFieldSources,
  SchoolPublicMedia,
  SchoolPublicMediaAsset,
  TrustTier,
} from '@study-abroad/shared';
import {
  toLegacyTestOptionalFlag,
  normalizeSchoolProvenance,
  toSchoolFieldSource,
} from '@study-abroad/shared/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  Prisma,
  School,
  SchoolMediaSourceType,
  SchoolMediaStatus,
  SchoolMediaType,
} from '@prisma/client';
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import { clampPercentRate } from '../../common/utils/percent.util';
import { toPublicSchoolMediaAsset } from '../../common/utils/school-public-media.util';
import { createHash } from 'crypto';
import { SchoolCommunityRatingService } from './school-community-rating.service';
import {
  buildNormalizedSchoolProvenance,
  collectPresentSchoolFacts,
  PREDICTION_CRITICAL_FIELDS,
  toRecord,
} from './school-provenance.helpers';
import { SchoolWriteService } from './school-write.service';
import { scoreAndRankSchools } from '../ranking/ranking-score.util';
import {
  CATALOG_RANKING_LISTS,
  RANKING_LIST_LABEL_KEYS,
  US_NEWS_CORE_RANKING_LIST,
  US_NEWS_RANKING_SOURCE,
  compareSchoolsByCatalogRank,
  getCatalogRanking,
  getCoreRankingForRange,
  isConcreteRankingList,
  normalizeRankingListSelection,
  type CatalogRanking,
  type RankingListSelection,
} from './school-ranking-catalog';
import {
  decodeNicheGradeParam,
  isNicheGradeAtLeast,
  type NicheGradeQueryValue,
} from '@study-abroad/shared/scoring';

// Cache TTL in seconds
const CACHE_TTL = {
  SCHOOL_DETAIL: 3600, // 1 hour for individual school
  SCHOOL_LIST: 300, // 5 minutes for lists
  SCHOOL_METRICS: 86400, // 24 hours for metrics (rarely change)
};

const LOCAL_CACHE_TTL_SECONDS = 60;
const LOCAL_CACHE_MAX_ENTRIES = 200;

interface LocalCacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** UC campuses (9) for one-click prediction */
const UC_SCHOOL_NAMES = [
  'University of California, Berkeley',
  'University of California, Los Angeles',
  'University of California, San Diego',
  'University of California, Irvine',
  'University of California, Davis',
  'University of California, Santa Barbara',
  'University of California, Santa Cruz',
  'University of California, Riverside',
  'University of California, Merced',
];

type SchoolWithPresentation<T> = T & {
  fieldSources: SchoolFieldSources;
  communityRatingSummary: SchoolCommunityRatingSummary;
};

type SchoolWithAliases = Pick<
  School,
  'name' | 'nameZh' | 'usNewsRank' | 'institutionType'
> & {
  aliases?: string[];
  rankings?: CatalogRanking[] | null;
};

type SchoolWithRankings = School & {
  rankings?: CatalogRanking[] | null;
  mediaAssets?: PublicSchoolMediaAssetRow[] | null;
};

interface RankingContext {
  source: typeof US_NEWS_RANKING_SOURCE;
  list: RankingListSelection;
  rankMin?: number;
  rankMax?: number;
}

function normalizeRankingSourceForDisplay(source: unknown): unknown {
  return source === 'US_NEWS' ? 'US News' : source;
}

const PUBLIC_SCHOOL_MEDIA_SOURCE_TYPES: SchoolMediaSourceType[] = [
  SchoolMediaSourceType.OFFICIAL_WEBSITE,
  SchoolMediaSourceType.OFFICIAL_BRAND_PAGE,
  SchoolMediaSourceType.WIKIMEDIA_COMMONS,
  SchoolMediaSourceType.LOGO_API,
  SchoolMediaSourceType.FAVICON_FALLBACK,
  SchoolMediaSourceType.MANUAL_ADMIN,
];

const schoolRankingsInclude = {
  rankings: {
    select: {
      source: true,
      list: true,
      rank: true,
      year: true,
      sourceUrl: true,
    },
  },
} satisfies Prisma.SchoolInclude;

const schoolPublicMediaInclude = {
  mediaAssets: {
    where: {
      status: SchoolMediaStatus.APPROVED,
      isPrimary: true,
      sourceType: { in: PUBLIC_SCHOOL_MEDIA_SOURCE_TYPES },
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
} satisfies Prisma.SchoolInclude;

type PublicSchoolMediaAssetRow = {
  type: SchoolMediaType;
  sourceType: SchoolMediaSourceType;
  storageUrl: string | null;
  originalUrl: string | null;
  sourcePageUrl: string | null;
  license: string | null;
  attribution: string | null;
  width: number | null;
  height: number | null;
};

function toPublicMediaAsset(
  asset: PublicSchoolMediaAssetRow | undefined,
): SchoolPublicMediaAsset | null {
  return toPublicSchoolMediaAsset(asset);
}

function buildPublicSchoolMedia(
  assets?: PublicSchoolMediaAssetRow[] | null,
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
 * 高级学校筛选接口
 */
interface SchoolFilters {
  country?: string;
  search?: string;
  state?: string;
  region?: string;
  rankMin?: number;
  rankMax?: number;
  acceptanceMin?: number;
  acceptanceMax?: number;
  tuitionMin?: number;
  tuitionMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  schoolType?: 'public' | 'private';
  testOptional?: boolean;
  testingPolicy?: 'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'UNKNOWN';
  needBlind?: boolean;
  hasEarlyDecision?: boolean;
  sortBy?: 'rank' | 'name' | 'acceptance' | 'salary' | 'weighted';
  rankingSource?: 'US_NEWS';
  rankingList?: RankingListSelection | string;
  weightRank?: number;
  weightAcceptance?: number;
  weightTuition?: number;
  weightSalary?: number;
  weightCampusSafety?: number;
  weightCampusLife?: number;
  weightCampusFood?: number;
  minSafetyGrade?: NicheGradeQueryValue;
  minLifeGrade?: NicheGradeQueryValue;
  minFoodGrade?: NicheGradeQueryValue;
}

// 地区到州的映射
const REGION_TO_STATES: Record<string, string[]> = {
  northeast: ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  midwest: [
    'IL',
    'IN',
    'IA',
    'KS',
    'MI',
    'MN',
    'MO',
    'NE',
    'ND',
    'OH',
    'SD',
    'WI',
  ],
  south: [
    'AL',
    'AR',
    'DE',
    'FL',
    'GA',
    'KY',
    'LA',
    'MD',
    'MS',
    'NC',
    'OK',
    'SC',
    'TN',
    'TX',
    'VA',
    'WV',
  ],
  west: [
    'AK',
    'AZ',
    'CA',
    'CO',
    'HI',
    'ID',
    'MT',
    'NV',
    'NM',
    'OR',
    'UT',
    'WA',
    'WY',
  ],
};

@Injectable()
export class SchoolService {
  private readonly localCache = new Map<string, LocalCacheEntry<unknown>>();

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private schoolCommunityRatingService: SchoolCommunityRatingService,
    private schoolWriteService: SchoolWriteService,
  ) {}

  async findAll(
    pagination: PaginationDto,
    filters?: SchoolFilters,
  ): Promise<
    PaginatedResponseDto<
      School & {
        fieldSources: SchoolFieldSources;
        communityRatingSummary: SchoolCommunityRatingSummary;
      }
    >
  > {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;
    const isSearch = !!filters?.search;

    // Cache non-search queries (search queries are too variable for caching)
    if (!isSearch) {
      const cacheKey = this.buildListCacheKey(pagination, filters);
      const localCached = this.getLocalCache<
        PaginatedResponseDto<
          School & {
            fieldSources: SchoolFieldSources;
            communityRatingSummary: SchoolCommunityRatingSummary;
          }
        >
      >(cacheKey);
      if (localCached) return localCached;

      try {
        const cached = await this.redis.getJSON<
          PaginatedResponseDto<
            School & {
              fieldSources: SchoolFieldSources;
              communityRatingSummary: SchoolCommunityRatingSummary;
            }
          >
        >(cacheKey);
        if (cached) {
          this.setLocalCache(cacheKey, cached);
          return cached;
        }
      } catch {
        // Redis is an optional cache; DB remains the source of truth.
      }
    }

    const where: Prisma.SchoolWhereInput = {};

    // 基础筛选
    if (filters?.country) {
      where.country = filters.country;
    }

    if (isSearch) {
      const searchTerm = filters.search!.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { nameZh: { contains: searchTerm, mode: 'insensitive' } },
        {
          aliases: {
            hasSome: [
              searchTerm,
              searchTerm.toUpperCase(),
              searchTerm.toLowerCase(),
            ],
          },
        }, // 别名大小写容错 (hasSome 已覆盖精确匹配)
      ];
    }

    // 地理位置筛选
    if (filters?.state) {
      where.state = filters.state;
    }

    const allowsUsRegionFilter =
      !filters?.country ||
      filters.country === 'US' ||
      filters.country === 'USA';

    if (
      !filters?.state &&
      allowsUsRegionFilter &&
      filters?.region &&
      REGION_TO_STATES[filters.region]
    ) {
      where.state = { in: REGION_TO_STATES[filters.region] };
    }

    // 录取率范围
    if (
      filters?.acceptanceMin !== undefined ||
      filters?.acceptanceMax !== undefined
    ) {
      where.acceptanceRate = {};
      if (filters.acceptanceMin !== undefined) {
        where.acceptanceRate.gte = filters.acceptanceMin;
      }
      if (filters.acceptanceMax !== undefined) {
        where.acceptanceRate.lte = filters.acceptanceMax;
      }
    }

    // 学费范围
    if (
      filters?.tuitionMin !== undefined ||
      filters?.tuitionMax !== undefined
    ) {
      where.tuition = {};
      if (filters.tuitionMin !== undefined) {
        where.tuition.gte = filters.tuitionMin;
      }
      if (filters.tuitionMax !== undefined) {
        where.tuition.lte = filters.tuitionMax;
      }
    }

    // 学校规模 (使用 totalEnrollment 字段)
    if (filters?.sizeMin !== undefined || filters?.sizeMax !== undefined) {
      where.totalEnrollment = {};
      if (filters.sizeMin !== undefined) {
        where.totalEnrollment.gte = filters.sizeMin;
      }
      if (filters.sizeMax !== undefined) {
        where.totalEnrollment.lte = filters.sizeMax;
      }
    }

    // ROI / post-graduation salary range
    if (filters?.salaryMin !== undefined || filters?.salaryMax !== undefined) {
      where.avgSalary = {};
      if (filters.salaryMin !== undefined) {
        where.avgSalary.gte = filters.salaryMin;
      }
      if (filters.salaryMax !== undefined) {
        where.avgSalary.lte = filters.salaryMax;
      }
    }

    // 学校类型 (使用 isPrivate 字段)
    if (filters?.schoolType) {
      where.isPrivate = filters.schoolType === 'private';
    }

    if (filters?.testingPolicy) {
      where.testingPolicy = filters.testingPolicy;
    }
    if (filters?.testOptional) {
      where.OR = [
        ...(Array.isArray(where.OR) ? where.OR : []),
        { testingPolicy: 'OPTIONAL' },
        { testingPolicy: 'UNKNOWN', testOptional: true },
      ];
    }
    if (filters?.needBlind) {
      where.needBlindInternational = true;
    }
    if (filters?.hasEarlyDecision) {
      where.hasEarlyDecision = true;
    }

    const sortBy = filters?.sortBy ?? 'rank';
    const rankingContext = this.buildRankingContext(filters);
    const includeRankings = {
      ...schoolRankingsInclude,
      ...schoolPublicMediaInclude,
    } satisfies Prisma.SchoolInclude;

    const [schools, total] =
      sortBy === 'weighted'
        ? await this.findWeightedSortedSchools(
            where,
            skip,
            pageSize,
            filters,
            rankingContext,
          )
        : sortBy === 'rank'
          ? await this.findCatalogRankSortedSchools(
              where,
              skip,
              pageSize,
              rankingContext,
              filters,
            )
          : this.needsInMemoryPagination(filters, rankingContext)
            ? await this.findRankingAwareSortedSchools(
                where,
                skip,
                pageSize,
                sortBy,
                rankingContext,
                filters,
              )
            : await Promise.all([
                this.prisma.school.findMany({
                  where,
                  skip,
                  take: pageSize,
                  orderBy: this.getListOrderBy(sortBy),
                  include: includeRankings,
                }),
                this.prisma.school.count({ where }),
              ]);

    const communitySummaries =
      await this.schoolCommunityRatingService.getSummariesForSchools(
        schools.map((school) => school.id),
      );

    const enrichedSchools = schools.map((school) =>
      this.enrichSchool(
        school,
        communitySummaries[school.id] ?? this.createEmptyCommunitySummary(),
      ),
    );

    if (isSearch && sortBy === 'rank') {
      const searchTerm = filters.search!.trim();
      const sorted = this.sortByRelevance(enrichedSchools, searchTerm);
      return createPaginatedResponse(sorted, total, page, pageSize);
    }

    const result = createPaginatedResponse(
      enrichedSchools,
      total,
      page,
      pageSize,
    );

    // Cache non-search results
    if (!isSearch) {
      const cacheKey = this.buildListCacheKey(pagination, filters);
      this.setLocalCache(cacheKey, result);
      try {
        await this.redis.setJSON(cacheKey, result, CACHE_TTL.SCHOOL_LIST);
      } catch {
        // Cache write failures must not break public school browsing.
      }
    }

    return result;
  }

  private getListOrderBy(
    sortBy: SchoolFilters['sortBy'],
  ): Prisma.SchoolOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'name':
        return [{ name: 'asc' }];
      case 'acceptance':
        return [{ acceptanceRate: 'asc' }, { usNewsRank: 'asc' }];
      case 'salary':
        return [{ avgSalary: 'desc' }, { usNewsRank: 'asc' }];
      case 'rank':
      default:
        return [{ usNewsRank: 'asc' }, { name: 'asc' }];
    }
  }

  private buildRankingContext(filters?: SchoolFilters): RankingContext {
    return {
      source: US_NEWS_RANKING_SOURCE,
      list: normalizeRankingListSelection(filters?.rankingList),
      rankMin: filters?.rankMin,
      rankMax: filters?.rankMax,
    };
  }

  private needsRankingAwarePagination(context: RankingContext): boolean {
    return (
      isConcreteRankingList(context.list) ||
      context.rankMin !== undefined ||
      context.rankMax !== undefined
    );
  }

  private hasCampusGradeFilters(filters?: SchoolFilters): boolean {
    return Boolean(
      filters?.minSafetyGrade || filters?.minLifeGrade || filters?.minFoodGrade,
    );
  }

  private needsInMemoryPagination(
    filters: SchoolFilters | undefined,
    context: RankingContext,
  ): boolean {
    return (
      this.needsRankingAwarePagination(context) ||
      this.hasCampusGradeFilters(filters)
    );
  }

  private filterSchoolsByRankingContext<T extends SchoolWithRankings>(
    schools: T[],
    context: RankingContext,
  ): T[] {
    if (!this.needsRankingAwarePagination(context)) {
      return schools;
    }

    return schools.filter((school) => {
      const ranking = isConcreteRankingList(context.list)
        ? getCatalogRanking(school, context.list)
        : getCoreRankingForRange(school);

      if (!ranking) return false;
      if (context.rankMin !== undefined && ranking.rank < context.rankMin) {
        return false;
      }
      if (context.rankMax !== undefined && ranking.rank > context.rankMax) {
        return false;
      }
      return true;
    });
  }

  private filterSchoolsByCampusGrades<T extends SchoolWithRankings>(
    schools: T[],
    filters?: SchoolFilters,
  ): T[] {
    if (!this.hasCampusGradeFilters(filters)) return schools;

    const minimumSafety = decodeNicheGradeParam(filters?.minSafetyGrade);
    const minimumLife = decodeNicheGradeParam(filters?.minLifeGrade);
    const minimumFood = decodeNicheGradeParam(filters?.minFoodGrade);

    return schools.filter((school) => {
      if (
        minimumSafety &&
        !isNicheGradeAtLeast(school.nicheSafetyGrade, minimumSafety)
      ) {
        return false;
      }
      if (
        minimumLife &&
        !isNicheGradeAtLeast(school.nicheLifeGrade, minimumLife)
      ) {
        return false;
      }
      if (
        minimumFood &&
        !isNicheGradeAtLeast(school.nicheFoodGrade, minimumFood)
      ) {
        return false;
      }
      return true;
    });
  }

  private filterSchoolsInMemory<T extends SchoolWithRankings>(
    schools: T[],
    context: RankingContext,
    filters?: SchoolFilters,
  ): T[] {
    return this.filterSchoolsByCampusGrades(
      this.filterSchoolsByRankingContext(schools, context),
      filters,
    );
  }

  private sortSchoolsInMemory<T extends SchoolWithRankings>(
    schools: T[],
    sortBy: SchoolFilters['sortBy'],
    context: RankingContext,
  ): T[] {
    const sorted = schools.slice();

    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'acceptance':
        return sorted.sort((a, b) => {
          const rateDelta =
            Number(a.acceptanceRate ?? Number.POSITIVE_INFINITY) -
            Number(b.acceptanceRate ?? Number.POSITIVE_INFINITY);
          if (rateDelta !== 0) return rateDelta;
          return compareSchoolsByCatalogRank(a, b, context.list);
        });
      case 'salary':
        return sorted.sort((a, b) => {
          const salaryDelta =
            Number(b.avgSalary ?? Number.NEGATIVE_INFINITY) -
            Number(a.avgSalary ?? Number.NEGATIVE_INFINITY);
          if (salaryDelta !== 0) return salaryDelta;
          return compareSchoolsByCatalogRank(a, b, context.list);
        });
      case 'rank':
      default:
        return sorted.sort((a, b) =>
          compareSchoolsByCatalogRank(a, b, context.list),
        );
    }
  }

  private async findRankingAwareSortedSchools(
    where: Prisma.SchoolWhereInput,
    skip: number,
    pageSize: number,
    sortBy: SchoolFilters['sortBy'],
    context: RankingContext,
    filters?: SchoolFilters,
  ) {
    const includeRankings = {
      ...schoolRankingsInclude,
      ...schoolPublicMediaInclude,
    } satisfies Prisma.SchoolInclude;

    const allSchools = await this.prisma.school.findMany({
      where,
      orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
      include: includeRankings,
    });

    const filtered = this.filterSchoolsInMemory(allSchools, context, filters);
    const sorted = this.sortSchoolsInMemory(filtered, sortBy, context);

    return [sorted.slice(skip, skip + pageSize), filtered.length] as const;
  }

  private async findWeightedSortedSchools(
    where: Prisma.SchoolWhereInput,
    skip: number,
    pageSize: number,
    filters?: SchoolFilters,
    context: RankingContext = this.buildRankingContext(filters),
  ) {
    const includeRankings = {
      ...schoolRankingsInclude,
      ...schoolPublicMediaInclude,
    } satisfies Prisma.SchoolInclude;

    const allSchools = await this.prisma.school.findMany({
      where,
      orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
      include: includeRankings,
    });
    const filteredSchools = this.filterSchoolsInMemory(
      allSchools,
      context,
      filters,
    );

    const rankedSchools = scoreAndRankSchools(
      filteredSchools,
      {
        usNewsRank: filters?.weightRank ?? 30,
        acceptanceRate: filters?.weightAcceptance ?? 20,
        tuition: filters?.weightTuition ?? 25,
        avgSalary: filters?.weightSalary ?? 25,
        safetyGrade: filters?.weightCampusSafety ?? 0,
        studentLifeGrade: filters?.weightCampusLife ?? 0,
        campusFoodGrade: filters?.weightCampusFood ?? 0,
        nicheOverall: 0,
      },
      { rankingList: context.list },
    ).map((school) => {
      const { score, rank: _rank, ...rest } = school;
      return {
        ...rest,
        fitScore: score,
      };
    });

    return [
      rankedSchools.slice(skip, skip + pageSize),
      filteredSchools.length,
    ] as const;
  }

  private async findCatalogRankSortedSchools(
    where: Prisma.SchoolWhereInput,
    skip: number,
    pageSize: number,
    context: RankingContext,
    filters?: SchoolFilters,
  ) {
    const includeRankings = {
      ...schoolRankingsInclude,
      ...schoolPublicMediaInclude,
    } satisfies Prisma.SchoolInclude;

    const allSchools = await this.prisma.school.findMany({
      where,
      orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
      include: includeRankings,
    });

    const filteredSchools = this.filterSchoolsInMemory(
      allSchools,
      context,
      filters,
    );
    const sortedSchools = this.sortSchoolsInMemory(
      filteredSchools,
      'rank',
      context,
    );

    return [
      sortedSchools.slice(skip, skip + pageSize),
      filteredSchools.length,
    ] as const;
  }

  async findById(id: string) {
    // Try cache first
    const cacheKey = `school:detail:${id}`;
    const localCached = this.getLocalCache<
      School & {
        fieldSources: SchoolFieldSources;
        communityRatingSummary: SchoolCommunityRatingSummary;
      }
    >(cacheKey);
    if (localCached) return localCached;

    try {
      const cached = await this.redis.getJSON<
        School & {
          fieldSources: SchoolFieldSources;
          communityRatingSummary: SchoolCommunityRatingSummary;
        }
      >(cacheKey);
      if (cached) {
        this.setLocalCache(cacheKey, cached);
        return cached;
      }
    } catch {
      // Redis is optional; school detail should keep serving from Postgres.
    }

    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        metrics: {
          orderBy: { year: 'desc' },
          take: 5,
        },
        rankings: {
          select: {
            source: true,
            list: true,
            rank: true,
            year: true,
            sourceUrl: true,
          },
          orderBy: [{ year: 'desc' }, { rank: 'asc' }],
        },
        ...schoolPublicMediaInclude,
        cases: {
          where: {
            visibility: 'ANONYMOUS',
          },
          select: {
            id: true,
            year: true,
            round: true,
            result: true,
            gpaRange: true,
            satRange: true,
            tags: true,
            isVerified: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        deadlines: {
          orderBy: { applicationDeadline: 'asc' },
          select: {
            id: true,
            year: true,
            round: true,
            applicationDeadline: true,
            financialAidDeadline: true,
            decisionDate: true,
            notes: true,
            applicationFee: true,
          },
        },
        essayPrompts: {
          where: { status: 'VERIFIED' },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            prompt: true,
            promptZh: true,
            wordLimit: true,
            isRequired: true,
            type: true,
            year: true,
            aiTips: true,
            aiCategory: true,
            changeType: true,
          },
        },
      },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const communityRatingSummary =
      await this.schoolCommunityRatingService.getSummary(id);
    const enriched = this.enrichSchool(school, communityRatingSummary);

    // Cache the result
    this.setLocalCache(cacheKey, enriched);
    try {
      await this.redis.setJSON(cacheKey, enriched, CACHE_TTL.SCHOOL_DETAIL);
    } catch {
      // Cache write failures must not break school detail pages.
    }

    return enriched;
  }

  /**
   * Invalidate school cache when data is updated
   */
  async invalidateSchoolCache(id: string) {
    this.localCache.delete(`school:detail:${id}`);
    this.deleteLocalCacheByPrefix('school:list:');
    this.localCache.delete('schools:available-countries');
    this.localCache.delete('schools:ranking-lists:us-news');
    await this.schoolWriteService.invalidateSchoolCaches(id);
  }

  private getLocalCache<T>(key: string): T | null {
    const entry = this.localCache.get(key) as LocalCacheEntry<T> | undefined;
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.localCache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setLocalCache<T>(
    key: string,
    value: T,
    ttlSeconds = LOCAL_CACHE_TTL_SECONDS,
  ): void {
    if (this.localCache.size >= LOCAL_CACHE_MAX_ENTRIES) {
      const oldestKey = this.localCache.keys().next().value;
      if (oldestKey) this.localCache.delete(oldestKey);
    }
    this.localCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private deleteLocalCacheByPrefix(prefix: string): void {
    for (const key of this.localCache.keys()) {
      if (key.startsWith(prefix)) {
        this.localCache.delete(key);
      }
    }
  }

  private buildListCacheKey(
    pagination: PaginationDto,
    filters?: SchoolFilters,
  ): string {
    const { search: _search, ...cacheableFilters } = filters ?? {};
    const raw = JSON.stringify({ p: pagination, f: cacheableFilters });
    const hash = createHash('md5').update(raw).digest('hex').slice(0, 12);
    return `school:list:${hash}`;
  }

  async create(
    data: Omit<Prisma.SchoolCreateInput, 'nameNorm'>,
  ): Promise<School> {
    try {
      const payload = data as Record<string, unknown>;
      const metadata = toRecord(payload.metadata);

      return await this.schoolWriteService.create({
        fields: Object.fromEntries(
          Object.entries(payload).filter(([key]) => key !== 'metadata'),
        ),
        metadataPatch: metadata,
        provenance: normalizeSchoolProvenance(metadata.provenance),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `School with name "${data.name}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(id: string, data: Prisma.SchoolUpdateInput): Promise<School> {
    const payload = data as Record<string, unknown>;
    const metadata = toRecord(payload.metadata);

    return this.schoolWriteService.update(id, {
      fields: Object.fromEntries(
        Object.entries(payload).filter(([key]) => key !== 'metadata'),
      ),
      metadataPatch: metadata,
      provenance: normalizeSchoolProvenance(metadata.provenance),
    });
  }

  /**
   * 搜索相关性排序
   *
   * 评分规则:
   * - 别名精确匹配 (case-insensitive): 100 分
   * - name/nameZh 以搜索词开头: 80 分
   * - name/nameZh 包含搜索词: 60 分
   * - 排名加权: Top 20 +10 分, Top 50 +5 分
   */
  private sortByRelevance<T extends SchoolWithAliases>(
    schools: T[],
    searchTerm: string,
  ): T[] {
    const scored = schools.map((school) => ({
      school,
      score: this.calculateRelevanceScore(school, searchTerm),
    }));

    scored.sort((a, b) => {
      // 先按相关性分数降序
      if (b.score !== a.score) return b.score - a.score;
      // 分数相同时按排名升序
      return compareSchoolsByCatalogRank(a.school, b.school);
    });

    return scored.map((s) => s.school);
  }

  private calculateRelevanceScore(
    school: SchoolWithAliases,
    searchTerm: string,
  ): number {
    let score = 0;
    const lowerSearch = searchTerm.toLowerCase();
    const _upperSearch = searchTerm.toUpperCase();
    const schoolAliases =
      (school as School & { aliases?: string[] }).aliases || [];

    // 1. 别名精确匹配 (case-insensitive): 100 分
    const aliasMatch = schoolAliases.some(
      (alias) => alias.toLowerCase() === lowerSearch,
    );
    if (aliasMatch) {
      score += 100;
    }

    // 2. name 以搜索词开头: 80 分
    if (school.name.toLowerCase().startsWith(lowerSearch)) {
      score += 80;
    } else if (school.nameZh && school.nameZh.startsWith(searchTerm)) {
      score += 80;
    }

    // 3. name/nameZh 包含搜索词: 60 分
    if (score < 80) {
      // 只在没有 startsWith 匹配时给 contains 分
      if (school.name.toLowerCase().includes(lowerSearch)) {
        score += 60;
      } else if (school.nameZh && school.nameZh.includes(searchTerm)) {
        score += 60;
      }
    }

    // 4. 排名加权
    const ranking = getCatalogRanking(school);
    if (ranking) {
      if (ranking.rank <= 20) {
        score += 10;
      } else if (ranking.rank <= 50) {
        score += 5;
      }
    }

    return score;
  }

  private createEmptyCommunitySummary(): SchoolCommunityRatingSummary {
    return {
      count: 0,
      safetyAvg: null,
      lifeAvg: null,
      foodAvg: null,
      isPublic: false,
    };
  }

  private buildFieldSources<T extends Record<string, unknown>>(
    school: T,
  ): SchoolFieldSources {
    const provenance = buildNormalizedSchoolProvenance(school);

    return Object.fromEntries(
      Object.entries(provenance)
        .filter(([, entry]) => Boolean(entry))
        .map(([field, entry]) => [field, toSchoolFieldSource(entry!)]),
    );
  }

  private enrichSchool<T extends Record<string, any>>(
    school: T,
    communityRatingSummary: SchoolCommunityRatingSummary,
  ): SchoolWithPresentation<T> {
    const { mediaAssets, ...schoolBase } = school;
    const media = buildPublicSchoolMedia(mediaAssets);
    const metadata = {
      ...toRecord(schoolBase.metadata),
      provenance: buildNormalizedSchoolProvenance(schoolBase),
    };
    const fieldSources = this.buildFieldSources({
      ...schoolBase,
      metadata,
    });

    const testingPolicy =
      (
        schoolBase as {
          testingPolicy?: 'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'UNKNOWN' | null;
        }
      ).testingPolicy ?? 'UNKNOWN';
    const nextSchool = {
      ...schoolBase,
      rankings: Array.isArray(schoolBase.rankings)
        ? schoolBase.rankings.map((ranking: any) => ({
            ...ranking,
            source: normalizeRankingSourceForDisplay(ranking.source),
          }))
        : schoolBase.rankings,
      acceptanceRate:
        clampPercentRate(schoolBase.acceptanceRate) ??
        schoolBase.acceptanceRate,
      gpaDistribution: schoolBase.gpaDistribution ?? null,
      programRates: schoolBase.programRates ?? null,
      graduationRate:
        clampPercentRate(schoolBase.graduationRate) ??
        schoolBase.graduationRate,
      testingPolicy,
      testOptional: toLegacyTestOptionalFlag({
        testingPolicy,
        testOptional: schoolBase.testOptional,
      }),
      media,
      metadata,
      fieldSources,
      communityRatingSummary,
    } as unknown as SchoolWithPresentation<T>;
    return nextSchool;
  }

  // For calculating custom rankings
  async findAllWithMetrics(): Promise<School[]> {
    return this.prisma.school.findMany({
      where: {
        usNewsRank: { not: null },
      },
      orderBy: { usNewsRank: 'asc' },
    });
  }

  /**
   * 数据质量报告 — 分析学校库各字段的完整度
   */
  async getDataQualityReport(options?: { bypassCache?: boolean }) {
    const cacheKey = 'school:data-quality';
    if (!options?.bypassCache) {
      const cached = await this.redis.getJSON<any>(cacheKey);
      if (cached) return cached;
    }

    const KEY_FIELDS = [
      'acceptanceRate',
      'tuition',
      'satAvg',
      'actAvg',
      'studentCount',
      'graduationRate',
      'city',
      'website',
      'description',
      'descriptionZh',
      'sat25',
      'sat75',
      'nameZh',
      'state',
      'isPrivate',
      'retentionRate',
      'averageNetPrice',
      'applicationFee',
      'acceptsCommonApp',
      'testingPolicy',
      'testOptional',
      'percentNeedMet',
    ] as const;

    const allSchools = await this.prisma.school.findMany({
      select: {
        id: true,
        name: true,
        nameZh: true,
        usNewsRank: true,
        acceptanceRate: true,
        tuition: true,
        satAvg: true,
        actAvg: true,
        studentCount: true,
        graduationRate: true,
        city: true,
        website: true,
        description: true,
        descriptionZh: true,
        sat25: true,
        sat75: true,
        state: true,
        isPrivate: true,
        retentionRate: true,
        averageNetPrice: true,
        applicationFee: true,
        acceptsCommonApp: true,
        testingPolicy: true,
        testOptional: true,
        percentNeedMet: true,
        totalEnrollment: true,
        metadata: true,
        updatedAt: true,
        scorecardId: true,
        ipedsId: true,
      },
      orderBy: { usNewsRank: 'asc' },
    });

    const tierCounts: Record<TrustTier, number> = {
      OFFICIAL: 0,
      PARTNER: 0,
      SCRAPED: 0,
      SEED: 0,
      COMMUNITY: 0,
      INFERRED: 0,
      UNAVAILABLE: 0,
    };
    const predictionEligibleCoverage: Record<
      string,
      { eligible: number; total: number; percent: number }
    > = {};
    const staleFields: Array<{
      schoolId: string;
      schoolName: string;
      schoolNameZh?: string;
      field: string;
      tier: TrustTier;
      source: string;
      fetchedAt: string;
      staleness: string;
      usNewsRank?: number;
    }> = [];

    // Field coverage stats
    const fieldCoverage: Record<
      string,
      { filled: number; missing: number; percent: number }
    > = {};
    for (const field of KEY_FIELDS) {
      const filled = allSchools.filter(
        (s) => s[field] != null && s[field] !== '',
      ).length;
      const missing = allSchools.length - filled;
      fieldCoverage[field] = {
        filled,
        missing,
        percent:
          allSchools.length > 0
            ? Math.round((filled / allSchools.length) * 1000) / 10
            : 0,
      };
    }

    for (const school of allSchools) {
      const facts = collectPresentSchoolFacts(school);
      const provenance = buildNormalizedSchoolProvenance(school);

      for (const [field, entry] of Object.entries(provenance)) {
        if (!(field in facts) || !entry) continue;

        const fieldSource = toSchoolFieldSource(entry);
        tierCounts[fieldSource.tier]++;

        const coverage = predictionEligibleCoverage[field] ?? {
          eligible: 0,
          total: 0,
          percent: 0,
        };
        coverage.total += 1;
        if (fieldSource.predictionEligible) {
          coverage.eligible += 1;
        }
        predictionEligibleCoverage[field] = coverage;

        if (fieldSource.staleness === 'STALE') {
          staleFields.push({
            schoolId: school.id,
            schoolName: school.name,
            schoolNameZh: school.nameZh ?? undefined,
            field,
            tier: fieldSource.tier,
            source: fieldSource.source,
            fetchedAt: fieldSource.fetchedAt,
            staleness: fieldSource.staleness,
            usNewsRank: school.usNewsRank ?? undefined,
          });
        }
      }
    }

    for (const coverage of Object.values(predictionEligibleCoverage)) {
      coverage.percent =
        coverage.total > 0
          ? Math.round((coverage.eligible / coverage.total) * 1000) / 10
          : 0;
    }

    // Per-school completeness
    const schoolCompleteness = allSchools.map((school) => {
      const missingFields = KEY_FIELDS.filter(
        (f) => school[f] == null || school[f] === '',
      );
      return {
        id: school.id,
        name: school.name,
        nameZh: school.nameZh,
        usNewsRank: school.usNewsRank,
        missingFields: missingFields,
        completeness: Math.round(
          ((KEY_FIELDS.length - missingFields.length) / KEY_FIELDS.length) *
            100,
        ),
      };
    });

    const fullyComplete = schoolCompleteness.filter(
      (s) => s.missingFields.length === 0,
    ).length;
    const criticalFields = ['acceptanceRate', 'tuition', 'satAvg'];
    const missingCritical = allSchools.filter((s) =>
      criticalFields.some((f) => (s as any)[f] == null),
    ).length;

    // Worst schools — sorted by most missing fields, then by rank
    const worstSchools = schoolCompleteness
      .filter((s) => s.missingFields.length > 0)
      .sort((a, b) => {
        if (b.missingFields.length !== a.missingFields.length) {
          return b.missingFields.length - a.missingFields.length;
        }
        return (a.usNewsRank ?? 9999) - (b.usNewsRank ?? 9999);
      })
      .slice(0, 50);

    const top200 = allSchools
      .filter((school) => school.usNewsRank != null)
      .slice(0, 200);
    let top200OfficialCovered = 0;
    const top200Slots = top200.length * 6;

    for (const school of top200) {
      const fieldSources = this.buildFieldSources(school);

      for (const field of PREDICTION_CRITICAL_FIELDS) {
        if (field === 'totalEnrollment' || field === 'studentCount') continue;
        if (fieldSources[field]?.tier === 'OFFICIAL') {
          top200OfficialCovered++;
        }
      }

      if (
        fieldSources.totalEnrollment?.tier === 'OFFICIAL' ||
        fieldSources.studentCount?.tier === 'OFFICIAL'
      ) {
        top200OfficialCovered++;
      }
    }

    const tierTotal = Object.values(tierCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const tierDistribution = Object.fromEntries(
      Object.entries(tierCounts).map(([tier, count]) => [
        tier,
        {
          count,
          percent:
            tierTotal > 0 ? Math.round((count / tierTotal) * 1000) / 10 : 0,
        },
      ]),
    );

    const report = {
      summary: {
        total: allSchools.length,
        fullyComplete,
        missingCritical,
        averageCompleteness:
          allSchools.length > 0
            ? Math.round(
                schoolCompleteness.reduce((sum, s) => sum + s.completeness, 0) /
                  allSchools.length,
              )
            : 0,
      },
      fieldCoverage,
      tierDistribution,
      predictionEligibleCoverage,
      top200OfficialCoverage: {
        schools: top200.length,
        covered: top200OfficialCovered,
        totalSlots: top200Slots,
        percent:
          top200Slots > 0
            ? Math.round((top200OfficialCovered / top200Slots) * 1000) / 10
            : 0,
        threshold: 90,
      },
      staleFields: staleFields
        .sort((a, b) => {
          const rankDelta = (a.usNewsRank ?? 9999) - (b.usNewsRank ?? 9999);
          if (rankDelta !== 0) return rankDelta;
          return a.fetchedAt.localeCompare(b.fetchedAt);
        })
        .slice(0, 100),
      worstSchools,
    };

    // Cache for 1 hour
    await this.redis.setJSON(cacheKey, report, 3600);

    return report;
  }

  /**
   * Return school IDs for the 9 UC campuses (for one-click UC prediction).
   */
  async getUcSchoolIds(): Promise<string[]> {
    const cacheKey = 'schools:uc-ids';
    try {
      const cached = await this.redis.getJSON<string[]>(cacheKey);
      if (cached?.length) return cached;
    } catch {
      // Redis is optional for this helper.
    }

    const schools = await this.prisma.school.findMany({
      where: { name: { in: UC_SCHOOL_NAMES } },
      select: { id: true },
      orderBy: { usNewsRank: 'asc' },
    });
    const ids = schools.map((s) => s.id);
    try {
      await this.redis.setJSON(cacheKey, ids, 86400); // 24h
    } catch {
      // Cache write failures must not break UC prediction setup.
    }
    return ids;
  }

  /**
   * Returns countries with at least one school in the database,
   * sorted by school count descending. Used by the frontend filter to
   * only show countries that actually have data — preventing the UX bug
   * where users select "UK" and get zero results.
   */
  async getAvailableCountries(): Promise<
    Array<{ code: string; count: number }>
  > {
    const cacheKey = 'schools:available-countries';
    const localCached =
      this.getLocalCache<Array<{ code: string; count: number }>>(cacheKey);
    if (localCached?.length) return localCached;

    try {
      const cached =
        await this.redis.getJSON<Array<{ code: string; count: number }>>(
          cacheKey,
        );
      if (cached?.length) {
        this.setLocalCache(cacheKey, cached);
        return cached;
      }
    } catch {
      // Redis is optional; this endpoint must keep serving from Postgres.
    }

    const grouped = await this.prisma.school.groupBy({
      by: ['country'],
      _count: { _all: true },
      orderBy: { _count: { country: 'desc' } },
    });

    const result = grouped.map((g) => ({
      code: g.country,
      count: g._count._all,
    }));

    // Cache for 5 minutes — school additions happen infrequently
    this.setLocalCache(cacheKey, result);
    try {
      await this.redis.setJSON(cacheKey, result, 300);
    } catch {
      // Cache write failures must not turn the filter endpoint into a 500.
    }
    return result;
  }

  async getAvailableRankingLists(): Promise<
    Array<{
      source: typeof US_NEWS_RANKING_SOURCE;
      list: RankingListSelection;
      labelKey: string;
      year: number | null;
      count: number;
      verifiedCount: number;
      fallbackCount: number;
      isDefault: boolean;
    }>
  > {
    const cacheKey = 'schools:ranking-lists:us-news';
    const localCached = this.getLocalCache<
      Array<{
        source: typeof US_NEWS_RANKING_SOURCE;
        list: RankingListSelection;
        labelKey: string;
        year: number | null;
        count: number;
        verifiedCount: number;
        fallbackCount: number;
        isDefault: boolean;
      }>
    >(cacheKey);
    if (localCached?.length) return localCached;

    try {
      const cached = await this.redis.getJSON<
        Array<{
          source: typeof US_NEWS_RANKING_SOURCE;
          list: RankingListSelection;
          labelKey: string;
          year: number | null;
          count: number;
          verifiedCount: number;
          fallbackCount: number;
          isDefault: boolean;
        }>
      >(cacheKey);
      if (cached?.length) {
        this.setLocalCache(cacheKey, cached);
        return cached;
      }
    } catch {
      // Redis is optional for ranking metadata.
    }

    const schoolsForRanking = await this.prisma.school.findMany({
      where: {
        OR: [
          { usNewsRank: { not: null } },
          {
            rankings: {
              some: {
                source: US_NEWS_RANKING_SOURCE,
                list: { in: Array.from(CATALOG_RANKING_LISTS) },
              },
            },
          },
        ],
      },
      select: {
        name: true,
        institutionType: true,
        usNewsRank: true,
        rankings: {
          select: {
            source: true,
            list: true,
            rank: true,
            year: true,
            sourceUrl: true,
          },
        },
      },
    });

    const getStats = (list: RankingListSelection) => {
      let verifiedCount = 0;
      let fallbackCount = 0;
      let year: number | null = null;

      for (const school of schoolsForRanking) {
        const ranking = getCatalogRanking(school, list);
        if (!ranking) continue;
        if (ranking.confidence === 'fallback') {
          fallbackCount += 1;
        } else {
          verifiedCount += 1;
        }
        if (ranking.year && (year === null || ranking.year > year)) {
          year = ranking.year;
        }
      }
      return {
        year,
        verifiedCount,
        fallbackCount,
        count: verifiedCount + fallbackCount,
      };
    };

    const coreStats = getStats(US_NEWS_CORE_RANKING_LIST);

    const result: Array<{
      source: typeof US_NEWS_RANKING_SOURCE;
      list: RankingListSelection;
      labelKey: string;
      year: number | null;
      count: number;
      verifiedCount: number;
      fallbackCount: number;
      isDefault: boolean;
    }> = [
      {
        source: US_NEWS_RANKING_SOURCE,
        list: US_NEWS_CORE_RANKING_LIST,
        labelKey: RANKING_LIST_LABEL_KEYS[US_NEWS_CORE_RANKING_LIST],
        year: coreStats.year,
        count: coreStats.count,
        verifiedCount: coreStats.verifiedCount,
        fallbackCount: coreStats.fallbackCount,
        isDefault: true,
      },
      ...CATALOG_RANKING_LISTS.map((list) => {
        const data = getStats(list);
        return {
          source: US_NEWS_RANKING_SOURCE,
          list,
          labelKey: RANKING_LIST_LABEL_KEYS[list],
          year: data?.year ?? null,
          count: data?.count ?? 0,
          verifiedCount: data?.verifiedCount ?? 0,
          fallbackCount: data?.fallbackCount ?? 0,
          isDefault: false,
        };
      }).filter((option) => option.count > 0),
    ];

    try {
      this.setLocalCache(cacheKey, result);
      await this.redis.setJSON(cacheKey, result, 300);
    } catch {
      // Cache write failures must not break ranking selector metadata.
    }

    return result;
  }
}
