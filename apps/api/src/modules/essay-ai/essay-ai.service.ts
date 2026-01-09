import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import {
  EssayPolishRequestDto,
  EssayPolishResponseDto,
  PolishStyle,
  EssayReviewRequestDto,
  EssayReviewResponseDto,
  EssayBrainstormRequestDto,
  EssayBrainstormResponseDto,
} from './dto';

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
  ) {}

  /**
   * 文书润色
   */
  async polishEssay(userId: string, dto: EssayPolishRequestDto): Promise<EssayPolishResponseDto> {
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
      throw new BadRequestException('You do not have permission to access this essay');
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

      return {
        id: aiResult.id,
        polished: result.polished,
        changes: result.changes,
        tokenUsed: aiResult.tokenUsed,
      };
    } catch (error) {
      // 退还积分
      await this.refundPoints(userId, POINTS_COST.polish);
      throw error;
    }
  }

  /**
   * 文书点评（招生官视角）
   */
  async reviewEssay(userId: string, dto: EssayReviewRequestDto): Promise<EssayReviewResponseDto> {
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
      throw new BadRequestException('You do not have permission to access this essay');
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
          { role: 'user', content: `题目：${essay.prompt || '(未提供)'}\n\n文书内容：\n${essay.content}` },
        ],
        { temperature: 0.5, maxTokens: 2000 }
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

      return {
        id: aiResult.id,
        overallScore: parsed.overallScore,
        scores: parsed.scores,
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        suggestions: parsed.suggestions || [],
        verdict: parsed.verdict || '',
        tokenUsed: aiResult.tokenUsed,
      };
    } catch (error) {
      await this.refundPoints(userId, POINTS_COST.review);
      this.logger.error('Essay review failed', error);
      throw new BadRequestException('Failed to review essay');
    }
  }

  /**
   * 文书创意/头脑风暴
   */
  async brainstormIdeas(userId: string, dto: EssayBrainstormRequestDto): Promise<EssayBrainstormResponseDto> {
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
        { temperature: 0.8, maxTokens: 2000 }
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        ideas: parsed.ideas || [],
        overallAdvice: parsed.overallAdvice || '',
        tokenUsed: this.estimateTokens(userContent + result),
      };
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
      throw new BadRequestException('You do not have permission to access this essay');
    }

    return this.prisma.essayAIResult.findMany({
      where: { essayId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // ============ Helper Methods ============

  private async checkAndDeductPoints(userId: string, points: number): Promise<void> {
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
}



