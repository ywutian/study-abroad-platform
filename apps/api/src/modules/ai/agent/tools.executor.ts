/**
 * Agent 工具执行器 - 执行具体的工具调用
 */

import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../ai.service';
import { AgentTool, ToolResult, AgentContext } from './agent.types';
import { PredictionService } from '../../prediction/prediction.service';
import { AssessmentService } from '../../assessment/assessment.service';
import { ForumService } from '../../forum/forum.service';
import { SwipeService } from '../../swipe/swipe.service';
import { HallService } from '../../hall/hall.service';
import { WebSearchService } from '../../ai-agent/services/web-search.service';
import { normalizeSchoolName } from '../../../common/utils/school-name.util';
import { getSchoolDisplayName } from '../../../common/utils/locale.util';

@Injectable()
export class ToolExecutor implements OnModuleInit {
  private readonly logger = new Logger(ToolExecutor.name);

  private predictionService!: PredictionService;
  private assessmentService!: AssessmentService;
  private forumService!: ForumService;
  private swipeService!: SwipeService;
  private hallService!: HallService;

  constructor(
    private moduleRef: ModuleRef,
    private prisma: PrismaService,
    private aiService: AiService,
    @Optional()
    private webSearchService?: WebSearchService,
  ) {}

  onModuleInit() {
    this.predictionService = this.moduleRef.get(PredictionService, {
      strict: false,
    });
    this.assessmentService = this.moduleRef.get(AssessmentService, {
      strict: false,
    });
    this.forumService = this.moduleRef.get(ForumService, { strict: false });
    this.swipeService = this.moduleRef.get(SwipeService, { strict: false });
    this.hallService = this.moduleRef.get(HallService, { strict: false });
  }

  /**
   * 执行工具调用
   */
  async execute(
    toolName: string,
    args: Record<string, any>,
    userId: string,
    context: AgentContext,
  ): Promise<ToolResult> {
    const toolCallId = `call_${Date.now()}`;
    const locale = context.locale || 'zh';
    const isZh = locale === 'zh';

    try {
      let result: any;

      switch (toolName as AgentTool) {
        case AgentTool.GET_PROFILE:
          result = await this.getProfile(userId, locale);
          break;

        case AgentTool.UPDATE_PROFILE:
          result = await this.updateProfile(
            userId,
            args.field,
            args.value,
            locale,
          );
          break;

        case AgentTool.SEARCH_SCHOOLS:
          result = await this.searchSchools(args);
          break;

        case AgentTool.GET_SCHOOL_DETAILS:
          result = await this.getSchoolDetails(
            args.schoolId,
            args.schoolName,
            locale,
          );
          break;

        case AgentTool.COMPARE_SCHOOLS:
          result = await this.compareSchools(
            args.schoolIds?.split(','),
            args.aspects,
            locale,
          );
          break;

        case AgentTool.GET_ESSAYS:
          result = await this.getEssays(userId, locale);
          break;

        case AgentTool.REVIEW_ESSAY:
          result = await this.reviewEssay(args, userId, locale);
          break;

        case AgentTool.POLISH_ESSAY:
          result = await this.aiService.polishEssay(
            args.content,
            args.style,
            locale,
          );
          break;

        case AgentTool.GENERATE_OUTLINE:
          result = await this.generateOutline(
            args as { prompt: string; background?: string; wordLimit?: number },
            locale,
          );
          break;

        case AgentTool.BRAINSTORM_IDEAS:
          result = await this.aiService.generateEssayIdeas(
            args.prompt,
            args.background,
            locale,
          );
          break;

        case AgentTool.RECOMMEND_SCHOOLS:
          result = await this.recommendSchools(userId, context, args, locale);
          break;

        case AgentTool.ANALYZE_ADMISSION_CHANCE:
          result = await this.analyzeAdmissionChance(
            userId,
            args,
            context,
            locale,
          );
          break;

        // ============== 预测数据工具 ==============
        case AgentTool.GET_PREDICTION_HISTORY:
          result = await this.getPredictionHistory(userId, args, locale);
          break;

        case AgentTool.GET_PREDICTION_DASHBOARD:
          result = await this.getPredictionDashboard(userId, locale);
          break;

        case AgentTool.GET_SCHOOL_LIST_PREDICTIONS:
          result = await this.getSchoolListPredictions(userId, locale);
          break;

        case AgentTool.SEARCH_CASES:
          result = await this.searchCases(args, locale);
          break;

        case AgentTool.GET_DEADLINES:
          result = await this.getDeadlines(
            args.schoolIds?.split(','),
            args.round,
            locale,
          );
          break;

        case AgentTool.CREATE_TIMELINE:
          result = await this.createTimeline(args, context, locale);
          break;

        case AgentTool.GET_PERSONAL_EVENTS:
          result = await this.getPersonalEvents(userId, args.category, locale);
          break;

        case AgentTool.CREATE_PERSONAL_EVENT:
          result = await this.createPersonalEvent(userId, args as any, locale);
          break;

        // ============== 测评工具 ==============
        case AgentTool.GET_ASSESSMENT_RESULTS:
          result = await this.getAssessmentResults(userId, args.type, locale);
          break;

        case AgentTool.INTERPRET_ASSESSMENT:
          result = await this.interpretAssessment(
            userId,
            args.resultId,
            locale,
          );
          break;

        case AgentTool.SUGGEST_ACTIVITIES_FROM_ASSESSMENT:
          result = await this.suggestActivitiesFromAssessment(
            userId,
            args.resultId,
            args.targetMajor,
            locale,
          );
          break;

        // ============== 论坛工具 ==============
        case AgentTool.SEARCH_FORUM_POSTS:
          result = await this.searchForumPosts(
            args.query,
            args.category,
            args.limit,
            locale,
          );
          break;

        case AgentTool.GET_POPULAR_DISCUSSIONS:
          result = await this.getPopularDiscussions(
            args.category,
            args.timeRange,
            locale,
          );
          break;

        case AgentTool.ANSWER_FORUM_QUESTION:
          result = await this.answerForumQuestion(
            args.question,
            args.context,
            locale,
          );
          break;

        // ============== 案例预测工具 ==============
        case AgentTool.EXPLAIN_CASE_RESULT:
          result = await this.explainCaseResult(args.caseId, locale);
          break;

        case AgentTool.ANALYZE_PREDICTION_ACCURACY:
          result = await this.analyzePredictionAccuracy(userId, locale);
          break;

        case AgentTool.COMPARE_CASE_WITH_PROFILE:
          result = await this.compareCaseWithProfile(
            userId,
            args.caseId,
            locale,
          );
          break;

        // ============== 档案排名工具 ==============
        case AgentTool.ANALYZE_PROFILE_RANKING:
          result = await this.analyzeProfileRanking(
            userId,
            args.schoolId,
            args.schoolName,
            locale,
          );
          break;

        case AgentTool.SUGGEST_PROFILE_IMPROVEMENTS:
          result = await this.suggestProfileImprovements(
            userId,
            args.targetTier,
            locale,
          );
          break;

        case AgentTool.COMPARE_WITH_ADMITTED_PROFILES:
          result = await this.compareWithAdmittedProfiles(
            userId,
            args.schoolId,
            args.schoolName,
            locale,
          );
          break;

        // ============== 外部搜索工具 ==============
        case AgentTool.WEB_SEARCH:
          result = await this.webSearch(args.query, args.topic, locale);
          break;

        case AgentTool.SEARCH_SCHOOL_WEBSITE:
          result = await this.searchSchoolWebsite(
            args.schoolName,
            args.query,
            locale,
          );
          break;

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return { toolCallId, result };
    } catch (error) {
      this.logger.error(`Tool execution failed: ${toolName}`, error);
      return {
        toolCallId,
        result: null,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  // ============== 档案工具实现 ==============

  private async getProfile(userId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: true,
        education: true,
      },
    });

    if (!profile) {
      return {
        message: isZh
          ? '用户档案为空，建议先完善档案信息'
          : 'Profile is empty. Please complete your profile.',
      };
    }

    return {
      gpa: profile.gpa ? Number(profile.gpa) : null,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      targetMajor: profile.targetMajor,
      grade: profile.grade,
      budgetTier: profile.budgetTier,
      testScores: profile.testScores?.map((s) => ({
        type: s.type,
        score: s.score,
        date: s.testDate,
      })),
      activities: profile.activities?.map((a) => ({
        name: a.name,
        category: a.category,
        role: a.role,
        duration: `${a.startDate} - ${a.endDate || (isZh ? '至今' : 'Present')}`,
      })),
      awards: profile.awards?.map((a) => ({
        name: a.name,
        level: a.level,
        year: a.year,
      })),
      education: profile.education?.map((e) => ({
        school: e.schoolName,
        degree: e.degree,
        major: e.major,
      })),
    };
  }

  private async updateProfile(
    userId: string,
    field: string,
    value: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    const allowedFields = ['targetMajor', 'budgetTier'];

    if (!allowedFields.includes(field)) {
      return {
        success: false,
        message: isZh
          ? `不允许更新字段: ${field}`
          : `Field not allowed: ${field}`,
      };
    }

    await this.prisma.profile.update({
      where: { userId },
      data: { [field]: value },
    });

    return {
      success: true,
      message: isZh ? `已更新 ${field}` : `Updated ${field}`,
    };
  }

  // ============== 学校工具实现 ==============

  private async searchSchools(args: {
    query?: string;
    rankRange?: string;
    maxTuition?: number;
    state?: string;
  }) {
    const where: any = {};

    if (args.query) {
      const searchTerm = args.query.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { nameZh: { contains: searchTerm, mode: 'insensitive' } },
        { aliases: { has: searchTerm } },
        {
          aliases: {
            hasSome: [
              searchTerm,
              searchTerm.toUpperCase(),
              searchTerm.toLowerCase(),
            ],
          },
        },
      ];
    }

    if (args.rankRange) {
      const [min, max] = args.rankRange.split('-').map(Number);
      where.usNewsRank = { gte: min, lte: max };
    }

    if (args.maxTuition) {
      where.tuition = { lte: args.maxTuition };
    }

    if (args.state) {
      where.state = args.state;
    }

    const schools = await this.prisma.school.findMany({
      where,
      take: 20,
      orderBy: { usNewsRank: 'asc' },
      select: {
        id: true,
        name: true,
        nameZh: true,
        state: true,
        usNewsRank: true,
        acceptanceRate: true,
        tuition: true,
        aliases: true,
      },
    });

    // 相关性排序：别名精确匹配 > 名称开头 > 名称包含
    const sortedSchools = args.query
      ? this.sortSchoolsByRelevance(schools, args.query.trim())
      : schools;

    return {
      count: sortedSchools.length,
      schools: sortedSchools.map((s) => ({
        id: s.id,
        name: s.name,
        nameZh: s.nameZh,
        state: s.state,
        rank: s.usNewsRank,
        acceptanceRate: s.acceptanceRate
          ? `${Number(s.acceptanceRate).toFixed(1)}%`
          : 'N/A',
        tuition: s.tuition ? `$${s.tuition.toLocaleString()}` : 'N/A',
      })),
    };
  }

