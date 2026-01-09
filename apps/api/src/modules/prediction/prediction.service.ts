import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { RedisService } from '../../common/redis/redis.service';
import { PredictionResultDto, PredictionFactor, PredictionComparison } from './dto';
import {
  buildPredictionPrompt,
  ProfileInput,
  SchoolInput,
} from './utils/prompt-builder';
import {
  ProfileMetrics,
  SchoolMetrics,
  calculateOverallScore,
  calculateProbability,
  calculateTier,
  calculateConfidence,
  normalizeGpa,
} from './utils/score-calculator';

const CACHE_TTL = 3600; // 1 hour in seconds
const CACHE_PREFIX = 'prediction:';

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private redis: RedisService,
  ) {}

  /**
   * 生成缓存 key
   */
  private getCacheKey(profileId: string, schoolId: string): string {
    return `${CACHE_PREFIX}${profileId}:${schoolId}`;
  }

  /**
   * 从 Redis 缓存获取预测结果
   */
  private async getFromCache(profileId: string, schoolId: string): Promise<PredictionResultDto | null> {
    const key = this.getCacheKey(profileId, schoolId);
    
    try {
      const cached = await this.redis.getJSON<PredictionResultDto>(key);
      
      if (cached) {
        this.logger.debug(`Cache hit for ${key}`);
        return { ...cached, fromCache: true };
      }
    } catch (error) {
      this.logger.warn(`Failed to get from cache: ${key}`, error);
    }
    
    return null;
  }

  /**
   * 保存预测结果到 Redis 缓存
   */
  private async saveToCache(profileId: string, schoolId: string, result: PredictionResultDto): Promise<void> {
    const key = this.getCacheKey(profileId, schoolId);
    
    try {
      await this.redis.setJSON(key, result, CACHE_TTL);
      this.logger.debug(`Cached prediction for ${key}`);
    } catch (error) {
      this.logger.warn(`Failed to save to cache: ${key}`, error);
    }
  }

  /**
   * 清除用户的预测缓存（当 Profile 更新时调用）
   */
  async invalidateUserCache(profileId: string): Promise<void> {
    try {
      // 获取用户所有的预测记录
      const predictions = await this.prisma.predictionResult.findMany({
        where: { profileId },
        select: { schoolId: true },
      });

      // 批量删除缓存
      for (const pred of predictions) {
        const key = this.getCacheKey(profileId, pred.schoolId);
        await this.redis.del(key);
      }

      this.logger.log(`Invalidated ${predictions.length} prediction cache entries for profile ${profileId}`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache for profile ${profileId}`, error);
    }
  }

  /**
   * 将数据库 Profile 转换为 ProfileInput
   */
  private profileToInput(profile: any): ProfileInput {
    return {
      gpa: profile.gpa ? Number(profile.gpa) : undefined,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      grade: profile.grade,
      currentSchoolType: profile.currentSchoolType,
      targetMajor: profile.targetMajor,
      testScores: (profile.testScores || []).map((s: any) => ({
        type: s.type,
        score: s.score,
        subScores: s.subScores,
      })),
      activities: (profile.activities || []).map((a: any) => ({
        category: a.category,
        role: a.role,
        hoursPerWeek: a.hoursPerWeek,
        weeksPerYear: a.weeksPerYear,
      })),
      awards: (profile.awards || []).map((a: any) => ({
        level: a.level,
        name: a.name,
      })),
    };
  }

  /**
   * 将数据库 School 转换为 SchoolInput
   */
  private schoolToInput(school: any): SchoolInput {
    return {
      id: school.id,
      name: school.name,
      nameZh: school.nameZh,
      acceptanceRate: school.acceptanceRate ? Number(school.acceptanceRate) : undefined,
      satAvg: school.satAvg,
      actAvg: school.actAvg,
      usNewsRank: school.usNewsRank,
    };
  }

  /**
   * 提取 ProfileMetrics
   */
  private extractProfileMetrics(profile: ProfileInput): ProfileMetrics {
    const satScore = profile.testScores.find(s => s.type === 'SAT')?.score;
    const actScore = profile.testScores.find(s => s.type === 'ACT')?.score;
    const toeflScore = profile.testScores.find(s => s.type === 'TOEFL')?.score;

    const nationalAwardCount = profile.awards.filter(a => a.level === 'NATIONAL').length;
    const internationalAwardCount = profile.awards.filter(a => a.level === 'INTERNATIONAL').length;

    return {
      gpa: profile.gpa,
      gpaScale: profile.gpaScale,
      satScore,
      actScore,
      toeflScore,
      activityCount: profile.activities.length,
      awardCount: profile.awards.length,
      nationalAwardCount,
      internationalAwardCount,
    };
  }

  /**
   * 提取 SchoolMetrics
   */
  private extractSchoolMetrics(school: SchoolInput): SchoolMetrics {
    return {
      acceptanceRate: school.acceptanceRate,
      satAvg: school.satAvg,
      actAvg: school.actAvg,
      usNewsRank: school.usNewsRank,
    };
  }

  /**
   * 使用 AI 进行预测
   */
  private async predictWithAI(profile: ProfileInput, school: SchoolInput): Promise<PredictionResultDto> {
    const prompt = buildPredictionPrompt(profile, school);

    try {
      const response = await this.aiService.chat(
        [
          { role: 'system', content: 'You are an expert college admissions consultant. Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3, maxTokens: 1500 }
      );

      // 解析 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          schoolId: school.id,
          schoolName: school.nameZh || school.name,
          probability: parsed.probability,
          confidence: parsed.confidence,
          tier: parsed.tier,
          factors: parsed.factors || [],
          suggestions: parsed.suggestions || [],
          comparison: parsed.comparison || {
            gpaPercentile: 50,
            testScorePercentile: 50,
            activityStrength: 'average',
          },
        };
      }

      throw new Error('Invalid JSON response from AI');
    } catch (error) {
      this.logger.warn(`AI prediction failed for school ${school.id}, using fallback`, error);
      // 降级到统计算法
      return this.predictWithStats(profile, school);
    }
  }

  /**
   * 使用统计算法进行预测（降级方案）
   */
  private predictWithStats(profile: ProfileInput, school: SchoolInput): PredictionResultDto {
    const profileMetrics = this.extractProfileMetrics(profile);
    const schoolMetrics = this.extractSchoolMetrics(school);

    const overallScore = calculateOverallScore(profileMetrics, schoolMetrics);
    const probability = calculateProbability(overallScore, schoolMetrics);
    const tier = calculateTier(probability, schoolMetrics);
    const confidence = calculateConfidence(profileMetrics, schoolMetrics);

    // 生成因素分析
    const factors: PredictionFactor[] = [];

    if (profileMetrics.gpa) {
      const normalizedGpa = normalizeGpa(profileMetrics.gpa, profileMetrics.gpaScale || 4);
      const isGood = normalizedGpa >= 3.7;
      factors.push({
        name: 'GPA',
        impact: isGood ? 'positive' : normalizedGpa >= 3.3 ? 'neutral' : 'negative',
        weight: 0.3,
        detail: isGood 
          ? `GPA ${normalizedGpa.toFixed(2)} 具有较强竞争力` 
          : `GPA ${normalizedGpa.toFixed(2)} 需要其他方面弥补`,
        improvement: !isGood ? '建议在剩余学期提高GPA，选修有把握的课程' : undefined,
      });
    }

    if (profileMetrics.satScore) {
      const isGood = profileMetrics.satScore >= (schoolMetrics.satAvg || 1400);
      factors.push({
        name: '标化成绩',
        impact: isGood ? 'positive' : 'negative',
        weight: 0.25,
        detail: isGood
          ? `SAT ${profileMetrics.satScore} 达到或超过学校平均水平`
          : `SAT ${profileMetrics.satScore} 略低于学校平均水平`,
        improvement: !isGood ? '建议考虑重考SAT或提交ACT成绩' : undefined,
      });
    }

    if (profileMetrics.activityCount > 0) {
      const isGood = profileMetrics.activityCount >= 5;
      factors.push({
        name: '活动经历',
        impact: isGood ? 'positive' : 'neutral',
        weight: 0.25,
        detail: isGood
          ? `${profileMetrics.activityCount}项活动展示了多元化兴趣`
          : `${profileMetrics.activityCount}项活动，建议增加深度参与`,
        improvement: !isGood ? '建议在现有活动中发挥领导作用' : undefined,
      });
    }

    if (profileMetrics.awardCount > 0) {
      const hasTopAwards = profileMetrics.nationalAwardCount > 0 || profileMetrics.internationalAwardCount > 0;
      factors.push({
        name: '获奖情况',
        impact: hasTopAwards ? 'positive' : 'neutral',
        weight: 0.2,
        detail: hasTopAwards
          ? `拥有国家级或国际级奖项，增强竞争力`
          : `${profileMetrics.awardCount}项奖项，建议争取更高级别奖项`,
        improvement: !hasTopAwards ? '建议参加含金量较高的学科竞赛' : undefined,
      });
    }

    // 生成建议
    const suggestions: string[] = [];
    if (tier === 'reach') {
      suggestions.push('作为冲刺校，建议在文书中充分展示独特性');
      suggestions.push('考虑申请该校特定项目或早申请以增加录取机会');
    } else if (tier === 'match') {
      suggestions.push('作为匹配校，保持现有优势的同时完善申请材料');
    } else {
      suggestions.push('作为保底校，确保申请材料质量，展示对学校的真诚兴趣');
    }

    // 生成对比数据
    const comparison: PredictionComparison = {
      gpaPercentile: profileMetrics.gpa 
        ? Math.min(99, Math.round(normalizeGpa(profileMetrics.gpa, profileMetrics.gpaScale || 4) / 4 * 100))
        : 50,
      testScorePercentile: profileMetrics.satScore
        ? Math.min(99, Math.round((profileMetrics.satScore - 1000) / 600 * 100))
        : 50,
      activityStrength: profileMetrics.activityCount >= 7 ? 'strong' 
        : profileMetrics.activityCount >= 4 ? 'average' 
        : 'weak',
    };

    return {
      schoolId: school.id,
      schoolName: school.nameZh || school.name,
      probability,
      confidence,
      tier,
      factors,
      suggestions,
      comparison,
    };
  }

  /**
   * 主预测方法
   */
  async predict(profileId: string, schoolIds: string[], forceRefresh = false): Promise<PredictionResultDto[]> {
    // 获取 Profile
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        testScores: true,
        activities: true,
        awards: true,
      },
    });

    if (!profile) {
      return [];
    }

    // 获取学校
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });

    const profileInput = this.profileToInput(profile);
    const results: PredictionResultDto[] = [];

    for (const school of schools) {
      // 检查缓存
      if (!forceRefresh) {
        const cached = await this.getFromCache(profileId, school.id);
        if (cached) {
          results.push(cached);
          continue;
        }
      }

      const schoolInput = this.schoolToInput(school);
      let result: PredictionResultDto;

      // 尝试使用 AI，失败则降级到统计算法
      try {
        result = await this.predictWithAI(profileInput, schoolInput);
      } catch {
        result = this.predictWithStats(profileInput, schoolInput);
      }

      // 保存到缓存
      await this.saveToCache(profileId, school.id, result);
      
      // 保存到数据库
      await this.savePrediction(profileId, school.id, result);

      results.push(result);
    }

    // 按概率排序
    results.sort((a, b) => b.probability - a.probability);

    return results;
  }

  /**
   * 保存预测结果到数据库
   */
  private async savePrediction(profileId: string, schoolId: string, result: PredictionResultDto): Promise<void> {
    try {
      // 先检查是否存在
      const existing = await this.prisma.predictionResult.findFirst({
        where: { profileId, schoolId },
      });

      if (existing) {
        await this.prisma.predictionResult.update({
          where: { id: existing.id },
          data: {
            probability: result.probability,
            factors: result.factors as any,
            modelVersion: 'ai-v1',
          },
        });
      } else {
        await this.prisma.predictionResult.create({
          data: {
            profileId,
            schoolId,
            probability: result.probability,
            factors: result.factors as any,
            modelVersion: 'ai-v1',
          },
        });
      }
    } catch (error) {
      this.logger.warn('Failed to save prediction to database', error);
    }
  }

  /**
   * 获取预测历史
   */
  async getPredictionHistory(profileId: string) {
    return this.prisma.predictionResult.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        profile: false,
      },
    });
  }
}
