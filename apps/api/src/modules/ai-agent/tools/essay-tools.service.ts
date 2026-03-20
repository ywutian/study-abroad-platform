/**
 * Essay Tools Service
 *
 * Tools: GET_ESSAYS, REVIEW_ESSAY, POLISH_ESSAY, GENERATE_OUTLINE, BRAINSTORM_IDEAS, SEARCH_ESSAY_PROMPTS
 *
 * Phase 2: polish_essay, review_essay, brainstorm_ideas delegate to EssayAiService
 * (charge points → call AI → persist EssayAIResult → record memory)
 *
 * Phase 3: search_essay_prompts for prompt lookup; review_essay enhanced with prompt-aware context
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../core/llm.service';
import { EssayAiService } from '../../essay/essay-ai.service';
import { extractJsonFromLlm } from './helpers/llm-json.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class EssayToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(EssayToolsService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private essayAiService: EssayAiService,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map([
      [
        'get_essays',
        (args, userId, _ctx, locale) => this.getEssays(userId, locale),
      ],
      [
        'review_essay',
        (args, userId, _ctx, locale) => this.reviewEssay(args, userId, locale),
      ],
      [
        'polish_essay',
        (args, userId, _ctx, locale) => this.polishEssay(args, userId, locale),
      ],
      [
        'generate_outline',
        (args, _userId, _ctx, locale) =>
          this.generateOutline(
            args as { prompt: string; background?: string; wordLimit?: number },
            locale,
          ),
      ],
      [
        'brainstorm_ideas',
        (args, userId, _ctx, locale) =>
          this.brainstormIdeas(args, userId, locale),
      ],
      [
        'search_essay_prompts',
        (args, _userId, _ctx, locale) => this.searchEssayPrompts(args, locale),
      ],
    ]);
  }

  async getEssays(userId: string, locale = 'zh') {
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

  async polishEssay(
    args: { content?: string; style?: string },
    userId: string,
    locale = 'zh',
  ) {
    if (!args.content) {
      return {
        error:
          locale === 'zh' ? '请提供文书内容' : 'Please provide essay content',
      };
    }

    try {
      return await this.essayAiService.polishEssayDirect(
        userId,
        args.content,
        (args.style as any) || 'default',
        locale,
      );
    } catch (error: any) {
      this.logger.warn(`polish_essay failed: ${error?.message}`);
      return {
        error:
          locale === 'zh'
            ? `润色失败：${error?.message || '请稍后重试'}`
            : `Polish failed: ${error?.message || 'Please try again later'}`,
      };
    }
  }

  async reviewEssay(
    args: { essayId?: string; content?: string; prompt?: string },
    userId: string,
    locale = 'zh',
  ) {
    let content = args.content;
    let prompt = args.prompt;
    let promptContext = '';

    if (args.essayId) {
      const essay = await this.prisma.essay.findFirst({
        where: { id: args.essayId, profile: { userId } },
      });
      if (essay) {
        content = essay.content;
        prompt = essay.prompt || essay.title;

        // Phase 3.2: If essay has an associated essayPromptId, fetch the prompt details
        // for more targeted, prompt-aware review feedback
        if ((essay as any).essayPromptId) {
          try {
            const essayPrompt = await this.prisma.essayPrompt.findUnique({
              where: { id: (essay as any).essayPromptId },
              include: { school: { select: { name: true, nameZh: true } } },
            });
            if (essayPrompt) {
              const isZh = locale === 'zh';
              const parts: string[] = [];
              if (essayPrompt.type) {
                parts.push(
                  isZh
                    ? `题目类型：${essayPrompt.type}`
                    : `Essay type: ${essayPrompt.type}`,
                );
              }
              if (essayPrompt.wordLimit) {
                parts.push(
                  isZh
                    ? `字数限制：${essayPrompt.wordLimit}词`
                    : `Word limit: ${essayPrompt.wordLimit} words`,
                );
              }
              if (essayPrompt.aiTips) {
                parts.push(
                  isZh
                    ? `写作建议：${essayPrompt.aiTips}`
                    : `Writing tips: ${essayPrompt.aiTips}`,
                );
              }
              if (essayPrompt.school) {
                parts.push(
                  isZh
                    ? `目标学校：${essayPrompt.school.nameZh || essayPrompt.school.name}`
                    : `Target school: ${essayPrompt.school.name}`,
                );
              }
              // Use the official prompt text if available
              if (essayPrompt.prompt) {
                prompt = essayPrompt.prompt;
              }
              if (parts.length > 0) {
                promptContext = parts.join('\n');
              }
            }
          } catch (err: any) {
            this.logger.debug(
              `Could not fetch essayPrompt context: ${err?.message}`,
            );
          }
        }
      }
    }

    if (!content) {
      return {
        error:
          locale === 'zh' ? '请提供文书内容' : 'Please provide essay content',
      };
    }

    // Build enriched prompt string with prompt context for the AI review
    const enrichedPrompt = promptContext
      ? `${prompt || 'Personal Statement'}\n\n--- Prompt Context ---\n${promptContext}`
      : prompt || 'Personal Statement';

    try {
      return await this.essayAiService.reviewEssayDirect(
        userId,
        content,
        enrichedPrompt,
        locale,
      );
    } catch (error: any) {
      this.logger.warn(`review_essay failed: ${error?.message}`);
      return {
        error:
          locale === 'zh'
            ? `点评失败：${error?.message || '请稍后重试'}`
            : `Review failed: ${error?.message || 'Please try again later'}`,
      };
    }
  }

  async brainstormIdeas(
    args: { prompt?: string; background?: string },
    userId: string,
    locale = 'zh',
  ) {
    if (!args.prompt) {
      return {
        error:
          locale === 'zh' ? '请提供文书题目' : 'Please provide essay prompt',
      };
    }

    try {
      return await this.essayAiService.brainstormDirect(
        userId,
        args.prompt,
        args.background,
        locale,
      );
    } catch (error: any) {
      this.logger.warn(`brainstorm_ideas failed: ${error?.message}`);
      return {
        error:
          locale === 'zh'
            ? `头脑风暴失败：${error?.message || '请稍后重试'}`
            : `Brainstorm failed: ${error?.message || 'Please try again later'}`,
      };
    }
  }

  async searchEssayPrompts(params: Record<string, any>, locale = 'zh') {
    const { schoolName, schoolId, type, year } = params;

    let resolvedSchoolId = schoolId;
    if (!resolvedSchoolId && schoolName) {
      const school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { name: { contains: schoolName, mode: 'insensitive' } },
            { nameZh: { contains: schoolName, mode: 'insensitive' } },
            { aliases: { has: schoolName } },
          ],
        },
        select: { id: true, name: true, nameZh: true },
      });
      if (!school) {
        return {
          error:
            locale === 'zh'
              ? `未找到学校：${schoolName}`
              : `School not found: ${schoolName}`,
        };
      }
      resolvedSchoolId = school.id;
    }

    const where: Record<string, any> = {
      isActive: true,
      status: 'VERIFIED',
      ...(resolvedSchoolId && { schoolId: resolvedSchoolId }),
      ...(type && { type }),
      ...(year && { year: +year }),
    };

    const prompts = await this.prisma.essayPrompt.findMany({
      where,
      include: { school: { select: { name: true, nameZh: true } } },
      orderBy: { sortOrder: 'asc' },
      take: 20,
    });

    if (prompts.length === 0) {
      return {
        count: 0,
        message:
          locale === 'zh'
            ? '未找到匹配的文书题目'
            : 'No matching essay prompts found',
        prompts: [],
      };
    }

    return {
      count: prompts.length,
      prompts: prompts.map((p) => ({
        id: p.id,
        schoolName: p.school.name,
        schoolNameZh: p.school.nameZh,
        type: p.type,
        year: p.year,
        prompt: p.prompt,
        promptZh: p.promptZh,
        wordLimit: p.wordLimit,
        isRequired: p.isRequired,
        aiTips: p.aiTips,
      })),
    };
  }

  async generateOutline(
    args: { prompt: string; background?: string; wordLimit?: number },
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

    const result = await this.llmService.chatSimple(
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

    return extractJsonFromLlm(result, 'outline');
  }
}
