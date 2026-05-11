/**
 * School Tools Service
 *
 * Tools: SEARCH_SCHOOLS, GET_SCHOOL_DETAILS, COMPARE_SCHOOLS
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  resolveSchoolTestingPolicyValue,
  toLegacyTestOptionalFlag,
} from '@study-abroad/shared/utils';
import { PrismaService } from '../../../prisma/prisma.service';
import { clampPercentRate } from '../../../common/utils/percent.util';
import {
  getCatalogRanking,
  type CatalogRanking,
} from '../../school/school-ranking-catalog';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class SchoolToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(SchoolToolsService.name);

  constructor(
    private prisma: PrismaService,
    private schoolLookup: SchoolLookupHelper,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map<string, ToolHandler>([
      ['search_schools', (args) => this.searchSchools(args)],
      [
        'get_school_details',
        (args, _userId, _ctx, locale) =>
          this.getSchoolDetails(args.schoolId, args.schoolName, locale),
      ],
      [
        'compare_schools',
        (args, _userId, _ctx, locale) =>
          this.compareSchools(args.schoolIds?.split(','), args.aspects, locale),
      ],
    ]);
  }

  async searchSchools(args: {
    query?: string;
    rankRange?: string;
    maxTuition?: number;
    state?: string;
    rankingList?: string;
  }) {
    const schools = await this.schoolLookup.searchSchools(args);

    const sortedSchools = args.query
      ? this.schoolLookup.sortByRelevance(schools, args.query.trim())
      : schools;

    if (sortedSchools.length === 0) {
      return {
        count: 0,
        schools: [],
        message:
          'No schools matched the search criteria. Try adjusting filters such as rank range, state, or tuition.',
      };
    }

    return {
      count: sortedSchools.length,
      schools: sortedSchools.map((s) => ({
        id: s.id,
        name: s.name,
        nameZh: s.nameZh,
        state: s.state,
        rank: s.displayRanking?.rank ?? null,
        ranking: s.displayRanking ?? null,
        rankLabel: this.formatRankingLabel(s.displayRanking, 'en'),
        acceptanceRate:
          clampPercentRate(s.acceptanceRate) != null
            ? `${clampPercentRate(s.acceptanceRate)}%`
            : 'N/A',
        tuition: s.tuition ? `$${s.tuition.toLocaleString()}` : 'N/A',
      })),
    };
  }

  async getSchoolDetails(
    schoolId?: string,
    schoolName?: string,
    locale = 'zh',
  ) {
    const school = await this.schoolLookup.findSchool(schoolId, schoolName);

    if (!school) {
      return { error: locale === 'zh' ? '未找到该学校' : 'School not found' };
    }

    // Fetch full school data
    const fullSchool = await this.prisma.school.findUnique({
      where: { id: school.id },
      include: {
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

    if (!fullSchool) {
      return { error: locale === 'zh' ? '未找到该学校' : 'School not found' };
    }

    const metadata = (fullSchool.metadata as any) || {};
    const testingPolicy = resolveSchoolTestingPolicyValue({
      testingPolicy: (fullSchool as any).testingPolicy,
      testOptional: (fullSchool as any).testOptional,
    });
    const ranking = getCatalogRanking(
      {
        name: fullSchool.name,
        institutionType: (fullSchool as any).institutionType,
        usNewsRank: fullSchool.usNewsRank,
        rankings: fullSchool.rankings,
      },
      'US_NEWS_CORE',
    );

    return {
      id: fullSchool.id,
      name: fullSchool.name,
      nameZh: fullSchool.nameZh,
      state: fullSchool.state,
      rank: ranking?.rank ?? null,
      ranking,
      rankLabel: this.formatRankingLabel(ranking, locale),
      acceptanceRate:
        clampPercentRate(fullSchool.acceptanceRate) != null
          ? `${clampPercentRate(fullSchool.acceptanceRate)}%`
          : 'N/A',
      tuition: fullSchool.tuition
        ? `$${fullSchool.tuition.toLocaleString()}`
        : 'N/A',
      avgSalary: fullSchool.avgSalary
        ? `$${fullSchool.avgSalary.toLocaleString()}`
        : 'N/A',
      retentionRate:
        (fullSchool as any).retentionRate != null
          ? `${(fullSchool as any).retentionRate}%`
          : 'N/A',
      testingPolicy,
      testOptional:
        toLegacyTestOptionalFlag({
          testingPolicy,
          testOptional: (fullSchool as any).testOptional,
        }) ?? null,
      acceptsCommonApp: (fullSchool as any).acceptsCommonApp ?? null,
      hasEarlyDecision: (fullSchool as any).hasEarlyDecision ?? null,
      salary6YrPostGrad:
        (fullSchool as any).salary6YrPostGrad != null
          ? `$${(fullSchool as any).salary6YrPostGrad.toLocaleString()}`
          : 'N/A',
      deadlines: this.annotateDeadlines(metadata.deadlines || {}),
      essayPrompts: await this.prisma.essayPrompt.findMany({
        where: { schoolId: fullSchool.id, isActive: true, status: 'VERIFIED' },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          prompt: true,
          promptZh: true,
          type: true,
          wordLimit: true,
          isRequired: true,
          aiTips: true,
          year: true,
        },
      }),
      requirements: metadata.requirements || {},
    };
  }

  async compareSchools(schoolIds: string[], _aspects?: string, locale = 'zh') {
    if (!schoolIds?.length) {
      return {
        error:
          locale === 'zh'
            ? '请提供要对比的学校ID'
            : 'Please provide school IDs to compare',
      };
    }

    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      include: {
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

    return {
      comparison: schools.map((s) => {
        const testingPolicy = resolveSchoolTestingPolicyValue({
          testingPolicy: (s as any).testingPolicy,
          testOptional: (s as any).testOptional,
        });
        const ranking = getCatalogRanking(
          {
            name: s.name,
            institutionType: (s as any).institutionType,
            usNewsRank: s.usNewsRank,
            rankings: s.rankings,
          },
          'US_NEWS_CORE',
        );
        return {
          testingPolicy,
          name: s.name,
          rank: ranking?.rank ?? null,
          ranking,
          rankLabel: this.formatRankingLabel(ranking, locale),
          acceptanceRate:
            clampPercentRate(s.acceptanceRate) != null
              ? `${clampPercentRate(s.acceptanceRate)}%`
              : 'N/A',
          tuition: s.tuition ? `$${s.tuition.toLocaleString()}` : 'N/A',
          avgSalary: s.avgSalary ? `$${s.avgSalary.toLocaleString()}` : 'N/A',
          state: s.state,
          testOptional:
            toLegacyTestOptionalFlag({
              testingPolicy,
              testOptional: (s as any).testOptional,
            }) ?? null,
          retentionRate:
            (s as any).retentionRate != null
              ? `${(s as any).retentionRate}%`
              : 'N/A',
        };
      }),
    };
  }

  private formatRankingLabel(
    ranking: CatalogRanking | null | undefined,
    locale: string,
  ): string | null {
    if (!ranking) return null;
    const fallback =
      ranking.confidence === 'fallback'
        ? locale === 'zh'
          ? '（回退数据）'
          : ' (fallback)'
        : '';
    return `US News ${ranking.list} #${ranking.rank}${fallback}`;
  }

  /** Annotate each deadline with status relative to current date. */
  private annotateDeadlines(
    deadlines: Record<string, unknown>,
  ): Record<string, { date: string; status: string; daysUntil: number }> {
    const now = new Date();
    const result: Record<
      string,
      { date: string; status: string; daysUntil: number }
    > = {};

    for (const [type, dateStr] of Object.entries(deadlines)) {
      if (typeof dateStr !== 'string') continue;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;

      const daysUntil = Math.ceil((date.getTime() - now.getTime()) / 86400000);
      result[type] = {
        date: dateStr,
        status:
          daysUntil < 0 ? 'passed' : daysUntil <= 7 ? 'closing_soon' : 'open',
        daysUntil,
      };
    }

    return result;
  }
}
