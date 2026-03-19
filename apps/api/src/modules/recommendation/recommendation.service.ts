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
import { fireAndForget } from '../../common/utils/async.util';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import { RedisService } from '../../common/redis/redis.service';
import { MemoryManagerService } from '../ai-agent/memory';
import { MemoryType, EntityType } from '@prisma/client';
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

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private caseIncentiveService: CaseIncentiveService,
    private redis: RedisService,
    @Optional() private memoryManager?: MemoryManagerService,
  ) {}

  /**
   * 生成 AI 选校建议
   */
  async generateRecommendation(
    userId: string,
    dto: SchoolRecommendationRequestDto,
    locale = 'zh',
  ): Promise<SchoolRecommendationResponseDto> {
    const isZh = locale === 'zh';
    // 幂等锁：防止并发重复请求（2分钟过期）
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
      // 释放锁
      await this.redis.del(lockKey);
    }
  }

  private async doGenerateRecommendation(
    userId: string,
    dto: SchoolRecommendationRequestDto,
    locale = 'zh',
  ): Promise<SchoolRecommendationResponseDto> {
    const isZh = locale === 'zh';

    // 检查积分
    await this.caseIncentiveService.charge(
      userId,
      PointAction.AI_SCHOOL_RECOMMENDATION,
    );

    // 获取用户档案
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

    // 构建 AI Prompt
    const schoolCount = dto.schoolCount || 15;
    const systemPrompt = buildRecommendationSystemPrompt(locale, schoolCount);
    const userPrompt = buildRecommendationUserPrompt(profile, dto, locale);

    try {
      const result = await this.llmService.chatSimple(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.6, maxTokens: 4000 },
      );

      const parsed: any = extractJsonFromLlm(result);

      // 校验 AI 响应结构
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

      // 模糊匹配数据库中的学校
      const recommendations = await this.matchSchoolIds(parsed.recommendations);

      // 使用统计模型锚定 LLM 概率估计，防止 LLM 猜测与数据驱动模型偏差过大
      await this.anchorProbabilities(profile, recommendations);

      // 保存结果
      const savedRecommendation = await this.prisma.schoolRecommendation.create(
        {
          data: {
            userId,
            profileSnapshot: this.createProfileSnapshot(profile),
            preferences: {
              regions: dto.preferredRegions,
              majors: dto.preferredMajors,
              budget: dto.budget,
              additional: dto.additionalPreferences,
            },
            recommendations: recommendations as any,
            analysis: parsed.analysis,
            summary: parsed.summary,
            tokenUsed,
          },
        },
      );

      const response = {
        id: savedRecommendation.id,
        recommendations,
        analysis: parsed.analysis,
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

      // 写入记忆系统（异步非阻塞）
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
   * 获取用户的选校建议历史
   */
  async getRecommendationHistory(
    userId: string,
  ): Promise<SchoolRecommendationResponseDto[]> {
    const recommendations = await this.prisma.schoolRecommendation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return recommendations.map((r) => ({
      id: r.id,
      recommendations: r.recommendations as unknown as RecommendedSchoolDto[],
      analysis: r.analysis as unknown as RecommendationAnalysisDto,
      summary: r.summary || '',
      tokenUsed: r.tokenUsed,
      createdAt: r.createdAt,
    }));
  }

  /**
   * 获取单个推荐详情
   */
  async getRecommendationById(
    userId: string,
    id: string,
  ): Promise<SchoolRecommendationResponseDto> {
    const recommendation = await this.prisma.schoolRecommendation.findFirst({
      where: { id, userId },
    });

    if (!recommendation) {
      throw new NotFoundException('推荐记录不存在');
    }

    // 记录浏览行为
    fireAndForget(
      this.recordViewToMemory(userId, recommendation),
      this.logger,
      'Failed to record view to memory',
    );

    return {
      id: recommendation.id,
      recommendations:
        recommendation.recommendations as unknown as RecommendedSchoolDto[],
      analysis: recommendation.analysis as unknown as RecommendationAnalysisDto,
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

    // 三层匹配：精确 + 别名 + 模糊
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
   * 预检查：用户是否可以生成推荐
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
   * 删除推荐记录
   */
  async deleteRecommendation(userId: string, id: string): Promise<void> {
    const rec = await this.prisma.schoolRecommendation.findFirst({
      where: { id, userId },
    });
    if (!rec) {
      throw new NotFoundException('推荐记录不存在');
    }
    await this.prisma.schoolRecommendation.delete({ where: { id } });
  }

  // ============ Memory Integration ============

  /**
   * 将选校建议记录到记忆系统
   */
  private async recordRecommendationToMemory(
    userId: string,
    response: SchoolRecommendationResponseDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    // 按 tier 分组
    const reach = response.recommendations.filter((r) => r.tier === 'reach');
    const match = response.recommendations.filter((r) => r.tier === 'match');
    const safety = response.recommendations.filter((r) => r.tier === 'safety');

    // 记录决策记忆
    await this.memoryManager.remember(userId, {
      type: MemoryType.DECISION,
      category: 'school_recommendation',
      content: `用户获取了AI选校建议，包含${reach.length}所冲刺校、${match.length}所匹配校、${safety.length}所保底校。${response.summary}`,
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

    // 记录学校实体
    for (const rec of response.recommendations.slice(0, 5)) {
      await this.memoryManager.recordEntity(userId, {
        type: EntityType.SCHOOL,
        name: rec.schoolName,
        description: `AI推荐的${rec.tier === 'reach' ? '冲刺校' : rec.tier === 'match' ? '匹配校' : '保底校'}，契合度${rec.fitScore}%`,
        attributes: {
          schoolId: rec.schoolId,
          tier: rec.tier,
          probability: rec.estimatedProbability,
          fitScore: rec.fitScore,
          reasons: rec.reasons,
        },
      });
    }

    // 记录分析结果作为偏好
    if (response.analysis?.strengths?.length > 0) {
      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'profile_analysis',
        content: `申请优势：${response.analysis.strengths.join('、')}`,
        importance: 0.6,
      });
    }

    if (response.analysis?.weaknesses?.length > 0) {
      await this.memoryManager.remember(userId, {
        type: MemoryType.FEEDBACK,
        category: 'improvement',
        content: `需要改进：${response.analysis.weaknesses.join('、')}。建议：${response.analysis.improvementTips?.join('、') || ''}`,
        importance: 0.7,
      });
    }
  }

  /**
   * 记录浏览行为
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
      content: `用户查看了之前的选校建议，包含学校：${schools.join('、')}`,
      importance: 0.3,
      metadata: {
        recommendationId: recommendation.id,
        viewedAt: new Date().toISOString(),
      },
    });
  }
}
