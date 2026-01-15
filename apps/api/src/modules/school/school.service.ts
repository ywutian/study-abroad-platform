import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { School, Prisma } from '@prisma/client';
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';

// Cache TTL in seconds
const CACHE_TTL = {
  SCHOOL_DETAIL: 3600, // 1 hour for individual school
  SCHOOL_LIST: 300, // 5 minutes for lists
  SCHOOL_METRICS: 86400, // 24 hours for metrics (rarely change)
};

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
  ) {}

  async findAll(
    pagination: PaginationDto,
    filters?: SchoolFilters,
  ): Promise<PaginatedResponseDto<School>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SchoolWhereInput = {};

    // 基础筛选
    if (filters?.country) {
      where.country = filters.country;
    }

    if (filters?.search) {
      const searchTerm = filters.search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { nameZh: { contains: searchTerm, mode: 'insensitive' } },
        { aliases: { has: searchTerm } }, // 精确别名匹配 (case-sensitive)
        {
          aliases: {
            hasSome: [
              searchTerm,
              searchTerm.toUpperCase(),
              searchTerm.toLowerCase(),
            ],
          },
        }, // 别名大小写容错
      ];
    }

    // 地理位置筛选
    if (filters?.state) {
      where.state = filters.state;
    }

    if (filters?.region && REGION_TO_STATES[filters.region]) {
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

    // TODO: 以下字段需在 Prisma Schema 添加后启用
    // if (filters?.testOptional) {
    //   where.testOptional = true;
    // }
    // if (filters?.needBlind) {
    //   where.needBlind = true;
    // }
    // if (filters?.hasEarlyDecision) {
    //   where.hasEarlyDecision = true;
    // }

    const [schools, total] = await Promise.all([
      this.prisma.school.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { usNewsRank: 'asc' },
      }),
      this.prisma.school.count({ where }),
    ]);

    // 当存在搜索词时，按相关性重新排序
    if (filters?.search) {
      const searchTerm = filters.search.trim();
      const sorted = this.sortByRelevance(schools, searchTerm);
      return createPaginatedResponse(sorted, total, page, pageSize);
    }

    return createPaginatedResponse(schools, total, page, pageSize);
  }

  async findById(id: string) {
    // Try cache first
    const cacheKey = `school:detail:${id}`;
    const cached = await this.redis.getJSON<School>(cacheKey);
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
      },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Cache the result
    await this.redis.setJSON(cacheKey, school, CACHE_TTL.SCHOOL_DETAIL);

    return school;
  }

  /**
   * Invalidate school cache when data is updated
   */
  async invalidateSchoolCache(id: string) {
    await this.redis.del(`school:detail:${id}`);
  }

  async create(data: Prisma.SchoolCreateInput): Promise<School> {
    return this.prisma.school.create({ data });
  }

  async update(id: string, data: Prisma.SchoolUpdateInput): Promise<School> {
    return this.prisma.school.update({
      where: { id },
      data,
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
  private sortByRelevance(schools: School[], searchTerm: string): School[] {
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

  private calculateRelevanceScore(school: School, searchTerm: string): number {
    let score = 0;
    const lowerSearch = searchTerm.toLowerCase();
    const upperSearch = searchTerm.toUpperCase();
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

  // For calculating custom rankings
  async findAllWithMetrics(): Promise<School[]> {
    return this.prisma.school.findMany({
      where: {
        usNewsRank: { not: null },
      },
      orderBy: { usNewsRank: 'asc' },
    });
  }
}
