import { Injectable, Logger, Optional } from '@nestjs/common';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import { ScrapedEssay } from './strategies/base.strategy';

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  promptZh?: string;
  aiTips?: string;
  aiCategory?: string;
  issues?: string[];
}

@Injectable()
export class AiValidatorService {
  private readonly logger = new Logger(AiValidatorService.name);

  constructor(@Optional() private llmService?: LLMService) {}

  async validateAndEnhance(
    essay: ScrapedEssay,
    schoolName: string,
  ): Promise<ValidationResult> {
    if (!this.llmService) {
      this.logger.warn('LLMService not available, skipping AI validation');
      return { isValid: true, confidence: essay.confidence || 0.5 };
    }

    try {
      const content = await this.llmService.chatSimpleGuarded(
        [
          {
            role: 'system',
            content: `你是一个留学申请专家，负责验证和分析大学申请文书题目。请用JSON格式返回结果。`,
          },
          {
            role: 'user',
            content: `请分析以下文书题目是否是有效的大学申请文书题目：

学校：${schoolName}
题目：${essay.prompt}
字数限制：${essay.wordLimit || '未知'}

请返回JSON格式：
{
  "isValid": true/false,  // 是否是有效的文书题目
  "confidence": 0.0-1.0,  // 置信度
  "promptZh": "中文翻译",
  "aiTips": "写作建议（50字以内）",
  "aiCategory": "学术/课外/个人成长/社会责任/创意思维",
  "issues": ["问题1", "问题2"]  // 如果有问题
}`,
          },
        ],
        {
          maxTokens: 500,
          providerOptions: { response_format: { type: 'json_object' } },
        },
      );

      // Partial<>: every read below already defaults (`?? true`, `?? 0.7`),
      // so the required-field type was claiming more than this code relies
      // on. The util asserts T, it never checks it.
      const result =
        extractJsonFromLlm<Partial<ValidationResult>>(content) ?? {};
      return {
        isValid: result.isValid ?? true,
        confidence: result.confidence ?? 0.7,
        promptZh: result.promptZh,
        aiTips: result.aiTips,
        aiCategory: result.aiCategory,
        issues: result.issues,
      };
    } catch (error: unknown) {
      this.logger.error(
        `AI validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { isValid: true, confidence: essay.confidence || 0.5 };
    }
  }

  async batchTranslate(prompts: string[]): Promise<string[]> {
    if (!this.llmService || prompts.length === 0) {
      return prompts.map(() => '');
    }

    try {
      const content = await this.llmService.chatSimpleGuarded(
        [
          {
            role: 'system',
            content:
              '你是一个专业的翻译，请将以下大学申请文书题目翻译成中文。保持准确和流畅。返回JSON数组格式。',
          },
          {
            role: 'user',
            content: `请翻译以下文书题目，返回JSON数组：\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`,
          },
        ],
        {
          maxTokens: 2000,
          providerOptions: { response_format: { type: 'json_object' } },
        },
      );

      const result =
        extractJsonFromLlm<{ translations?: string[] }>(content) ?? {};
      return result.translations || prompts.map(() => '');
    } catch (error: unknown) {
      this.logger.error(
        `Batch translation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return prompts.map(() => '');
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async compareMultipleSources(
    sources: Array<{ source: string; essays: ScrapedEssay[] }>,
  ): Promise<ScrapedEssay[]> {
    const seenPrompts = new Map<string, ScrapedEssay>();

    for (const { essays } of sources) {
      for (const essay of essays) {
        const key = essay.prompt.toLowerCase().substring(0, 80);
        const existing = seenPrompts.get(key);

        if (!existing || (essay.confidence || 0) > (existing.confidence || 0)) {
          seenPrompts.set(key, essay);
        }
      }
    }

    return Array.from(seenPrompts.values());
  }
}
