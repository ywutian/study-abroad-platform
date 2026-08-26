import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ERR } from '../../common/constants/error-messages';
import { fireAndForget } from '../../common/utils/async.util';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import { MemoryManagerService } from '../ai-agent/memory';
import { MemoryType, EntityType, Prisma } from '@prisma/client';
import {
  SchoolRecommendationRequestDto,
  SchoolRecommendationResponseDto,
  RecommendedSchoolDto,
} from './dto';
import { PointsService, PointAction } from '../points/incentive.service';
import { safeRefund } from '../points/refund.helper';
import { PredictionService } from '../prediction/prediction.service';
import {
  RECOMMENDATION_SCHOOL_SELECT,
  mapSourcedSchoolMeta,
  type RecommendationSchoolResult,
} from './recommendation.constants';
import {
  buildRecommendationSystemPrompt,
  buildRecommendationUserPrompt,
  recommendationNumber,
  type RecommendationPromptProfile,
} from './recommendation.prompts';
import { detectInternationalStatus } from '@study-abroad/shared/scoring';
import type { RecommendationOutcomeMetrics } from '@study-abroad/shared';
import {
  isJsonRecord,
  normalizeAnalysis,
  normalizeRecommendation,
  normalizeSummerPrograms,
  readStoredAnalysis,
} from './recommendation-response-normalizers';

