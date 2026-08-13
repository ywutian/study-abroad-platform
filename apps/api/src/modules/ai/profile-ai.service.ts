import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import type {
  ProfileAnalysisRequest,
  DetailedProfileAnalysisResponse,
  SectionAnalysis,
} from './ai.types';
import {
  buildProfileAnalysisSystemPrompt,
  buildProfileAnalysisUserPrompt,
} from './profile-ai.prompts';

@Injectable()
export class ProfileAiService {
  private readonly logger = new Logger(ProfileAiService.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Legacy profile-only analysis helper.
   * New school-aware application analysis must use /profiles/me/ai-analysis.
   *
   * P0: 详细档案分析 - 红黄绿评分系统
   *
   * 评分标准:
   * - Green (7-10): 该维度是申请亮点
   * - Yellow (4-6): 可接受但有提升空间
   * - Red (1-3): 需要重点改进
   */
  async analyzeProfileDetailed(
    request: ProfileAnalysisRequest,
    locale = 'zh',
  ): Promise<DetailedProfileAnalysisResponse> {
    const systemPrompt = buildProfileAnalysisSystemPrompt(locale);

    // Query target school stats for competitive positioning
    let schoolComparison: Array<{
      name: string;
      sat25?: number | null;
      sat75?: number | null;
      acceptanceRate?: number | null;
    }> = [];
    if (request.targetSchools?.length) {
      // governance: system-scope — School lookup — published institution data
      const schools = await this.prisma.school.findMany({
        where: {
          name: { in: request.targetSchools.slice(0, 3) },
        },
        select: {
          name: true,
          sat25: true,
          sat75: true,
          acceptanceRate: true,
        },
      });
      schoolComparison = schools.map((s) => ({
        name: s.name,
        sat25: s.sat25,
        sat75: s.sat75,
        acceptanceRate: s.acceptanceRate ? Number(s.acceptanceRate) : null,
      }));
    }

    const userPrompt = buildProfileAnalysisUserPrompt(
      request,
      locale,
      schoolComparison.length > 0 ? schoolComparison : undefined,
    );

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.4, maxTokens: 2500 },
      );

      const parsed = extractJsonFromLlm(result);
      return this.validateDetailedAnalysis(parsed, locale);
    } catch (error) {
      this.logger.error('Detailed profile analysis failed', error);
      return this.getDefaultDetailedAnalysis(locale);
    }
  }

  private validateDetailedAnalysis(
    data: unknown,
    locale = 'zh',
  ): DetailedProfileAnalysisResponse {
    const isZh = locale === 'zh';
    const record = (value: unknown): Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const strings = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];
    const root = record(data);
    const sections = record(root.sections);
    const suggestions = record(root.suggestions);
    const validateSection = (value: unknown): SectionAnalysis => {
      const section = record(value);
      return {
        status:
          section.status === 'green' ||
          section.status === 'yellow' ||
          section.status === 'red'
            ? section.status
            : 'yellow',
        score:
          typeof section.score === 'number'
            ? Math.min(10, Math.max(1, section.score))
            : 5,
        feedback:
          typeof section.feedback === 'string'
            ? section.feedback
            : isZh
              ? '暂无评价'
              : 'No evaluation available',
        highlights: strings(section.highlights),
        improvements: strings(section.improvements),
      };
    };

    return {
      sections: {
        academic: validateSection(sections.academic),
        testScores: validateSection(sections.testScores),
        activities: validateSection(sections.activities),
        awards: validateSection(sections.awards),
      },
      overallScore:
        typeof root.overallScore === 'number'
          ? Math.min(100, Math.max(0, root.overallScore))
          : 50,
      tier:
        root.tier === 'top10' ||
        root.tier === 'top30' ||
        root.tier === 'top50' ||
        root.tier === 'top100' ||
        root.tier === 'other'
          ? root.tier
          : 'top50',
      suggestions: {
        majors: strings(suggestions.majors),
        competitions: strings(suggestions.competitions),
        activities: strings(suggestions.activities),
        summerPrograms: strings(suggestions.summerPrograms),
        timeline: strings(suggestions.timeline),
      },
      summary:
        typeof root.summary === 'string'
          ? root.summary
          : isZh
            ? '请完善档案信息以获取更准确的分析。'
            : 'Please complete your profile for a more accurate analysis.',
    };
  }

  private getDefaultDetailedAnalysis(
    locale = 'zh',
  ): DetailedProfileAnalysisResponse {
    const isZh = locale === 'zh';
    const defaultSection: SectionAnalysis = {
      status: 'yellow',
      score: 5,
      feedback: isZh
        ? '请补充更多信息以获取准确评估'
        : 'Please provide more information for an accurate assessment',
      highlights: [],
      improvements: [
        isZh ? '请补充此项信息' : 'Please provide this information',
      ],
    };

    return {
      sections: {
        academic: defaultSection,
        testScores: defaultSection,
        activities: defaultSection,
        awards: defaultSection,
      },
      overallScore: 50,
      tier: 'top50',
      suggestions: {
        majors: [],
        competitions: [],
        activities: [],
        summerPrograms: [],
        timeline: [
          isZh
            ? '请先完善档案基本信息'
            : 'Please complete your basic profile information first',
        ],
      },
      summary: isZh
        ? '档案信息不完整,请补充GPA、标化成绩、活动和奖项后重新分析。'
        : 'Profile information is incomplete. Please add GPA, test scores, activities, and awards for a complete analysis.',
    };
  }
}
