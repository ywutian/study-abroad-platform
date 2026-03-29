import { Injectable, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryType, EntityType } from '@prisma/client';
import { getSchoolDisplayName } from '../../common/utils/locale.util';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { LLMService } from '../ai-agent/core/llm.service';
import {
  extractProfileMetrics,
  extractSchoolMetrics,
  calculateScoreBreakdown,
  calculateOverallScore,
  type ScoreBreakdown,
} from '../../common/utils/scoring';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';

export interface PercentileBands {
  p25: number;
  p50: number;
  p75: number;
}

export interface RankingResult {
  schoolId: string;
  schoolName: string;
  totalApplicants: number;
  yourRank: number;
  yourScore: number;
  percentile: number;
  breakdown: ScoreBreakdown;
  percentiles: {
    academic: number;
    activity: number;
    award: number;
  };
  scoreDistribution: {
    overall: PercentileBands;
    academic: PercentileBands;
    activity: PercentileBands;
    award: PercentileBands;
  };
  competitorStats: {
    avgScore: number;
    medianScore: number;
    totalCount: number;
  };
  competitivePosition: 'strong' | 'moderate' | 'challenging';
}

export interface PublicProfileResponse {
  id: string;
  userId: string;
  grade?: string | null;
  gpa?: number;
  gpaScale?: number;
  targetMajor?: string | null;
  visibility: string;
  _count: {
    testScores: number;
    activities: number;
    awards: number;
  };
}

@Injectable()
export class HallRankingService {
  private readonly logger = new Logger(HallRankingService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private memoryManager?: MemoryManagerService,
    @Optional() private llmService?: LLMService,
  ) {}

  calcBands(values: number[]): PercentileBands {
    if (values.length === 0) return { p25: 0, p50: 0, p75: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const at = (p: number) =>
      Math.round(
        (sorted[Math.floor(sorted.length * p)] ?? sorted[sorted.length - 1]) *
          10,
      ) / 10;
    return { p25: at(0.25), p50: at(0.5), p75: at(0.75) };
  }

  async getPublicProfiles(
    search?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{
    data: PublicProfileResponse[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where: any = {
      visibility: { in: ['ANONYMOUS', 'VERIFIED_ONLY'] },
    };

    if (search) {
      where.targetMajor = { contains: search, mode: 'insensitive' };
    }

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(1, pageSize), 100);

    const [profiles, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        select: {
          id: true,
          userId: true,
          grade: true,
          gpa: true,
          gpaScale: true,
          targetMajor: true,
          visibility: true,
          _count: {
            select: {
              testScores: true,
              activities: true,
              awards: true,
            },
          },
        },
        take: safePageSize,
        skip: (safePage - 1) * safePageSize,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.profile.count({ where }),
    ]);

    const result = profiles.map((p) => ({
      ...p,
      userId:
        p.visibility === 'ANONYMOUS' ? `anon-${p.id.slice(0, 8)}` : p.userId,
      gpa: p.gpa ? Number(p.gpa) : undefined,
      gpaScale: p.gpaScale ? Number(p.gpaScale) : undefined,
    }));

    return { data: result, total, page: safePage, pageSize: safePageSize };
  }

  async getBatchRanking(
    userId: string,
    schoolIds: string[],
    locale = 'zh',
  ): Promise<{ rankings: RankingResult[] }> {
    if (!schoolIds.length) {
      return { rankings: [] };
    }

    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });

    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    if (!userProfile) {
      return { rankings: [] };
    }

    const allSchoolListItems = await this.prisma.schoolListItem.findMany({
      where: {
        schoolId: { in: schoolIds },
        user: {
          profile: {
            visibility: { not: 'PRIVATE' },
          },
        },
      },
      select: { schoolId: true, userId: true },
    });

    const competitorUserIds = [
      ...new Set(allSchoolListItems.map((i) => i.userId)),
    ];

