/**
 * Agent 工具执行器 - 执行具体的工具调用
 */

import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../ai.service';
import { AgentTool, ToolResult, AgentContext } from './agent.types';
import { PredictionService } from '../../prediction/prediction.service';
import { AssessmentService } from '../../assessment/assessment.service';
import { ForumService } from '../../forum/forum.service';
import { SwipeService } from '../../swipe/swipe.service';
import { HallService } from '../../hall/hall.service';
import { WebSearchService } from '../../ai-agent/services/web-search.service';

@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    @Inject(forwardRef(() => PredictionService))
    private predictionService: PredictionService,
    @Inject(forwardRef(() => AssessmentService))
    private assessmentService: AssessmentService,
    @Inject(forwardRef(() => ForumService))
    private forumService: ForumService,
    @Inject(forwardRef(() => SwipeService))
    private swipeService: SwipeService,
    @Inject(forwardRef(() => HallService))
    private hallService: HallService,
    @Optional()
    private webSearchService?: WebSearchService,
  ) {}

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

    try {
      let result: any;

      switch (toolName as AgentTool) {
        case AgentTool.GET_PROFILE:
          result = await this.getProfile(userId);
          break;

        case AgentTool.UPDATE_PROFILE:
          result = await this.updateProfile(userId, args.field, args.value);
          break;

        case AgentTool.SEARCH_SCHOOLS:
          result = await this.searchSchools(args);
          break;

        case AgentTool.GET_SCHOOL_DETAILS:
          result = await this.getSchoolDetails(args.schoolId, args.schoolName);
          break;

        case AgentTool.COMPARE_SCHOOLS:
          result = await this.compareSchools(
            args.schoolIds?.split(','),
            args.aspects,
          );
          break;

        case AgentTool.GET_ESSAYS:
          result = await this.getEssays(userId);
          break;

        case AgentTool.REVIEW_ESSAY:
          result = await this.reviewEssay(args, userId);
          break;

        case AgentTool.POLISH_ESSAY:
          result = await this.aiService.polishEssay(args.content, args.style);
          break;

        case AgentTool.GENERATE_OUTLINE:
          result = await this.generateOutline(
            args as { prompt: string; background?: string; wordLimit?: number },
          );
          break;

        case AgentTool.BRAINSTORM_IDEAS:
          result = await this.aiService.generateEssayIdeas(
            args.prompt,
            args.background,
          );
          break;

        case AgentTool.RECOMMEND_SCHOOLS:
          result = await this.recommendSchools(userId, context, args);
          break;

        case AgentTool.ANALYZE_ADMISSION_CHANCE:
          result = await this.analyzeAdmissionChance(userId, args, context);
          break;

        case AgentTool.SEARCH_CASES:
          result = await this.searchCases(args);
          break;

        case AgentTool.GET_DEADLINES:
          result = await this.getDeadlines(
            args.schoolIds?.split(','),
            args.round,
          );
          break;

        case AgentTool.CREATE_TIMELINE:
          result = await this.createTimeline(args, context);
          break;

        case AgentTool.GET_PERSONAL_EVENTS:
          result = await this.getPersonalEvents(userId, args.category);
          break;

        case AgentTool.CREATE_PERSONAL_EVENT:
          result = await this.createPersonalEvent(userId, args as any);
          break;

        // ============== 测评工具 ==============
        case AgentTool.GET_ASSESSMENT_RESULTS:
          result = await this.getAssessmentResults(userId, args.type);
          break;

        case AgentTool.INTERPRET_ASSESSMENT:
          result = await this.interpretAssessment(userId, args.resultId);
          break;

        case AgentTool.SUGGEST_ACTIVITIES_FROM_ASSESSMENT:
          result = await this.suggestActivitiesFromAssessment(
            userId,
            args.resultId,
            args.targetMajor,
          );
          break;

        // ============== 论坛工具 ==============
        case AgentTool.SEARCH_FORUM_POSTS:
          result = await this.searchForumPosts(
            args.query,
            args.category,
            args.limit,
          );
          break;

        case AgentTool.GET_POPULAR_DISCUSSIONS:
          result = await this.getPopularDiscussions(
            args.category,
            args.timeRange,
          );
          break;

        case AgentTool.ANSWER_FORUM_QUESTION:
          result = await this.answerForumQuestion(args.question, args.context);
          break;

        // ============== 案例预测工具 ==============
        case AgentTool.EXPLAIN_CASE_RESULT:
          result = await this.explainCaseResult(args.caseId);
          break;

        case AgentTool.ANALYZE_PREDICTION_ACCURACY:
          result = await this.analyzePredictionAccuracy(userId);
          break;

        case AgentTool.COMPARE_CASE_WITH_PROFILE:
          result = await this.compareCaseWithProfile(userId, args.caseId);
          break;

        // ============== 档案排名工具 ==============
        case AgentTool.ANALYZE_PROFILE_RANKING:
          result = await this.analyzeProfileRanking(
            userId,
            args.schoolId,
            args.schoolName,
          );
          break;

        case AgentTool.SUGGEST_PROFILE_IMPROVEMENTS:
          result = await this.suggestProfileImprovements(
            userId,
            args.targetTier,
          );
          break;

        case AgentTool.COMPARE_WITH_ADMITTED_PROFILES:
          result = await this.compareWithAdmittedProfiles(
            userId,
            args.schoolId,
            args.schoolName,
          );
          break;

        // ============== 外部搜索工具 ==============
        case AgentTool.WEB_SEARCH:
          result = await this.webSearch(args.query, args.topic);
          break;

        case AgentTool.SEARCH_SCHOOL_WEBSITE:
          result = await this.searchSchoolWebsite(args.schoolName, args.query);
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

  private async getProfile(userId: string) {
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
      return { message: '用户档案为空，建议先完善档案信息' };
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
        duration: `${a.startDate} - ${a.endDate || '至今'}`,
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

  private async updateProfile(userId: string, field: string, value: string) {
    const allowedFields = ['targetMajor', 'budgetTier'];

    if (!allowedFields.includes(field)) {
      return { success: false, message: `不允许更新字段: ${field}` };
    }

    await this.prisma.profile.update({
      where: { userId },
      data: { [field]: value },
    });

    return { success: true, message: `已更新 ${field}` };
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

  private async getSchoolDetails(schoolId?: string, schoolName?: string) {
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
      return { error: '未找到该学校' };
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

  private async compareSchools(schoolIds: string[], aspects?: string) {
    if (!schoolIds?.length) {
      return { error: '请提供要对比的学校ID' };
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

  private async getEssays(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { essays: true },
    });

    if (!profile?.essays?.length) {
      return { message: '暂无保存的文书' };
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
      return { error: '请提供文书内容' };
    }

    return this.aiService.reviewEssay({
      prompt: prompt || 'Personal Statement',
      content,
    });
  }

  private async generateOutline(args: {
    prompt: string;
    background?: string;
    wordLimit?: number;
  }) {
    const systemPrompt = `你是文书写作专家。根据题目生成详细的文书大纲。
    
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
}`;

    const result = await this.aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `题目: ${args.prompt}\n${args.background ? `背景: ${args.background}\n` : ''}${args.wordLimit ? `字数限制: ${args.wordLimit}词` : ''}`,
        },
      ],
      { temperature: 0.7 },
    );

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}

    return { outline: result };
  }

  // ============== 选校工具实现 ==============

  private async recommendSchools(
    userId: string,
    context: AgentContext,
    args: { count?: number; preference?: string },
  ) {
    // 获取用户档案
    const profile = context.profile || (await this.getProfile(userId));

    if (!profile.gpa && !profile.testScores?.length) {
      return { error: '请先完善档案信息（GPA或标化成绩）以获取推荐' };
    }

    return this.aiService.schoolMatch({
      gpa: profile.gpa ?? undefined,
      gpaScale: profile.gpaScale,
      testScores: profile.testScores,
      targetMajor: profile.targetMajor ?? undefined,
    });
  }

  private async analyzeAdmissionChance(
    userId: string,
    args: { schoolId?: string; schoolName?: string },
    context: AgentContext,
  ) {
    // 获取用户的 profileId
    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!userProfile) {
      return { error: '请先完善档案信息以获取录取预测' };
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
      return { error: '未找到该学校' };
    }

    // 调用 PredictionService 进行预测
    try {
      const predictions = await this.predictionService.predict(
        userProfile.id,
        [school.id],
        false, // 使用缓存
      );

      if (!predictions.length) {
        return { error: '预测失败，请稍后重试' };
      }

      const prediction = predictions[0];

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
          '暂无详细分析',
        suggestions: prediction.suggestions || [],
        comparison: prediction.comparison,
      };
    } catch (error) {
      this.logger.error('Prediction service failed', error);
      return { error: '预测服务暂时不可用，请稍后重试' };
    }
  }

  // ============== 案例工具实现 ==============

  private async searchCases(args: {
    schoolName?: string;
    major?: string;
    year?: number;
    gpaRange?: string;
  }) {
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
      return { message: '未找到匹配的案例' };
    }

    return {
      count: cases.length,
      cases: cases.map((c) => ({
        school: c.school.nameZh || c.school.name,
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

  private async getDeadlines(schoolIds?: string[], round?: string) {
    if (!schoolIds?.length) {
      return { error: '请提供学校ID' };
    }

    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { name: true, nameZh: true, metadata: true },
    });

    const deadlines = schools.map((s) => {
      const metadata = (s.metadata as any) || {};
      const allDeadlines = metadata.deadlines || {};

      return {
        school: s.nameZh || s.name,
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
  ) {
    const systemPrompt = `你是申请规划顾问。根据目标学校创建详细的申请时间线。

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
}`;

    const result = await this.aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `目标学校: ${args.targetSchools || '待定'}\n开始日期: ${args.startDate || '现在'}`,
        },
      ],
      { temperature: 0.6 },
    );

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}

    return { timeline: result };
  }

  private async getPersonalEvents(userId: string, category?: string) {
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
      return { message: '暂无个人事件，可以通过订阅全局事件或手动创建来添加' };
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
  ) {
    if (!args.title || !args.category) {
      return { error: '需要提供事件名称和分类' };
    }

    // 默认任务模板
    const templates: Record<string, string[]> = {
      COMPETITION: [
        '了解竞赛规则和要求',
        '报名注册',
        '备赛准备',
        '参加竞赛',
        '查看结果',
      ],
      TEST: ['报名注册', '制定备考计划', '完成模考练习', '参加考试', '送分'],
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
      message: `已创建事件「${event.title}」，包含 ${event.tasks.length} 个子任务`,
    };
  }

  // ============== 测评工具实现 ==============

  private async getAssessmentResults(
    userId: string,
    type?: 'mbti' | 'holland',
  ) {
    try {
      const history = await this.assessmentService.getHistory(userId);

      if (!history.length) {
        return { message: '暂无测评记录，建议先完成 MBTI 或霍兰德测评' };
      }

      // 按类型筛选
      const filteredResults = type
        ? history.filter((r) => r.type.toLowerCase() === type.toLowerCase())
        : history;

      if (!filteredResults.length) {
        return { message: `暂无${type?.toUpperCase()}测评记录` };
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
      return { error: '获取测评结果失败' };
    }
  }

  private async interpretAssessment(userId: string, resultId: string) {
    try {
      const result = await this.assessmentService.getResult(userId, resultId);

      if (!result) {
        return { error: '未找到该测评结果' };
      }

      // 构建解读提示词
      const systemPrompt = `你是专业的职业规划顾问和心理咨询师。请根据以下测评结果，提供深度解读和个性化建议。

解读应包括：
1. 性格/兴趣特点分析
2. 适合的学习方式和环境
3. 专业选择建议（考虑留学申请）
4. 职业发展方向
5. 需要注意的潜在挑战

请用中文回复，语气专业但友好。`;

      const userContent = result.mbtiResult
        ? `MBTI测评结果：
类型：${result.mbtiResult.type}
描述：${result.mbtiResult.descriptionZh || result.mbtiResult.description}
优势：${result.mbtiResult.strengths?.join('、')}
推荐职业：${result.mbtiResult.careers?.join('、')}
推荐专业：${result.mbtiResult.majors?.join('、')}`
        : `霍兰德测评结果：
代码：${result.hollandResult?.codes}
类型：${result.hollandResult?.typesZh?.join('、') || result.hollandResult?.types?.join('、')}
适合领域：${result.hollandResult?.fieldsZh?.join('、') || result.hollandResult?.fields?.join('、')}
推荐专业：${result.hollandResult?.majors?.join('、')}`;

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
      return { error: '解读测评结果失败' };
    }
  }

  private async suggestActivitiesFromAssessment(
    userId: string,
    resultId: string,
    targetMajor?: string,
  ) {
    try {
      const result = await this.assessmentService.getResult(userId, resultId);

      if (!result) {
        return { error: '未找到该测评结果' };
      }

      const systemPrompt = `你是留学申请顾问，擅长活动规划。根据学生的性格测评结果，推荐适合的课外活动、竞赛和项目。

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
}`;

      const userContent = `
测评结果：${JSON.stringify(result.mbtiResult || result.hollandResult)}
${targetMajor ? `目标专业：${targetMajor}` : ''}

请推荐适合这位学生的活动和竞赛。`;

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
      } catch {}

      return { suggestions: response };
    } catch (error) {
      this.logger.error('Failed to suggest activities', error);
      return { error: '推荐活动失败' };
    }
  }

  // ============== 论坛工具实现 ==============

  private async searchForumPosts(
    query: string,
    category?: string,
    limit?: number,
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
          author: p.author.name || '匿名用户',
          isVerified: p.author.isVerified,
          category: p.category?.nameZh || p.category?.name,
          tags: p.tags,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          createdAt: p.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to search forum posts', error);
      return { error: '搜索论坛帖子失败' };
    }
  }

  private async getPopularDiscussions(category?: string, timeRange?: string) {
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
          category: p.category?.nameZh || p.category?.name,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          isTeamPost: p.isTeamPost,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get popular discussions', error);
      return { error: '获取热门讨论失败' };
    }
  }

  private async answerForumQuestion(question: string, context?: string) {
    const systemPrompt = `你是专业的留学顾问，负责回答学生关于留学申请的问题。

回答要求：
1. 准确、专业、有帮助
2. 如果不确定，诚实说明并建议寻求专业人士帮助
3. 适当引用相关资源或建议进一步阅读
4. 用中文回答`;

    const response = await this.aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `问题：${question}${context ? `\n背景：${context}` : ''}`,
        },
      ],
      { temperature: 0.5 },
    );

    return {
      question,
      answer: response,
      disclaimer: '以上回答仅供参考，具体情况请咨询专业顾问或学校官方。',
    };
  }

  // ============== 案例预测工具实现 ==============

  private async explainCaseResult(caseId: string) {
    try {
      const admissionCase = await this.prisma.admissionCase.findUnique({
        where: { id: caseId },
        include: { school: true },
      });

      if (!admissionCase) {
        return { error: '未找到该案例' };
      }

      const systemPrompt = `你是资深招生官和留学顾问。请分析这个录取案例，解释为什么申请者被${admissionCase.result === 'ADMITTED' ? '录取' : admissionCase.result === 'REJECTED' ? '拒绝' : '放入候补名单'}。

分析要点：
1. 学术背景评估（GPA、标化成绩）
2. 软实力分析（活动、奖项的暗示）
3. 学校匹配度
4. 可能的录取/拒绝因素
5. 对类似背景学生的建议

请用中文回答，分析要客观专业。`;

      const caseInfo = `
学校：${admissionCase.school.nameZh || admissionCase.school.name} (排名 #${admissionCase.school.usNewsRank || 'N/A'})
申请年份：${admissionCase.year}
申请轮次：${admissionCase.round || '未知'}
专业：${admissionCase.major || '未知'}
GPA范围：${admissionCase.gpaRange || '未知'}
SAT范围：${admissionCase.satRange || '未知'}
ACT范围：${admissionCase.actRange || '未知'}
托福范围：${admissionCase.toeflRange || '未知'}
标签：${admissionCase.tags?.join('、') || '无'}
结果：${admissionCase.result}
录取率：${admissionCase.school.acceptanceRate ? Number(admissionCase.school.acceptanceRate).toFixed(1) + '%' : '未知'}`;

      const analysis = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: caseInfo },
        ],
        { temperature: 0.5 },
      );

      return {
        caseId,
        school: admissionCase.school.nameZh || admissionCase.school.name,
        result: admissionCase.result,
        analysis,
      };
    } catch (error) {
      this.logger.error('Failed to explain case result', error);
      return { error: '分析案例失败' };
    }
  }

  private async analyzePredictionAccuracy(userId: string) {
    try {
      const stats = await this.swipeService.getStats(userId);

      const systemPrompt = `你是数据分析师。根据用户的案例预测游戏统计数据，分析其预测能力和改进建议。`;

      const analysis = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `
用户预测统计：
- 总预测次数：${stats.totalSwipes}
- 正确次数：${stats.correctCount}
- 准确率：${stats.accuracy}%
- 当前连胜：${stats.currentStreak}
- 最佳连胜：${stats.bestStreak}
- 等级：${stats.badge}

请分析用户的预测能力特点，并给出提高准确率的建议。`,
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
      return { error: '分析预测准确度失败' };
    }
  }

  private async compareCaseWithProfile(userId: string, caseId: string) {
    try {
      const [admissionCase, profile] = await Promise.all([
        this.prisma.admissionCase.findUnique({
          where: { id: caseId },
          include: { school: true },
        }),
        this.getProfile(userId),
      ]);

      if (!admissionCase) {
        return { error: '未找到该案例' };
      }

      if (!profile || profile.message) {
        return { error: '请先完善您的档案信息' };
      }

      const systemPrompt = `你是留学顾问。请对比分析申请者档案与录取案例，找出差距和优势。

分析要点：
1. 学术成绩对比
2. 软实力对比（活动、奖项）
3. 相似点和差异点
4. 具体改进建议
5. 录取可能性评估

请用中文回答，给出具体可操作的建议。`;

      const comparison = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `
录取案例：
- 学校：${admissionCase.school.nameZh || admissionCase.school.name}
- 结果：${admissionCase.result}
- GPA范围：${admissionCase.gpaRange || '未知'}
- SAT范围：${admissionCase.satRange || '未知'}
- 标签：${admissionCase.tags?.join('、') || '无'}

您的档案：
- GPA：${profile.gpa || '未填'}/${profile.gpaScale || 4.0}
- 标化：${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || '未填'}
- 活动数量：${profile.activities?.length || 0}
- 奖项数量：${profile.awards?.length || 0}
- 目标专业：${profile.targetMajor || '未定'}`,
          },
        ],
        { temperature: 0.5 },
      );

      return {
        caseSchool: admissionCase.school.nameZh || admissionCase.school.name,
        caseResult: admissionCase.result,
        comparison,
      };
    } catch (error) {
      this.logger.error('Failed to compare case with profile', error);
      return { error: '对比分析失败' };
    }
  }

  // ============== 档案排名工具实现 ==============

  private async analyzeProfileRanking(
    userId: string,
    schoolId?: string,
    schoolName?: string,
  ) {
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
          type: '总体排名',
          rank: ranking.rank,
          total: ranking.total,
          percentile: ranking.percentile,
          message: `您在所有用户中排名第 ${ranking.rank}/${ranking.total}，超过了 ${ranking.percentile}% 的用户`,
        };
      }

      const ranking = await this.hallService.getProfileRanking(
        userId,
        targetSchoolId,
      );
      const school = await this.prisma.school.findUnique({
        where: { id: targetSchoolId },
      });

      return {
        school: school?.nameZh || school?.name,
        rank: ranking.rank,
        total: ranking.total,
        percentile: ranking.percentile,
        message: `在申请 ${school?.nameZh || school?.name} 的用户中，您排名第 ${ranking.rank}/${ranking.total}，超过了 ${ranking.percentile}% 的用户`,
      };
    } catch (error) {
      this.logger.error('Failed to analyze profile ranking', error);
      return { error: '获取排名失败' };
    }
  }

  private async suggestProfileImprovements(
    userId: string,
    targetTier?: string,
  ) {
    try {
      const profile = await this.getProfile(userId);

      if (!profile || profile.message) {
        return { error: '请先完善档案信息' };
      }

      const systemPrompt = `你是资深留学顾问。根据学生档案，提供具体的改进建议以提升竞争力。

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
}`;

      const response = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `
学生档案：
- GPA：${profile.gpa || '未填'}/${profile.gpaScale || 4.0}
- 年级：${profile.grade || '未填'}
- 标化成绩：${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || '未填'}
- 活动数量：${profile.activities?.length || 0}
- 活动详情：${
              profile.activities
                ?.slice(0, 3)
                .map((a: any) => `${a.name}(${a.role})`)
                .join(', ') || '无'
            }
- 奖项数量：${profile.awards?.length || 0}
- 奖项详情：${
              profile.awards
                ?.slice(0, 3)
                .map((a: any) => `${a.name}(${a.level})`)
                .join(', ') || '无'
            }
- 目标专业：${profile.targetMajor || '未定'}
- 预算：${profile.budgetTier || '未定'}
${targetTier ? `目标学校层次：${targetTier}` : ''}`,
          },
        ],
        { temperature: 0.6 },
      );

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {}

      return { suggestions: response };
    } catch (error) {
      this.logger.error('Failed to suggest improvements', error);
      return { error: '生成改进建议失败' };
    }
  }

  private async compareWithAdmittedProfiles(
    userId: string,
    schoolId?: string,
    schoolName?: string,
  ) {
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
        return { error: '请指定要对比的学校' };
      }

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
          school: school.nameZh || school.name,
          message: '暂无该学校的录取案例数据',
        };
      }

      // 获取用户档案
      const profile = await this.getProfile(userId);
      if (!profile || profile.message) {
        return { error: '请先完善档案信息' };
      }

      // 统计录取案例的平均水平
      const gpaRanges = admittedCases.map((c) => c.gpaRange).filter(Boolean);
      const satRanges = admittedCases.map((c) => c.satRange).filter(Boolean);

      const systemPrompt = `你是留学数据分析师。请对比学生档案与该校录取学生的整体情况。`;

      const analysis = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `
目标学校：${school.nameZh || school.name} (排名 #${school.usNewsRank})

录取学生情况（${admittedCases.length}个案例）：
- GPA范围分布：${gpaRanges.join(', ') || '数据不足'}
- SAT范围分布：${satRanges.join(', ') || '数据不足'}
- 常见标签：${[...new Set(admittedCases.flatMap((c) => c.tags || []))].slice(0, 10).join(', ')}

您的档案：
- GPA：${profile.gpa || '未填'}/${profile.gpaScale || 4.0}
- 标化：${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || '未填'}
- 活动：${profile.activities?.length || 0}个
- 奖项：${profile.awards?.length || 0}个

请分析差距并给出建议。`,
          },
        ],
        { temperature: 0.5 },
      );

      return {
        school: school.nameZh || school.name,
        admittedCasesCount: admittedCases.length,
        analysis,
      };
    } catch (error) {
      this.logger.error('Failed to compare with admitted profiles', error);
      return { error: '对比分析失败' };
    }
  }

  // ============== 外部搜索工具实现 ==============

  private async webSearch(query: string, topic?: string) {
    if (!this.webSearchService || !this.webSearchService.isAvailable()) {
      return { error: '搜索功能未配置，请联系管理员配置搜索 API Key' };
    }

    try {
      const response = await this.webSearchService.search(query, {
        topic: (topic as 'general' | 'news') || 'general',
        maxResults: 5,
      });

      if (!response.results.length) {
        return { message: '未找到相关搜索结果', query };
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
      return { error: '搜索服务暂时不可用，已使用现有数据库信息回答' };
    }
  }

  private async searchSchoolWebsite(schoolName: string, query: string) {
    if (!this.webSearchService || !this.webSearchService.isAvailable()) {
      return { error: '搜索功能未配置，请联系管理员配置搜索 API Key' };
    }

    if (!schoolName) {
      return { error: '请提供学校名称' };
    }

    try {
      const response = await this.webSearchService.searchSchoolWebsite(
        schoolName,
        query,
        { maxResults: 5 },
      );

      if (!response.results.length) {
        return {
          message: `未在 ${schoolName} 官网找到相关信息`,
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
      return { error: '学校官网搜索暂时不可用，已使用现有数据库信息回答' };
    }
  }
}
