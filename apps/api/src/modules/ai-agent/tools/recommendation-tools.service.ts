/**
 * Recommendation Tools Service
 *
 * Tools: RECOMMEND_SCHOOLS, ANALYZE_ADMISSION_CHANCE
 *
 * Phase 2: recommend_schools delegates to RecommendationService
 * (charge points → AI ranking → probability calibration → persist → memory)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../core/llm.service';
import { PredictionService } from '../../prediction/prediction.service';
import { RecommendationService } from '../../recommendation/recommendation.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import {} from './helpers/education-context.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class RecommendationToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(RecommendationToolsService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private predictionService: PredictionService,
    private recommendationService: RecommendationService,
    private profileLoader: ProfileLoaderHelper,
    private schoolLookup: SchoolLookupHelper,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map<string, ToolHandler>([
      [
        'recommend_schools',
        (args, userId, ctx, locale) =>
          this.recommendSchools(userId, ctx, args, locale),
      ],
      [
        'analyze_admission_chance',
        (args, userId, ctx, locale) =>
          this.analyzeAdmissionChance(userId, args, ctx, locale),
      ],
    ]);
  }

  async recommendSchools(
    userId: string,
    context: any,
    args: { count?: number; preference?: string },
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';

    // Quick profile check before delegating (avoid charging if profile is empty)
    const profile =
      context?.profile ||
      (await this.profileLoader.loadProfile(userId, locale));

    if (!profile || (!profile.gpa && !profile.testScores?.length)) {
      return {
        error: isZh
          ? '请先完善档案信息（GPA或标化成绩）以获取推荐'
          : 'Please complete your profile (GPA or test scores) to get recommendations',
      };
    }

    try {
      // Delegate to RecommendationService: charge points → AI ranking → persist → memory
      const result = await this.recommendationService.generateRecommendation(
        userId,
        {
          schoolCount: args.count || 15,
          preferredRegions: args.preference ? [args.preference] : undefined,
        },
        locale,
      );

      return {
        recommendations: result.recommendations?.map((r) => ({
          schoolName: r.schoolName,
          schoolId: r.schoolId,
          tier: r.tier,
          estimatedProbability: r.estimatedProbability,
          fitScore: r.fitScore,
          reasons: r.reasons,
          concerns: r.concerns,
          schoolMeta: r.schoolMeta,
        })),
        analysis: result.analysis,
        summary: result.summary,
        totalCount: result.recommendations?.length || 0,
      };
    } catch (error: any) {
      this.logger.warn(`recommend_schools failed: ${error?.message}`);
      return {
        error: isZh
          ? `推荐失败：${error?.message || '请稍后重试'}`
          : `Recommendation failed: ${error?.message || 'Please try again later'}`,
      };
    }
  }

  async analyzeAdmissionChance(
    userId: string,
    args: { schoolId?: string; schoolName?: string },
    _context: any,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    const profileId = await this.profileLoader.getProfileId(userId);

    if (!profileId) {
      return {
        error: isZh
          ? '请先完善档案信息以获取录取预测'
          : 'Please complete your profile to get admission predictions',
      };
    }

    const school = await this.schoolLookup.findSchool(
      args.schoolId,
      args.schoolName,
      { id: true, name: true, nameZh: true },
    );

    if (!school) {
      return { error: isZh ? '未找到该学校' : 'School not found' };
    }

    try {
      const output = await this.predictionService.predict(
        profileId,
        [school.id],
        false,
        locale,
      );

      if (!output.results.length) {
        return {
          error: isZh
            ? '预测失败，请稍后重试'
            : 'Prediction failed. Please try again later.',
        };
      }

      const prediction = output.results[0];

      return {
        school: prediction.schoolName,
        chance:
          prediction.tier === 'safety'
            ? 'high'
            : prediction.tier === 'match'
              ? 'medium'
              : 'low',
        percentage: `${Math.round(prediction.probability * 100)}%`,
        confidence: prediction.confidence,
        tier: prediction.tier,
        analysis:
          prediction.factors?.map((f) => `${f.name}: ${f.detail}`).join('\n') ||
          (isZh ? '暂无详细分析' : 'No detailed analysis available'),
        suggestions: prediction.suggestions || [],
        comparison: prediction.comparison,
      };
    } catch (error) {
      this.logger.error('Prediction service failed', error);
      return {
        error: isZh
          ? '预测服务暂时不可用，请稍后重试'
          : 'Prediction service is temporarily unavailable. Please try again later.',
      };
    }
  }
}
