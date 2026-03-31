import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { fireAndForget } from '../../common/utils/async.util';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import {
  buildReviewSystemPrompt,
  buildBrainstormSystemPrompt,
} from './essay-ai.prompts';
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
import { CaseIncentiveService, PointAction } from '../points/incentive.service';
import { safeRefund } from '../points/refund.helper';

@Injectable()
export class EssayAiService {
  private readonly logger = new Logger(EssayAiService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private caseIncentiveService: CaseIncentiveService,
    @Optional()
    private memoryManager?: MemoryManagerService,
  ) {}

  /**
   * 文书润色
   */
  async polishEssay(
    userId: string,
    dto: EssayPolishRequestDto,
    locale = 'zh',
  ): Promise<EssayPolishResponseDto> {
    // 检查积分
    await this.caseIncentiveService.charge(userId, PointAction.AI_ESSAY_POLISH);

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
      const result = await this.polishEssayLlm(content, dto.style, locale);

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
      fireAndForget(
        this.savePolishToMemory(userId, dto, result),
        this.logger,
        'Failed to save polish to memory',
      );

      return response;
    } catch (error) {
      // 退还积分
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ESSAY_POLISH,
        this.logger,
      );
      throw error;
    }
  }

  /**
   * 文书点评（招生官视角）
   */
  async reviewEssay(
    userId: string,
    dto: EssayReviewRequestDto,
    locale = 'zh',
  ): Promise<EssayReviewResponseDto> {
    const isZh = locale === 'zh';
    await this.caseIncentiveService.charge(userId, PointAction.AI_ESSAY_REVIEW);

    const essay = await this.prisma.essay.findUnique({
      where: { id: dto.essayId },
      include: {
        linkedPrompt: { select: { wordLimit: true, type: true } },
      },
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

    // Enrich with school data when schoolName is provided
    let schoolContext = '';
    if (dto.schoolName) {
      const school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { name: { contains: dto.schoolName, mode: 'insensitive' } },
            { nameZh: dto.schoolName },
          ],
        },
        select: {
          name: true,
          usNewsRank: true,
          acceptanceRate: true,
          testOptional: true,
        },
      });
      if (school) {
        const rate =
          school.acceptanceRate != null
            ? `${Number(school.acceptanceRate)}%`
            : null;
        schoolContext = isZh
          ? `\n该校 US News 排名 #${school.usNewsRank ?? '未知'}，录取率 ${rate ?? '未知'}${school.testOptional ? '（Test Optional）' : ''}`
          : `\nSchool ranked #${school.usNewsRank ?? 'N/A'} (US News), ${rate ?? 'N/A'} acceptance rate${school.testOptional ? ' (Test Optional)' : ''}`;
      }
    }

    const systemPrompt = buildReviewSystemPrompt(
      locale,
      dto.schoolName
        ? { name: dto.schoolName, details: schoolContext }
        : undefined,
      dto.major,
      essay.linkedPrompt?.wordLimit ?? undefined,
      essay.linkedPrompt?.type ?? undefined,
    );

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `题目：${essay.prompt || '(未提供)'}\n\n文书内容：\n${essay.content}`
              : `Prompt: ${essay.prompt || '(not provided)'}\n\nEssay content:\n${essay.content}`,
          },
        ],
        { temperature: 0.5, maxTokens: 2000 },
      );

      const parsed = extractJsonFromLlm(result);

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
        cliches: Array.isArray(parsed.cliches) ? parsed.cliches : undefined,
        verdict: parsed.verdict || '',
        tokenUsed: aiResult.tokenUsed,
      };

      // 记录到记忆系统
      await this.saveReviewToMemory(userId, dto, parsed);

      return response;
    } catch (error) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ESSAY_REVIEW,
        this.logger,
      );
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
    locale = 'zh',
  ): Promise<EssayBrainstormResponseDto> {
    const isZh = locale === 'zh';
    await this.caseIncentiveService.charge(
      userId,
      PointAction.AI_ESSAY_BRAINSTORM,
    );

    // Enrich with school data
    let brainstormSchoolCtx = '';
    if (dto.school) {
      const school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { name: { contains: dto.school, mode: 'insensitive' } },
            { nameZh: dto.school },
          ],
        },
        select: { usNewsRank: true, acceptanceRate: true, testOptional: true },
      });
      if (school) {
        const rate =
          school.acceptanceRate != null
            ? `${Number(school.acceptanceRate)}%`
            : null;
        brainstormSchoolCtx = isZh
          ? `（US News #${school.usNewsRank ?? '未知'}，录取率 ${rate ?? '未知'}）`
          : ` (US News #${school.usNewsRank ?? 'N/A'}, ${rate ?? 'N/A'} acceptance rate)`;
      }
    }

    const systemPrompt = buildBrainstormSystemPrompt(
      locale,
      dto.school
        ? { name: dto.school, details: brainstormSchoolCtx }
        : undefined,
      dto.major,
    );

    try {
      const userContent = isZh
        ? `题目：${dto.prompt}${dto.background ? `\n学生背景：${dto.background}` : ''}`
        : `Prompt: ${dto.prompt}${dto.background ? `\nStudent background: ${dto.background}` : ''}`;

      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.8, maxTokens: 2000 },
      );

      const parsed = extractJsonFromLlm(result);

      const response = {
        ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
        overallAdvice: parsed.overallAdvice || '',
        tokenUsed: this.estimateTokens(userContent + result),
      };

      // 记录到记忆系统
      fireAndForget(
        this.saveBrainstormToMemory(userId, dto, response),
        this.logger,
        'Failed to save brainstorm to memory',
      );

      return response;
    } catch (error) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ESSAY_BRAINSTORM,
        this.logger,
      );
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

  // ============ Direct Methods (for Agent Tools — no essayId required) ============

  /**
   * 文书润色（直接模式）— Agent 工具调用入口
   * 接受原始内容，不需要 essayId。扣积分 → 调 AI → 存 EssayAIResult → 记录记忆
   */
  async polishEssayDirect(
    userId: string,
    content: string,
    style?: PolishStyle,
    locale = 'zh',
  ): Promise<EssayPolishResponseDto> {
    await this.caseIncentiveService.charge(userId, PointAction.AI_ESSAY_POLISH);

    try {
      const result = await this.polishEssayLlm(content, style, locale);
      const tokenUsed = this.estimateTokens(content + result.polished);

      // No EssayAIResult persistence (essayId is required FK) — results recorded in memory
      this.savePolishToMemory(
        userId,
        { essayId: '', style } as EssayPolishRequestDto,
        result,
      ).catch((err) => {
        this.logger.warn('Failed to save polish to memory', err);
      });

      return {
        id: '',
        polished: result.polished,
        changes: result.changes,
        tokenUsed,
      };
    } catch (error) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ESSAY_POLISH,
        this.logger,
      );
      throw error;
    }
  }

  /**
   * 文书点评（直接模式）— Agent 工具调用入口
   * 接受原始内容，不需要 essayId。扣积分 → 调 AI → 存 EssayAIResult → 记录记忆
   */
  async reviewEssayDirect(
    userId: string,
    content: string,
    prompt?: string,
    locale = 'zh',
    wordLimit?: number,
  ): Promise<EssayReviewResponseDto> {
    const isZh = locale === 'zh';
    await this.caseIncentiveService.charge(userId, PointAction.AI_ESSAY_REVIEW);

    const systemPrompt = buildReviewSystemPrompt(
      locale,
      undefined,
      undefined,
      wordLimit,
    );

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `题目：${prompt || '(未提供)'}\n\n文书内容：\n${content}`
              : `Prompt: ${prompt || '(not provided)'}\n\nEssay content:\n${content}`,
          },
        ],
        { temperature: 0.5, maxTokens: 2000 },
      );

      const parsed = extractJsonFromLlm(result);
      const tokenUsed = this.estimateTokens(content + result);

      // No EssayAIResult persistence (essayId is required FK) — results recorded in memory
      const response = {
        id: '',
        overallScore: parsed.overallScore,
        scores: parsed.scores,
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        suggestions: parsed.suggestions || [],
        cliches: Array.isArray(parsed.cliches) ? parsed.cliches : undefined,
        verdict: parsed.verdict || '',
        tokenUsed,
      };

      await this.saveReviewToMemory(
        userId,
        { essayId: '' } as EssayReviewRequestDto,
        parsed,
      );

      return response;
    } catch (error) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ESSAY_REVIEW,
        this.logger,
      );
      this.logger.error('Essay review (direct) failed', error);
      throw new BadRequestException('Failed to review essay');
    }
  }

  /**
   * 文书头脑风暴（直接模式）— Agent 工具调用入口
   * 接受原始 prompt/background，不需要 essayId。扣积分 → 调 AI → 记录记忆
   */
  async brainstormDirect(
    userId: string,
    prompt: string,
    background?: string,
    locale = 'zh',
  ): Promise<EssayBrainstormResponseDto> {
    const isZh = locale === 'zh';
    await this.caseIncentiveService.charge(
      userId,
      PointAction.AI_ESSAY_BRAINSTORM,
    );

    const systemPrompt = buildBrainstormSystemPrompt(locale);

    try {
      const userContent = isZh
        ? `题目：${prompt}${background ? `\n学生背景：${background}` : ''}`
        : `Prompt: ${prompt}${background ? `\nStudent background: ${background}` : ''}`;

      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.8, maxTokens: 2000 },
      );

      const parsed = extractJsonFromLlm(result);

      const response = {
        ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
        overallAdvice: parsed.overallAdvice || '',
        tokenUsed: this.estimateTokens(userContent + result),
      };

      this.saveBrainstormToMemory(
        userId,
        { prompt, background } as EssayBrainstormRequestDto,
        response,
      ).catch((err) => {
        this.logger.warn('Failed to save brainstorm to memory', err);
      });

      return response;
    } catch (error) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ESSAY_BRAINSTORM,
        this.logger,
      );
      this.logger.error('Brainstorm (direct) failed', error);
      throw new BadRequestException('Failed to generate ideas');
    }
  }

  // ============ Migrated from AiService ============

  /**
   * AI 段落改写 - 用不同方式表达同一内容
   */
  async rewriteParagraph(
    paragraph: string,
    instruction?: string,
    locale = 'zh',
  ): Promise<{
    versions: Array<{ text: string; style: string }>;
  }> {
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是文书写作专家。根据用户提供的段落,生成3个不同风格的改写版本。

${instruction ? `用户特殊要求: ${instruction}` : ''}

返回JSON格式:
{
  "versions": [
    { "text": "改写版本1", "style": "风格描述(如:更具感染力)" },
    { "text": "改写版本2", "style": "风格描述" },
    { "text": "改写版本3", "style": "风格描述" }
  ]
}
style字段必须用中文。`
      : `You are an essay writing expert. Based on the provided paragraph, generate 3 rewritten versions in different styles.

${instruction ? `Special instruction: ${instruction}` : ''}

Return JSON format:
{
  "versions": [
    { "text": "Rewritten version 1", "style": "Style description (e.g., More compelling)" },
    { "text": "Rewritten version 2", "style": "Style description" },
    { "text": "Rewritten version 3", "style": "Style description" }
  ]
}
style field must be in English.`;

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `请改写以下段落:\n\n${paragraph}`
              : `Please rewrite the following paragraph:\n\n${paragraph}`,
          },
        ],
        { temperature: 0.8, maxTokens: 2000 },
      );

      const parsed = extractJsonFromLlm<{
        versions: Array<{ text: string; style: string }>;
      }>(result);
      return {
        versions: Array.isArray(parsed.versions)
          ? parsed.versions
          : [{ text: result, style: isZh ? '默认' : 'Default' }],
      };
    } catch (error) {
      this.logger.error('Paragraph rewrite failed', error);
      throw new BadRequestException('Failed to rewrite paragraph');
    }
  }

  /**
   * AI 续写 - 根据上下文继续写作
   */
  async continueWriting(
    content: string,
    prompt?: string,
    direction?: string,
    locale = 'zh',
  ): Promise<{ continuation: string; suggestions: string[] }> {
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是留学文书写作助手。根据已有内容,帮助用户继续写作。

${prompt ? `文书题目: ${prompt}` : ''}
${direction ? `用户希望的方向: ${direction}` : ''}

要求:
1. 保持与前文一致的语气和风格
2. 自然衔接,不要重复前文内容
3. 生成100-200词的续写内容
4. 提供2-3个后续发展方向建议

返回JSON格式:
{
  "continuation": "续写内容",
  "suggestions": ["方向建议1（中文）", "方向建议2（中文）", "方向建议3（中文）"]
}
suggestions字段必须用中文。`
      : `You are a college essay writing assistant. Based on existing content, help the user continue writing.

${prompt ? `Essay prompt: ${prompt}` : ''}
${direction ? `Desired direction: ${direction}` : ''}

Requirements:
1. Maintain consistent tone and style with the existing text
2. Connect naturally without repeating previous content
3. Generate 100-200 words of continuation
4. Provide 2-3 suggestions for future direction

Return JSON format:
{
  "continuation": "Continuation text",
  "suggestions": ["Direction 1 (English)", "Direction 2 (English)", "Direction 3 (English)"]
}
suggestions field must be in English.`;

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `请基于以下内容续写:\n\n${content}`
              : `Please continue writing based on the following:\n\n${content}`,
          },
        ],
        { temperature: 0.7, maxTokens: 1500 },
      );

      const parsed = extractJsonFromLlm<{
        continuation: string;
        suggestions: string[];
      }>(result);
      return {
        continuation: parsed.continuation || result,
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
      };
    } catch (error) {
      this.logger.error('Continue writing failed', error);
      throw new BadRequestException('Failed to continue writing');
    }
  }

  /**
   * AI 开头生成 - 为文书生成吸引人的开头
   */
  async generateOpening(
    prompt: string,
    background?: string,
    locale = 'zh',
  ): Promise<{
    openings: Array<{ text: string; style: string }>;
  }> {
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是留学文书专家。根据题目和背景,生成3个不同风格的文书开头。

好的开头应该:
1. 立即抓住读者注意力
2. 不要用"我"开头
3. 可以用场景、对话、问题、或有力的陈述开始
4. 50-100词

返回JSON格式:
{
  "openings": [
    { "text": "开头1", "style": "风格描述（中文，如:场景描写）" },
    { "text": "开头2", "style": "风格" },
    { "text": "开头3", "style": "风格" }
  ]
}
style字段必须用中文。`
      : `You are a college essay expert. Based on the prompt and background, generate 3 essay openings in different styles.

A good opening should:
1. Immediately grab the reader's attention
2. Avoid starting with "I"
3. Use a scene, dialogue, question, or powerful statement
4. Be 50-100 words

Return JSON format:
{
  "openings": [
    { "text": "Opening 1", "style": "Style description (English, e.g., Scene setting)" },
    { "text": "Opening 2", "style": "Style" },
    { "text": "Opening 3", "style": "Style" }
  ]
}
style field must be in English.`;

    const userPrompt = isZh
      ? `题目: ${prompt}
${background ? `背景信息: ${background}` : ''}

请生成3个吸引人的开头:`
      : `Prompt: ${prompt}
${background ? `Background: ${background}` : ''}

Please generate 3 compelling openings:`;

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.8, maxTokens: 1500 },
      );

      const parsed = extractJsonFromLlm<{
        openings: Array<{ text: string; style: string }>;
      }>(result);
      return {
        openings: Array.isArray(parsed.openings)
          ? parsed.openings
          : [{ text: result, style: isZh ? '默认' : 'Default' }],
      };
    } catch (error) {
      this.logger.error('Opening generation failed', error);
      throw new BadRequestException('Failed to generate opening');
    }
  }

  /**
   * Activity description optimizer for Common App 150-char limit.
   * No points charge — lightweight single-shot LLM call.
   */
  async optimizeActivityDescription(
    description: string,
    activityName: string,
    role: string,
    locale = 'zh',
  ): Promise<{ optimized: string; charCount: number }> {
    const isZh = locale === 'zh';

    const prompt = isZh
      ? `你是一位经验丰富的美国大学申请顾问。请优化以下活动描述，使其在 150 个字符以内且最大化影响力。

活动名称：${activityName}
职位/角色：${role}
当前描述：${description}

规则：
- 必须 150 个英文字符或更少（仔细计数）
- 以强有力的动词开头
- 尽可能包含可量化的成果
- 删除填充词
- 保留最重要的成就/影响
- 语言：英文（这是用于美国大学申请的）

只返回优化后的描述，不要返回其他任何内容。`
      : `You are an expert college application counselor. Optimize this activity description to fit within 150 characters while maximizing impact.

Activity: ${activityName}
Role: ${role}
Current description: ${description}

Rules:
- MUST be 150 characters or fewer (count carefully)
- Start with a strong action verb
- Include quantifiable impact where possible
- Remove filler words
- Keep the most important achievement/impact
- Language: English

Return ONLY the optimized description, nothing else.`;

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [{ role: 'user', content: prompt }],
        { maxTokens: 200, temperature: 0.3 },
      );

      const optimized = result.trim();
      return { optimized, charCount: optimized.length };
    } catch (error) {
      this.logger.error('Activity description optimization failed', error);
      throw new BadRequestException('Failed to optimize activity description');
    }
  }

  /**
   * 文书逐段点评 - 类似Clastify风格
   */
  async analyzeEssayParagraphs(
    content: string,
    prompt?: string,
    schoolName?: string,
    locale = 'zh',
  ): Promise<EssayParagraphAnalysisResponse> {
    // 分段处理
    const paragraphs = content
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20); // 过滤太短的段落

    if (paragraphs.length === 0) {
      return this.getDefaultParagraphAnalysis(locale);
    }

    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是顶尖大学招生官，请逐段分析以下文书。

${prompt ? `题目: ${prompt}` : ''}
${schoolName ? `目标学校: ${schoolName}` : ''}

## 评分标准
- 🟢 excellent (8-10): 段落出色，展现独特性和深度
- 🟡 good (5-7): 段落合格但可以更好
- 🔴 needs_work (1-4): 需要重点修改

## 输出格式 (严格JSON)
{
  "paragraphs": [
    {
      "paragraphIndex": 0,
      "paragraphText": "段落原文前30字...",
      "score": 8,
      "status": "excellent",
      "comment": "评价（中文）",
      "highlights": ["亮点词句1"],
      "suggestions": ["建议（中文）"]
    }
  ],
  "overallScore": 75,
  "structure": {
    "hasStrongOpening": true,
    "hasClarity": true,
    "hasGoodConclusion": false,
    "feedback": "结构反馈（中文）"
  },
  "summary": "整体评价（中文，100字内）"
}

所有文本字段必须用中文。`
      : `You are a top university admissions officer. Analyze the following essay paragraph by paragraph.

${prompt ? `Prompt: ${prompt}` : ''}
${schoolName ? `Target school: ${schoolName}` : ''}

## Scoring Criteria
- 🟢 excellent (8-10): Outstanding paragraph, shows uniqueness and depth
- 🟡 good (5-7): Adequate but could be better
- 🔴 needs_work (1-4): Needs significant revision

## Output Format (strict JSON)
{
  "paragraphs": [
    {
      "paragraphIndex": 0,
      "paragraphText": "First 30 chars of paragraph...",
      "score": 8,
      "status": "excellent",
      "comment": "Comment (English)",
      "highlights": ["Highlight phrase 1"],
      "suggestions": ["Suggestion (English)"]
    }
  ],
  "overallScore": 75,
  "structure": {
    "hasStrongOpening": true,
    "hasClarity": true,
    "hasGoodConclusion": false,
    "feedback": "Structure feedback (English)"
  },
  "summary": "Overall evaluation (English, under 100 words)"
}

All text fields must be in English.`;

    const userPrompt = paragraphs
      .map((p, i) => `【段落 ${i + 1}】\n${p}`)
      .join('\n\n');

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `请逐段分析以下文书:\n\n${userPrompt}`
              : `Analyze the following essay paragraph by paragraph:\n\n${userPrompt}`,
          },
        ],
        { temperature: 0.4, maxTokens: 3000 },
      );

      const parsed = extractJsonFromLlm(result);
      return this.validateParagraphAnalysis(parsed, paragraphs, locale);
    } catch (error) {
      this.logger.error('Paragraph analysis failed', error);
      return this.getDefaultParagraphAnalysis(locale);
    }
  }

  // ============ Polish LLM Logic (moved from AiService) ============

  /**
   * 直接调用 LLM 进行文书润色（不经过 AiService.polishEssay）
   */
  private async polishEssayLlm(
    content: string,
    style?: 'formal' | 'vivid' | 'concise',
    locale = 'zh',
  ): Promise<{
    polished: string;
    changes: Array<{ original: string; revised: string; reason: string }>;
  }> {
    const isZh = locale === 'zh';

    const styleGuideZh = {
      formal: '使用更正式、学术化的语言，适合严肃主题',
      vivid: '使用更生动、有画面感的语言，多用具体细节和感官描写',
      concise: '精简冗余表达，每个词都要有意义',
    };
    const styleGuideEn = {
      formal: 'Use more formal, academic language suitable for serious topics',
      vivid:
        'Use more vivid, imagery-rich language with specific details and sensory descriptions',
      concise: 'Eliminate redundancy; every word should count',
    };

    const systemPrompt = isZh
      ? `你是专业的留学文书编辑,擅长英文文书润色。
任务:在保持原文核心内容和作者声音(voice)的前提下,提升语言表达质量。

润色风格: ${styleGuideZh[style || 'formal']}

要求:
1. 保持原文的故事和观点不变
2. 改善语法、用词、句式多样性
3. 增强表达力和可读性
4. 不要过度修改,保持作者个人特色

返回JSON格式:
{
  "polished": "润色后的完整文书",
  "changes": [
    { "original": "原句", "revised": "修改后", "reason": "修改原因（中文）" }
  ]
}
只返回主要修改(5-10处),不需要列出所有小改动。所有reason字段必须用中文。`
      : `You are a professional college essay editor specializing in polishing English essays.
Task: Improve the language quality while preserving the original content and the author's voice.

Polish style: ${styleGuideEn[style || 'formal']}

Requirements:
1. Keep the original story and viewpoints unchanged
2. Improve grammar, word choice, and sentence variety
3. Enhance expressiveness and readability
4. Don't over-edit; preserve the author's personal style

Return JSON format:
{
  "polished": "The fully polished essay",
  "changes": [
    { "original": "Original sentence", "revised": "Revised version", "reason": "Reason for change (English)" }
  ]
}
Only list major changes (5-10), not every small edit. All reason fields must be in English.`;

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请润色以下文书:\n\n${content}` },
        ],
        { temperature: 0.4, maxTokens: 3000 },
      );

      const parsed = extractJsonFromLlm<{
        polished: string;
        changes: Array<{ original: string; revised: string; reason: string }>;
      }>(result);
      return {
        polished: parsed.polished || result,
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
      };
    } catch (error) {
      this.logger.error('Essay polish failed', error);
      throw new BadRequestException('Failed to polish essay');
    }
  }

  // ============ Paragraph Analysis Helpers ============

  private validateParagraphAnalysis(
    data: any,
    originalParagraphs: string[],
    locale = 'zh',
  ): EssayParagraphAnalysisResponse {
    const validateParagraph = (p: any, index: number): ParagraphComment => {
      const score =
        typeof p?.score === 'number' ? Math.min(10, Math.max(1, p.score)) : 5;
      let status: 'excellent' | 'good' | 'needs_work' = 'good';
      if (score >= 8) status = 'excellent';
      else if (score < 5) status = 'needs_work';

      return {
        paragraphIndex: index,
        paragraphText: originalParagraphs[index]?.slice(0, 50) + '...' || '',
        score,
        status: p?.status || status,
        comment:
          p?.comment || (locale === 'zh' ? '暂无评价' : 'No comment available'),
        highlights: Array.isArray(p?.highlights) ? p.highlights : [],
        suggestions: Array.isArray(p?.suggestions) ? p.suggestions : [],
      };
    };

    const paragraphComments = Array.isArray(data.paragraphs)
      ? data.paragraphs.map((p: any, i: number) => validateParagraph(p, i))
      : originalParagraphs.map((_, i) => validateParagraph({}, i));

    return {
      paragraphs: paragraphComments,
      overallScore:
        typeof data.overallScore === 'number'
          ? Math.min(100, Math.max(0, data.overallScore))
          : 60,
      structure: {
        hasStrongOpening: data.structure?.hasStrongOpening ?? false,
        hasClarity: data.structure?.hasClarity ?? true,
        hasGoodConclusion: data.structure?.hasGoodConclusion ?? false,
        feedback:
          data.structure?.feedback ||
          (locale === 'zh'
            ? '请完善文书以获取更详细的结构分析。'
            : 'Please improve your essay for a more detailed structural analysis.'),
      },
      summary:
        data.summary ||
        (locale === 'zh'
          ? '文书分析完成，请查看各段落点评。'
          : 'Essay analysis complete. Please review the paragraph-by-paragraph feedback.'),
    };
  }

  private getDefaultParagraphAnalysis(
    locale = 'zh',
  ): EssayParagraphAnalysisResponse {
    const isZh = locale === 'zh';
    return {
      paragraphs: [],
      overallScore: 0,
      structure: {
        hasStrongOpening: false,
        hasClarity: false,
        hasGoodConclusion: false,
        feedback: isZh
          ? '文书内容不足，请提供更多内容以进行分析。'
          : 'Not enough essay content. Please provide more content for analysis.',
      },
      summary: isZh
        ? '文书内容过短或为空，无法分析。'
        : 'Essay content is too short or empty for analysis.',
    };
  }

  // ============ Helper Methods ============

  private estimateTokens(text: string): number {
    // 粗略估算：中文约2字符/token，英文约4字符/token
    return Math.ceil(text.length / 3);
  }
}

// P1: 逐段点评类型定义
export interface ParagraphComment {
  paragraphIndex: number;
  paragraphText: string;
  score: number; // 1-10
  status: 'excellent' | 'good' | 'needs_work';
  comment: string;
  highlights: string[]; // 亮点词句
  suggestions: string[];
}

export interface EssayParagraphAnalysisResponse {
  paragraphs: ParagraphComment[];
  overallScore: number;
  structure: {
    hasStrongOpening: boolean;
    hasClarity: boolean;
    hasGoodConclusion: boolean;
    feedback: string;
  };
  summary: string;
}
