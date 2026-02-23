import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { RedisService } from '../../common/redis/redis.service';
import { MemoryManagerService } from '../ai-agent/memory';
import { MemoryType, EntityType } from '@prisma/client';
import {
  SchoolRecommendationRequestDto,
  SchoolRecommendationResponseDto,
  RecommendedSchoolDto,
  RecommendationAnalysisDto,
} from './dto';
import {
  CaseIncentiveService,
  PointAction,
} from '../case/case-incentive.service';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
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
        activities: true,
        awards: { include: { competition: true } },
        education: true,
      },
    });

    if (!profile) {
      await this.caseIncentiveService
        .refund(userId, PointAction.AI_SCHOOL_RECOMMENDATION)
        .catch((err) => {
          this.logger.error('CRITICAL: refund failed after profile not found', {
            userId,
            error: err instanceof Error ? err.message : err,
          });
        });
      throw new NotFoundException(
        isZh ? '请先完善个人档案' : 'Please complete your profile first',
      );
    }

    // 构建 AI Prompt
    const schoolCount = dto.schoolCount || 15;
    const systemPrompt = isZh
      ? `你是一位资深留学顾问，擅长根据学生背景推荐最适合的美国大学。

请根据学生档案推荐 ${schoolCount} 所学校，分为三档：
1. 冲刺校 (Reach): 约占30%，录取概率 < 30%
2. 匹配校 (Match): 约占40%，录取概率 30-60%
3. 保底校 (Safety): 约占30%，录取概率 > 60%

评估维度：
- 学术匹配度：GPA、标化成绩与学校平均水平的对比
- 专业契合度：学校在该专业的排名和资源
- 活动/奖项匹配：课外活动与学校文化的契合
- 地理位置、费用等偏好

返回严格的 JSON 格式：
{
  "recommendations": [
    {
      "schoolName": "学校英文名",
      "tier": "reach" | "match" | "safety",
      "estimatedProbability": 25,
      "fitScore": 85,
      "reasons": ["推荐理由1（中文）", "推荐理由2（中文）"],
      "concerns": ["需要注意的点（中文）"]
    }
  ],
  "analysis": {
    "strengths": ["学生申请优势1（中文）", "优势2（中文）"],
    "weaknesses": ["需要改进的方面1（中文）"],
    "improvementTips": ["提升建议1（中文）", "建议2（中文）"]
  },
  "summary": "选校策略总结（中文，100-150字）"
}

所有文本字段必须用中文。`
      : `You are an expert college admissions consultant who specializes in recommending the best-fit US universities based on student profiles.

Based on the student profile, recommend ${schoolCount} schools in three tiers:
1. Reach: ~30% of list, admission probability < 30%
2. Match: ~40% of list, admission probability 30-60%
3. Safety: ~30% of list, admission probability > 60%

Evaluation dimensions:
- Academic fit: GPA and test scores vs. school averages
- Major fit: school ranking and resources in the target major
- Activity/award fit: extracurriculars aligned with school culture
- Location, cost, and other preferences

Return strict JSON:
{
  "recommendations": [
    {
      "schoolName": "School English Name",
      "tier": "reach" | "match" | "safety",
      "estimatedProbability": 25,
      "fitScore": 85,
      "reasons": ["Reason 1 (English)", "Reason 2 (English)"],
      "concerns": ["Concern (English)"]
    }
  ],
  "analysis": {
    "strengths": ["Strength 1 (English)", "Strength 2 (English)"],
    "weaknesses": ["Area for improvement (English)"],
    "improvementTips": ["Tip 1 (English)", "Tip 2 (English)"]
  },
  "summary": "School selection strategy summary (English, 100-150 words)"
}

All text fields must be in English.`;

    const userPrompt = this.buildUserPrompt(profile, dto, locale);

    try {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.6, maxTokens: 4000 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response: no JSON block found');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        this.logger.error('AI response JSON parse failed', {
          userId,
          rawResponse: result.substring(0, 500),
          error: parseError instanceof Error ? parseError.message : parseError,
        });
        throw new Error('Failed to parse AI response JSON');
      }

      // 校验 AI 响应结构
      if (!Array.isArray(parsed.recommendations)) {
        throw new Error('Invalid AI response: missing recommendations');
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
      this.recordRecommendationToMemory(userId, response).catch((err) => {
        this.logger.warn('Failed to record recommendation to memory', err);
      });

      // 桥接：将推荐结果同步到 PredictionResult（异步非阻塞）
      this.syncToPredictionResult(userId, recommendations).catch((err) => {
        this.logger.warn('Failed to sync recommendation to predictions', err);
      });

      return response;
    } catch (error) {
      await this.caseIncentiveService
        .refund(userId, PointAction.AI_SCHOOL_RECOMMENDATION)
        .catch((refundErr) => {
          this.logger.error(
            'CRITICAL: refund failed after recommendation error',
            {
              userId,
              originalError: error instanceof Error ? error.message : error,
              refundError:
                refundErr instanceof Error ? refundErr.message : refundErr,
            },
          );
        });
      this.logger.error('School recommendation failed', error);
      throw new BadRequestException(
        isZh
          ? '生成选校建议失败，请重试'
          : 'Failed to generate school recommendations, please try again',
      );
    }
  }

  /**
   * 桥接：将推荐结果同步到统一的 PredictionResult 表
   * 使 recommendation 生成的数据可在学校详情页、选校清单、仪表盘中复用
   */
  private async syncToPredictionResult(
    userId: string,
    recommendations: RecommendedSchoolDto[],
  ): Promise<void> {
    const profile = await this.prisma.profile.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return;

    for (const rec of recommendations) {
      if (!rec.schoolId) continue;

      const probability = rec.estimatedProbability / 100;

      try {
        // 防覆盖：不覆盖更高质量的 v2-ensemble 预测结果
        const existing = await this.prisma.predictionResult.findUnique({
          where: {
            profileId_schoolId: {
              profileId: profile.id,
              schoolId: rec.schoolId,
            },
          },
          select: { modelVersion: true },
        });

        if (
          existing?.modelVersion === 'v3-enterprise' ||
          existing?.modelVersion === 'v2-ensemble'
        )
          continue;

        await this.prisma.predictionResult.upsert({
          where: {
            profileId_schoolId: {
              profileId: profile.id,
              schoolId: rec.schoolId,
            },
          },
          update: {
            probability,
            tier: rec.tier,
            confidence: 'medium',
            factors: rec.reasons.map((r) => ({
              name: r,
              impact: 'neutral' as const,
              weight: 0,
              detail: r,
            })) as any,
            suggestions: rec.concerns || ([] as any),
            modelVersion: 'v1-recommendation-ai',
            source: 'recommendation',
          },
          create: {
            profileId: profile.id,
            schoolId: rec.schoolId,
            probability,
            tier: rec.tier,
            confidence: 'medium',
            factors: rec.reasons.map((r) => ({
              name: r,
              impact: 'neutral' as const,
              weight: 0,
              detail: r,
            })) as any,
            suggestions: rec.concerns || ([] as any),
            modelVersion: 'v1-recommendation-ai',
            source: 'recommendation',
          },
        });

        // 写入历史快照
        await this.prisma.predictionSnapshot.create({
          data: {
            profileId: profile.id,
            schoolId: rec.schoolId,
            probability,
            tier: rec.tier,
            confidence: 'medium',
            source: 'recommendation',
            modelVersion: 'v1-recommendation-ai',
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to sync recommendation for school ${rec.schoolId}`,
          error,
        );
      }
    }

    // 写入记忆系统
    if (this.memoryManager) {
      const schools = recommendations
        .filter((r) => r.schoolId)
        .slice(0, 5)
        .map((r) => ({
          name: r.schoolName,
          probability: r.estimatedProbability / 100,
          tier: r.tier,
        }));

      if (schools.length > 0) {
        const summary = schools
          .map(
            (s) =>
              `${s.name} ${(s.probability * 100).toFixed(0)}%(${
                s.tier === 'reach'
                  ? '冲刺'
                  : s.tier === 'match'
                    ? '匹配'
                    : '保底'
              })`,
          )
          .join(', ');

        await this.memoryManager
          .remember(userId, {
            type: MemoryType.FACT,
            category: 'school_prediction',
            content: `通过智能选校获得预测: ${summary}`,
            importance: 0.5,
            metadata: {
              source: 'recommendation',
              schoolCount: schools.length,
              topSchools: schools,
              timestamp: new Date().toISOString(),
            },
          })
          .catch((err) => {
            this.logger.warn('Failed to record bridge prediction memory', err);
          });
      }
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
    this.recordViewToMemory(userId, recommendation).catch((err) => {
      this.logger.warn('Failed to record view to memory', err);
    });

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

  private buildUserPrompt(
    profile: any,
    dto: SchoolRecommendationRequestDto,
    locale = 'zh',
  ): string {
    const isZh = locale === 'zh';
    const parts: string[] = [
      isZh
        ? '请根据以下学生档案推荐选校清单：\n'
        : 'Based on the following student profile, recommend a school list:\n',
    ];

    if (profile.gpa) {
      parts.push(`GPA: ${profile.gpa}/${profile.gpaScale || 4.0}`);
    }

    if (profile.testScores?.length) {
      const scores = profile.testScores
        .map((s: any) => `${s.type}: ${s.score}`)
        .join(', ');
      parts.push(`${isZh ? '标化成绩' : 'Test Scores'}: ${scores}`);
    }

    if (profile.activities?.length) {
      const activities = profile.activities
        .slice(0, 5)
        .map((a: any) => `${a.name || a.category}(${a.role})`)
        .join(', ');
      parts.push(`${isZh ? '主要活动' : 'Key Activities'}: ${activities}`);
    }

    if (profile.awards?.length) {
      const awards = profile.awards
        .slice(0, 5)
        .map((a: any) => `${a.name}(${a.level})`)
        .join(', ');
      parts.push(`${isZh ? '奖项' : 'Awards'}: ${awards}`);
    }

    if (profile.targetMajor) {
      parts.push(
        `${isZh ? '目标专业' : 'Target Major'}: ${profile.targetMajor}`,
      );
    }

    if (dto.preferredRegions?.length) {
      parts.push(
        `${isZh ? '偏好地区' : 'Preferred Regions'}: ${dto.preferredRegions.join(', ')}`,
      );
    }
    if (dto.preferredMajors?.length) {
      parts.push(
        `${isZh ? '意向专业' : 'Intended Majors'}: ${dto.preferredMajors.join(', ')}`,
      );
    }
    if (dto.budget) {
      const budgetMap = {
        low: isZh ? '< $30,000/年' : '< $30,000/year',
        medium: isZh ? '$30,000 - $60,000/年' : '$30,000 - $60,000/year',
        high: isZh ? '$60,000 - $80,000/年' : '$60,000 - $80,000/year',
        unlimited: isZh ? '不限' : 'No limit',
      };
      parts.push(`${isZh ? '预算' : 'Budget'}: ${budgetMap[dto.budget]}`);
    }
    if (dto.additionalPreferences) {
      parts.push(
        `${isZh ? '其他偏好' : 'Other Preferences'}: ${dto.additionalPreferences}`,
      );
    }

    return parts.join('\n');
  }

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
      select: {
        id: true,
        name: true,
        nameZh: true,
        aliases: true,
        usNewsRank: true,
        acceptanceRate: true,
        city: true,
        state: true,
        tuition: true,
        isPrivate: true,
      },
    });

    return recommendations.map((r: any) => {
      const matched = this.findBestMatch(r.schoolName, schools);
      return {
        ...r,
        schoolId: matched?.id || undefined,
        schoolMeta: matched
          ? {
              nameZh: matched.nameZh,
              usNewsRank: matched.usNewsRank,
              acceptanceRate: matched.acceptanceRate
                ? Number(matched.acceptanceRate)
                : undefined,
              city: matched.city,
              state: matched.state,
              tuition: matched.tuition,
              isPrivate: matched.isPrivate,
            }
          : undefined,
      };
    });
  }

  private findBestMatch(
    name: string,
    candidates: Array<{
      id: string;
      name: string;
      nameZh: string | null;
      aliases: string[];
      usNewsRank: number | null;
      acceptanceRate: any;
      city: string | null;
      state: string | null;
      tuition: number | null;
      isPrivate: boolean;
    }>,
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
