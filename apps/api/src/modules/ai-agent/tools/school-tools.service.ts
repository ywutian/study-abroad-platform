/**
 * School Tools Service
 *
 * Tools: SEARCH_SCHOOLS, GET_SCHOOL_DETAILS, COMPARE_SCHOOLS
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
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
    return new Map([
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

    return {
      count: sortedSchools.length,
      schools: sortedSchools.map((s) => ({
        id: s.id,
        name: s.name,
        nameZh: s.nameZh,
        state: s.state,
        rank: s.usNewsRank,
        acceptanceRate: s.acceptanceRate
          ? `${Number(s.acceptanceRate).toFixed(1)}%`
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
      acceptanceRate: fullSchool.acceptanceRate
        ? `${Number(fullSchool.acceptanceRate).toFixed(1)}%`
        : 'N/A',
      tuition: fullSchool.tuition
        ? `$${fullSchool.tuition.toLocaleString()}`
        : 'N/A',
      avgSalary: fullSchool.avgSalary
        ? `$${fullSchool.avgSalary.toLocaleString()}`
        : 'N/A',
      deadlines: metadata.deadlines || {},
      essayPrompts: metadata.essayPrompts || [],
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
        acceptanceRate: s.acceptanceRate
          ? Number(s.acceptanceRate).toFixed(1) + '%'
          : 'N/A',
        tuition: s.tuition ? `$${s.tuition.toLocaleString()}` : 'N/A',
        avgSalary: s.avgSalary ? `$${s.avgSalary.toLocaleString()}` : 'N/A',
        state: s.state,
      })),
    };
  }
}
