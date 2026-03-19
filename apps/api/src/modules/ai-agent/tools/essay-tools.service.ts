/**
 * Essay Tools Service
 *
 * Tools: GET_ESSAYS, REVIEW_ESSAY, POLISH_ESSAY, GENERATE_OUTLINE, BRAINSTORM_IDEAS
 *
 * Phase 2: polish_essay, review_essay, brainstorm_ideas delegate to EssayAiService
 * (charge points → call AI → persist EssayAIResult → record memory)
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

    try {
      return await this.essayAiService.reviewEssayDirect(
        userId,
        content,
        prompt || 'Personal Statement',
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
