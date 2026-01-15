import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { MemoryManagerService } from '../ai-agent/memory';
import { MemoryType, EntityType } from '@prisma/client';
import {
  SchoolRecommendationRequestDto,
  SchoolRecommendationResponseDto,
  RecommendedSchoolDto,
  RecommendationAnalysisDto,
} from './dto';

const POINTS_COST = 25;

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    @Optional() private memoryManager?: MemoryManagerService,
  ) {}

  /**
   * 生成 AI 选校建议
   */
  async generateRecommendation(
    userId: string,
    dto: SchoolRecommendationRequestDto,
  ): Promise<SchoolRecommendationResponseDto> {
    // 检查积分
    await this.checkAndDeductPoints(userId, POINTS_COST);

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
      await this.refundPoints(userId, POINTS_COST);
      throw new NotFoundException('请先完善个人档案');
    }

    // 构建 AI Prompt
    const systemPrompt = `你是一位资深留学顾问，擅长根据学生背景推荐最适合的美国大学。

请根据学生档案推荐 ${dto.schoolCount || 15} 所学校，分为三档：
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
      "reasons": ["推荐理由1", "推荐理由2"],
      "concerns": ["需要注意的点"]
    }
  ],
  "analysis": {
    "strengths": ["学生申请优势1", "优势2"],
    "weaknesses": ["需要改进的方面1"],
    "improvementTips": ["提升建议1", "建议2"]
  },
  "summary": "选校策略总结（100-150字）"
}`;

    const userPrompt = this.buildUserPrompt(profile, dto);

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
        throw new Error('Failed to parse AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const tokenUsed = this.estimateTokens(userPrompt + result);

      // 尝试匹配数据库中的学校
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

      // 写入记忆系统
      this.recordRecommendationToMemory(userId, response).catch((err) => {
        this.logger.warn('Failed to record recommendation to memory', err);
      });

      return response;
    } catch (error) {
      await this.refundPoints(userId, POINTS_COST);
      this.logger.error('School recommendation failed', error);
      throw new BadRequestException('生成选校建议失败，请重试');
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
  ): string {
    const parts: string[] = ['请根据以下学生档案推荐选校清单：\n'];

    // GPA
    if (profile.gpa) {
      parts.push(`GPA: ${profile.gpa}/${profile.gpaScale || 4.0}`);
    }

    // 标化成绩
    if (profile.testScores?.length) {
      const scores = profile.testScores
        .map((s: any) => `${s.type}: ${s.score}`)
        .join(', ');
      parts.push(`标化成绩: ${scores}`);
    }

    // 活动
    if (profile.activities?.length) {
      const activities = profile.activities
        .slice(0, 5)
        .map((a: any) => `${a.name || a.category}(${a.role})`)
        .join(', ');
      parts.push(`主要活动: ${activities}`);
    }

    // 奖项
    if (profile.awards?.length) {
      const awards = profile.awards
        .slice(0, 5)
        .map((a: any) => `${a.name}(${a.level})`)
        .join(', ');
      parts.push(`奖项: ${awards}`);
    }

    // 目标专业
    if (profile.targetMajor) {
      parts.push(`目标专业: ${profile.targetMajor}`);
    }

    // 用户偏好
    if (dto.preferredRegions?.length) {
      parts.push(`偏好地区: ${dto.preferredRegions.join(', ')}`);
    }
    if (dto.preferredMajors?.length) {
      parts.push(`意向专业: ${dto.preferredMajors.join(', ')}`);
    }
    if (dto.budget) {
      const budgetMap = {
        low: '< $30,000/年',
        medium: '$30,000 - $60,000/年',
        high: '$60,000 - $80,000/年',
        unlimited: '不限',
      };
      parts.push(`预算: ${budgetMap[dto.budget]}`);
    }
    if (dto.additionalPreferences) {
      parts.push(`其他偏好: ${dto.additionalPreferences}`);
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
    // 尝试从数据库中匹配学校
    const schoolNames = recommendations.map((r) => r.schoolName);
    const schools = await this.prisma.school.findMany({
      where: {
        OR: [{ name: { in: schoolNames } }, { nameZh: { in: schoolNames } }],
      },
    });

    const schoolMap = new Map<string, string>();
    schools.forEach((s) => {
      schoolMap.set(s.name.toLowerCase(), s.id);
      if (s.nameZh) schoolMap.set(s.nameZh.toLowerCase(), s.id);
    });

    return recommendations.map((r) => ({
      ...r,
      schoolId: schoolMap.get(r.schoolName.toLowerCase()) || undefined,
    }));
  }

  private async checkAndDeductPoints(
    userId: string,
    points: number,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (!user || user.points < points) {
      throw new BadRequestException(`积分不足，需要 ${points} 积分`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { points: { decrement: points } },
    });

    await this.prisma.pointHistory.create({
      data: {
        userId,
        action: 'AI_SCHOOL_RECOMMENDATION',
        points: -points,
        metadata: { service: 'recommendation' },
      },
    });
  }

  private async refundPoints(userId: string, points: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { points: { increment: points } },
    });

    await this.prisma.pointHistory.create({
      data: {
        userId,
        action: 'AI_RECOMMENDATION_REFUND',
        points: points,
        metadata: { reason: 'service_error' },
      },
    });
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 3);
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
