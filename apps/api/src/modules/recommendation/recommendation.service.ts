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
import { MemoryManagerService } from '../ai-agent/memory';
import { MemoryType, EntityType, EssayStatus } from '@prisma/client';
import {
  SchoolRecommendationRequestDto,
  SchoolRecommendationResponseDto,
  RecommendedSchoolDto,
  RecommendationAnalysisDto,
} from './dto';
import { CaseIncentiveService, PointAction } from '../points/incentive.service';
import { safeRefund } from '../points/refund.helper';
import { clampPercentRate } from '../../common/utils/percent.util';
import {
  extractProfileMetrics,
  extractSchoolMetrics,
  calculateOverallScore,
  calculateProbability,
} from '../../common/utils/scoring';
import {
  RECOMMENDATION_SCHOOL_SELECT,
  mapSchoolMeta,
  type RecommendationSchoolResult,
} from './recommendation.constants';
import {
  buildRecommendationSystemPrompt,
  buildRecommendationUserPrompt,
} from './recommendation.prompts';
import { PredictionHistoricalService } from '../prediction/prediction-historical.service';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private caseIncentiveService: CaseIncentiveService,
    private redis: RedisService,
    @Optional() private memoryManager?: MemoryManagerService,
    @Optional() private historicalService?: PredictionHistoricalService,
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
    const acquired = await this.redis.setNX(lockKey, '1', 120);
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
    await this.caseIncentiveService.charge(
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
        this.caseIncentiveService,
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
    const assessmentData =
      mbtiResult || hollandResult
        ? {
            mbtiType: (mbtiResult?.result as any)?.mbtiType as
              | string
              | undefined,
            hollandCodes: (hollandResult?.result as any)?.hollandCodes as
              | string[]
              | undefined,
          }
        : undefined;

    // Build AI prompt
    const schoolCount = dto.schoolCount || 15;
    const systemPrompt = buildRecommendationSystemPrompt(locale, schoolCount);

    // Extract nationality context for international student awareness
    const nationalityContext =
      (profile as any).nationality || (profile as any).isInternational
        ? {
            nationality: (profile as any).nationality as string | undefined,
            isInternational: (profile as any).isInternational as
              | boolean
              | undefined,
          }
        : undefined;

    let userPrompt = buildRecommendationUserPrompt(
      profile,
      dto,
      locale,
      assessmentData,
      nationalityContext,
    );

    // Inject historical case comparison data for evidence-based recommendations
    const comparisonCache: Record<
      string,
      import('../prediction/prediction-historical.service').CaseComparisonResult
    > = {};
    if (this.historicalService) {
      const historicalLines: string[] = [];
      const targetSchools = (profile as any).targetSchools as
        | string[]
        | undefined;
      if (targetSchools?.length) {
        for (const schoolName of targetSchools.slice(0, 5)) {
          try {
            const school = await this.prisma.school.findFirst({
              where: { name: { contains: schoolName, mode: 'insensitive' } },
              select: { id: true, name: true, acceptanceRate: true },
            });
            if (!school) continue;

            // Use structured case comparison (admitted vs rejected)
            const comparison = await this.historicalService.getCaseComparison(
              school.id,
              nationalityContext?.nationality,
            );

            if (comparison) {
              comparisonCache[school.id] = comparison;
              const parts = [`### ${school.name}`];
              const { admitted, rejected } = comparison;
              parts.push(
                `- Cases: ${comparison.totalCases} total (${admitted.count} admitted, ${rejected.count} rejected${comparison.waitlisted ? `, ${comparison.waitlisted.count} waitlisted` : ''})`,
              );
              parts.push(
                `- Platform admit rate: ${((admitted.count / comparison.totalCases) * 100).toFixed(1)}%`,
              );

              // Admitted cohort profile
              const admittedParts: string[] = [];
              if (admitted.gpaMedian != null) {
                admittedParts.push(
                  `GPA ${admitted.gpaMedian}${admitted.gpaP25 != null ? ` (${admitted.gpaP25}-${admitted.gpaP75})` : ''}`,
                );
              }
              if (admitted.satMedian != null) {
                admittedParts.push(
                  `SAT ${admitted.satMedian}${admitted.satP25 != null ? ` (${admitted.satP25}-${admitted.satP75})` : ''}`,
                );
              }
              if (admittedParts.length) {
                parts.push(`- Admitted profile: ${admittedParts.join(', ')}`);
              }

              // Rejected cohort profile
              const rejectedParts: string[] = [];
              if (rejected.gpaMedian != null) {
                rejectedParts.push(
                  `GPA ${rejected.gpaMedian}${rejected.gpaP25 != null ? ` (${rejected.gpaP25}-${rejected.gpaP75})` : ''}`,
                );
              }
              if (rejected.satMedian != null) {
                rejectedParts.push(
                  `SAT ${rejected.satMedian}${rejected.satP25 != null ? ` (${rejected.satP25}-${rejected.satP75})` : ''}`,
                );
              }
              if (rejectedParts.length) {
                parts.push(`- Rejected profile: ${rejectedParts.join(', ')}`);
              }

              // Common traits
              if (admitted.topTags?.length) {
                parts.push(
                  `- Admitted common traits: ${admitted.topTags.join(', ')}`,
                );
              }
              if (rejected.topTags?.length) {
                parts.push(
                  `- Rejected common traits: ${rejected.topTags.join(', ')}`,
                );
              }

              // Nationality subset
              if (comparison.nationalitySubset) {
                const ns = comparison.nationalitySubset;
                const natParts = [`- ${ns.nationality} applicants:`];
                if (ns.admitted.count > 0 || ns.rejected.count > 0) {
                  natParts.push(
                    `${ns.admitted.count} admitted, ${ns.rejected.count} rejected`,
                  );
                }
                if (ns.admitted.gpaMedian != null) {
                  natParts.push(`admitted GPA ${ns.admitted.gpaMedian}+`);
                }
                if (ns.admitted.satMedian != null) {
                  natParts.push(`admitted SAT ${ns.admitted.satMedian}+`);
                }
                parts.push(natParts.join(' '));
              }

              if (parts.length > 1) historicalLines.push(parts.join('\n'));
            } else {
              // Fall back to basic stats when comparison data is insufficient
              const natStats = nationalityContext?.nationality
                ? await this.historicalService.getNationalityStats(
                    school.id,
                    nationalityContext.nationality,
                  )
                : null;
              const dist = await this.historicalService.getSchoolDistribution(
                school.id,
              );
              const parts = [`### ${school.name}`];
              if (dist) {
                const satMedian = dist.satValues.length
                  ? dist.satValues.sort((a, b) => a - b)[
                      Math.floor(dist.satValues.length / 2)
                    ]
                  : null;
                if (satMedian)
                  parts.push(`- Admitted SAT median: ${satMedian}`);
              }
              if (natStats && natStats.totalCases >= 3) {
                parts.push(
                  `- ${natStats.nationality} admit rate: ${natStats.admitRate.toFixed(1)}% (${natStats.admittedCases}/${natStats.totalCases})`,
                );
              }
              if (parts.length > 1) historicalLines.push(parts.join('\n'));
            }
          } catch {
            // Skip school if query fails
          }
        }
      }
      if (historicalLines.length > 0) {
        const header =
          locale === 'zh'
            ? '\n\n## 历史录取数据（来自平台已验证案例，供参考）\n'
            : '\n\n## Historical Admission Data (from verified platform cases, for reference)\n';
        const footer =
          locale === 'zh'
            ? '\n\n使用以上数据时请：1. 对比录取者与拒绝者的 GPA/标化/活动差异 2. 在 reasons 中引用录取者画像的对比 3. 在 concerns 中指出与拒绝者画像的相似之处 4. 有国籍数据时按国籍分析\n历史数据仅供参考，不代表未来录取标准。'
            : '\n\nWhen using this data: 1. Compare admitted vs rejected GPA/test scores/activity differences 2. In reasons[], cite how the student compares to admitted cohort 3. In concerns[], note where the student resembles rejected cohort 4. Segment by nationality when data is available\nHistorical data is for reference only.';
        userPrompt += header + historicalLines.join('\n\n') + footer;
      }
    }

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

      const parsed: any = extractJsonFromLlm(result);

      // Validate AI response structure
      if (!Array.isArray(parsed.recommendations)) {
        throw new InternalServerErrorException(
          'Invalid AI response: missing recommendations',
        );
      }
      parsed.recommendations = parsed.recommendations
        .filter((r: any) => r.schoolName && typeof r.schoolName === 'string')
        .map((r: any) => ({
          ...r,
          tier: ['reach', 'match', 'safety'].includes(r.tier)
            ? r.tier
            : 'match',
          estimatedProbability: Math.min(
            100,
            Math.max(0, Number(r.estimatedProbability) || 50),
          ),
          fitScore: Math.min(100, Math.max(0, Number(r.fitScore) || 50)),
          recommendedMajors: Array.isArray(r.recommendedMajors)
            ? r.recommendedMajors
                .slice(0, 3)
                .map((m: unknown) =>
                  typeof m === 'string' ? { name: m, reason: '' } : m,
                )
            : [],
          reasons: Array.isArray(r.reasons) ? r.reasons : [],
          concerns: Array.isArray(r.concerns) ? r.concerns : [],
        }));

      if (!parsed.analysis) {
        parsed.analysis = {
          strengths: [],
          weaknesses: [],
          improvementTips: [],
        };
      }

      const tokenUsed = this.estimateTokens(userPrompt + result);

      // Fuzzy-match schools in the database
      const recommendations = await this.matchSchoolIds(parsed.recommendations);

      // Anchor LLM probability estimates using statistical model to prevent large deviations
      await this.anchorProbabilities(profile, recommendations);

      // Enrich with essay prompt data
      await this.enrichWithEssayData(recommendations);

      // Attach case comparison data to matched schools
      for (const rec of recommendations) {
        if (rec.schoolId && comparisonCache[rec.schoolId]) {
          (rec as any).caseComparison = comparisonCache[rec.schoolId];
        }
      }

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
            recommendations: recommendations as any,
            analysis: {
              ...parsed.analysis,
              summerPrograms: parsed.summerPrograms || [],
            },
            summary: parsed.summary,
            tokenUsed,
          },
        },
      );

      const response = {
        id: savedRecommendation.id,
        recommendations,
        analysis: parsed.analysis,
        summerPrograms: parsed.summerPrograms || [],
        summary: parsed.summary,
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
        this.caseIncentiveService,
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
      const analysisData = r.analysis as any;
      const { summerPrograms, ...analysis } = analysisData || {};
      return {
        id: r.id,
        recommendations: r.recommendations as unknown as RecommendedSchoolDto[],
        analysis: analysis,
        summerPrograms: summerPrograms || [],
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

    const analysisData = recommendation.analysis as any;
    const { summerPrograms, ...analysis } = analysisData || {};
    return {
      id: recommendation.id,
      recommendations:
        recommendation.recommendations as unknown as RecommendedSchoolDto[],
      analysis: analysis as unknown as RecommendationAnalysisDto,
      summerPrograms: summerPrograms || [],
      summary: recommendation.summary || '',
      tokenUsed: recommendation.tokenUsed,
      createdAt: recommendation.createdAt,
    };
  }

  // ============ Helper Methods ============

  private createProfileSnapshot(profile: any): any {
    return {
      gpa: profile.gpa,
      gpaScale: profile.gpaScale,
      targetMajor: profile.targetMajor,
      testScores: profile.testScores?.map((s: any) => ({
        type: s.type,
        score: s.score,
      })),
      activitiesCount: profile.activities?.length || 0,
      awardsCount: profile.awards?.length || 0,
    };
  }

  private async matchSchoolIds(
    recommendations: any[],
  ): Promise<RecommendedSchoolDto[]> {
    const schoolNames = recommendations.map((r: any) => r.schoolName);

    // Three-tier matching: exact + alias + fuzzy
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

    return recommendations.map((r: any) => {
      const matched = this.findBestMatch(r.schoolName, schools);
      return {
        ...r,
        schoolId: matched?.id || undefined,
        schoolMeta: matched ? mapSchoolMeta(matched) : undefined,
      };
    });
  }

  /**
   * Anchor LLM-generated estimatedProbability to the stats model baseline.
   * Clamps each recommendation's probability within ±15pp of the statistical
   * estimate so that rates converge with the Prediction module's output.
   */
  private async anchorProbabilities(
    profile: any,
    recommendations: RecommendedSchoolDto[],
  ): Promise<void> {
    const matchedIds = recommendations
      .filter((r) => r.schoolId)
      .map((r) => r.schoolId!);
    if (matchedIds.length === 0) return;

    const schools = await this.prisma.school.findMany({
      where: { id: { in: matchedIds } },
      select: {
        id: true,
        acceptanceRate: true,
        usNewsRank: true,
        satAvg: true,
        sat25: true,
        sat75: true,
        actAvg: true,
        act25: true,
        act75: true,
        graduationRate: true,
        retentionRate: true,
        percentNeedMet: true,
      },
    });

    const schoolMap = new Map(schools.map((s) => [s.id, s]));
    const profileMetrics = extractProfileMetrics(profile);
    const MAX_DEVIATION = 0.15;

    for (const rec of recommendations) {
      if (!rec.schoolId) continue;
      const school = schoolMap.get(rec.schoolId);
      if (!school) continue;

      const schoolMetrics = extractSchoolMetrics({
        acceptanceRate:
          school.acceptanceRate != null
            ? clampPercentRate(school.acceptanceRate)
            : undefined,
        usNewsRank: school.usNewsRank ?? undefined,
        satAvg: school.satAvg ?? undefined,
        sat25: school.sat25 ?? undefined,
        sat75: school.sat75 ?? undefined,
        actAvg: school.actAvg ?? undefined,
        act25: school.act25 ?? undefined,
        act75: school.act75 ?? undefined,
        graduationRate:
          school.graduationRate != null
            ? Number(school.graduationRate)
            : undefined,
      });

      const overallScore = calculateOverallScore(profileMetrics, schoolMetrics);
      const statsProb = calculateProbability(overallScore, schoolMetrics);

      const llmProb = rec.estimatedProbability / 100;
      const anchored = Math.max(
        0,
        Math.min(
          1,
          Math.max(
            statsProb - MAX_DEVIATION,
            Math.min(statsProb + MAX_DEVIATION, llmProb),
          ),
        ),
      );

      rec.estimatedProbability = Math.round(anchored * 100);
    }
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
          isActive: true,
          status: EssayStatus.VERIFIED,
        },
        _count: true,
      }),
      this.prisma.essayPrompt.findMany({
        where: {
          schoolId: { in: matchedIds },
          isActive: true,
          status: EssayStatus.VERIFIED,
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
        (rec as any).essayPromptCount = countMap.get(rec.schoolId) || 0;
        (rec as any).hasWhySchool = whySchoolSet.has(rec.schoolId);
      }
    }
  }

  private findBestMatch(
    name: string,
    candidates: RecommendationSchoolResult[],
  ) {
    let best: (typeof candidates)[0] | undefined;
    let bestScore = 0;
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
      }
    }

    return bestScore >= 60 ? best : undefined;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 3);
  }

  /**
   * Preflight check: whether the user can generate a recommendation
   */
  async checkPreflight(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

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

    const canAfford = await this.caseIncentiveService.canPerformAction(
      userId,
      PointAction.AI_SCHOOL_RECOMMENDATION,
    );

    return {
      canGenerate: canAfford && missingFields.length === 0,
      points: user?.points || 0,
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