  /**
   * 学校搜索相关性排序
   */
  private sortSchoolsByRelevance(
    schools: Array<{
      id: string;
      name: string;
      nameZh: string | null;
      state: string | null;
      usNewsRank: number | null;
      acceptanceRate: any;
      tuition: number | null;
      aliases: string[];
    }>,
    searchTerm: string,
  ) {
    const lowerSearch = searchTerm.toLowerCase();

    return [...schools].sort((a, b) => {
      const scoreA = this.getSchoolRelevanceScore(a, lowerSearch, searchTerm);
      const scoreB = this.getSchoolRelevanceScore(b, lowerSearch, searchTerm);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.usNewsRank ?? 9999) - (b.usNewsRank ?? 9999);
    });
  }

  private getSchoolRelevanceScore(
    school: {
      name: string;
      nameZh: string | null;
      usNewsRank: number | null;
      aliases: string[];
    },
    lowerSearch: string,
    originalSearch: string,
  ): number {
    let score = 0;

    // 别名精确匹配: 100 分
    if (school.aliases?.some((a) => a.toLowerCase() === lowerSearch)) {
      score += 100;
    }

    // 名称开头匹配: 80 分
    if (school.name.toLowerCase().startsWith(lowerSearch)) {
      score += 80;
    } else if (school.nameZh?.startsWith(originalSearch)) {
      score += 80;
    }

    // 名称包含匹配: 60 分
    if (score < 80) {
      if (school.name.toLowerCase().includes(lowerSearch)) {
        score += 60;
      } else if (school.nameZh?.includes(originalSearch)) {
        score += 60;
      }
    }

    // 排名加权
    if (school.usNewsRank) {
      if (school.usNewsRank <= 20) score += 10;
      else if (school.usNewsRank <= 50) score += 5;
    }

    return score;
  }

  private async getSchoolDetails(
    schoolId?: string,
    schoolName?: string,
    locale = 'zh',
  ) {
    let school;

    if (schoolId) {
      school = await this.prisma.school.findUnique({
        where: { id: schoolId },
      });
    } else if (schoolName) {
      const searchTerm = schoolName.trim();
      school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { nameZh: { contains: searchTerm, mode: 'insensitive' } },
            { aliases: { has: searchTerm } },
            {
              aliases: {
                hasSome: [
                  searchTerm,
                  searchTerm.toUpperCase(),
                  searchTerm.toLowerCase(),
                ],
              },
            },
          ],
        },
      });
    }

    if (!school) {
      return { error: locale === 'zh' ? '未找到该学校' : 'School not found' };
    }

    const metadata = (school.metadata as any) || {};

    return {
      id: school.id,
      name: school.name,
      nameZh: school.nameZh,
      state: school.state,
      rank: school.usNewsRank,
      acceptanceRate: school.acceptanceRate
        ? `${Number(school.acceptanceRate).toFixed(1)}%`
        : 'N/A',
      tuition: school.tuition ? `$${school.tuition.toLocaleString()}` : 'N/A',
      avgSalary: school.avgSalary
        ? `$${school.avgSalary.toLocaleString()}`
        : 'N/A',
      deadlines: metadata.deadlines || {},
      essayPrompts: metadata.essayPrompts || [],
      requirements: metadata.requirements || {},
    };
  }

  private async compareSchools(
    schoolIds: string[],
    aspects?: string,
    locale = 'zh',
  ) {
    if (!schoolIds?.length) {
      return {
        error:
          locale === 'zh'
            ? '请提供要对比的学校ID'
            : 'Please provide school IDs to compare',
      };
    }

    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });

    return {
      comparison: schools.map((s) => ({
        name: s.name,
        rank: s.usNewsRank,
        acceptanceRate: s.acceptanceRate
          ? Number(s.acceptanceRate).toFixed(1) + '%'
          : 'N/A',
        tuition: s.tuition ? `$${s.tuition.toLocaleString()}` : 'N/A',
        avgSalary: s.avgSalary ? `$${s.avgSalary.toLocaleString()}` : 'N/A',
        state: s.state,
      })),
    };
  }

  // ============== 文书工具实现 ==============

  private async getEssays(userId: string, locale = 'zh') {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { essays: true },
    });

    if (!profile?.essays?.length) {
      return {
        message: locale === 'zh' ? '暂无保存的文书' : 'No saved essays',
      };
    }

    return {
      count: profile.essays.length,
      essays: profile.essays.map((e) => ({
        id: e.id,
        title: e.title,
        prompt: e.prompt,
        wordCount: e.content?.split(/\s+/).filter(Boolean).length || 0,
        updatedAt: e.updatedAt,
      })),
    };
  }

  private async reviewEssay(
    args: { essayId?: string; content?: string; prompt?: string },
    userId: string,
    locale = 'zh',
  ) {
    let content = args.content;
    let prompt = args.prompt;

    if (args.essayId) {
      const essay = await this.prisma.essay.findFirst({
        where: { id: args.essayId, profile: { userId } },
      });
      if (essay) {
        content = essay.content;
        prompt = essay.prompt || essay.title;
      }
    }

    if (!content) {
      return {
        error:
          locale === 'zh' ? '请提供文书内容' : 'Please provide essay content',
      };
    }

    return this.aiService.reviewEssay(
      {
        prompt: prompt || 'Personal Statement',
        content,
      },
      locale,
    );
  }

  private async generateOutline(
    args: {
      prompt: string;
      background?: string;
      wordLimit?: number;
    },
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    const systemPrompt = isZh
      ? `你是文书写作专家。根据题目生成详细的文书大纲。

大纲应包括:
1. 开头策略 (Hook)
2. 主体段落结构 (3-4段)
3. 每段的核心内容和过渡
4. 结尾呼应

返回JSON格式:
{
  "hook": "开头策略描述",
  "paragraphs": [
    { "focus": "段落重点", "content": "内容建议", "transition": "过渡句建议" }
  ],
  "ending": "结尾策略",
  "tips": ["写作建议1", "写作建议2"]
}`
      : `You are an essay writing expert. Generate a detailed essay outline based on the prompt.

The outline should include:
1. Opening strategy (Hook)
2. Body paragraph structure (3-4 paragraphs)
3. Core content and transitions for each paragraph
4. Closing that ties back to the opening

Return in JSON format:
{
  "hook": "Opening strategy description",
  "paragraphs": [
    { "focus": "Paragraph focus", "content": "Content suggestions", "transition": "Transition suggestions" }
  ],
  "ending": "Closing strategy",
  "tips": ["Writing tip 1", "Writing tip 2"]
}`;

    const result = await this.aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: isZh
            ? `题目: ${args.prompt}\n${args.background ? `背景: ${args.background}\n` : ''}${args.wordLimit ? `字数限制: ${args.wordLimit}词` : ''}`
            : `Prompt: ${args.prompt}\n${args.background ? `Background: ${args.background}\n` : ''}${args.wordLimit ? `Word limit: ${args.wordLimit} words` : ''}`,
        },
      ],
      { temperature: 0.7 },
    );

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      /* JSON parse fallback */
    }

    return { outline: result };
  }

  // ============== 选校工具实现 ==============

  private async recommendSchools(
    userId: string,
    context: AgentContext,
    args: { count?: number; preference?: string },
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    // 获取用户档案
    const profile = context.profile || (await this.getProfile(userId, locale));

    if (!profile.gpa && !profile.testScores?.length) {
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

  private async analyzeAdmissionChance(
    userId: string,
    args: { schoolId?: string; schoolName?: string },
    context: AgentContext,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    // 获取用户的 profileId
    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!userProfile) {
      return {
        error: isZh
          ? '请先完善档案信息以获取录取预测'
          : 'Please complete your profile to get admission predictions',
      };
    }

    // 获取学校信息
    let school;
    if (args.schoolId) {
      school = await this.prisma.school.findUnique({
        where: { id: args.schoolId },
        select: { id: true, name: true, nameZh: true },
      });
    } else if (args.schoolName) {
      const searchTerm = args.schoolName.trim();
      school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { nameZh: { contains: searchTerm, mode: 'insensitive' } },
            { aliases: { has: searchTerm } },
            {
              aliases: {
                hasSome: [
                  searchTerm,
                  searchTerm.toUpperCase(),
                  searchTerm.toLowerCase(),
                ],
              },
            },
          ],
        },
        select: { id: true, name: true, nameZh: true },
      });
    }

    if (!school) {
      return { error: isZh ? '未找到该学校' : 'School not found' };
    }

    // 调用 PredictionService 进行预测
    try {
      const output = await this.predictionService.predict(
        userProfile.id,
        [school.id],
        false, // 使用缓存
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

      // 转换为智能体输出格式
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

  // ============== 预测数据工具实现 ==============

  private async getPredictionHistory(
    userId: string,
    args: { schoolId?: string; schoolName?: string },
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!userProfile) {
      return {
        error: isZh ? '请先完善档案信息' : 'Please complete your profile first',
      };
    }

    // 查找学校 — prefer nameNorm-based exact match, then fallback to fuzzy
    let school: { id: string; name: string; nameZh: string | null } | null =
      null;
    if (args.schoolId) {
      school = await this.prisma.school.findUnique({
        where: { id: args.schoolId },
        select: { id: true, name: true, nameZh: true },
      });
    } else if (args.schoolName) {
      const norm = normalizeSchoolName(args.schoolName);
      // Exact match via normalized name first (uses UNIQUE index)
      school = await this.prisma.school.findUnique({
        where: { nameNorm: norm },
        select: { id: true, name: true, nameZh: true },
      });
      // Fallback: fuzzy search by contains / aliases
      if (!school) {
        const searchTerm = args.schoolName.trim();
        school = await this.prisma.school.findFirst({
          where: {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { nameZh: { contains: searchTerm, mode: 'insensitive' } },
              { aliases: { has: searchTerm } },
            ],
          },
          select: { id: true, name: true, nameZh: true },
        });
      }
    }
    if (!school) {
      return { error: isZh ? '未找到该学校' : 'School not found' };
    }

    const [current, history] = await Promise.all([
      this.prisma.predictionResult.findUnique({
        where: {
          profileId_schoolId: {
            profileId: userProfile.id,
            schoolId: school.id,
          },
        },
      }),
      this.prisma.predictionSnapshot.findMany({
        where: { profileId: userProfile.id, schoolId: school.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      school: { id: school.id, name: school.name, nameZh: school.nameZh },
      current: current
        ? {
            probability: Number(current.probability),
            probabilityLow: current.probabilityLow
              ? Number(current.probabilityLow)
              : undefined,
            probabilityHigh: current.probabilityHigh
              ? Number(current.probabilityHigh)
              : undefined,
            tier: current.tier,
            confidence: current.confidence,
            source: current.source,
            modelVersion: current.modelVersion,
            updatedAt: current.updatedAt,
          }
        : null,
      history: history.map((s) => ({
        probability: Number(s.probability),
        tier: s.tier,
        confidence: s.confidence,
        source: s.source,
        modelVersion: s.modelVersion,
        createdAt: s.createdAt,
      })),
    };
  }

  private async getPredictionDashboard(userId: string, locale = 'zh') {
    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!userProfile) {
      return {
        error:
          locale === 'zh'
            ? '请先完善档案信息'
            : 'Please complete your profile first',
      };
    }

    const predictions = await this.prisma.predictionResult.findMany({
      where: { profileId: userProfile.id },
      take: 100, // Bounded to prevent unbounded result sets
      orderBy: { updatedAt: 'desc' },
    });

    if (predictions.length === 0) {
      return {
        totalSchools: 0,
        tierDistribution: { reach: 0, match: 0, safety: 0 },
        avgProbability: 0,
        confidenceBreakdown: { high: 0, medium: 0, low: 0 },
        predictions: [],
      };
    }

    // Batch fetch school info
    const schools = await this.prisma.school.findMany({
      where: { id: { in: predictions.map((p) => p.schoolId) } },
      select: { id: true, name: true, nameZh: true, usNewsRank: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const tierDist = { reach: 0, match: 0, safety: 0 };
    const confDist = { high: 0, medium: 0, low: 0 };
    let totalProb = 0;

    const predList = predictions.map((p) => {
      const prob = Number(p.probability);
      totalProb += prob;
      const tier = (p.tier as 'reach' | 'match' | 'safety') || 'reach';
      tierDist[tier] = (tierDist[tier] || 0) + 1;
      const conf = (p.confidence as 'high' | 'medium' | 'low') || 'low';
      confDist[conf] = (confDist[conf] || 0) + 1;

      return {
        schoolId: p.schoolId,
        school: schoolMap.get(p.schoolId) ?? null,
        probability: prob,
        tier,
        confidence: conf,
        source: p.source,
        modelVersion: p.modelVersion,
        updatedAt: p.updatedAt,
      };
    });

    return {
      totalSchools: predictions.length,
      tierDistribution: tierDist,
      avgProbability: Math.round((totalProb / predictions.length) * 100),
      confidenceBreakdown: confDist,
      predictions: predList,
    };
  }

  private async getSchoolListPredictions(userId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!userProfile) {
      return {
        error: isZh ? '请先完善档案信息' : 'Please complete your profile first',
      };
    }

    const items = await this.prisma.schoolListItem.findMany({
      where: { userId },
      include: {
        school: {
          select: { id: true, name: true, nameZh: true, usNewsRank: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Bounded to prevent unbounded result sets
    });

    if (items.length === 0) {
      return {
        error: isZh
          ? '选校清单为空，请先添加学校'
          : 'School list is empty. Please add schools first.',
      };
    }

    // Batch query predictions
    const preds = await this.prisma.predictionResult.findMany({
      where: {
        profileId: userProfile.id,
        schoolId: { in: items.map((i) => i.schoolId) },
      },
      select: {
        schoolId: true,
        probability: true,
        tier: true,
        confidence: true,
        source: true,
        updatedAt: true,
      },
    });
    const predMap = new Map(preds.map((p) => [p.schoolId, p]));

    return items.map((item) => {
      const pred = predMap.get(item.schoolId);
      return {
        schoolId: item.schoolId,
        school: item.school,
        tier: item.tier,
        isAIRecommended: item.isAIRecommended,
        prediction: pred
          ? {
              probability: Number(pred.probability),
              tier: pred.tier,
              confidence: pred.confidence,
              source: pred.source,
              updatedAt: pred.updatedAt,
            }
          : null,
      };
    });
  }

  // ============== 案例工具实现 ==============

  private async searchCases(
    args: {
      schoolName?: string;
      major?: string;
      year?: number;
      gpaRange?: string;
    },
    locale = 'zh',
  ) {
    const where: any = {};

    if (args.schoolName) {
      const searchTerm = args.schoolName.trim();
      where.school = {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { nameZh: { contains: searchTerm, mode: 'insensitive' } },
          { aliases: { has: searchTerm } },
          {
            aliases: {
              hasSome: [
                searchTerm,
                searchTerm.toUpperCase(),
                searchTerm.toLowerCase(),
              ],
            },
          },
        ],
      };
    }

    if (args.major) {
      where.major = { contains: args.major, mode: 'insensitive' };
    }

    if (args.year) {
      where.year = args.year;
    }

    if (args.gpaRange) {
      where.gpaRange = args.gpaRange;
    }

    // 只显示公开案例
    where.visibility = { in: ['ANONYMOUS', 'PUBLIC'] };

    const cases = await this.prisma.admissionCase.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { name: true, nameZh: true } } },
    });

    if (!cases.length) {
      return {
        message:
          locale === 'zh' ? '未找到匹配的案例' : 'No matching cases found',
      };
    }

    return {
      count: cases.length,
      cases: cases.map((c) => ({
        school: getSchoolDisplayName(c.school, locale),
        year: c.year,
        round: c.round,
        result: c.result,
        gpaRange: c.gpaRange,
        satRange: c.satRange,
        tags: c.tags,
      })),
    };
  }

  // ============== 时间线工具实现 ==============

  private async getDeadlines(
    schoolIds?: string[],
    round?: string,
    locale = 'zh',
  ) {
    if (!schoolIds?.length) {
      return {
        error: locale === 'zh' ? '请提供学校ID' : 'Please provide school IDs',
      };
    }

    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { name: true, nameZh: true, metadata: true },
    });

    const deadlines = schools.map((s) => {
      const metadata = (s.metadata as any) || {};
      const allDeadlines = metadata.deadlines || {};

      return {
        school: getSchoolDisplayName(s, locale),
        deadlines: round
          ? { [round]: allDeadlines[round.toLowerCase()] }
          : allDeadlines,
      };
    });

    return { deadlines };
  }

  private async createTimeline(
    args: { targetSchools?: string; startDate?: string },
    context: AgentContext,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    const systemPrompt = isZh
      ? `你是申请规划顾问。根据目标学校创建详细的申请时间线。

时间线应包括:
1. 标化考试准备和报名
2. 学校研究和选校
3. 文书写作时间
4. 推荐信联系
5. 各轮次申请截止
6. 面试准备

返回JSON格式:
{
  "timeline": [
    { "month": "2025年8月", "tasks": ["任务1", "任务2"] }
  ],
  "keyDates": [
    { "date": "2025-11-01", "event": "ED截止", "schools": ["学校1"] }
  ],
  "tips": ["建议1", "建议2"]
}`
      : `You are an admissions planning consultant. Create a detailed application timeline based on target schools.

The timeline should include:
1. Standardized test preparation and registration
2. School research and selection
3. Essay writing schedule
4. Recommendation letter outreach
5. Application deadlines by round
6. Interview preparation

Return in JSON format:
{
  "timeline": [
    { "month": "August 2025", "tasks": ["Task 1", "Task 2"] }
  ],
  "keyDates": [
    { "date": "2025-11-01", "event": "ED Deadline", "schools": ["School 1"] }
  ],
  "tips": ["Tip 1", "Tip 2"]
}`;

    const result = await this.aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: isZh
            ? `目标学校: ${args.targetSchools || '待定'}\n开始日期: ${args.startDate || '现在'}`
            : `Target schools: ${args.targetSchools || 'TBD'}\nStart date: ${args.startDate || 'now'}`,
        },
      ],
      { temperature: 0.6 },
    );

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      /* JSON parse fallback */
    }

    return { timeline: result };
  }

  private async getPersonalEvents(
    userId: string,
    category?: string,
    locale = 'zh',
  ) {
    const where: any = { userId };
    if (category) {
      where.category = category;
    }

    const events = await this.prisma.personalEvent.findMany({
      where,
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
      take: 20,
    });

    if (!events.length) {
      return {
        message:
          locale === 'zh'
            ? '暂无个人事件，可以通过订阅全局事件或手动创建来添加'
            : 'No personal events. You can subscribe to global events or create new ones.',
      };
    }

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      status: e.status,
      progress: e.progress,
      deadline: e.deadline?.toISOString(),
      eventDate: e.eventDate?.toISOString(),
      tasksTotal: e.tasks.length,
      tasksCompleted: e.tasks.filter((t) => t.completed).length,
      tasks: e.tasks.map((t) => ({
        title: t.title,
        completed: t.completed,
        dueDate: t.dueDate?.toISOString(),
      })),
    }));
  }

  private async createPersonalEvent(
    userId: string,
    args: {
      title: string;
      category: string;
      deadline?: string;
      eventDate?: string;
      description?: string;
    },
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    if (!args.title || !args.category) {
      return {
        error: isZh
          ? '需要提供事件名称和分类'
          : 'Event title and category are required',
      };
    }

    // 默认任务模板
    const templates: Record<string, string[]> = isZh
      ? {
          COMPETITION: [
            '了解竞赛规则和要求',
            '报名注册',
            '备赛准备',
            '参加竞赛',
            '查看结果',
          ],
          TEST: [
            '报名注册',
            '制定备考计划',
            '完成模考练习',
            '参加考试',
            '送分',
          ],
          SUMMER_PROGRAM: [
            '研究项目/学校',
            '准备申请材料',
            '提交申请',
            '面试准备',
            '确认录取',
          ],
          INTERNSHIP: [
            '搜索实习机会',
            '准备简历/CV',
            '提交申请',
            '面试准备',
            '确认 Offer',
          ],
          ACTIVITY: [
            '了解活动详情',
            '报名/注册',
            '准备所需材料',
            '参与活动',
            '总结记录',
          ],
          MATERIAL: [
            '确认需要的材料清单',
            '联系相关人员/机构',
            '准备材料内容',
            '提交/寄送',
            '确认收到',
          ],
          OTHER: ['了解详情', '准备', '执行', '完成'],
        }
      : {
          COMPETITION: [
            'Learn rules and requirements',
            'Register',
            'Prepare',
            'Compete',
            'Check results',
          ],
          TEST: [
            'Register',
            'Create study plan',
            'Complete practice tests',
            'Take exam',
            'Send scores',
          ],
          SUMMER_PROGRAM: [
            'Research programs',
            'Prepare application',
            'Submit application',
            'Interview prep',
            'Confirm enrollment',
          ],
          INTERNSHIP: [
            'Search opportunities',
            'Prepare resume/CV',
            'Submit applications',
            'Interview prep',
            'Confirm offer',
          ],
          ACTIVITY: [
            'Learn details',
            'Register',
            'Prepare materials',
            'Participate',
            'Document & reflect',
          ],
          MATERIAL: [
            'Confirm required materials',
            'Contact relevant parties',
            'Prepare content',
            'Submit/send',
            'Confirm receipt',
          ],
          OTHER: ['Learn details', 'Prepare', 'Execute', 'Complete'],
        };

    const taskTitles = templates[args.category] || templates.OTHER;

    const event = await this.prisma.personalEvent.create({
      data: {
        userId,
        title: args.title,
        category: args.category as any,
        deadline: args.deadline ? new Date(args.deadline) : undefined,
        eventDate: args.eventDate ? new Date(args.eventDate) : undefined,
        description: args.description,
        tasks: {
          create: taskTitles.map((title, index) => ({
            title,
            sortOrder: index,
          })),
        },
      },
      include: { tasks: true },
    });

    return {
      success: true,
      event: {
        id: event.id,
        title: event.title,
        category: event.category,
        status: event.status,
        tasksCreated: event.tasks.length,
      },
      message: isZh
        ? `已创建事件「${event.title}」，包含 ${event.tasks.length} 个子任务`
        : `Created event "${event.title}" with ${event.tasks.length} subtasks`,
    };
  }

  // ============== 测评工具实现 ==============

  private async getAssessmentResults(
    userId: string,
    type?: 'mbti' | 'holland',
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      const history = await this.assessmentService.getHistory(userId);

      if (!history.length) {
        return {
          message: isZh
            ? '暂无测评记录，建议先完成 MBTI 或霍兰德测评'
            : 'No assessment records. Consider taking the MBTI or Holland assessment.',
        };
      }

      // 按类型筛选
      const filteredResults = type
        ? history.filter((r) => r.type.toLowerCase() === type.toLowerCase())
        : history;

      if (!filteredResults.length) {
        return {
          message: isZh
            ? `暂无${type?.toUpperCase()}测评记录`
            : `No ${type?.toUpperCase()} assessment records`,
        };
      }

      return {
        count: filteredResults.length,
        results: filteredResults.map((r) => ({
          id: r.id,
          type: r.type,
          completedAt: r.completedAt,
          mbtiResult: r.mbtiResult
            ? {
                type: r.mbtiResult.type,
                title: r.mbtiResult.titleZh || r.mbtiResult.title,
                description:
                  r.mbtiResult.descriptionZh || r.mbtiResult.description,
                strengths: r.mbtiResult.strengths,
                careers: r.mbtiResult.careers,
                majors: r.mbtiResult.majors,
              }
            : undefined,
          hollandResult: r.hollandResult
            ? {
                codes: r.hollandResult.codes,
                types: r.hollandResult.typesZh || r.hollandResult.types,
                fields: r.hollandResult.fieldsZh || r.hollandResult.fields,
                majors: r.hollandResult.majors,
              }
            : undefined,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get assessment results', error);
      return {
        error: isZh
          ? '获取测评结果失败'
          : 'Failed to retrieve assessment results',
      };
    }
  }

  private async interpretAssessment(
    userId: string,
    resultId: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      const result = await this.assessmentService.getResult(userId, resultId);

      if (!result) {
        return {
          error: isZh ? '未找到该测评结果' : 'Assessment result not found',
        };
      }

      // 构建解读提示词
      const systemPrompt = isZh
        ? `你是专业的职业规划顾问和心理咨询师。请根据以下测评结果，提供深度解读和个性化建议。

解读应包括：
1. 性格/兴趣特点分析
2. 适合的学习方式和环境
3. 专业选择建议（考虑留学申请）
4. 职业发展方向
5. 需要注意的潜在挑战

请用中文回复，语气专业但友好。`
        : `You are a professional career planning consultant and counselor. Provide an in-depth interpretation and personalized advice based on the assessment results.

Include:
1. Personality/interest trait analysis
2. Suitable learning styles and environments
3. Major selection advice (considering college applications)
4. Career development directions
5. Potential challenges to be aware of

Please respond in English with a professional yet friendly tone.`;

      const userContent = result.mbtiResult
        ? isZh
          ? `MBTI测评结果：
类型：${result.mbtiResult.type}
描述：${result.mbtiResult.descriptionZh || result.mbtiResult.description}
优势：${result.mbtiResult.strengths?.join('、')}
推荐职业：${result.mbtiResult.careers?.join('、')}
推荐专业：${result.mbtiResult.majors?.join('、')}`
          : `MBTI Assessment Result:
Type: ${result.mbtiResult.type}
Description: ${result.mbtiResult.description}
Strengths: ${result.mbtiResult.strengths?.join(', ')}
Recommended careers: ${result.mbtiResult.careers?.join(', ')}
Recommended majors: ${result.mbtiResult.majors?.join(', ')}`
        : isZh
          ? `霍兰德测评结果：
代码：${result.hollandResult?.codes}
类型：${result.hollandResult?.typesZh?.join('、') || result.hollandResult?.types?.join('、')}
适合领域：${result.hollandResult?.fieldsZh?.join('、') || result.hollandResult?.fields?.join('、')}
推荐专业：${result.hollandResult?.majors?.join('、')}`
          : `Holland Assessment Result:
Code: ${result.hollandResult?.codes}
Types: ${result.hollandResult?.types?.join(', ')}
Suitable fields: ${result.hollandResult?.fields?.join(', ')}
Recommended majors: ${result.hollandResult?.majors?.join(', ')}`;

      const interpretation = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.7 },
      );

      return {
        resultId,
        type: result.type,
        originalResult: result.mbtiResult || result.hollandResult,
        interpretation,
      };
    } catch (error) {
      this.logger.error('Failed to interpret assessment', error);
      return {
        error: isZh
          ? '解读测评结果失败'
          : 'Failed to interpret assessment result',
      };
    }
  }

  private async suggestActivitiesFromAssessment(
    userId: string,
    resultId: string,
    targetMajor?: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      const result = await this.assessmentService.getResult(userId, resultId);

      if (!result) {
        return {
          error: isZh ? '未找到该测评结果' : 'Assessment result not found',
        };
      }

      const systemPrompt = isZh
        ? `你是留学申请顾问，擅长活动规划。根据学生的性格测评结果，推荐适合的课外活动、竞赛和项目。

推荐要求：
1. 活动要与学生性格/兴趣匹配
2. 要有助于留学申请（展示领导力、创造力、社会影响等）
3. 区分难度级别（入门级、进阶级、竞争级）
4. 说明每个活动的价值和申请中的作用

返回JSON格式:
{
  "activities": [
    {
      "name": "活动名称",
      "category": "学术/志愿/艺术/体育/领导力",
      "difficulty": "入门/进阶/竞争",
      "description": "活动描述",
      "benefit": "对申请的帮助",
      "timeCommitment": "预计时间投入"
    }
  ],
  "competitions": [
    {
      "name": "竞赛名称",
      "level": "校级/省级/国家级/国际级",
      "relevance": "与专业/兴趣的相关性"
    }
  ],
  "tips": ["活动规划建议"]
}`
        : `You are a college admissions consultant specializing in activity planning. Recommend extracurricular activities, competitions, and projects based on the student's personality assessment results.

Requirements:
1. Activities should match the student's personality/interests
2. Should benefit college applications (demonstrate leadership, creativity, social impact)
3. Categorize by difficulty level (beginner, intermediate, competitive)
4. Explain the value and role of each activity in applications

Return in JSON format:
{
  "activities": [
    {
      "name": "Activity name",
      "category": "Academic/Volunteer/Arts/Sports/Leadership",
      "difficulty": "Beginner/Intermediate/Competitive",
      "description": "Activity description",
      "benefit": "How it helps applications",
      "timeCommitment": "Expected time commitment"
    }
  ],
  "competitions": [
    {
      "name": "Competition name",
      "level": "School/State/National/International",
      "relevance": "Relevance to major/interests"
    }
  ],
  "tips": ["Activity planning advice"]
}`;

      const userContent = isZh
        ? `测评结果：${JSON.stringify(result.mbtiResult || result.hollandResult)}
${targetMajor ? `目标专业：${targetMajor}` : ''}

请推荐适合这位学生的活动和竞赛。`
        : `Assessment results: ${JSON.stringify(result.mbtiResult || result.hollandResult)}
${targetMajor ? `Target major: ${targetMajor}` : ''}

Please recommend suitable activities and competitions for this student.`;

      const response = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.7 },
      );

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        /* JSON parse fallback */
      }

      return { suggestions: response };
    } catch (error) {
      this.logger.error('Failed to suggest activities', error);
      return { error: isZh ? '推荐活动失败' : 'Failed to suggest activities' };
    }
  }

  // ============== 论坛工具实现 ==============

  private async searchForumPosts(
    query: string,
    category?: string,
    limit?: number,
    locale = 'zh',
  ) {
    try {
      const result = await this.forumService.getPosts(null, {
        search: query,
        categoryId: category,
        limit: limit || 10,
        offset: 0,
      });

      return {
        count: result.total,
        posts: result.posts.map((p) => ({
          id: p.id,
          title: p.title,
          content:
            p.content.substring(0, 200) + (p.content.length > 200 ? '...' : ''),
          author: p.author.name || (locale === 'zh' ? '匿名用户' : 'Anonymous'),
          isVerified: p.author.isVerified,
          category:
            locale === 'zh'
              ? p.category?.nameZh || p.category?.name
              : p.category?.name || p.category?.nameZh,
          tags: p.tags,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          createdAt: p.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to search forum posts', error);
      return {
        error:
          locale === 'zh' ? '搜索论坛帖子失败' : 'Failed to search forum posts',
      };
    }
  }

  private async getPopularDiscussions(
    category?: string,
    timeRange?: string,
    locale = 'zh',
  ) {
    try {
      const result = await this.forumService.getPosts(null, {
        categoryId: category,
        sortBy: 'popular' as any,
        limit: 10,
        offset: 0,
      });

      return {
        count: result.total,
        discussions: result.posts.map((p) => ({
          id: p.id,
          title: p.title,
          summary: p.content.substring(0, 150) + '...',
          category:
            locale === 'zh'
              ? p.category?.nameZh || p.category?.name
              : p.category?.name || p.category?.nameZh,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          isTeamPost: p.isTeamPost,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get popular discussions', error);
      return {
        error:
          locale === 'zh'
            ? '获取热门讨论失败'
            : 'Failed to get popular discussions',
      };
    }
  }

  private async answerForumQuestion(
    question: string,
    context?: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    const systemPrompt = isZh
      ? `你是专业的留学顾问，负责回答学生关于留学申请的问题。

回答要求：
1. 准确、专业、有帮助
2. 如果不确定，诚实说明并建议寻求专业人士帮助
3. 适当引用相关资源或建议进一步阅读
4. 用中文回答`
      : `You are a professional admissions consultant answering student questions about college applications.

Requirements:
1. Be accurate, professional, and helpful
2. If unsure, be honest and suggest seeking professional guidance
3. Reference relevant resources when appropriate
4. Respond in English`;

    const response = await this.aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: isZh
            ? `问题：${question}${context ? `\n背景：${context}` : ''}`
            : `Question: ${question}${context ? `\nContext: ${context}` : ''}`,
        },
      ],
      { temperature: 0.5 },
    );

    return {
      question,
      answer: response,
      disclaimer: isZh
        ? '以上回答仅供参考，具体情况请咨询专业顾问或学校官方。'
        : 'This answer is for reference only. Please consult a professional counselor or the school directly for specific situations.',
    };
  }

  // ============== 案例预测工具实现 ==============

  private async explainCaseResult(caseId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    try {
      const admissionCase = await this.prisma.admissionCase.findUnique({
        where: { id: caseId },
        include: { school: true },
      });

      if (!admissionCase) {
        return { error: isZh ? '未找到该案例' : 'Case not found' };
      }

      const resultLabel = isZh
        ? admissionCase.result === 'ADMITTED'
          ? '录取'
          : admissionCase.result === 'REJECTED'
            ? '拒绝'
            : '放入候补名单'
        : admissionCase.result === 'ADMITTED'
          ? 'admitted'
          : admissionCase.result === 'REJECTED'
            ? 'rejected'
            : 'waitlisted';

      const systemPrompt = isZh
        ? `你是资深招生官和留学顾问。请分析这个录取案例，解释为什么申请者被${resultLabel}。

分析要点：
1. 学术背景评估（GPA、标化成绩）
2. 软实力分析（活动、奖项的暗示）
3. 学校匹配度
4. 可能的录取/拒绝因素
5. 对类似背景学生的建议

请用中文回答，分析要客观专业。`
        : `You are a senior admissions officer and consultant. Analyze this admission case and explain why the applicant was ${resultLabel}.

Key points:
1. Academic background assessment (GPA, test scores)
2. Extracurricular analysis (activities, awards implications)
3. School fit
4. Likely admission/rejection factors
5. Advice for students with similar backgrounds

Provide an objective and professional analysis.`;

      const schoolName = getSchoolDisplayName(admissionCase.school, locale);
      const unknown = isZh ? '未知' : 'Unknown';
      const none = isZh ? '无' : 'None';
      const caseInfo = isZh
        ? `
学校：${schoolName} (排名 #${admissionCase.school.usNewsRank || 'N/A'})
申请年份：${admissionCase.year}
申请轮次：${admissionCase.round || unknown}
专业：${admissionCase.major || unknown}
GPA范围：${admissionCase.gpaRange || unknown}
SAT范围：${admissionCase.satRange || unknown}
ACT范围：${admissionCase.actRange || unknown}
托福范围：${admissionCase.toeflRange || unknown}
标签：${admissionCase.tags?.join('、') || none}
结果：${admissionCase.result}
录取率：${admissionCase.school.acceptanceRate ? Number(admissionCase.school.acceptanceRate).toFixed(1) + '%' : unknown}`
        : `
School: ${schoolName} (Rank #${admissionCase.school.usNewsRank || 'N/A'})
Application year: ${admissionCase.year}
Round: ${admissionCase.round || unknown}
Major: ${admissionCase.major || unknown}
GPA range: ${admissionCase.gpaRange || unknown}
SAT range: ${admissionCase.satRange || unknown}
ACT range: ${admissionCase.actRange || unknown}
TOEFL range: ${admissionCase.toeflRange || unknown}
Tags: ${admissionCase.tags?.join(', ') || none}
Result: ${admissionCase.result}
Acceptance rate: ${admissionCase.school.acceptanceRate ? Number(admissionCase.school.acceptanceRate).toFixed(1) + '%' : unknown}`;

      const analysis = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: caseInfo },
        ],
        { temperature: 0.5 },
      );

      return {
        caseId,
        school: schoolName,
        result: admissionCase.result,
        analysis,
      };
    } catch (error) {
      this.logger.error('Failed to explain case result', error);
      return { error: isZh ? '分析案例失败' : 'Failed to analyze case' };
    }
  }

  private async analyzePredictionAccuracy(userId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    try {
      const stats = await this.swipeService.getStats(userId);

      const systemPrompt = isZh
        ? `你是数据分析师。根据用户的案例预测游戏统计数据，分析其预测能力和改进建议。`
        : `You are a data analyst. Analyze the user's prediction game statistics and provide insights and improvement suggestions.`;

      const analysis = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `
用户预测统计：
- 总预测次数：${stats.totalSwipes}
- 正确次数：${stats.correctCount}
- 准确率：${stats.accuracy}%
- 当前连胜：${stats.currentStreak}
- 最佳连胜：${stats.bestStreak}
- 等级：${stats.badge}

请分析用户的预测能力特点，并给出提高准确率的建议。`
              : `
User prediction statistics:
- Total predictions: ${stats.totalSwipes}
- Correct: ${stats.correctCount}
- Accuracy: ${stats.accuracy}%
- Current streak: ${stats.currentStreak}
- Best streak: ${stats.bestStreak}
- Badge: ${stats.badge}

Analyze the user's prediction strengths and provide tips to improve accuracy.`,
          },
        ],
        { temperature: 0.5 },
      );

      return {
        stats: {
          totalSwipes: stats.totalSwipes,
          accuracy: stats.accuracy,
          bestStreak: stats.bestStreak,
          badge: stats.badge,
        },
        analysis,
      };
    } catch (error) {
      this.logger.error('Failed to analyze prediction accuracy', error);
      return {
        error: isZh
          ? '分析预测准确度失败'
          : 'Failed to analyze prediction accuracy',
      };
    }
  }

  private async compareCaseWithProfile(
    userId: string,
    caseId: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      const [admissionCase, profile] = await Promise.all([
        this.prisma.admissionCase.findUnique({
          where: { id: caseId },
          include: { school: true },
        }),
        this.getProfile(userId, locale),
      ]);

      if (!admissionCase) {
        return { error: isZh ? '未找到该案例' : 'Case not found' };
      }

      if (!profile || profile.message) {
        return {
          error: isZh
            ? '请先完善您的档案信息'
            : 'Please complete your profile first',
        };
      }

      const schoolName = getSchoolDisplayName(admissionCase.school, locale);
      const unknown = isZh ? '未知' : 'Unknown';
      const none = isZh ? '无' : 'None';
      const notFilled = isZh ? '未填' : 'Not provided';
      const undecided = isZh ? '未定' : 'Undecided';

      const systemPrompt = isZh
        ? `你是留学顾问。请对比分析申请者档案与录取案例，找出差距和优势。

分析要点：
1. 学术成绩对比
2. 软实力对比（活动、奖项）
3. 相似点和差异点
4. 具体改进建议
5. 录取可能性评估

请用中文回答，给出具体可操作的建议。`
        : `You are an admissions consultant. Compare the applicant's profile with the admission case to identify gaps and strengths.

Key points:
1. Academic comparison
2. Extracurricular comparison (activities, awards)
3. Similarities and differences
4. Specific improvement suggestions
5. Admission likelihood assessment

Provide specific, actionable advice.`;

      const comparison = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `
录取案例：
- 学校：${schoolName}
- 结果：${admissionCase.result}
- GPA范围：${admissionCase.gpaRange || unknown}
- SAT范围：${admissionCase.satRange || unknown}
- 标签：${admissionCase.tags?.join('、') || none}

您的档案：
- GPA：${profile.gpa || notFilled}/${profile.gpaScale || 4.0}
- 标化：${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- 活动数量：${profile.activities?.length || 0}
- 奖项数量：${profile.awards?.length || 0}
- 目标专业：${profile.targetMajor || undecided}`
              : `
Admission case:
- School: ${schoolName}
- Result: ${admissionCase.result}
- GPA range: ${admissionCase.gpaRange || unknown}
- SAT range: ${admissionCase.satRange || unknown}
- Tags: ${admissionCase.tags?.join(', ') || none}

Your profile:
- GPA: ${profile.gpa || notFilled}/${profile.gpaScale || 4.0}
- Test scores: ${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- Activities: ${profile.activities?.length || 0}
- Awards: ${profile.awards?.length || 0}
- Target major: ${profile.targetMajor || undecided}`,
          },
        ],
        { temperature: 0.5 },
      );

      return {
        caseSchool: schoolName,
        caseResult: admissionCase.result,
        comparison,
      };
    } catch (error) {
      this.logger.error('Failed to compare case with profile', error);
      return { error: isZh ? '对比分析失败' : 'Failed to compare profiles' };
    }
  }

  // ============== 档案排名工具实现 ==============

  private async analyzeProfileRanking(
    userId: string,
    schoolId?: string,
    schoolName?: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      // 获取学校ID
      let targetSchoolId = schoolId;
      if (!targetSchoolId && schoolName) {
        const searchTerm = schoolName.trim();
        const school = await this.prisma.school.findFirst({
          where: {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { nameZh: { contains: searchTerm, mode: 'insensitive' } },
              { aliases: { has: searchTerm } },
              {
                aliases: {
                  hasSome: [
                    searchTerm,
                    searchTerm.toUpperCase(),
                    searchTerm.toLowerCase(),
                  ],
                },
              },
            ],
          },
        });
        targetSchoolId = school?.id;
      }

      if (!targetSchoolId) {
        // 获取总体排名
        const ranking = await this.hallService.getProfileRanking(
          userId,
          'overall',
        );
        return {
          type: isZh ? '总体排名' : 'Overall Ranking',
          rank: ranking.rank,
          total: ranking.total,
          percentile: ranking.percentile,
          message: isZh
            ? `您在所有用户中排名第 ${ranking.rank}/${ranking.total}，超过了 ${ranking.percentile}% 的用户`
            : `You rank ${ranking.rank} out of ${ranking.total} users, surpassing ${ranking.percentile}% of users`,
        };
      }

      const ranking = await this.hallService.getProfileRanking(
        userId,
        targetSchoolId,
      );
      const school = await this.prisma.school.findUnique({
        where: { id: targetSchoolId },
      });

      const displayName = school ? getSchoolDisplayName(school, locale) : '';
      return {
        school: displayName,
        rank: ranking.rank,
        total: ranking.total,
        percentile: ranking.percentile,
        message: isZh
          ? `在申请 ${displayName} 的用户中，您排名第 ${ranking.rank}/${ranking.total}，超过了 ${ranking.percentile}% 的用户`
          : `Among applicants to ${displayName}, you rank ${ranking.rank} out of ${ranking.total}, surpassing ${ranking.percentile}% of users`,
      };
    } catch (error) {
      this.logger.error('Failed to analyze profile ranking', error);
      return { error: isZh ? '获取排名失败' : 'Failed to retrieve ranking' };
    }
  }

  private async suggestProfileImprovements(
    userId: string,
    targetTier?: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      const profile = await this.getProfile(userId, locale);

      if (!profile || profile.message) {
        return {
          error: isZh
            ? '请先完善档案信息'
            : 'Please complete your profile first',
        };
      }

      const notFilled = isZh ? '未填' : 'Not provided';
      const none = isZh ? '无' : 'None';
      const undecided = isZh ? '未定' : 'Undecided';

      const systemPrompt = isZh
        ? `你是资深留学顾问。根据学生档案，提供具体的改进建议以提升竞争力。

分析维度：
1. 学术成绩（GPA、课程选择）
2. 标化考试（SAT/ACT、托福）
3. 课外活动（深度、广度、领导力）
4. 奖项荣誉（级别、相关性）
5. 申请材料（文书主题、推荐信）

请针对${targetTier ? `申请${targetTier}学校` : '整体申请'}给出具体可执行的建议。

返回JSON格式:
{
  "currentStrengths": ["优势1", "优势2"],
  "areasToImprove": [
    { "area": "领域", "currentStatus": "现状", "suggestion": "建议", "priority": "高/中/低" }
  ],
  "actionItems": [
    { "task": "具体任务", "timeline": "建议时间", "impact": "预期效果" }
  ]
}`
        : `You are a senior admissions consultant. Based on the student's profile, provide specific improvement suggestions to enhance competitiveness.

Analysis dimensions:
1. Academics (GPA, course selection)
2. Standardized tests (SAT/ACT, TOEFL)
3. Extracurriculars (depth, breadth, leadership)
4. Awards (level, relevance)
5. Application materials (essay topics, recommendations)

Provide specific, actionable advice for ${targetTier ? `${targetTier} schools` : 'overall applications'}.

Return in JSON format:
{
  "currentStrengths": ["Strength 1", "Strength 2"],
  "areasToImprove": [
    { "area": "Area", "currentStatus": "Current status", "suggestion": "Suggestion", "priority": "High/Medium/Low" }
  ],
  "actionItems": [
    { "task": "Specific task", "timeline": "Suggested timeline", "impact": "Expected impact" }
  ]
}`;

      const response = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `
学生档案：
- GPA：${profile.gpa || notFilled}/${profile.gpaScale || 4.0}
- 年级：${profile.grade || notFilled}
- 标化成绩：${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- 活动数量：${profile.activities?.length || 0}
- 活动详情：${
                  profile.activities
                    ?.slice(0, 3)
                    .map((a: any) => `${a.name}(${a.role})`)
                    .join(', ') || none
                }
- 奖项数量：${profile.awards?.length || 0}
- 奖项详情：${
                  profile.awards
                    ?.slice(0, 3)
                    .map((a: any) => `${a.name}(${a.level})`)
                    .join(', ') || none
                }
- 目标专业：${profile.targetMajor || undecided}
- 预算：${profile.budgetTier || undecided}
${targetTier ? `目标学校层次：${targetTier}` : ''}`
              : `
Student profile:
- GPA: ${profile.gpa || notFilled}/${profile.gpaScale || 4.0}
- Grade: ${profile.grade || notFilled}
- Test scores: ${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- Activities: ${profile.activities?.length || 0}
- Activity details: ${
                  profile.activities
                    ?.slice(0, 3)
                    .map((a: any) => `${a.name} (${a.role})`)
                    .join(', ') || none
                }
- Awards: ${profile.awards?.length || 0}
- Award details: ${
                  profile.awards
                    ?.slice(0, 3)
                    .map((a: any) => `${a.name} (${a.level})`)
                    .join(', ') || none
                }
- Target major: ${profile.targetMajor || undecided}
- Budget: ${profile.budgetTier || undecided}
${targetTier ? `Target school tier: ${targetTier}` : ''}`,
          },
        ],
        { temperature: 0.6 },
      );

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        /* JSON parse fallback */
      }

      return { suggestions: response };
    } catch (error) {
      this.logger.error('Failed to suggest improvements', error);
      return {
        error: isZh
          ? '生成改进建议失败'
          : 'Failed to generate improvement suggestions',
      };
    }
  }

  private async compareWithAdmittedProfiles(
    userId: string,
    schoolId?: string,
    schoolName?: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      // 获取学校
      let school;
      if (schoolId) {
        school = await this.prisma.school.findUnique({
          where: { id: schoolId },
        });
      } else if (schoolName) {
        const searchTerm = schoolName.trim();
        school = await this.prisma.school.findFirst({
          where: {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { nameZh: { contains: searchTerm, mode: 'insensitive' } },
              { aliases: { has: searchTerm } },
              {
                aliases: {
                  hasSome: [
                    searchTerm,
                    searchTerm.toUpperCase(),
                    searchTerm.toLowerCase(),
                  ],
                },
              },
            ],
          },
        });
      }

      if (!school) {
        return {
          error: isZh
            ? '请指定要对比的学校'
            : 'Please specify a school to compare',
        };
      }

      const displayName = getSchoolDisplayName(school, locale);

      // 获取该学校的录取案例
      const admittedCases = await this.prisma.admissionCase.findMany({
        where: {
          schoolId: school.id,
          result: 'ADMITTED',
          visibility: { in: ['ANONYMOUS', 'VERIFIED_ONLY'] },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });

      if (!admittedCases.length) {
        return {
          school: displayName,
          message: isZh
            ? '暂无该学校的录取案例数据'
            : 'No admission case data available for this school',
        };
      }

      // 获取用户档案
      const profile = await this.getProfile(userId, locale);
      if (!profile || profile.message) {
        return {
          error: isZh
            ? '请先完善档案信息'
            : 'Please complete your profile first',
        };
      }

      // 统计录取案例的平均水平
      const gpaRanges = admittedCases.map((c) => c.gpaRange).filter(Boolean);
      const satRanges = admittedCases.map((c) => c.satRange).filter(Boolean);
      const notFilled = isZh ? '未填' : 'Not provided';
      const insufficient = isZh ? '数据不足' : 'Insufficient data';

      const systemPrompt = isZh
        ? `你是留学数据分析师。请对比学生档案与该校录取学生的整体情况。`
        : `You are an admissions data analyst. Compare the student's profile with the overall admitted student data for this school.`;

      const analysis = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `
目标学校：${displayName} (排名 #${school.usNewsRank})

录取学生情况（${admittedCases.length}个案例）：
- GPA范围分布：${gpaRanges.join(', ') || insufficient}
- SAT范围分布：${satRanges.join(', ') || insufficient}
- 常见标签：${[...new Set(admittedCases.flatMap((c) => c.tags || []))].slice(0, 10).join(', ')}

您的档案：
- GPA：${profile.gpa || notFilled}/${profile.gpaScale || 4.0}
- 标化：${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- 活动：${profile.activities?.length || 0}个
- 奖项：${profile.awards?.length || 0}个

请分析差距并给出建议。`
              : `
Target school: ${displayName} (Rank #${school.usNewsRank})

Admitted student data (${admittedCases.length} cases):
- GPA range distribution: ${gpaRanges.join(', ') || insufficient}
- SAT range distribution: ${satRanges.join(', ') || insufficient}
- Common tags: ${[...new Set(admittedCases.flatMap((c) => c.tags || []))].slice(0, 10).join(', ')}

Your profile:
- GPA: ${profile.gpa || notFilled}/${profile.gpaScale || 4.0}
- Test scores: ${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- Activities: ${profile.activities?.length || 0}
- Awards: ${profile.awards?.length || 0}

Analyze the gaps and provide recommendations.`,
          },
        ],
        { temperature: 0.5 },
      );

      return {
        school: displayName,
        admittedCasesCount: admittedCases.length,
        analysis,
      };
    } catch (error) {
      this.logger.error('Failed to compare with admitted profiles', error);
      return { error: isZh ? '对比分析失败' : 'Failed to compare profiles' };
    }
  }

  // ============== 外部搜索工具实现 ==============

  private async webSearch(query: string, topic?: string, locale = 'zh') {
    const isZh = locale === 'zh';
    if (!this.webSearchService || !this.webSearchService.isAvailable()) {
      return {
        error: isZh
          ? '搜索功能未配置，请联系管理员配置搜索 API Key'
          : 'Search not configured. Please contact admin to set up the search API key.',
      };
    }

    try {
      const response = await this.webSearchService.search(query, {
        topic: (topic as 'general' | 'news') || 'general',
        maxResults: 5,
      });

      if (!response.results.length) {
        return {
          message: isZh
            ? '未找到相关搜索结果'
            : 'No relevant search results found',
          query,
        };
      }

      return {
        count: response.results.length,
        source: response.source,
        cached: response.cached,
        results: response.results.map((r) => ({
          title: r.title,
          snippet: r.snippet,
          url: r.url,
          ...(r.date ? { date: r.date } : {}),
        })),
      };
    } catch (error) {
      this.logger.error('Web search failed', error);
      return {
        error: isZh
          ? '搜索服务暂时不可用，已使用现有数据库信息回答'
          : 'Search service temporarily unavailable. Using existing database information.',
      };
    }
  }

  private async searchSchoolWebsite(
    schoolName: string,
    query: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    if (!this.webSearchService || !this.webSearchService.isAvailable()) {
      return {
        error: isZh
          ? '搜索功能未配置，请联系管理员配置搜索 API Key'
          : 'Search not configured. Please contact admin to set up the search API key.',
      };
    }

    if (!schoolName) {
      return { error: isZh ? '请提供学校名称' : 'Please provide school name' };
    }

    try {
      const response = await this.webSearchService.searchSchoolWebsite(
        schoolName,
        query,
        { maxResults: 5 },
      );

      if (!response.results.length) {
        return {
          message: isZh
            ? `未在 ${schoolName} 官网找到相关信息`
            : `No relevant information found on ${schoolName}'s website`,
          query: `${schoolName} ${query}`,
        };
      }

      return {
        school: schoolName,
        count: response.results.length,
        source: response.source,
        cached: response.cached,
        results: response.results.map((r) => ({
          title: r.title,
          snippet: r.snippet,
          url: r.url,
          ...(r.content ? { content: r.content } : {}),
        })),
      };
    } catch (error) {
      this.logger.error('School website search failed', error);
      return {
        error: isZh
          ? '学校官网搜索暂时不可用，已使用现有数据库信息回答'
          : 'School website search temporarily unavailable. Using existing database information.',
      };
    }
  }
}
