/**
 * Recommendation Tools Service
 *
 * Tools: RECOMMEND_SCHOOLS, ANALYZE_ADMISSION_CHANCE
 *
 * Phase 2: recommend_schools delegates to RecommendationService
 * (charge points → AI ranking → probability calibration → persist → memory)
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
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
    @Optional() private redis?: RedisService,
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
        suggestedAction: {
          label: isZh ? '完善档案' : 'Complete Profile',
          action: 'navigate:/profile',
        },
      };
    }

    try {
      // Check cache (24h TTL) for consistent results
      const cacheKey = `rec:${userId}:${args.count || 15}:${args.preference || 'none'}`;
      const client = this.redis?.getClient();
      if (client) {
        try {
          const cached = await client.get(cacheKey);
          if (cached) {
            this.logger.debug(`recommend_schools cache hit for ${userId}`);
            return JSON.parse(cached);
          }
        } catch {
          // Cache miss or Redis error — proceed with fresh generation
        }
      }

      // Delegate to RecommendationService: charge points → AI ranking → persist → memory
      const result = await this.recommendationService.generateRecommendation(
        userId,
        {
          schoolCount: args.count || 15,
          preferredRegions: args.preference ? [args.preference] : undefined,
        },
        locale,
      );

      const formattedResult = {
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

      // Cache for 24 hours
      if (client) {
        try {
          await client.set(
            cacheKey,
            JSON.stringify(formattedResult),
            'EX',
            86400,
          );
        } catch {
          // Cache write failure is non-critical
        }
      }

      return formattedResult;
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
    args: { schoolId?: string; schoolName?: string; forceRefresh?: boolean },
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
        args.forceRefresh ?? false,
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
        school: {
          id: school.id,
          name: school.name,
          nameZh: school.nameZh ?? undefined,
        },
        chance:
          prediction.tier === 'safety'
            ? 'high'
            : prediction.tier === 'match'
              ? 'medium'
              : 'low',
        probability: prediction.probability,
        percentage:
          prediction.probability == null
            ? 'N/A'
            : `${Math.round(prediction.probability * 100)}%`,
        confidence: prediction.confidence,
        tier: prediction.tier,
        confidenceReason: prediction.confidenceReason,
        cohortKey: prediction.cohortKey,
        roundContext: prediction.roundContext,
        sourceSummary: prediction.sourceSummary,
        uncertaintyReasons: prediction.uncertaintyReasons,
        // servedPolicyVersionId omitted — internal policy gate detail
        latestOutcomeLabel: prediction.latestOutcomeLabel,
        source: (prediction as { source?: string }).source,
        modelVersion: prediction.modelVersion,
        schoolMeta: prediction.schoolMeta,
        analysis:
          prediction.factors?.map((f) => `${f.name}: ${f.detail}`).join('\n') ||
          (isZh ? '暂无详细分析' : 'No detailed analysis available'),
        factors: prediction.factors,
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
