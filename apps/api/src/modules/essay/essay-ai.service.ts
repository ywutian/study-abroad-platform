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
  buildRewriteParagraphSystemPrompt,
  buildRewriteParagraphUserPrompt,
  buildContinueWritingSystemPrompt,
  buildContinueWritingUserPrompt,
  buildOpeningSystemPrompt,
  buildOpeningUserPrompt,
  buildActivityOptimizePrompt,
  buildParagraphAnalysisSystemPrompt,
  buildParagraphAnalysisUserPrompt,
  buildPolishEssaySystemPrompt,
  buildPolishEssayUserPrompt,
} from './essay-ai.prompts';
import { MemoryType } from '@prisma/client';
import {
  EssayPolishRequestDto,
  EssayPolishResponseDto,
  PolishStyle,
  EssayReviewRequestDto,
  EssayReviewResponseDto,
  EssaySuggestEditsRequestDto,
  EssaySuggestEditsResponseDto,
  EssayBrainstormRequestDto,
  EssayBrainstormResponseDto,
} from './dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { CaseIncentiveService, PointAction } from '../points/incentive.service';
import { safeRefund } from '../points/refund.helper';
import { resolveSchoolTestingPolicyValue } from '@study-abroad/shared/utils';

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

  private formatTestingPolicyLabel(
    testingPolicy: 'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'UNKNOWN',
    locale: string,
  ): string | null {
    const isZh = locale === 'zh';
    switch (testingPolicy) {
      case 'REQUIRED':
        return isZh ? '必须提交标化' : 'Test required';
      case 'OPTIONAL':
        return isZh ? '可选提交标化' : 'Test optional';
      case 'BLIND':
        return isZh ? '标化盲审' : 'Test blind';
      default:
        return null;
    }
  }

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
          testingPolicy: true,
          testOptional: true,
        },
      });
      if (school) {
        const rate =
          school.acceptanceRate != null
            ? `${Number(school.acceptanceRate)}%`
            : null;
        const testingPolicy = resolveSchoolTestingPolicyValue({
          testingPolicy: school.testingPolicy,
          testOptional: school.testOptional,
        });
        const testingPolicyLabel = this.formatTestingPolicyLabel(
          testingPolicy,
          locale,
        );
        schoolContext = isZh
          ? `\n该校 US News legacy 回退排名 #${school.usNewsRank ?? '未知'}，录取率 ${rate ?? '未知'}${testingPolicyLabel ? `（${testingPolicyLabel}）` : ''}`
          : `\nSchool legacy fallback rank #${school.usNewsRank ?? 'N/A'} (US News), ${rate ?? 'N/A'} acceptance rate${testingPolicyLabel ? ` (${testingPolicyLabel})` : ''}`;
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

  async suggestEdits(
    userId: string,
    dto: EssaySuggestEditsRequestDto,
    locale = 'zh',
  ): Promise<EssaySuggestEditsResponseDto> {
    const essay = await this.prisma.essay.findUnique({
      where: { id: dto.essayId },
      include: { profile: { select: { userId: true } } },
    });

    if (!essay) {
      throw new NotFoundException('Essay not found');
    }

    if (essay.profile.userId !== userId) {
      throw new BadRequestException(
        'You do not have permission to access this essay',
      );
    }

    await this.caseIncentiveService.charge(userId, PointAction.AI_ESSAY_POLISH);

    try {
      const result = await this.polishEssayLlm(
        essay.content,
        dto.style ?? 'concise',
        locale,
      );
      const tokenUsed = this.estimateTokens(essay.content + result.polished);

      const changes = (Array.isArray(result.changes) ? result.changes : [])
        .filter(
          (change) =>
            typeof change.original === 'string' &&
            typeof change.revised === 'string' &&
            change.original.trim() &&
            change.revised.trim() &&
            change.original.trim() !== change.revised.trim(),
        )
        .slice(0, 12);

      const persisted = await this.prisma.$transaction(async (tx) => {
        const revision = await tx.essayRevision.create({
          data: {
            essayId: essay.id,
            title: essay.title,
            prompt: essay.prompt,
            content: essay.content,
            wordCount:
              essay.wordCount ??
              essay.content.split(/\s+/).filter(Boolean).length,
            reason: dto.focus || 'Before AI edit suggestions',
            source: 'ai_suggest',
          },
        });

        await tx.essayAIResult.create({
          data: {
            essayId: essay.id,
            type: 'suggest_edits',
            input: essay.content,
            output: result.polished,
            changes: changes as any,
            tokenUsed,
          },
        });

        const suggestions = await Promise.all(
          changes.map((change) =>
            tx.essaySuggestion.create({
              data: {
                essayId: essay.id,
                kind: dto.style === 'concise' ? 'shorten' : 'rewrite',
                originalText: change.original,
                replacementText: change.revised,
                reason:
                  change.reason ||
                  (locale === 'zh' ? '优化表达' : 'Improve expression'),
                impact:
                  dto.focus ||
                  (dto.style === 'concise'
                    ? locale === 'zh'
                      ? '更精简，便于控制字数'
                      : 'More concise and easier to keep within word limit'
                    : locale === 'zh'
                      ? '提升表达清晰度'
                      : 'Improves clarity'),
                status: 'PENDING',
                insertMode: 'replace',
                createdFromRevisionId: revision.id,
              },
            }),
          ),
        );

        return { revision, suggestions };
      });

      return {
        revisionId: persisted.revision.id,
        suggestions: persisted.suggestions.map((suggestion) => ({
          id: suggestion.id,
          kind: suggestion.kind,
          originalText: suggestion.originalText,
          replacementText: suggestion.replacementText,
          reason: suggestion.reason,
          impact: suggestion.impact,
          status: suggestion.status,
          insertMode: suggestion.insertMode,
        })),
        tokenUsed,
      };
    } catch (error) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ESSAY_POLISH,
        this.logger,
      );
      this.logger.error('Essay edit suggestions failed', error);
      throw new BadRequestException('Failed to suggest essay edits');
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
        select: {
          usNewsRank: true,
          acceptanceRate: true,
          testingPolicy: true,
          testOptional: true,
        },
      });
      if (school) {
        const rate =
          school.acceptanceRate != null
            ? `${Number(school.acceptanceRate)}%`
            : null;
        const testingPolicy = resolveSchoolTestingPolicyValue({
          testingPolicy: (school as any).testingPolicy,
          testOptional: school.testOptional,
        });
        const testingPolicyLabel = this.formatTestingPolicyLabel(
          testingPolicy,
          locale,
        );
        brainstormSchoolCtx = isZh
          ? `（US News legacy #${school.usNewsRank ?? '未知'}，录取率 ${rate ?? '未知'}${testingPolicyLabel ? `，${testingPolicyLabel}` : ''}）`
          : ` (US News legacy #${school.usNewsRank ?? 'N/A'}, ${rate ?? 'N/A'} acceptance rate${testingPolicyLabel ? `, ${testingPolicyLabel}` : ''})`;
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
      this.savePolishToMemory(userId, { essayId: '', style }, result).catch(
        (err) => {
          this.logger.warn('Failed to save polish to memory', err);
        },
      );

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

      await this.saveReviewToMemory(userId, { essayId: '' }, parsed);

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
        { prompt, background },
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
    const systemPrompt = buildRewriteParagraphSystemPrompt(locale, instruction);
    const userPrompt = buildRewriteParagraphUserPrompt(locale, paragraph);

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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
    const systemPrompt = buildContinueWritingSystemPrompt(
      locale,
      prompt,
      direction,
    );
    const userPrompt = buildContinueWritingUserPrompt(locale, content);

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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
    const systemPrompt = buildOpeningSystemPrompt(locale);
    const userPrompt = buildOpeningUserPrompt(locale, prompt, background);

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
    const prompt = buildActivityOptimizePrompt(
      locale,
      description,
      activityName,
      role,
    );

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

    const systemPrompt = buildParagraphAnalysisSystemPrompt(
      locale,
      prompt,
      schoolName,
    );

    const userPrompt = paragraphs
      .map((p, i) => `【段落 ${i + 1}】\n${p}`)
      .join('\n\n');

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: buildParagraphAnalysisUserPrompt(locale, userPrompt),
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
    const systemPrompt = buildPolishEssaySystemPrompt(locale, style);
    const userPrompt = buildPolishEssayUserPrompt(locale, content);

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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