    const allCompetitorProfiles = await this.prisma.profile.findMany({
      where: {
        userId: { in: competitorUserIds },
        visibility: { not: 'PRIVATE' },
      },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    const profileByUserId = new Map(
      allCompetitorProfiles.map((p) => [p.userId, p]),
    );

    const competitorsBySchool = new Map<string, typeof allCompetitorProfiles>();
    for (const item of allSchoolListItems) {
      const profile = profileByUserId.get(item.userId);
      if (!profile) continue;
      if (!competitorsBySchool.has(item.schoolId)) {
        competitorsBySchool.set(item.schoolId, []);
      }
      competitorsBySchool.get(item.schoolId)!.push(profile);
    }

    const rankings: RankingResult[] = [];

    for (const school of schools) {
      const schoolMetrics = extractSchoolMetrics(school);
      const competitors = competitorsBySchool.get(school.id) || [];

      const allProfiles = competitors.find((p) => p.userId === userId)
        ? competitors
        : [...competitors, userProfile];

      const scored = allProfiles.map((p) => ({
        userId: p.userId,
        breakdown: calculateScoreBreakdown(
          extractProfileMetrics(p),
          schoolMetrics,
        ),
      }));

      scored.sort((a, b) => b.breakdown.overall - a.breakdown.overall);

      const userIndex = scored.findIndex((p) => p.userId === userId);
      const userBreakdown = scored[userIndex]?.breakdown || {
        academic: 0,
        activity: 0,
        award: 0,
        overall: 0,
      };

      const calcPercentile = (category: 'academic' | 'activity' | 'award') => {
        const sorted = [...scored].sort(
          (a, b) => b.breakdown[category] - a.breakdown[category],
        );
        const rank = sorted.findIndex((p) => p.userId === userId) + 1;
        return scored.length > 1
          ? Math.round((1 - rank / sorted.length) * 100)
          : 100;
      };

      const overallScores = scored.map((s) => s.breakdown.overall);
      const academicScores = scored.map((s) => s.breakdown.academic);
      const activityScores = scored.map((s) => s.breakdown.activity);
      const awardScores = scored.map((s) => s.breakdown.award);

      const avgScore =
        overallScores.length > 0
          ? Math.round(
              (overallScores.reduce((a, b) => a + b, 0) /
                overallScores.length) *
                10,
            ) / 10
          : 0;

      const userPercentile =
        allProfiles.length > 1
          ? Math.round((1 - (userIndex + 1) / allProfiles.length) * 100)
          : 100;

      const competitivePosition: 'strong' | 'moderate' | 'challenging' =
        userPercentile >= 70
          ? 'strong'
          : userPercentile >= 40
            ? 'moderate'
            : 'challenging';

      rankings.push({
        schoolId: school.id,
        schoolName: getSchoolDisplayName(school, locale),
        totalApplicants: allProfiles.length,
        yourRank: userIndex + 1,
        yourScore: Math.round(userBreakdown.overall * 10) / 10,
        percentile: userPercentile,
        breakdown: userBreakdown,
        percentiles: {
          academic: calcPercentile('academic'),
          activity: calcPercentile('activity'),
          award: calcPercentile('award'),
        },
        scoreDistribution: {
          overall: this.calcBands(overallScores),
          academic: this.calcBands(academicScores),
          activity: this.calcBands(activityScores),
          award: this.calcBands(awardScores),
        },
        competitorStats: {
          avgScore,
          medianScore: this.calcBands(overallScores).p50,
          totalCount: allProfiles.length,
        },
        competitivePosition,
      });
    }

    await this.saveSchoolInterestToMemory(userId, schools, rankings, locale);

    return { rankings };
  }

  private async saveSchoolInterestToMemory(
    userId: string,
    schools: Array<{
      id: string;
      name: string;
      nameZh?: string | null;
      usNewsRank?: number | null;
    }>,
    rankings: RankingResult[],
    locale = 'zh',
  ): Promise<void> {
    if (!this.memoryManager || schools.length === 0) return;

    try {
      for (const school of schools.slice(0, 3)) {
        const ranking = rankings.find((r) => r.schoolId === school.id);
        const isZh = locale === 'zh';
        await this.memoryManager.recordEntity(userId, {
          type: EntityType.SCHOOL,
          name: getSchoolDisplayName(school, locale),
          description: isZh
            ? `US News 排名 #${school.usNewsRank || '未知'}`
            : `US News Rank #${school.usNewsRank || 'N/A'}`,
          attributes: {
            interestLevel: 'high',
            addedAt: new Date().toISOString(),
          },
        });

        if (ranking) {
          const dims = ['academic', 'activity', 'award'] as const;
          const strongest = dims.reduce((a, b) =>
            ranking.percentiles[a] >= ranking.percentiles[b] ? a : b,
          );
          const weakest = dims.reduce((a, b) =>
            ranking.percentiles[a] <= ranking.percentiles[b] ? a : b,
          );
          const schoolDisplayName = getSchoolDisplayName(school, locale);
          const positionLabel = isZh
            ? ranking.competitivePosition === 'strong'
              ? '强'
              : ranking.competitivePosition === 'moderate'
                ? '中等'
                : '待提升'
            : ranking.competitivePosition;

          await this.memoryManager.remember(userId, {
            type: MemoryType.FACT,
            category: 'ranking',
            content: isZh
              ? `用户在 ${schoolDisplayName} 排名第${ranking.yourRank}/${ranking.totalApplicants}（前${ranking.percentile}%），竞争力${positionLabel}。最强维度: ${strongest}，待提升: ${weakest}`
              : `User ranked #${ranking.yourRank}/${ranking.totalApplicants} (top ${ranking.percentile}%) at ${schoolDisplayName}. Competitiveness: ${positionLabel}. Strongest: ${strongest}, Weakest: ${weakest}`,
            importance: 0.7,
            metadata: {
              schoolId: school.id,
              schoolName: school.name,
              rank: ranking.yourRank,
              percentile: ranking.percentile,
              competitivePosition: ranking.competitivePosition,
              breakdown: ranking.breakdown,
              strongestDim: strongest,
              weakestDim: weakest,
              source: 'hall_service',
            },
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to save school interest to memory', error);
    }
  }

  async getProfileRanking(userId: string, schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    const schoolMetrics = school ? extractSchoolMetrics(school) : {};

    const competitors = await this.prisma.profile.findMany({
      where: {
        visibility: { not: 'PRIVATE' },
        user: {
          schoolListItems: {
            some: { schoolId },
          },
        },
      },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    if (!userProfile) {
      return {
        rank: null,
        total: competitors.length,
        message: 'Complete your profile first',
      };
    }

    const allProfiles = competitors.find((p) => p.userId === userId)
      ? competitors
      : [...competitors, userProfile];

    const scoredProfiles = allProfiles.map((p) => ({
      userId: p.userId,
      score: calculateOverallScore(extractProfileMetrics(p), schoolMetrics),
    }));

    scoredProfiles.sort((a, b) => b.score - a.score);

    const userRank = scoredProfiles.findIndex((p) => p.userId === userId) + 1;
    const userScore =
      scoredProfiles.find((p) => p.userId === userId)?.score || 0;

    return {
      rank: userRank,
      total: scoredProfiles.length,
      score: Math.round(userScore * 10) / 10,
      percentile:
        scoredProfiles.length > 1
          ? Math.round((1 - userRank / scoredProfiles.length) * 100)
          : 100,
    };
  }

  async getTargetSchoolRanking(userId: string): Promise<{
    rankings: RankingResult[];
    totalTargetSchools: number;
  }> {
    const schoolListItems = await this.prisma.schoolListItem.findMany({
      where: { userId },
      include: { school: true },
    });

    if (!schoolListItems.length) {
      return { rankings: [], totalTargetSchools: 0 };
    }

    const schoolIds = schoolListItems.map((item) => item.schoolId);
    const rankings = await this.getBatchRanking(userId, schoolIds);

    return {
      rankings: rankings.rankings,
      totalTargetSchools: schoolListItems.length,
    };
  }

  async getRankingAnalysis(
    userId: string,
    schoolId: string,
    locale = 'zh',
  ): Promise<{
    analysis: string;
    strengths: string[];
    improvements: string[];
    competitivePosition: string;
  }> {
    const isZh = locale === 'zh';
    if (!this.llmService) {
      return {
        analysis: isZh
          ? 'AI 分析服务暂时不可用。'
          : 'AI analysis service is temporarily unavailable.',
        strengths: [],
        improvements: [],
        competitivePosition: 'unknown',
      };
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    if (!profile) {
      return {
        analysis: isZh
          ? '请先完善你的档案信息。'
          : 'Please complete your profile first.',
        strengths: [],
        improvements: [],
        competitivePosition: 'unknown',
      };
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return {
        analysis: isZh ? '未找到该学校信息。' : 'School not found.',
        strengths: [],
        improvements: [],
        competitivePosition: 'unknown',
      };
    }

    const rankingData = await this.getProfileRanking(userId, schoolId);
    const metrics = extractProfileMetrics(profile);
    const schoolMetrics = extractSchoolMetrics(school);
    const breakdown = calculateScoreBreakdown(metrics, schoolMetrics);

    const schoolName = isZh ? school.nameZh || school.name : school.name;
    const unknown = isZh ? '未知' : 'Unknown';
    const notFilled = isZh ? '未填写' : 'Not provided';

    const prompt = isZh
      ? `你是一位资深美本申请顾问。请根据以下数据，用中文分析该学生在 ${schoolName} 的竞争力。

## 学生数据
- GPA: ${metrics.gpa || notFilled}${metrics.gpaScale ? `/${metrics.gpaScale}` : ''}
- SAT: ${metrics.satScore || notFilled}
- ACT: ${metrics.actScore || notFilled}
- TOEFL: ${metrics.toeflScore || notFilled}
- 活动数量: ${metrics.activityCount}
- 奖项数量: ${metrics.awardCount}（国家级${metrics.nationalAwardCount}，国际级${metrics.internationalAwardCount}）

## 评分结果
- 学术分: ${breakdown.academic.toFixed(1)}/100
- 活动分: ${breakdown.activity.toFixed(1)}/100
- 奖项分: ${breakdown.award.toFixed(1)}/100
- 综合分: ${breakdown.overall.toFixed(1)}/100

## 排名
- 排名: ${rankingData.rank}/${rankingData.total}
- 百分位: 前${rankingData.percentile}%

## 学校信息
- US News 排名: #${school.usNewsRank || unknown}
- 录取率: ${school.acceptanceRate ? Number(school.acceptanceRate) + '%' : unknown}

请输出 JSON 格式：
{
  "analysis": "综合分析（2-3句话）",
  "strengths": ["优势1", "优势2"],
  "improvements": ["改进建议1", "改进建议2"],
  "competitivePosition": "strong|moderate|challenging"
}

只输出 JSON，不要其他内容。`
      : `You are a senior US college admissions consultant. Based on the following data, analyze this student's competitiveness at ${schoolName}.

## Student Data
- GPA: ${metrics.gpa || notFilled}${metrics.gpaScale ? `/${metrics.gpaScale}` : ''}
- SAT: ${metrics.satScore || notFilled}
- ACT: ${metrics.actScore || notFilled}
- TOEFL: ${metrics.toeflScore || notFilled}
- Activities: ${metrics.activityCount}
- Awards: ${metrics.awardCount} (National: ${metrics.nationalAwardCount}, International: ${metrics.internationalAwardCount})

## Score Breakdown
- Academic: ${breakdown.academic.toFixed(1)}/100
- Activities: ${breakdown.activity.toFixed(1)}/100
- Awards: ${breakdown.award.toFixed(1)}/100
- Overall: ${breakdown.overall.toFixed(1)}/100

## Ranking
- Rank: ${rankingData.rank}/${rankingData.total}
- Percentile: Top ${rankingData.percentile}%

## School Info
- US News Rank: #${school.usNewsRank || unknown}
- Acceptance Rate: ${school.acceptanceRate ? Number(school.acceptanceRate) + '%' : unknown}

Output in JSON format:
{
  "analysis": "Comprehensive analysis (2-3 sentences)",
  "strengths": ["Strength 1", "Strength 2"],
  "improvements": ["Improvement suggestion 1", "Improvement suggestion 2"],
  "competitivePosition": "strong|moderate|challenging"
}

Output only JSON, nothing else.`;

    try {
      const response = await this.llmService.chatSimpleGuarded([
        { role: 'user', content: prompt },
      ]);

      const parsed = extractJsonFromLlm<{
        analysis: string;
        strengths: string[];
        improvements: string[];
        competitivePosition: 'strong' | 'moderate' | 'challenging' | 'unknown';
      }>(response);

      if (parsed.analysis && Array.isArray(parsed.strengths)) {
        return {
          analysis: parsed.analysis,
          strengths: parsed.strengths,
          improvements: parsed.improvements || [],
          competitivePosition: parsed.competitivePosition || 'unknown',
        };
      }
    } catch (error) {
      this.logger.warn('AI ranking analysis failed', error);
    }

    return {
      analysis: isZh
        ? 'AI 分析暂时不可用，请稍后再试。'
        : 'AI analysis is temporarily unavailable. Please try again later.',
      strengths: [],
      improvements: [],
      competitivePosition: 'unknown',
    };
  }
}