const SOURCE_BACKED_VERIFIED_ESSAY_PROMPT_WHERE = {
  isActive: true,
  status: 'VERIFIED',
  sources: { some: { sourceUrl: { not: null } } },
} as const;

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private pointsService: PointsService,
    private redis: RedisService,
    private predictionService: PredictionService,
    @Optional() private memoryManager?: MemoryManagerService,
  ) {}

  /**
   * Generate AI school recommendations
   */
  async generateRecommendation(
    userId: string,
    dto: SchoolRecommendationRequestDto,
    locale = 'zh',
  ): Promise<SchoolRecommendationResponseDto> {
    const isZh = locale === 'zh';
    // Idempotency lock: prevent concurrent duplicate requests (2-minute expiry)
    const lockKey = `recommendation:lock:${userId}`;
    const acquired = await this.redis.setNX(
      lockKey,
      '1',
      REDIS_TTL.RECOMMENDATION_LOCK,
    );
    if (!acquired) {
      throw new ConflictException(
        isZh
          ? '推荐正在生成中，请勿重复提交'
          : 'Recommendation is being generated, please do not resubmit',
      );
    }

    this.logger.log('Recommendation requested', {
      userId,
      schoolCount: dto.schoolCount || 15,
    });

    try {
      return await this.doGenerateRecommendation(userId, dto, locale);
    } finally {
      // Release lock
      await this.redis.del(lockKey);
    }
  }

  private async doGenerateRecommendation(
    userId: string,
    dto: SchoolRecommendationRequestDto,
    locale = 'zh',
  ): Promise<SchoolRecommendationResponseDto> {
    const isZh = locale === 'zh';

    // Check points
    await this.pointsService.charge(
      userId,
      PointAction.AI_SCHOOL_RECOMMENDATION,
    );

    // Fetch user profile
    const profile = await this.prisma.profile.findFirst({
      where: { userId },
      include: {
        testScores: true,
        activities: {
          orderBy: { order: 'asc' },
          include: { activityTemplate: true },
        },
        awards: { include: { competition: true } },
        education: { include: { highSchool: true } },
      },
    });

    if (!profile) {
      await safeRefund(
        this.pointsService,
        userId,
        PointAction.AI_SCHOOL_RECOMMENDATION,
        this.logger,
      );
      throw new NotFoundException(
        isZh ? '请先完善个人档案' : 'Please complete your profile first',
      );
    }

    // Fetch assessment data (MBTI / Holland) for richer context
    const assessmentResults = await this.prisma.assessmentResult.findMany({
      where: { userId },
      include: { assessment: { select: { type: true } } },
      orderBy: { completedAt: 'desc' },
    });
    const mbtiResult = assessmentResults.find(
      (r) => r.assessment.type === 'MBTI',
    );
    const hollandResult = assessmentResults.find(
      (r) => r.assessment.type === 'HOLLAND',
    );
    const parsedMbtiResult = mbtiResult
      ? typeof mbtiResult.result === 'string'
        ? JSON.parse(mbtiResult.result)
        : (mbtiResult.result as any)
      : undefined;
    const parsedHollandResult = hollandResult
      ? typeof hollandResult.result === 'string'
        ? JSON.parse(hollandResult.result)
        : (hollandResult.result as any)
      : undefined;
    const assessmentData =
      mbtiResult || hollandResult
        ? {
            mbtiType: parsedMbtiResult?.type as string | undefined,
            hollandCodes: parsedHollandResult?.codes
              ? [String(parsedHollandResult.codes)]
              : undefined,
          }
        : undefined;

    // Build AI prompt
    const schoolCount = dto.schoolCount || 15;
    const systemPrompt = buildRecommendationSystemPrompt(locale, schoolCount);

    // Nationality context for international-student awareness.
    //
    // `isInternational` is not a Profile column and never was; it was read
    // through an untyped cast, came back `undefined` on every call, and the
    // prompt builder's branch on it therefore never fired. The branch adds
    // international-student context based only on published school policies
    // and official requirements, without historical individual cases.
    //
    // Derived the same way the prediction path derives it, from the same five
    // Profile columns, so the two features agree about who is international.
    const nationalityContext = profile.nationality
      ? {
          nationality: profile.nationality,
          isInternational: detectInternationalStatus({
            nationality: profile.nationality,
            countryOfResidence: profile.countryOfResidence,
            citizenship: profile.citizenship,
            educationSystem: profile.educationSystem,
            currentSchoolType: profile.currentSchoolType,
          }).isInternational,
        }
      : undefined;

    const userPrompt = buildRecommendationUserPrompt(
      profile,
      dto,
      locale,
      assessmentData,
      nationalityContext,
    );

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.6,
          maxTokens: 3000,
          timeoutMs: 90000,
          providerOptions: {
            response_format: {
              type: 'json_object',
            },
          },
        },
      );

      const parsed: unknown = extractJsonFromLlm(result);
      if (!isJsonRecord(parsed) || !Array.isArray(parsed.recommendations)) {
        throw new InternalServerErrorException(
          'Invalid AI response: missing recommendations',
        );
      }
      const normalizedRecommendations = parsed.recommendations.flatMap(
        (recommendation) => {
          const normalized = normalizeRecommendation(recommendation);
          return normalized ? [normalized] : [];
        },
      );
      const analysis = normalizeAnalysis(parsed.analysis);
      const summerPrograms = normalizeSummerPrograms(parsed.summerPrograms);
      const summary = typeof parsed.summary === 'string' ? parsed.summary : '';

      const tokenUsed = this.estimateTokens(userPrompt + result);

      // Fuzzy-match schools in the database
      let recommendations = await this.matchSchoolIds(
        normalizedRecommendations,
      );

      // Admission probability and tier have exactly one fact source. The LLM
      // proposes candidates and prose, but the counselor preview owns the
      // numeric/tier contract. Unknown, ambiguous, duplicate, or unscored
      // schools are removed instead of leaking invented values to users.
      recommendations = await this.applyCounselorPredictions(
        userId,
        recommendations,
        locale,
      );
      if (recommendations.length === 0) {
        throw new InternalServerErrorException(
          'No uniquely matched schools with counselor predictions',
        );
      }

      // Enrich with essay prompt data
      await this.enrichWithEssayData(recommendations);

      // Save results
      const savedRecommendation = await this.prisma.schoolRecommendation.create(
        {
          data: {
            userId,
            profileSnapshot: this.createProfileSnapshot(profile),
            preferences: {
              regions: dto.preferredRegions,
              majors: dto.preferredMajors,
              budget: dto.budget,
              campusPreferences: dto.campusPreferences,
              additional: dto.additionalPreferences,
            },
            recommendations:
              recommendations as unknown as Prisma.InputJsonValue,
            analysis: {
              ...analysis,
              summerPrograms,
            },
            summary,
            tokenUsed,
            events: {
              create: recommendations.flatMap((recommendation, position) =>
                recommendation.schoolId
                  ? [
                      {
                        userId,
                        schoolId: recommendation.schoolId,
                        eventType: 'IMPRESSION' as const,
                        position,
                        metadata: {
                          probabilitySource: 'counselor-preview',
                        },
                      },
                    ]
                  : [],
              ),
            },
          },
        },
      );

      const response = {
        id: savedRecommendation.id,
        recommendations,
        analysis,
        summerPrograms,
        summary,
        tokenUsed,
        createdAt: savedRecommendation.createdAt,
      };

      const matchedCount = recommendations.filter((r) => r.schoolId).length;
      this.logger.log('Recommendation generated', {
        userId,
        id: savedRecommendation.id,
        tokenUsed,
        totalSchools: recommendations.length,
        matchedSchools: matchedCount,
      });

      // Record to memory system (async, non-blocking)
      fireAndForget(
        this.recordRecommendationToMemory(userId, response),
        this.logger,
        'Failed to record recommendation to memory',
      );

      return response;
    } catch (error) {
      await safeRefund(
        this.pointsService,
        userId,
        PointAction.AI_SCHOOL_RECOMMENDATION,
        this.logger,
      );
      this.logger.error('School recommendation failed', error);
      throw new BadRequestException(
        isZh
          ? '生成选校建议失败，请重试'
          : 'Failed to generate school recommendations, please try again',
      );
    }
  }

  /**
   * Get user's school recommendation history
   */
  async getRecommendationHistory(
    userId: string,
  ): Promise<SchoolRecommendationResponseDto[]> {
    const recommendations = await this.prisma.schoolRecommendation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return recommendations.map((r) => {
      const { analysis, summerPrograms } = readStoredAnalysis(r.analysis);
      return {
        id: r.id,
        recommendations: r.recommendations as unknown as RecommendedSchoolDto[],
        analysis,
        summerPrograms,
        summary: r.summary || '',
        tokenUsed: r.tokenUsed,
        createdAt: r.createdAt,
      };
    });
  }

  /**
   * Get a single recommendation by ID
   */
  async getRecommendationById(
    userId: string,
    id: string,
  ): Promise<SchoolRecommendationResponseDto> {
    const recommendation = await this.prisma.schoolRecommendation.findFirst({
      where: { id, userId },
    });

    if (!recommendation) {
      throw new NotFoundException(ERR.NOT_FOUND.recommendation());
    }

    // Record view behavior
    fireAndForget(
      this.recordViewToMemory(userId, recommendation),
      this.logger,
      'Failed to record view to memory',
    );

    const { analysis, summerPrograms } = readStoredAnalysis(
      recommendation.analysis,
    );
    return {
      id: recommendation.id,
      recommendations:
        recommendation.recommendations as unknown as RecommendedSchoolDto[],
      analysis,
      summerPrograms,
      summary: recommendation.summary || '',
      tokenUsed: recommendation.tokenUsed,
      createdAt: recommendation.createdAt,
    };
  }

  async getRecommendationMetrics(
    userId: string,
    recommendationId?: string,
  ): Promise<RecommendationOutcomeMetrics> {
    if (recommendationId) {
      const recommendation = await this.prisma.schoolRecommendation.findFirst({
        where: { id: recommendationId, userId },
        select: { id: true },
      });
      if (!recommendation) {
        throw new NotFoundException(ERR.NOT_FOUND.recommendation());
      }
    }

    const eventWhere = recommendationId
      ? { recommendationId, userId }
      : { userId };
    const retainedWhere = recommendationId
      ? { userId, sourceRecommendationId: recommendationId }
      : { userId, sourceRecommendationId: { not: null } };

    const [grouped, retainedCount] = await Promise.all([
      this.prisma.schoolRecommendationEvent.groupBy({
        by: ['eventType'],
        where: eventWhere,
        _count: { _all: true },
      }),
      this.prisma.schoolListItem.count({
        where: retainedWhere,
      }),
    ]);
    const counts = new Map(
      grouped.map((entry) => [entry.eventType, entry._count._all]),
    );
    const impressions = counts.get('IMPRESSION') ?? 0;
    const added = counts.get('ADDED') ?? 0;
    const removed = counts.get('REMOVED') ?? 0;
    const applied = counts.get('APPLIED') ?? 0;
    const insufficientSample = impressions < 30;

    return {
      scope: recommendationId ? 'recommendation' : 'user',
      ...(recommendationId ? { recommendationId } : {}),
      sampleSize: impressions,
      insufficientSample,
      counts: {
        impressions,
        added,
        removed,
        retained: retainedCount,
        applied,
      },
      rates: {
        addRate:
          !insufficientSample && impressions > 0 ? added / impressions : null,
        retentionRate:
          !insufficientSample && added > 0 ? retainedCount / added : null,
        applicationConversionRate:
          !insufficientSample && impressions > 0 ? applied / impressions : null,
      },
    };
  }

  async recordApplied(
    userId: string,
    recommendationId: string,
    schoolId: string,
  ) {
    const recommendation = await this.prisma.schoolRecommendation.findFirst({
      where: { id: recommendationId, userId },
      select: { recommendations: true },
    });
    if (
      !recommendation ||
      !recommendationContainsSchool(recommendation.recommendations, schoolId)
    ) {
      throw new NotFoundException(ERR.NOT_FOUND.recommendation());
    }

    await this.prisma.schoolRecommendationEvent.upsert({
      where: {
        recommendationId_schoolId_eventType: {
          recommendationId,
          schoolId,
          eventType: 'APPLIED',
        },
      },
      create: {
        recommendationId,
        userId,
        schoolId,
        eventType: 'APPLIED',
        metadata: { source: 'user-confirmed' },
      },
      update: {},
    });
    return { recorded: true };
  }

  // ============ Helper Methods ============

  private createProfileSnapshot(
    profile: RecommendationPromptProfile,
  ): Prisma.InputJsonObject {
    return {
      gpa: recommendationNumber(profile.gpa) ?? null,
      gpaScale: recommendationNumber(profile.gpaScale) ?? null,
      targetMajor: profile.targetMajor ?? null,
      testScores:
        profile.testScores?.map((s) => ({
          type: s.type,
          score: s.score,
        })) ?? [],
      activitiesCount: profile.activities?.length || 0,
      awardsCount: profile.awards?.length || 0,
    };
  }

  private async matchSchoolIds(
    recommendations: RecommendedSchoolDto[],
  ): Promise<RecommendedSchoolDto[]> {
    const schoolNames = recommendations.map((r) => r.schoolName);

    // Three-tier matching: exact + alias + fuzzy
    // governance: system-scope — School / EssayPrompt lookups — published institution data used to score a recommendation, no User relation
    const schools = await this.prisma.school.findMany({
      where: {
        OR: [
          { name: { in: schoolNames } },
          { nameZh: { in: schoolNames } },
          {
            aliases: {
              hasSome: schoolNames.flatMap((n: string) => [
                n,
                n.toUpperCase(),
                n.toLowerCase(),
              ]),
            },
          },
          ...schoolNames.map((n: string) => ({
            name: { contains: n, mode: 'insensitive' as const },
          })),
        ],
      },
      select: RECOMMENDATION_SCHOOL_SELECT,
    });

    return recommendations.map((r) => {
      const matched = this.findBestMatch(r.schoolName, schools);
      return {
        ...r,
        schoolId: matched?.id || undefined,
        schoolMeta: matched ? mapSourcedSchoolMeta(matched) : undefined,
      };
    });
  }

  private async applyCounselorPredictions(
    userId: string,
    recommendations: RecommendedSchoolDto[],
    locale: string,
  ): Promise<RecommendedSchoolDto[]> {
    const unique = new Map<string, RecommendedSchoolDto>();
    for (const recommendation of recommendations) {
      if (recommendation.schoolId && !unique.has(recommendation.schoolId)) {
        unique.set(recommendation.schoolId, recommendation);
      }
    }
    if (unique.size === 0) return [];

    const preview = await this.predictionService.previewForUser(
      userId,
      [...unique.keys()],
      {},
      locale,
    );
    const predictions = new Map(
      preview.results.map((result) => [result.schoolId, result]),
    );

    return [...unique.entries()].flatMap(([schoolId, recommendation]) => {
      const prediction = predictions.get(schoolId);
      if (
        !prediction ||
        prediction.probability == null ||
        (prediction.tier !== 'reach' &&
          prediction.tier !== 'match' &&
          prediction.tier !== 'safety')
      ) {
        return [];
      }
      return [
        {
          ...recommendation,
          tier: prediction.tier,
          estimatedProbability: Math.round(prediction.probability * 100),
        },
      ];
    });
  }

  /**
   * Enrich matched recommendations with essay prompt counts and hasWhySchool flag.
   */
  private async enrichWithEssayData(
    recommendations: RecommendedSchoolDto[],
  ): Promise<void> {
    const matchedIds = recommendations
      .filter((r) => r.schoolId)
      .map((r) => r.schoolId!);
    if (matchedIds.length === 0) return;

    const [counts, whySchoolIds] = await Promise.all([
      this.prisma.essayPrompt.groupBy({
        by: ['schoolId'],
        where: {
          schoolId: { in: matchedIds },
          ...SOURCE_BACKED_VERIFIED_ESSAY_PROMPT_WHERE,
        },
        _count: true,
      }),
      // governance: system-scope — School / EssayPrompt lookups — published institution data used to score a recommendation, no User relation
      this.prisma.essayPrompt.findMany({
        where: {
          schoolId: { in: matchedIds },
          ...SOURCE_BACKED_VERIFIED_ESSAY_PROMPT_WHERE,
          type: 'WHY_SCHOOL',
        },
        select: { schoolId: true },
        distinct: ['schoolId'],
      }),
    ]);

    const countMap = new Map(counts.map((c) => [c.schoolId, c._count]));
    const whySchoolSet = new Set(whySchoolIds.map((w) => w.schoolId));

    for (const rec of recommendations) {
      if (rec.schoolId) {
        rec.essayPromptCount = countMap.get(rec.schoolId) || 0;
        rec.hasWhySchool = whySchoolSet.has(rec.schoolId);
      }
    }
  }

  private findBestMatch(
    name: string,
    candidates: RecommendationSchoolResult[],
  ) {
    let best: (typeof candidates)[0] | undefined;
    let bestScore = 0;
    let bestScoreCount = 0;
    const lower = name.toLowerCase();

    for (const s of candidates) {
      let score = 0;
      if (s.name.toLowerCase() === lower || s.nameZh?.toLowerCase() === lower) {
        score = 100;
      } else if (s.aliases?.some((a) => a.toLowerCase() === lower)) {
        score = 90;
      } else if (s.name.toLowerCase().startsWith(lower)) {
        score = 80;
      } else if (
        s.name.toLowerCase().includes(lower) ||
        lower.includes(s.name.toLowerCase())
      ) {
        score = 60;
      }
      if (score > bestScore) {
        best = s;
        bestScore = score;
        bestScoreCount = 1;
      } else if (score > 0 && score === bestScore) {
        bestScoreCount += 1;
      }
    }

    return bestScore >= 60 && bestScoreCount === 1 ? best : undefined;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 3);
  }

  /**
   * Preflight check: whether the user can generate a recommendation
   */
  async checkPreflight(userId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: { userId },
      include: {
        testScores: { select: { id: true } },
        activities: { select: { id: true } },
      },
    });

    const missingFields: string[] = [];
    if (!profile) {
      missingFields.push('profile');
    } else {
      if (!profile.gpa) missingFields.push('gpa');
      if (!profile.testScores?.length) missingFields.push('testScores');
      if (!profile.activities?.length) missingFields.push('activities');
      if (!profile.targetMajor) missingFields.push('targetMajor');
    }

    const canAfford = await this.pointsService.canPerformAction(
      userId,
      PointAction.AI_SCHOOL_RECOMMENDATION,
    );

    return {
      canGenerate: canAfford && missingFields.length === 0,
      points: await this.pointsService.getVisibleUserPoints(userId),
      profileComplete: missingFields.length === 0,
      missingFields,
      profileSummary: profile
        ? {
            gpa: profile.gpa ? Number(profile.gpa) : undefined,
            testCount: profile.testScores?.length || 0,
            activityCount: profile.activities?.length || 0,
          }
        : undefined,
    };
  }

  /**
   * Delete a recommendation record
   */
  async deleteRecommendation(userId: string, id: string): Promise<void> {
    const rec = await this.prisma.schoolRecommendation.findFirst({
      where: { id, userId },
    });
    if (!rec) {
      throw new NotFoundException(ERR.NOT_FOUND.recommendation());
    }
    await this.prisma.schoolRecommendation.delete({ where: { id } });
  }

  // ============ Memory Integration ============

  /**
   * Record school recommendation to memory system
   */
  private async recordRecommendationToMemory(
    userId: string,
    response: SchoolRecommendationResponseDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    // Group by tier
    const reach = response.recommendations.filter((r) => r.tier === 'reach');
    const match = response.recommendations.filter((r) => r.tier === 'match');
    const safety = response.recommendations.filter((r) => r.tier === 'safety');

    // Record decision memory
    await this.memoryManager.remember(userId, {
      type: MemoryType.DECISION,
      category: 'school_recommendation',
      content: `User received AI school recommendations: ${reach.length} reach, ${match.length} match, ${safety.length} safety schools. ${response.summary}`,
      importance: 0.8,
      metadata: {
        recommendationId: response.id,
        schoolCount: response.recommendations.length,
        tierDistribution: {
          reach: reach.length,
          match: match.length,
          safety: safety.length,
        },
        topReachSchools: reach.slice(0, 3).map((r) => r.schoolName),
        timestamp: new Date().toISOString(),
      },
    });

    // Record school entities
    for (const rec of response.recommendations.slice(0, 5)) {
      await this.memoryManager.recordEntity(userId, {
        type: EntityType.SCHOOL,
        name: rec.schoolName,
        description: `AI-recommended ${rec.tier} school with ${rec.fitScore}% fit score`,
        attributes: {
          schoolId: rec.schoolId,
          tier: rec.tier,
          probability: rec.estimatedProbability,
          fitScore: rec.fitScore,
          reasons: rec.reasons,
        },
      });
    }

    // Record analysis results as preferences
    if (response.analysis?.strengths?.length > 0) {
      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'profile_analysis',
        content: `Application strengths: ${response.analysis.strengths.join(', ')}`,
        importance: 0.6,
      });
    }

    if (response.analysis?.weaknesses?.length > 0) {
      await this.memoryManager.remember(userId, {
        type: MemoryType.FEEDBACK,
        category: 'improvement',
        content: `Areas for improvement: ${response.analysis.weaknesses.join(', ')}. Tips: ${response.analysis.improvementTips?.join(', ') || ''}`,
        importance: 0.7,
      });
    }
  }

  /**
   * Record view behavior to memory
   */
  private async recordViewToMemory(
    userId: string,
    recommendation: any,
  ): Promise<void> {
    if (!this.memoryManager) return;

    const schools = (recommendation.recommendations as RecommendedSchoolDto[])
      .slice(0, 3)
      .map((r) => r.schoolName);

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'view_history',
      content: `User viewed a previous school recommendation containing: ${schools.join(', ')}`,
      importance: 0.3,
      metadata: {
        recommendationId: recommendation.id,
        viewedAt: new Date().toISOString(),
      },
    });
  }
}

function recommendationContainsSchool(
  value: unknown,
  schoolId: string,
): boolean {
  return (
    Array.isArray(value) &&
    value.some(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        'schoolId' in entry &&
        entry.schoolId === schoolId,
    )
  );
}
