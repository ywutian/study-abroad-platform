/**
 * School Tools Service
 *
 * Tools: SEARCH_SCHOOLS, GET_SCHOOL_DETAILS, COMPARE_SCHOOLS
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { clampPercentRate } from '../../../common/utils/percent.util';
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
        rank: s.usNewsRank,
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
    });

    if (!fullSchool) {
      return { error: locale === 'zh' ? '未找到该学校' : 'School not found' };
    }

    const metadata = (fullSchool.metadata as any) || {};

    return {
      id: fullSchool.id,
      name: fullSchool.name,
      nameZh: fullSchool.nameZh,
      state: fullSchool.state,
      rank: fullSchool.usNewsRank,
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
      testOptional: (fullSchool as any).testOptional ?? null,
      acceptsCommonApp: (fullSchool as any).acceptsCommonApp ?? null,
      hasEarlyDecision: (fullSchool as any).hasEarlyDecision ?? null,
      salary6YrPostGrad:
        (fullSchool as any).salary6YrPostGrad != null
          ? `$${(fullSchool as any).salary6YrPostGrad.toLocaleString()}`
          : 'N/A',
      deadlines: metadata.deadlines || {},
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
    });

    return {
      comparison: schools.map((s) => ({
        name: s.name,
        rank: s.usNewsRank,
        acceptanceRate:
          clampPercentRate(s.acceptanceRate) != null
            ? `${clampPercentRate(s.acceptanceRate)}%`
            : 'N/A',
        tuition: s.tuition ? `$${s.tuition.toLocaleString()}` : 'N/A',
        avgSalary: s.avgSalary ? `$${s.avgSalary.toLocaleString()}` : 'N/A',
        state: s.state,
        testOptional: (s as any).testOptional ?? null,
        retentionRate:
          (s as any).retentionRate != null
            ? `${(s as any).retentionRate}%`
            : 'N/A',
      })),
    };
  }
}
