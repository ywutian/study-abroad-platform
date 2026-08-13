import { resolveApplicationYear } from '@study-abroad/shared';
/**
 * School Tools Service
 *
 * Tools: SEARCH_SCHOOLS, GET_SCHOOL_DETAILS, COMPARE_SCHOOLS
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  EssayStatus,
  SchoolMediaStatus,
  SchoolMediaType,
} from '@prisma/client';
import type { SchoolFieldSource } from '@study-abroad/shared';
import {
  normalizeSchoolProvenance,
  resolveSchoolTestingPolicyValue,
  toSchoolFieldSource,
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

const SOURCE_BACKED_VERIFIED_PROMPT_WHERE = {
  isActive: true,
  status: EssayStatus.VERIFIED,
  sources: { some: { sourceUrl: { not: null } } },
};

type PromptSourceSummaryInput = {
  sourceType?: string | null;
  sourceUrl?: string | null;
  scrapedAt?: Date | string | null;
  confidence?: number | null;
};

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
          this.compareSchools(
            args.schoolIds?.split(',') ?? [],
            args.aspects,
            locale,
          ),
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
        acceptanceRate: this.formatSourcedPercentFact(s, 'acceptanceRate'),
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
    // governance: system-scope — School is published institution data (name/aliases/rank/tuition) with no User or Profile relation; keyed by a school id or name from the tool args
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
        mediaAssets: {
          where: {
            type: SchoolMediaType.CAMPUS_COVER,
            status: SchoolMediaStatus.APPROVED,
            isPrimary: true,
          },
          take: 1,
          select: {
            storageUrl: true,
            originalUrl: true,
            sourcePageUrl: true,
            sourceType: true,
            license: true,
            attribution: true,
            width: true,
            height: true,
          },
        },
        programs: {
          orderBy: [{ competitiveness: 'desc' }, { programName: 'asc' }],
          take: 8,
          select: {
            cipCode: true,
            programName: true,
            programNameZh: true,
            competitiveness: true,
            acceptanceRateEstimate: true,
            medianEarnings: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!fullSchool) {
      return { error: locale === 'zh' ? '未找到该学校' : 'School not found' };
    }

    const metadata = (fullSchool.metadata as any) || {};
    const applicationYear = this.getCurrentApplicationYear();
    // governance: system-scope — SchoolDeadline holds scraped application deadlines keyed by schoolId + year, no User relation
    const sourcedDeadlines = await this.prisma.schoolDeadline.findMany({
      where: {
        schoolId: fullSchool.id,
        year: applicationYear,
        source: { not: 'MANUAL' },
        notes: { contains: 'source:' },
      },
      orderBy: { applicationDeadline: 'asc' },
      select: {
        round: true,
        year: true,
        applicationDeadline: true,
        financialAidDeadline: true,
        decisionDate: true,
        source: true,
        notes: true,
      },
    });
    const testingPolicy = resolveSchoolTestingPolicyValue({
      testingPolicy: fullSchool.testingPolicy,
      testOptional: fullSchool.testOptional,
    });
    const ranking = getCatalogRanking(
      {
        name: fullSchool.name,
        institutionType: fullSchool.institutionType,
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
      acceptanceRate: this.formatSourcedPercentFact(
        fullSchool,
        'acceptanceRate',
      ),
      tuition: fullSchool.tuition
        ? `$${fullSchool.tuition.toLocaleString()}`
        : 'N/A',
      avgSalary: fullSchool.avgSalary
        ? `$${fullSchool.avgSalary.toLocaleString()}`
        : 'N/A',
      retentionRate: this.formatSourcedPercentFact(fullSchool, 'retentionRate'),
      testingPolicy,
      testingPolicySource: this.getExplicitFieldSource(
        fullSchool,
        'testingPolicy',
      ),
      testOptional:
        toLegacyTestOptionalFlag({
          testingPolicy,
          testOptional: fullSchool.testOptional,
        }) ?? null,
      campusCover: this.buildCampusCoverSummary(fullSchool.mediaAssets ?? []),
      programRates: this.buildProgramRatesSummary(
        fullSchool.programs ?? [],
        fullSchool,
      ),
      acceptsCommonApp: fullSchool.acceptsCommonApp ?? null,
      hasEarlyDecision: fullSchool.hasEarlyDecision ?? null,
      salary6YrPostGrad:
        fullSchool.salary6YrPostGrad != null
          ? `$${fullSchool.salary6YrPostGrad.toLocaleString()}`
          : 'N/A',
      deadlines: this.annotateSourcedDeadlines(sourcedDeadlines),
      deadlineSourcePolicy:
        sourcedDeadlines.length > 0
          ? 'source_backed_structured_deadlines'
          : 'no_source_backed_current_year_deadlines',
      essayPrompts: await this.prisma.essayPrompt
        .findMany({
          where: {
            schoolId: fullSchool.id,
            ...SOURCE_BACKED_VERIFIED_PROMPT_WHERE,
          },
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
            sources: {
              select: {
                sourceType: true,
                sourceUrl: true,
                scrapedAt: true,
                confidence: true,
              },
            },
          },
        })
        .then((prompts) =>
          prompts.map(({ sources, ...prompt }) => ({
            ...prompt,
            sourceSummary: this.buildSourceSummary(sources ?? []),
          })),
        ),
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

    // governance: system-scope — School is published institution data (name/aliases/rank/tuition) with no User or Profile relation; keyed by a school id or name from the tool args
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
          testingPolicy: s.testingPolicy,
          testOptional: s.testOptional,
        });
        const ranking = getCatalogRanking(
          {
            name: s.name,
            institutionType: s.institutionType,
            usNewsRank: s.usNewsRank,
            rankings: s.rankings,
          },
          'US_NEWS_CORE',
        );
        return {
          testingPolicy,
          testingPolicySource: this.getExplicitFieldSource(s, 'testingPolicy'),
          name: s.name,
          rank: ranking?.rank ?? null,
          ranking,
          rankLabel: this.formatRankingLabel(ranking, locale),
          acceptanceRate: this.formatSourcedPercentFact(s, 'acceptanceRate'),
          tuition: s.tuition ? `$${s.tuition.toLocaleString()}` : 'N/A',
          avgSalary: s.avgSalary ? `$${s.avgSalary.toLocaleString()}` : 'N/A',
          state: s.state,
          testOptional:
            toLegacyTestOptionalFlag({
              testingPolicy,
              testOptional: s.testOptional,
            }) ?? null,
          retentionRate: this.formatSourcedPercentFact(s, 'retentionRate'),
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

  private getExplicitFieldSource(
    school: Record<string, any>,
    field: string,
  ): SchoolFieldSource | null {
    const provenance = normalizeSchoolProvenance(
      (school.metadata as Record<string, any> | null | undefined)?.provenance,
    );
    const entry = provenance[field];
    return entry ? toSchoolFieldSource(entry) : null;
  }

  private formatSourcedPercentFact(school: Record<string, any>, field: string) {
    const source = this.getExplicitFieldSource(school, field);
    const value = source ? clampPercentRate(school[field]) : null;
    return {
      value: typeof value === 'number' ? value : null,
      displayValue: typeof value === 'number' ? `${value}%` : 'N/A',
      source,
      consumerPolicy: source
        ? 'use_with_field_source'
        : 'hidden_until_field_provenance_exists',
    };
  }

  private buildCampusCoverSummary(
    mediaAssets: Array<Record<string, any>>,
  ): Record<string, unknown> {
    const asset = mediaAssets[0];
    if (!asset) {
      return {
        url: null,
        sourceType: null,
        sourceUrl: null,
        sourceQuality: 'unknown',
        consumerPolicy: 'hidden_until_approved_media_source_exists',
      };
    }

    const sourceUrl = asset.sourcePageUrl ?? asset.originalUrl ?? null;
    return {
      url: asset.storageUrl ?? asset.originalUrl ?? null,
      sourceType: asset.sourceType ?? null,
      sourceUrl,
      sourceQuality: sourceUrl ? 'approved_media_source' : 'approved_media',
      license: asset.license ?? null,
      attribution: asset.attribution ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      consumerPolicy: sourceUrl
        ? 'use_with_media_source_provenance'
        : 'show_media_with_source_review_label',
    };
  }

  private buildProgramRatesSummary(
    programs: Array<Record<string, any>>,
    school: Record<string, any>,
  ): Record<string, unknown> {
    const source = this.getExplicitFieldSource(school, 'programRates');
    return {
      programs: programs.map((program) => ({
        cipCode: program.cipCode,
        programName: program.programName,
        programNameZh: program.programNameZh ?? null,
        competitiveness: program.competitiveness,
        acceptanceRateEstimate:
          program.acceptanceRateEstimate == null
            ? null
            : Number(program.acceptanceRateEstimate),
        medianEarnings: program.medianEarnings ?? null,
        updatedAt:
          program.updatedAt instanceof Date
            ? program.updatedAt.toISOString()
            : String(program.updatedAt),
      })),
      source,
      sourceQuality: source ? 'field_provenance_present' : 'unknown',
      consumerPolicy: source
        ? 'use_with_program_rate_provenance'
        : 'review_program_rate_estimates_before_advice',
    };
  }

  private getCurrentApplicationYear(now = new Date()) {
    return resolveApplicationYear(now);
  }

  private extractSourceUrl(notes?: string | null): string | null {
    if (!notes) return null;
    const match = /source:\s*(https?:\/\/\S+)/i.exec(notes);
    return match ? match[1] : null;
  }

  /** Annotate sourced structured deadlines with status relative to current date. */
  private annotateSourcedDeadlines(
    deadlines: Array<{
      round: string;
      year: number;
      applicationDeadline: Date;
      financialAidDeadline?: Date | null;
      decisionDate?: Date | null;
      source: string;
      notes?: string | null;
    }>,
  ): Record<
    string,
    {
      date: string;
      status: string;
      daysUntil: number;
      source: string;
      sourceUrl: string | null;
      year: number;
      financialAidDeadline: string | null;
      decisionDate: string | null;
    }
  > {
    const now = new Date();
    const result: Record<
      string,
      {
        date: string;
        status: string;
        daysUntil: number;
        source: string;
        sourceUrl: string | null;
        year: number;
        financialAidDeadline: string | null;
        decisionDate: string | null;
      }
    > = {};

    for (const deadline of deadlines) {
      const date = deadline.applicationDeadline;
      if (!(date instanceof Date) || isNaN(date.getTime())) continue;

      const daysUntil = Math.ceil((date.getTime() - now.getTime()) / 86400000);
      result[deadline.round] = {
        date: date.toISOString(),
        status:
          daysUntil < 0 ? 'passed' : daysUntil <= 7 ? 'closing_soon' : 'open',
        daysUntil,
        source: deadline.source,
        sourceUrl: this.extractSourceUrl(deadline.notes),
        year: deadline.year,
        financialAidDeadline:
          deadline.financialAidDeadline?.toISOString() ?? null,
        decisionDate: deadline.decisionDate?.toISOString() ?? null,
      };
    }

    return result;
  }

  private buildSourceSummary(sources: PromptSourceSummaryInput[]) {
    const sourceUrls = Array.from(
      new Set(
        sources
          .map((source) => source.sourceUrl?.trim())
          .filter((url): url is string => Boolean(url)),
      ),
    );
    const sourceTypes = Array.from(
      new Set(
        sources
          .map((source) => source.sourceType?.trim())
          .filter((sourceType): sourceType is string => Boolean(sourceType)),
      ),
    );
    return {
      hasSourceEvidence: sourceUrls.length > 0,
      sourceUrls,
      sourceTypes,
      sourceQuality: sourceTypes.some((type) =>
        ['OFFICIAL', 'COMMON_APP', 'UC'].includes(type.toUpperCase()),
      )
        ? 'official'
        : sourceTypes.length > 0
          ? 'secondary'
          : 'unknown',
    };
  }
}
