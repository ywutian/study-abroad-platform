import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { MemoryType } from '@prisma/client';
import {
  EssayPolishRequestDto,
  EssayPolishResponseDto,
  PolishStyle,
  EssayReviewRequestDto,
  EssayReviewResponseDto,
  EssayBrainstormRequestDto,
  EssayBrainstormResponseDto,
} from './dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

const POINTS_COST = {
  polish: 20,
  review: 30,
  brainstorm: 15,
};

@Injectable()
export class EssayAiService {
  private readonly logger = new Logger(EssayAiService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    @Optional()
    @Inject(forwardRef(() => MemoryManagerService))
    private memoryManager?: MemoryManagerService,
  ) {}

  /**
   * 文书润色
   */
  async polishEssay(
    userId: string,
    dto: EssayPolishRequestDto,
  ): Promise<EssayPolishResponseDto> {
    // 检查积分
    await this.checkAndDeductPoints(userId, POINTS_COST.polish);

    // 获取文书
    const essay = await this.prisma.essay.findUnique({
      where: { id: dto.essayId },
      include: { profile: true },
    });

    if (!essay) {
      throw new NotFoundException('Essay not found');
    }

    // 验证权限
    const profile = await this.prisma.profile.findFirst({
      where: { id: essay.profileId, userId },
    });

    if (!profile) {
      throw new BadRequestException(
        'You do not have permission to access this essay',
      );
    }

    const content = dto.content || essay.content;

    try {
      const result = await this.aiService.polishEssay(content, dto.style);

      // 保存结果
      const aiResult = await this.prisma.essayAIResult.create({
        data: {
          essayId: essay.id,
          type: 'polish',
          input: content,
          output: result.polished,
          changes: result.changes as any,
          tokenUsed: this.estimateTokens(content + result.polished),
        },
      });

      const response = {
        id: aiResult.id,
        polished: result.polished,
        changes: result.changes,
        tokenUsed: aiResult.tokenUsed,
      };

      // 记录到记忆系统
      this.savePolishToMemory(userId, dto, result).catch((err) => {
        this.logger.warn('Failed to save polish to memory', err);
      });

      return response;
    } catch (error) {
      // 退还积分
      await this.refundPoints(userId, POINTS_COST.polish);
      throw error;
    }
  }

