import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
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
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * 验证并增强文书数据
   */
  async validateAndEnhance(
    essay: ScrapedEssay,
    schoolName: string,
  ): Promise<ValidationResult> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, skipping AI validation');
      return { isValid: true, confidence: essay.confidence || 0.5 };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
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
        response_format: { type: 'json_object' },
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { isValid: true, confidence: essay.confidence || 0.5 };
      }

      const result = JSON.parse(content);
      return {
        isValid: result.isValid ?? true,
        confidence: result.confidence ?? 0.7,
        promptZh: result.promptZh,
        aiTips: result.aiTips,
        aiCategory: result.aiCategory,
        issues: result.issues,
      };
    } catch (error) {
      this.logger.error(`AI validation failed: ${error.message}`);
      return { isValid: true, confidence: essay.confidence || 0.5 };
    }
  }

  /**
   * 批量翻译文书题目
   */
  async batchTranslate(prompts: string[]): Promise<string[]> {
    if (!this.openai || prompts.length === 0) {
      return prompts.map(() => '');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
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
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return prompts.map(() => '');

      const result = JSON.parse(content);
      return result.translations || prompts.map(() => '');
    } catch (error) {
      this.logger.error(`Batch translation failed: ${error.message}`);
      return prompts.map(() => '');
    }
  }

  /**
   * 对比多来源数据
   */
  async compareMultipleSources(
    sources: Array<{ source: string; essays: ScrapedEssay[] }>,
  ): Promise<ScrapedEssay[]> {
    // 简单的去重和合并逻辑
    const allEssays: ScrapedEssay[] = [];
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
