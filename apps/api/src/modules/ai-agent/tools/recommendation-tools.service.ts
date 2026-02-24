/**
 * Recommendation Tools Service
 *
 * Tools: RECOMMEND_SCHOOLS, ANALYZE_ADMISSION_CHANCE
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { PredictionService } from '../../prediction/prediction.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class RecommendationToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(RecommendationToolsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private predictionService: PredictionService,
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

    return this.aiService.schoolMatch(
      {
        gpa: profile.gpa ?? undefined,
        gpaScale: profile.gpaScale,
        testScores: profile.testScores,
        targetMajor: profile.targetMajor ?? undefined,
      },
      locale,
    );
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
        percentage: `${prediction.probability}%`,
        confidence: `${prediction.confidence}%`,
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