  /**
   * 文书点评（招生官视角）
   */
  async reviewEssay(
    userId: string,
    dto: EssayReviewRequestDto,
  ): Promise<EssayReviewResponseDto> {
    await this.checkAndDeductPoints(userId, POINTS_COST.review);

    const essay = await this.prisma.essay.findUnique({
      where: { id: dto.essayId },
    });

    if (!essay) {
      throw new NotFoundException('Essay not found');
    }

    const profile = await this.prisma.profile.findFirst({
      where: { id: essay.profileId, userId },
    });

    if (!profile) {
      throw new BadRequestException(
        'You do not have permission to access this essay',
      );
    }

    const systemPrompt = `你是一位顶尖大学招生官，请从招生官视角评估以下文书。

${dto.schoolName ? `目标学校：${dto.schoolName}` : ''}
${dto.major ? `目标专业：${dto.major}` : ''}

请从以下维度评分(1-10)并给出详细点评：
1. clarity (主题清晰度): 文章主旨是否明确，读者能否快速理解你想表达什么
2. uniqueness (个人特色): 是否展现了独特的个人经历、观点或视角
3. storytelling (故事性): 叙事是否引人入胜，有没有让人印象深刻的细节
4. fit (学校契合度): 是否展现了与目标学校价值观、文化的契合
5. language (语言表达): 语法、用词、句式是否恰当有力

返回JSON格式：
{
  "overallScore": 7.5,
  "scores": { "clarity": 8, "uniqueness": 7, "storytelling": 8, "fit": 7, "language": 8 },
  "strengths": ["亮点1", "亮点2"],
  "weaknesses": ["不足1", "不足2"],
  "suggestions": ["建议1", "建议2"],
  "verdict": "总体评价（50-100字）"
}`;

    try {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `题目：${essay.prompt || '(未提供)'}\n\n文书内容：\n${essay.content}`,
          },
        ],
        { temperature: 0.5, maxTokens: 2000 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const aiResult = await this.prisma.essayAIResult.create({
        data: {
          essayId: essay.id,
          type: 'review',
          input: essay.content,
          output: result,
          scores: parsed.scores,
          suggestions: parsed.suggestions,
          tokenUsed: this.estimateTokens(essay.content + result),
        },
      });

      const response = {
        id: aiResult.id,
        overallScore: parsed.overallScore,
        scores: parsed.scores,
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        suggestions: parsed.suggestions || [],
        verdict: parsed.verdict || '',
        tokenUsed: aiResult.tokenUsed,
      };

      // 记录到记忆系统
      await this.saveReviewToMemory(userId, dto, parsed);

      return response;
    } catch (error) {
      await this.refundPoints(userId, POINTS_COST.review);
      this.logger.error('Essay review failed', error);
      throw new BadRequestException('Failed to review essay');
    }
  }

  /**
   * 保存文书润色结果到记忆系统
   */
  private async savePolishToMemory(
    userId: string,
    dto: EssayPolishRequestDto,
    result: { polished: string; changes: any[] },
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const changeCount = result.changes?.length || 0;
      await this.memoryManager.remember(userId, {
        type: MemoryType.FEEDBACK,
        category: 'essay_polish',
        content: `文书润色：使用${dto.style || 'default'}风格润色，进行了${changeCount}处修改`,
        importance: 0.5,
        metadata: {
          essayId: dto.essayId,
          style: dto.style,
          changeCount,
          source: 'essay_ai_service',
        },
      });
    } catch (error) {
      this.logger.warn('Failed to save essay polish to memory', error);
    }
  }

  /**
   * 保存头脑风暴结果到记忆系统
   */
  private async saveBrainstormToMemory(
    userId: string,
    dto: EssayBrainstormRequestDto,
    result: { ideas: any[]; overallAdvice: string },
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const ideaTitles = result.ideas
        .slice(0, 3)
        .map((i) => i.title)
        .join('、');
      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'essay_brainstorm',
        content: `文书头脑风暴：题目"${dto.prompt.slice(0, 50)}..."，生成了${result.ideas.length}个写作角度，包括${ideaTitles}等`,
        importance: 0.6,
        metadata: {
          prompt: dto.prompt,
          school: dto.school,
          major: dto.major,
          ideaCount: result.ideas.length,
          ideas: result.ideas.slice(0, 5),
          source: 'essay_ai_service',
        },
      });

      // 记录目标学校偏好
      if (dto.school) {
        await this.memoryManager.remember(userId, {
          type: MemoryType.PREFERENCE,
          category: 'target_school',
          content: `用户正在为 ${dto.school} ${dto.major ? `的 ${dto.major} 专业` : ''} 构思文书`,
          importance: 0.5,
          metadata: {
            schoolName: dto.school,
            major: dto.major,
            source: 'essay_brainstorm',
          },
        });
      }
    } catch (error) {
      this.logger.warn('Failed to save essay brainstorm to memory', error);
    }
  }

  /**
   * 保存文书点评结果到记忆系统
   */
  private async saveReviewToMemory(
    userId: string,
    dto: EssayReviewRequestDto,
    result: {
      overallScore: number;
      scores: Record<string, number>;
      strengths: string[];
      weaknesses: string[];
      suggestions: string[];
    },
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      // 记录文书评分反馈
      await this.memoryManager.remember(userId, {
        type: MemoryType.FEEDBACK,
        category: 'essay_review',
        content: `文书点评：${dto.schoolName ? `针对${dto.schoolName}` : ''}${dto.major ? `${dto.major}专业` : ''}文书。总分 ${result.overallScore}/10。亮点：${result.strengths.slice(0, 2).join('、')}。待改进：${result.weaknesses.slice(0, 2).join('、')}`,
        importance: 0.7,
        metadata: {
          essayId: dto.essayId,
          schoolName: dto.schoolName,
          major: dto.major,
          overallScore: result.overallScore,
          scores: result.scores,
          source: 'essay_ai_service',
        },
      });

      // 如果有目标学校，记录为偏好
      if (dto.schoolName) {
        await this.memoryManager.remember(userId, {
          type: MemoryType.PREFERENCE,
          category: 'target_school',
          content: `用户正在为 ${dto.schoolName} ${dto.major ? `的 ${dto.major} 专业` : ''} 准备文书`,
          importance: 0.6,
          metadata: {
            schoolName: dto.schoolName,
            major: dto.major,
            source: 'essay_review',
          },
        });
      }
    } catch (error) {
      this.logger.warn('Failed to save essay review to memory', error);
    }
  }

  /**
   * 文书创意/头脑风暴
   */
  async brainstormIdeas(
    userId: string,
    dto: EssayBrainstormRequestDto,
  ): Promise<EssayBrainstormResponseDto> {
    await this.checkAndDeductPoints(userId, POINTS_COST.brainstorm);

    const systemPrompt = `你是一位资深留学文书顾问，擅长帮助学生挖掘独特的故事和角度。

${dto.school ? `目标学校：${dto.school}` : ''}
${dto.major ? `目标专业：${dto.major}` : ''}

根据提供的题目和背景，生成5-8个具体、有深度的写作角度。每个想法要：
1. 具体可执行，不是泛泛的建议
2. 有独特性，能让文书脱颖而出
3. 与学生背景相关联

返回JSON格式：
{
  "ideas": [
    {
      "title": "想法标题（简短有力）",
      "description": "详细说明这个角度如何展开，包括可以写的具体内容",
      "suitableFor": "适合什么类型的题目/学校"
    }
  ],
  "overallAdvice": "针对这个题目的整体写作建议（100字内）"
}`;

    try {
      const userContent = `题目：${dto.prompt}
${dto.background ? `\n学生背景：${dto.background}` : ''}`;

      const result = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.8, maxTokens: 2000 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const response = {
        ideas: parsed.ideas || [],
        overallAdvice: parsed.overallAdvice || '',
        tokenUsed: this.estimateTokens(userContent + result),
      };

      // 记录到记忆系统
      this.saveBrainstormToMemory(userId, dto, response).catch((err) => {
        this.logger.warn('Failed to save brainstorm to memory', err);
      });

      return response;
    } catch (error) {
      await this.refundPoints(userId, POINTS_COST.brainstorm);
      this.logger.error('Brainstorm failed', error);
      throw new BadRequestException('Failed to generate ideas');
    }
  }

  /**
   * 获取文书的AI处理历史
   */
  async getEssayAIHistory(userId: string, essayId: string) {
    const essay = await this.prisma.essay.findUnique({
      where: { id: essayId },
      include: { profile: true },
    });

    if (!essay) {
      throw new NotFoundException('Essay not found');
    }

    const profile = await this.prisma.profile.findFirst({
      where: { id: essay.profileId, userId },
    });

    if (!profile) {
      throw new BadRequestException(
        'You do not have permission to access this essay',
      );
    }

    return this.prisma.essayAIResult.findMany({
      where: { essayId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // ============ Helper Methods ============

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
        action: 'AI_ESSAY_SERVICE',
        points: -points,
        metadata: { service: 'essay-ai' },
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
        action: 'AI_ESSAY_REFUND',
        points: points,
        metadata: { reason: 'service_error' },
      },
    });
  }

  private estimateTokens(text: string): number {
    // 粗略估算：中文约2字符/token，英文约4字符/token
    return Math.ceil(text.length / 3);
  }

  // ============ 文书画廊 (P1) ============

  /**
   * 获取公开优秀文书列表
   * 来源：录取案例中公开分享的文书
   */
  async getGalleryEssays(filters: {
    school?: string;
    type?: 'COMMON_APP' | 'UC' | 'SUPPLEMENTAL' | 'WHY_SCHOOL' | 'OTHER';
    promptNumber?: number;
    year?: number;
    result?: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
    rankMin?: number;
    rankMax?: number;
    isVerified?: boolean;
    sortBy?: 'newest' | 'popular';
    page: number;
    pageSize: number;
  }) {
    const {
      school,
      type,
      promptNumber,
      year,
      result,
      rankMin,
      rankMax,
      isVerified,
      sortBy,
      page,
      pageSize,
    } = filters;
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: any = {
      visibility: { in: ['PUBLIC', 'ANONYMOUS'] },
      essayContent: { not: null },
    };

    // 文书类型筛选
    if (type) {
      where.essayType = type;
    }

    // Common App/UC 题号筛选
    if (promptNumber) {
      where.promptNumber = promptNumber;
    }

    // 年份筛选
    if (year) {
      where.year = year;
    }

    // 录取结果筛选
    if (result) {
      where.result = result;
    }

    // 仅显示已验证
    if (isVerified) {
      where.isVerified = true;
    }

    // 学校名称搜索
    if (school) {
      where.school = {
        OR: [
          { name: { contains: school, mode: 'insensitive' } },
          { nameZh: { contains: school, mode: 'insensitive' } },
        ],
      };
    }

    // 学校排名范围筛选
    if (rankMin !== undefined || rankMax !== undefined) {
      where.school = {
        ...where.school,
        usNewsRank: {
          ...(rankMin !== undefined && { gte: rankMin }),
          ...(rankMax !== undefined && { lte: rankMax }),
        },
      };
    }

    // 排序逻辑
    const orderBy =
      sortBy === 'popular'
        ? [{ isVerified: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }, { isVerified: 'desc' as const }];

    const [cases, total, stats] = await Promise.all([
      this.prisma.admissionCase.findMany({
        where,
        select: {
          id: true,
          year: true,
          result: true,
          essayType: true,
          essayPrompt: true,
          essayContent: true,
          promptNumber: true,
          gpaRange: true,
          satRange: true,
          tags: true,
          isVerified: true,
          createdAt: true,
          school: {
            select: {
              id: true,
              name: true,
              nameZh: true,
              usNewsRank: true,
            },
          },
        },
        skip,
        take: pageSize,
        orderBy,
      }),
      this.prisma.admissionCase.count({ where }),
      // 统计数据
      this.getGalleryStats(),
    ]);

    // 处理返回数据
    const essays = cases.map((c) => ({
      id: c.id,
      year: c.year,
      result: c.result,
      essayType: c.essayType,
      promptNumber: c.promptNumber,
      prompt: c.essayPrompt,
      preview: c.essayContent ? c.essayContent.slice(0, 200) + '...' : null,
      wordCount: c.essayContent ? c.essayContent.split(/\s+/).length : 0,
      school: c.school,
      tags: c.tags,
      isVerified: c.isVerified,
    }));

    return {
      items: essays,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats,
    };
  }

  /**
   * 获取文书画廊统计数据
   */
  private async getGalleryStats() {
    const baseWhere = {
      visibility: { in: ['PUBLIC', 'ANONYMOUS'] as any },
      essayContent: { not: null },
    };

    const [total, admitted, top20, byType] = await Promise.all([
      this.prisma.admissionCase.count({ where: baseWhere }),
      this.prisma.admissionCase.count({
        where: { ...baseWhere, result: 'ADMITTED' },
      }),
      this.prisma.admissionCase.count({
        where: {
          ...baseWhere,
          school: { usNewsRank: { lte: 20 } },
        },
      }),
      this.prisma.admissionCase.groupBy({
        by: ['essayType'],
        where: baseWhere,
        _count: true,
      }),
    ]);

    return {
      total,
      admitted,
      top20,
      byType: byType.reduce(
        (acc, item) => {
          if (item.essayType) {
            acc[item.essayType] = item._count;
          }
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * 获取单篇公开文书详情
   */
  async getGalleryEssayDetail(caseId: string) {
    const admissionCase = await this.prisma.admissionCase.findFirst({
      where: {
        id: caseId,
        visibility: { in: ['PUBLIC', 'ANONYMOUS'] },
        essayContent: { not: null },
      },
      select: {
        id: true,
        year: true,
        round: true,
        result: true,
        essayType: true,
        essayPrompt: true,
        essayContent: true,
        promptNumber: true,
        gpaRange: true,
        satRange: true,
        tags: true,
        isVerified: true,
        visibility: true,
        school: {
          select: {
            id: true,
            name: true,
            nameZh: true,
            usNewsRank: true,
          },
        },
      },
    });

    if (!admissionCase) {
      throw new NotFoundException('Essay not found or not public');
    }

    return {
      id: admissionCase.id,
      year: admissionCase.year,
      round: admissionCase.round,
      result: admissionCase.result,
      essayType: admissionCase.essayType,
      promptNumber: admissionCase.promptNumber,
      prompt: admissionCase.essayPrompt,
      content: admissionCase.essayContent,
      wordCount: admissionCase.essayContent?.split(/\s+/).length || 0,
      gpaRange: admissionCase.gpaRange,
      satRange: admissionCase.satRange,
      school: admissionCase.school,
      tags: admissionCase.tags,
      isVerified: admissionCase.isVerified,
      isAnonymous: admissionCase.visibility === 'ANONYMOUS',
    };
  }

  /**
   * 逐段分析公开文书
   */
  async analyzeGalleryEssay(
    userId: string,
    caseId: string,
    schoolName?: string,
  ) {
    const POINTS_COST = 20;
    await this.checkAndDeductPoints(userId, POINTS_COST);

    const essay = await this.getGalleryEssayDetail(caseId);

    if (!essay.content) {
      await this.refundPoints(userId, POINTS_COST);
      throw new BadRequestException('Essay content is empty');
    }

    try {
      const analysis = await this.aiService.analyzeEssayParagraphs(
        essay.content,
        essay.prompt || undefined,
        schoolName || essay.school?.name,
      );

      return {
        essayId: caseId,
        ...analysis,
        tokenUsed: this.estimateTokens(essay.content),
      };
    } catch (error) {
      await this.refundPoints(userId, POINTS_COST);
      this.logger.error('Gallery essay analysis failed', error);
      throw new BadRequestException('Failed to analyze essay');
    }
  }
}
