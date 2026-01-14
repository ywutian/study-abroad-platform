/**
 * 工具执行器 - 执行 Agent 的工具调用
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { ToolCall, ToolResult, UserContext } from '../types';
import { getToolByName } from '../config/tools.config';

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  /**
   * 执行工具调用
   */
  async execute(
    toolCall: ToolCall,
    userId: string,
    context: UserContext,
  ): Promise<ToolResult> {
    const tool = getToolByName(toolCall.name);
    
    if (!tool) {
      return {
        callId: toolCall.id,
        name: toolCall.name,
        result: null,
        error: `Unknown tool: ${toolCall.name}`,
      };
    }

    try {
      const [category, method] = tool.handler.split('.');
      const result = await this.executeHandler(category, method, toolCall.arguments, userId, context);
      
      return {
        callId: toolCall.id,
        name: toolCall.name,
        result,
      };
    } catch (error) {
      this.logger.error(`Tool execution failed: ${toolCall.name}`, error);
      return {
        callId: toolCall.id,
        name: toolCall.name,
        result: null,
        error: error instanceof Error ? error.message : 'Execution failed',
      };
    }
  }

  /**
   * 执行具体的 handler
   */
  private async executeHandler(
    category: string,
    method: string,
    args: Record<string, any>,
    userId: string,
    context: UserContext,
  ): Promise<any> {
    switch (category) {
      case 'user':
        return this.userHandlers(method, args, userId, context);
      case 'school':
        return this.schoolHandlers(method, args, userId, context);
      case 'essay':
        return this.essayHandlers(method, args, userId, context);
      case 'profile':
        return this.profileHandlers(method, args, userId, context);
      case 'case':
        return this.caseHandlers(method, args, userId);
      case 'timeline':
        return this.timelineHandlers(method, args, userId, context);
      case 'knowledge':
        return this.knowledgeHandlers(method, args);
      default:
        throw new Error(`Unknown handler category: ${category}`);
    }
  }

  // ==================== User Handlers ====================
  
  private async userHandlers(method: string, args: any, userId: string, context: UserContext) {
    switch (method) {
      case 'getProfile':
        return this.getProfile(userId);
      case 'getContext':
        return context;
      default:
        throw new Error(`Unknown user method: ${method}`);
    }
  }

  private async getProfile(userId: string): Promise<{ message: string; empty: true } | {
    gpa: number | null;
    gpaScale: number;
    targetMajor: string | null;
    grade: string | null;
    testScores: Array<{ type: string; score: number }> | undefined;
    activities: Array<{ name: string; category: string; role: string | null }> | undefined;
    awards: Array<{ name: string; level: string }> | undefined;
    empty?: false;
  }> {
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
      return { message: '档案为空，建议先完善档案信息', empty: true };
    }

    return {
      gpa: profile.gpa ? Number(profile.gpa) : null,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      targetMajor: profile.targetMajor || '未设置',
      grade: profile.grade || '未设置',
      testScores: profile.testScores?.length 
        ? profile.testScores.map(s => ({ type: s.type, score: s.score }))
        : [],
      activities: profile.activities?.length
        ? profile.activities.slice(0, 10).map(a => ({
            name: a.name,
            category: a.category,
            role: a.role || '参与者',
          }))
        : [],
      awards: profile.awards?.length
        ? profile.awards.slice(0, 10).map(a => ({
            name: a.name,
            level: a.level,
          }))
        : [],
      empty: false,
    };
  }

  // ==================== School Handlers ====================

  private async schoolHandlers(method: string, args: any, userId: string, context: UserContext) {
    switch (method) {
      case 'search':
        return this.searchSchools(args);
      case 'getDetails':
        return this.getSchoolDetails(args);
      case 'compare':
        return this.compareSchools(args.schoolIds);
      case 'getEssayPrompts':
        return this.getSchoolEssayPrompts(args);
      case 'getDeadlines':
        return this.getDeadlines(args);
      case 'recommend':
        return this.recommendSchools(userId, context, args);
      case 'analyzeAdmission':
        return this.analyzeAdmission(args, context);
      default:
        throw new Error(`Unknown school method: ${method}`);
    }
  }

  private async searchSchools(args: any) {
    const where: any = {};
    
    if (args.query) {
      where.OR = [
        { name: { contains: args.query, mode: 'insensitive' } },
        { nameZh: { contains: args.query, mode: 'insensitive' } },
      ];
    }
    if (args.rankMin || args.rankMax) {
      where.usNewsRank = {};
      if (args.rankMin) where.usNewsRank.gte = args.rankMin;
      if (args.rankMax) where.usNewsRank.lte = args.rankMax;
    }
    if (args.state) where.state = args.state;
    if (args.maxTuition) where.tuition = { lte: args.maxTuition };

    const schools = await this.prisma.school.findMany({
      where,
      take: 15,
      orderBy: { usNewsRank: 'asc' },
      select: {
        id: true, name: true, nameZh: true, state: true,
        usNewsRank: true, acceptanceRate: true, tuition: true,
      },
    });

    return {
      count: schools.length,
      schools: schools.map(s => ({
        id: s.id,
        name: s.nameZh || s.name,
        state: s.state,
        rank: s.usNewsRank,
        acceptanceRate: s.acceptanceRate ? `${Number(s.acceptanceRate).toFixed(1)}%` : 'N/A',
        tuition: s.tuition ? `$${s.tuition.toLocaleString()}` : 'N/A',
      })),
    };
  }

  private async getSchoolDetails(args: any) {
    let school;
    if (args.schoolId) {
      school = await this.prisma.school.findUnique({ where: { id: args.schoolId } });
    } else if (args.schoolName) {
      school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { name: { contains: args.schoolName, mode: 'insensitive' } },
            { nameZh: { contains: args.schoolName, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!school) return { error: '未找到该学校' };

    const metadata = school.metadata as any || {};
    return {
      id: school.id,
      name: school.nameZh || school.name,
      englishName: school.name,
      state: school.state,
      rank: school.usNewsRank,
      acceptanceRate: school.acceptanceRate ? `${Number(school.acceptanceRate).toFixed(1)}%` : 'N/A',
      tuition: school.tuition ? `$${school.tuition.toLocaleString()}` : 'N/A',
      avgSalary: school.avgSalary ? `$${school.avgSalary.toLocaleString()}` : 'N/A',
      deadlines: metadata.deadlines || {},
      essayPrompts: metadata.essayPrompts || [],
    };
  }

  private async compareSchools(schoolIds: string[]) {
    if (!schoolIds?.length) return { error: '请提供学校ID' };

    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });

    return {
      schools: schools.map(s => ({
        name: s.nameZh || s.name,
        rank: s.usNewsRank,
        acceptanceRate: s.acceptanceRate ? `${Number(s.acceptanceRate).toFixed(1)}%` : 'N/A',
        tuition: s.tuition ? `$${s.tuition.toLocaleString()}` : 'N/A',
        avgSalary: s.avgSalary ? `$${s.avgSalary.toLocaleString()}` : 'N/A',
      })),
    };
  }

  private async getSchoolEssayPrompts(args: any) {
    const school = await this.getSchoolDetails(args);
    if (school.error) return school;
    return {
      school: school.name,
      prompts: school.essayPrompts || [],
    };
  }

  private async getDeadlines(args: any) {
    if (!args.schoolIds?.length) return { error: '请提供学校' };
    
    const schools = await this.prisma.school.findMany({
      where: { id: { in: args.schoolIds } },
      select: { name: true, nameZh: true, metadata: true },
    });

    return {
      deadlines: schools.map(s => ({
        school: s.nameZh || s.name,
        ...(s.metadata as any)?.deadlines || {},
      })),
    };
  }

  private async recommendSchools(userId: string, context: UserContext, args: any) {
    const profile = context.profile || await this.getProfile(userId);
    if ('empty' in profile && profile.empty === true) return profile;

    return this.aiService.schoolMatch({
      gpa: profile.gpa ?? undefined,
      gpaScale: profile.gpaScale,
      testScores: profile.testScores,
      targetMajor: profile.targetMajor ?? undefined,
    });
  }

  private async analyzeAdmission(args: any, context: UserContext) {
    const school = await this.getSchoolDetails(args);
    if (school.error) return school;

    const profile = context.profile;
    if (!profile?.gpa) return { error: '请先完善档案信息' };

    // 简单的录取概率估算
    const gpa = profile.gpa;
    const sat = profile.testScores?.find(s => s.type === 'SAT')?.score;
    const rank = school.rank || 100;

    let chance = 'medium';
    if (rank <= 10) chance = gpa >= 3.9 && sat && sat >= 1550 ? 'low' : 'very_low';
    else if (rank <= 30) chance = gpa >= 3.7 && sat && sat >= 1500 ? 'medium' : 'low';
    else if (rank <= 50) chance = gpa >= 3.5 ? 'high' : 'medium';
    else chance = 'high';

    return {
      school: school.name,
      rank: school.rank,
      acceptanceRate: school.acceptanceRate,
      yourProfile: { gpa, sat },
      chance,
      chanceLabel: {
        very_low: '很低 (<10%)',
        low: '较低 (10-25%)',
        medium: '中等 (25-50%)',
        high: '较高 (>50%)',
      }[chance],
    };
  }

  // ==================== Essay Handlers ====================

  private async essayHandlers(method: string, args: any, userId: string, context: UserContext) {
    switch (method) {
      case 'list':
        return this.listEssays(userId);
      case 'review':
        return this.reviewEssay(args, userId);
      case 'polish':
        return this.aiService.polishEssay(args.content, args.style);
      case 'generateOutline':
        return this.generateOutline(args, context);
      case 'brainstorm':
        return { ideas: await this.aiService.generateEssayIdeas(args.prompt, args.background) };
      case 'continue':
        return this.aiService.continueWriting(args.content, args.prompt, args.direction);
      default:
        throw new Error(`Unknown essay method: ${method}`);
    }
  }

  private async listEssays(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { essays: { orderBy: { updatedAt: 'desc' } } },
    });

    if (!profile?.essays?.length) return { message: '暂无保存的文书', essays: [] };

    return {
      count: profile.essays.length,
      essays: profile.essays.map(e => ({
        id: e.id,
        title: e.title,
        prompt: e.prompt,
        wordCount: e.content?.split(/\s+/).filter(Boolean).length || 0,
        updatedAt: e.updatedAt,
      })),
    };
  }

  private async reviewEssay(args: any, userId: string) {
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

    if (!content) return { error: '请提供文书内容' };

    return this.aiService.reviewEssay({ prompt: prompt || 'Essay', content });
  }

  private async generateOutline(args: any, context: UserContext) {
    const background = args.background || (context.profile ? 
      `GPA: ${context.profile.gpa}, 活动: ${context.profile.activities?.map(a => a.name).join(', ')}` : '');

    // 使用 AI 生成大纲
    const result = await this.aiService.chat([
      {
        role: 'system',
        content: `生成文书大纲，返回JSON: { "hook": "开头策略", "paragraphs": [{"focus": "重点", "content": "内容"}], "ending": "结尾", "tips": [] }`,
      },
      { role: 'user', content: `题目: ${args.prompt}\n背景: ${background}\n字数: ${args.wordLimit || 650}` },
    ], { temperature: 0.7 });

    try {
      const match = result.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    
    return { outline: result };
  }

  // ==================== Profile Handlers ====================

  private async profileHandlers(method: string, args: any, userId: string, context: UserContext) {
    switch (method) {
      case 'analyze':
        return this.analyzeProfile(userId, context);
      case 'suggestImprovements':
        return this.suggestImprovements(context, args.focus);
      default:
        throw new Error(`Unknown profile method: ${method}`);
    }
  }

  private async analyzeProfile(userId: string, context: UserContext) {
    const profile = context.profile || await this.getProfile(userId);
    if ('empty' in profile && profile.empty === true) return profile;

    return this.aiService.analyzeProfile({
      gpa: profile.gpa ?? undefined,
      gpaScale: profile.gpaScale,
      testScores: profile.testScores,
      activities: profile.activities?.map(a => ({
        name: a.name,
        category: a.category,
        role: a.role ?? '',
      })),
      awards: profile.awards,
      targetMajor: profile.targetMajor ?? undefined,
    });
  }

  private async suggestImprovements(context: UserContext, focus?: string) {
    const profile = context.profile;
    if (!profile) return { error: '请先完善档案' };

    const systemPrompt = `根据学生档案提供背景提升建议。关注: ${focus || 'all'}
返回JSON: { "suggestions": [{"area": "领域", "current": "现状", "suggestion": "建议", "priority": "high/medium/low"}] }`;

    const result = await this.aiService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(profile) },
    ], { temperature: 0.6 });

    try {
      const match = result.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}

    return { suggestions: result };
  }

  // ==================== Case Handlers ====================

  private async caseHandlers(method: string, args: any, userId: string) {
    switch (method) {
      case 'search':
        return this.searchCases(args);
      default:
        throw new Error(`Unknown case method: ${method}`);
    }
  }

  private async searchCases(args: any) {
    const where: any = { visibility: { in: ['ANONYMOUS', 'PUBLIC'] } };

    if (args.schoolName) {
      where.school = {
        OR: [
          { name: { contains: args.schoolName, mode: 'insensitive' } },
          { nameZh: { contains: args.schoolName, mode: 'insensitive' } },
        ],
      };
    }
    if (args.major) where.major = { contains: args.major, mode: 'insensitive' };
    if (args.year) where.year = args.year;

    const cases = await this.prisma.admissionCase.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { name: true, nameZh: true } } },
    });

    if (!cases.length) return { message: '未找到匹配案例' };

    return {
      count: cases.length,
      cases: cases.map(c => ({
        school: c.school.nameZh || c.school.name,
        year: c.year,
        round: c.round,
        result: c.result,
        gpaRange: c.gpaRange,
        satRange: c.satRange,
      })),
    };
  }

  // ==================== Timeline Handlers ====================

  private async timelineHandlers(method: string, args: any, userId: string, context: UserContext) {
    switch (method) {
      case 'create':
        return this.createTimeline(args, context);
      default:
        throw new Error(`Unknown timeline method: ${method}`);
    }
  }

  private async createTimeline(args: any, context: UserContext) {
    const systemPrompt = `创建申请时间线。返回JSON:
{ "timeline": [{"month": "2025年X月", "tasks": ["任务"]}], "keyDates": [{"date": "日期", "event": "事件"}] }`;

    const result = await this.aiService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `目标学校: ${args.targetSchools || '待定'}, 开始: ${args.startDate || '现在'}` },
    ], { temperature: 0.5 });

    try {
      const match = result.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}

    return { timeline: result };
  }

  // ==================== Knowledge Handlers ====================

  private async knowledgeHandlers(method: string, args: any) {
    // 简单的知识库查询（可扩展为向量搜索）
    return {
      query: args.query,
      answer: '这是一个通用留学问题，建议查阅官方资料或咨询专业顾问。',
    };
  }
}







