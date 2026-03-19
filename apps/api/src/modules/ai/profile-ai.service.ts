import { Injectable, Logger } from '@nestjs/common';
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

  constructor(private readonly llmService: LLMService) {}

  /**
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
    const userPrompt = buildProfileAnalysisUserPrompt(request, locale);

    try {
      const result = await this.llmService.chatSimple(
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
    data: any,
    locale = 'zh',
  ): DetailedProfileAnalysisResponse {
    const isZh = locale === 'zh';
    const validateSection = (section: any): SectionAnalysis => ({
      status: ['green', 'yellow', 'red'].includes(section?.status)
        ? section.status
        : 'yellow',
      score:
        typeof section?.score === 'number'
          ? Math.min(10, Math.max(1, section.score))
          : 5,
      feedback:
        section?.feedback || (isZh ? '暂无评价' : 'No evaluation available'),
      highlights: Array.isArray(section?.highlights) ? section.highlights : [],
      improvements: Array.isArray(section?.improvements)
        ? section.improvements
        : [],
    });

    return {
      sections: {
        academic: validateSection(data.sections?.academic),
        testScores: validateSection(data.sections?.testScores),
        activities: validateSection(data.sections?.activities),
        awards: validateSection(data.sections?.awards),
      },
      overallScore:
        typeof data.overallScore === 'number'
          ? Math.min(100, Math.max(0, data.overallScore))
          : 50,
      tier: ['top10', 'top30', 'top50', 'top100', 'other'].includes(data.tier)
        ? data.tier
        : 'top50',
      suggestions: {
        majors: Array.isArray(data.suggestions?.majors)
          ? data.suggestions.majors
          : [],
        competitions: Array.isArray(data.suggestions?.competitions)
          ? data.suggestions.competitions
          : [],
        activities: Array.isArray(data.suggestions?.activities)
          ? data.suggestions.activities
          : [],
        summerPrograms: Array.isArray(data.suggestions?.summerPrograms)
          ? data.suggestions.summerPrograms
          : [],
        timeline: Array.isArray(data.suggestions?.timeline)
          ? data.suggestions.timeline
          : [],
      },
      summary:
        data.summary ||
        (isZh
          ? '请完善档案信息以获取更准确的分析。'
          : 'Please complete your profile for a more accurate analysis.'),
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
