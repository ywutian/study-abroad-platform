/**
 * Agent 工具执行器 - 执行具体的工具调用
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../ai.service';
import { AgentTool, ToolResult, AgentContext } from './agent.types';

@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
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
          result = await this.compareSchools(args.schoolIds?.split(','), args.aspects);
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
          result = await this.generateOutline(args);
          break;

        case AgentTool.BRAINSTORM_IDEAS:
          result = await this.aiService.generateEssayIdeas(args.prompt, args.background);
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
          result = await this.getDeadlines(args.schoolIds?.split(','), args.round);
          break;

        case AgentTool.CREATE_TIMELINE:
          result = await this.createTimeline(args, context);
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
      testScores: profile.testScores?.map(s => ({
        type: s.type,
        score: s.score,
        date: s.testDate,
      })),
      activities: profile.activities?.map(a => ({
        name: a.name,
        category: a.category,
        role: a.role,
        duration: `${a.startDate} - ${a.endDate || '至今'}`,
      })),
      awards: profile.awards?.map(a => ({
        name: a.name,
        level: a.level,
        year: a.year,
      })),
      education: profile.education?.map(e => ({
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
      where.OR = [
        { name: { contains: args.query, mode: 'insensitive' } },
        { nameZh: { contains: args.query, mode: 'insensitive' } },
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
      },
    });

    return {
      count: schools.length,
      schools: schools.map(s => ({
        id: s.id,
        name: s.name,
        nameZh: s.nameZh,
        state: s.state,
        rank: s.usNewsRank,
        acceptanceRate: s.acceptanceRate ? `${Number(s.acceptanceRate).toFixed(1)}%` : 'N/A',
        tuition: s.tuition ? `$${s.tuition.toLocaleString()}` : 'N/A',
      })),
    };
  }

  private async getSchoolDetails(schoolId?: string, schoolName?: string) {
    let school;

    if (schoolId) {
      school = await this.prisma.school.findUnique({
        where: { id: schoolId },
      });
    } else if (schoolName) {
      school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { name: { contains: schoolName, mode: 'insensitive' } },
            { nameZh: { contains: schoolName, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!school) {
      return { error: '未找到该学校' };
    }

    const metadata = school.metadata as any || {};

    return {
      id: school.id,
      name: school.name,
      nameZh: school.nameZh,
      state: school.state,
      rank: school.usNewsRank,
      acceptanceRate: school.acceptanceRate ? `${Number(school.acceptanceRate).toFixed(1)}%` : 'N/A',
      tuition: school.tuition ? `$${school.tuition.toLocaleString()}` : 'N/A',
      avgSalary: school.avgSalary ? `$${school.avgSalary.toLocaleString()}` : 'N/A',
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
      comparison: schools.map(s => ({
        name: s.name,
        rank: s.usNewsRank,
        acceptanceRate: s.acceptanceRate ? Number(s.acceptanceRate).toFixed(1) + '%' : 'N/A',
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
      essays: profile.essays.map(e => ({
        id: e.id,
        title: e.title,
        prompt: e.prompt,
        wordCount: e.content?.split(/\s+/).filter(Boolean).length || 0,
        updatedAt: e.updatedAt,
      })),
    };
  }

  private async reviewEssay(args: { essayId?: string; content?: string; prompt?: string }, userId: string) {
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

  private async generateOutline(args: { prompt: string; background?: string; wordLimit?: number }) {
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
        { role: 'user', content: `题目: ${args.prompt}\n${args.background ? `背景: ${args.background}\n` : ''}${args.wordLimit ? `字数限制: ${args.wordLimit}词` : ''}` },
      ],
      { temperature: 0.7 }
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

  private async recommendSchools(userId: string, context: AgentContext, args: { count?: number; preference?: string }) {
    // 获取用户档案
    const profile = context.profile || await this.getProfile(userId);
    
    if (!profile.gpa && !profile.testScores?.length) {
      return { error: '请先完善档案信息（GPA或标化成绩）以获取推荐' };
    }

    return this.aiService.schoolMatch({
      gpa: profile.gpa,
      gpaScale: profile.gpaScale,
      testScores: profile.testScores,
      targetMajor: profile.targetMajor,
    });
  }

  private async analyzeAdmissionChance(userId: string, args: { schoolId?: string; schoolName?: string }, context: AgentContext) {
    const school = await this.getSchoolDetails(args.schoolId, args.schoolName);
    if (school.error) return school;

    const profile = context.profile || await this.getProfile(userId);

    const systemPrompt = `你是留学顾问，请分析学生申请该校的录取概率。

学生档案:
- GPA: ${profile.gpa || 'N/A'}/${profile.gpaScale || 4.0}
- 标化: ${profile.testScores?.map(s => `${s.type}: ${s.score}`).join(', ') || 'N/A'}
- 目标专业: ${profile.targetMajor || 'N/A'}

学校信息:
- ${school.name} (排名 #${school.rank})
- 录取率: ${school.acceptanceRate}

返回JSON格式:
{
  "chance": "high/medium/low",
  "percentage": "预估录取概率百分比",
  "analysis": "详细分析",
  "suggestions": ["提升建议1", "提升建议2"]
}`;

    const result = await this.aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '请分析录取概率' },
      ],
      { temperature: 0.5 }
    );

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { school: school.name, ...JSON.parse(jsonMatch[0]) };
      }
    } catch {}

    return { school: school.name, analysis: result };
  }

  // ============== 案例工具实现 ==============

  private async searchCases(args: { schoolName?: string; major?: string; year?: number; gpaRange?: string }) {
    const where: any = {};

    if (args.schoolName) {
      where.school = {
        OR: [
          { name: { contains: args.schoolName, mode: 'insensitive' } },
          { nameZh: { contains: args.schoolName, mode: 'insensitive' } },
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
      cases: cases.map(c => ({
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

    const deadlines = schools.map(s => {
      const metadata = s.metadata as any || {};
      const allDeadlines = metadata.deadlines || {};
      
      return {
        school: s.nameZh || s.name,
        deadlines: round ? { [round]: allDeadlines[round.toLowerCase()] } : allDeadlines,
      };
    });

    return { deadlines };
  }

  private async createTimeline(args: { targetSchools?: string; startDate?: string }, context: AgentContext) {
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
        { role: 'user', content: `目标学校: ${args.targetSchools || '待定'}\n开始日期: ${args.startDate || '现在'}` },
      ],
      { temperature: 0.6 }
    );

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}

    return { timeline: result };
  }
}




