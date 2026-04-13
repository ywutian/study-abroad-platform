import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type {
  FieldProvenance,
  SchoolCommunityRatingSummary,
  SchoolFieldSources,
} from '@study-abroad/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { School, Prisma } from '@prisma/client';
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import { normalizeSchoolName } from '../../common/utils/school-name.util';
import { clampPercentRate } from '../../common/utils/percent.util';
import { createHash } from 'crypto';
import { SchoolCommunityRatingService } from './school-community-rating.service';
import { VERIFIED_SCHOOL_DATA_SOURCES } from './school-data-merger';

// Cache TTL in seconds
const CACHE_TTL = {
  SCHOOL_DETAIL: 3600, // 1 hour for individual school
  SCHOOL_LIST: 300, // 5 minutes for lists
  SCHOOL_METRICS: 86400, // 24 hours for metrics (rarely change)
};

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

type SchoolWithAliases = Pick<School, 'name' | 'nameZh' | 'usNewsRank'> & {
  aliases?: string[];
};

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseProvenance(metadata: unknown): Record<string, FieldProvenance> {
  const raw = toRecord(toRecord(metadata).provenance);
  const provenance: Record<string, FieldProvenance> = {};

  for (const [field, value] of Object.entries(raw)) {
    const entry = toRecord(value);
    if (typeof entry.source === 'string' && typeof entry.at === 'string') {
      provenance[field] = {
        source: entry.source,
        at: entry.at,
      };
    }
  }

  return provenance;
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
  schoolType?: 'public' | 'private';
  testOptional?: boolean;
  needBlind?: boolean;
  hasEarlyDecision?: boolean;
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
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private schoolCommunityRatingService: SchoolCommunityRatingService,
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
      const cached = await this.redis.getJSON<
        PaginatedResponseDto<
          School & {
            fieldSources: SchoolFieldSources;
            communityRatingSummary: SchoolCommunityRatingSummary;
          }
        >
      >(cacheKey);
      if (cached) return cached;
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

    // 排名范围
    if (filters?.rankMin !== undefined || filters?.rankMax !== undefined) {
      where.usNewsRank = {};
      if (filters.rankMin !== undefined) {
        where.usNewsRank.gte = filters.rankMin;
      }
      if (filters.rankMax !== undefined) {
        where.usNewsRank.lte = filters.rankMax;
      }
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

    // 学校类型 (使用 isPrivate 字段)
    if (filters?.schoolType) {
      where.isPrivate = filters.schoolType === 'private';
    }

    if (filters?.testOptional) {
      where.testOptional = true;
    }
    if (filters?.needBlind) {
      where.needBlindInternational = true;
    }
    if (filters?.hasEarlyDecision) {
      where.hasEarlyDecision = true;
    }

    const [schools, total] = await Promise.all([
      this.prisma.school.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { usNewsRank: 'asc' },
        include: {
          rankings: {
            select: { source: true, list: true, rank: true, year: true },
          },
        },
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

    if (isSearch) {
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
    const cacheKey = this.buildListCacheKey(pagination, filters);
    await this.redis.setJSON(cacheKey, result, CACHE_TTL.SCHOOL_LIST);

    return result;
  }

  async findById(id: string) {
    // Try cache first
    const cacheKey = `school:detail:${id}`;
    const cached = await this.redis.getJSON<
      School & {
        fieldSources: SchoolFieldSources;
        communityRatingSummary: SchoolCommunityRatingSummary;
      }
    >(cacheKey);
    if (cached) {
      return cached;
    }

    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        metrics: {
          orderBy: { year: 'desc' },
          take: 5,
        },
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
    await this.redis.setJSON(cacheKey, enriched, CACHE_TTL.SCHOOL_DETAIL);

    return enriched;
  }

  /**
   * Invalidate school cache when data is updated
   */
  async invalidateSchoolCache(id: string) {
    await Promise.all([
      this.redis.del(`school:detail:${id}`),
      this.redis.delByPrefix('school:list:'),
    ]);
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
      return await this.prisma.school.create({
        data: {
          ...data,
          nameNorm: normalizeSchoolName(data.name),
        },
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
    const nextData = { ...data };

    if (typeof nextData.name === 'string') {
      nextData.nameNorm = normalizeSchoolName(nextData.name);
    }

    return this.prisma.school.update({
      where: { id },
      data: nextData,
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
      const rankA = a.school.usNewsRank ?? 9999;
      const rankB = b.school.usNewsRank ?? 9999;
      return rankA - rankB;
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
    if (school.usNewsRank) {
      if (school.usNewsRank <= 20) {
        score += 10;
      } else if (school.usNewsRank <= 50) {
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

  private buildFieldSources(metadata: unknown): SchoolFieldSources {
    const provenance = parseProvenance(metadata);

    return Object.fromEntries(
      Object.entries(provenance).map(([field, entry]) => [
        field,
        {
          tier: VERIFIED_SCHOOL_DATA_SOURCES.has(entry.source as any)
            ? 'verified'
            : 'supplemental',
          source: entry.source,
          updatedAt: entry.at,
        },
      ]),
    );
  }

  private enrichSchool<T extends Record<string, any>>(
    school: T,
    communityRatingSummary: SchoolCommunityRatingSummary,
  ): SchoolWithPresentation<T> {
    const fieldSources = this.buildFieldSources(school.metadata);
    const nextSchool = {
      ...school,
      acceptanceRate:
        clampPercentRate(school.acceptanceRate) ?? school.acceptanceRate,
      graduationRate:
        clampPercentRate(school.graduationRate) ?? school.graduationRate,
      fieldSources,
      communityRatingSummary,
    } as SchoolWithPresentation<T>;
    const sanitizedSchool = {
      ...nextSchool,
    } as Record<string, unknown>;

    for (const field of [
      'nicheSafetyGrade',
      'nicheLifeGrade',
      'nicheFoodGrade',
      'nicheOverallGrade',
    ] as const) {
      if (!fieldSources[field]) {
        sanitizedSchool[field] = null;
      }
    }

    return sanitizedSchool as SchoolWithPresentation<T>;
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
  async getDataQualityReport() {
    const cacheKey = 'school:data-quality';
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) return cached;

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
        testOptional: true,
        percentNeedMet: true,
      },
      orderBy: { usNewsRank: 'asc' },
    });

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
        missingFields: missingFields as string[],
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
    const cached = await this.redis.getJSON<string[]>(cacheKey);
    if (cached?.length) return cached;

    const schools = await this.prisma.school.findMany({
      where: { name: { in: UC_SCHOOL_NAMES } },
      select: { id: true },
      orderBy: { usNewsRank: 'asc' },
    });
    const ids = schools.map((s) => s.id);
    await this.redis.setJSON(cacheKey, ids, 86400); // 24h
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
    const cached =
      await this.redis.getJSON<Array<{ code: string; count: number }>>(
        cacheKey,
      );
    if (cached?.length) return cached;

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
    await this.redis.setJSON(cacheKey, result, 300);
    return result;
  }
}
