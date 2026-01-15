/**
 * 内容审核服务
 *
 * 对 LLM 输出进行安全检查：
 * 1. 敏感信息泄露检测
 * 2. 有害内容过滤
 * 3. 合规性检查
 */

import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

// ==================== 类型定义 ====================

export interface ModerationResult {
  safe: boolean;
  flagged: boolean;
  categories: ModerationCategory[];
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  action: ModerationAction;
  sanitizedContent?: string;
  details: ModerationDetail[];
}

export interface ModerationCategory {
  name: string;
  flagged: boolean;
  score: number;
}

export interface ModerationDetail {
  type: string;
  description: string;
  position?: { start: number; end: number };
  suggestion?: string;
}

export enum ModerationAction {
  ALLOW = 'ALLOW',
  WARN = 'WARN',
  SANITIZE = 'SANITIZE',
  BLOCK = 'BLOCK',
}

interface SensitivePattern {
  pattern: RegExp;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  replacement?: string;
}

// ==================== 敏感信息模式 ====================

const SENSITIVE_PATTERNS: SensitivePattern[] = [
  // PII
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    type: 'SSN',
    severity: 'HIGH',
    replacement: '[SSN已隐藏]',
  },
  {
    pattern:
      /\b[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
    type: 'ID_CARD',
    severity: 'HIGH',
    replacement: '[身份证号已隐藏]',
  },
  {
    pattern: /\b[A-Z]{1,2}\d{7,8}\b/g,
    type: 'PASSPORT',
    severity: 'HIGH',
    replacement: '[护照号已隐藏]',
  },
  {
    pattern: /\b1[3-9]\d{9}\b/g,
    type: 'PHONE_CN',
    severity: 'MEDIUM',
    replacement: '[手机号已隐藏]',
  },
  {
    pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    type: 'PHONE_US',
    severity: 'MEDIUM',
    replacement: '[电话已隐藏]',
  },
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    type: 'EMAIL',
    severity: 'LOW',
    replacement: '[邮箱已隐藏]',
  },

  // 金融信息
  {
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    type: 'CREDIT_CARD',
    severity: 'HIGH',
    replacement: '[银行卡号已隐藏]',
  },
  {
    pattern: /\b\d{16,19}\b/g,
    type: 'BANK_ACCOUNT',
    severity: 'MEDIUM',
    replacement: '[账号已隐藏]',
  },

  // 密码和密钥
  {
    pattern: /(?:password|密码|pwd)\s*[:=]\s*\S+/gi,
    type: 'PASSWORD',
    severity: 'HIGH',
    replacement: '[密码已隐藏]',
  },
  {
    pattern: /(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*\S+/gi,
    type: 'API_KEY',
    severity: 'HIGH',
    replacement: '[密钥已隐藏]',
  },
  {
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    type: 'OPENAI_KEY',
    severity: 'HIGH',
    replacement: '[API密钥已隐藏]',
  },
];

// 有害内容关键词
const HARMFUL_KEYWORDS = {
  HIGH: ['自杀', '自残', '伤害自己', 'suicide', 'self-harm', 'kill myself'],
  MEDIUM: ['作弊', '代写', '代考', '枪手', 'cheating', 'ghostwriting', 'fake'],
  LOW: ['抄袭', '复制', 'plagiarism', 'copy'],
};

// ==================== 服务实现 ====================

@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);
  private openai: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  /**
   * 审核内容
   */
  async moderate(
    content: string,
    options?: {
      useOpenAI?: boolean;
      sanitize?: boolean;
      context?: 'input' | 'output';
    },
  ): Promise<ModerationResult> {
    const details: ModerationDetail[] = [];
    const categories: ModerationCategory[] = [];

    // 1. 本地敏感信息检测
    const sensitiveResults = this.detectSensitiveInfo(content);
    details.push(...sensitiveResults.details);

    // 2. 有害内容检测
    const harmfulResults = this.detectHarmfulContent(content);
    details.push(...harmfulResults.details);

    // 3. OpenAI Moderation API（可选）
    let openaiCategories: ModerationCategory[] = [];
    if (options?.useOpenAI && this.openai) {
      openaiCategories = await this.callOpenAIModeration(content);
      categories.push(...openaiCategories);
    }

    // 4. 计算整体严重程度
    const severity = this.calculateSeverity(details, openaiCategories);

    // 5. 决定行动
    const action = this.determineAction(severity, details);

    // 6. 清洗内容（如果需要）
    let sanitizedContent: string | undefined;
    if (
      options?.sanitize &&
      (action === ModerationAction.SANITIZE || action === ModerationAction.WARN)
    ) {
      sanitizedContent = this.sanitizeContent(content, details);
    }

    const flagged = severity !== 'NONE';

    return {
      safe: !flagged,
      flagged,
      categories,
      severity,
      action,
      sanitizedContent,
      details,
    };
  }

  /**
   * 快速检查（仅本地规则）
   */
  quickCheck(content: string): {
    safe: boolean;
    severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    // 检查高严重度关键词
    for (const keyword of HARMFUL_KEYWORDS.HIGH) {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        return { safe: false, severity: 'HIGH' };
      }
    }

    // 检查敏感信息
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.severity === 'HIGH' && pattern.pattern.test(content)) {
        return { safe: false, severity: 'HIGH' };
      }
    }

    return { safe: true, severity: 'NONE' };
  }

  /**
   * 审核 LLM 输出
   */
  async moderateOutput(
    output: string,
    systemPrompt?: string,
  ): Promise<ModerationResult> {
    const result = await this.moderate(output, {
      useOpenAI: false,
      sanitize: true,
      context: 'output',
    });

    // 额外检查：系统提示泄露
    if (systemPrompt) {
      const leakCheck = this.checkPromptLeak(output, systemPrompt);
      if (leakCheck.leaked) {
        result.details.push({
          type: 'PROMPT_LEAK',
          description: '检测到系统提示泄露',
          suggestion: '输出中包含系统指令内容',
        });
        result.flagged = true;
        result.severity = 'HIGH';
        result.action = ModerationAction.BLOCK;
      }
    }

    return result;
  }

  // ==================== 私有方法 ====================

  private detectSensitiveInfo(content: string): {
    details: ModerationDetail[];
    found: boolean;
  } {
    const details: ModerationDetail[] = [];

    for (const pattern of SENSITIVE_PATTERNS) {
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        details.push({
          type: pattern.type,
          description: `检测到${pattern.type}类型敏感信息`,
          position: { start: match.index, end: match.index + match[0].length },
          suggestion: pattern.replacement,
        });
      }
    }

    return { details, found: details.length > 0 };
  }

  private detectHarmfulContent(content: string): {
    details: ModerationDetail[];
    found: boolean;
  } {
    const details: ModerationDetail[] = [];
    const lowerContent = content.toLowerCase();

    for (const [severity, keywords] of Object.entries(HARMFUL_KEYWORDS)) {
      for (const keyword of keywords) {
        const index = lowerContent.indexOf(keyword.toLowerCase());
        if (index !== -1) {
          details.push({
            type: `HARMFUL_${severity}`,
            description: `检测到${severity}级别有害内容关键词`,
            position: { start: index, end: index + keyword.length },
          });
        }
      }
    }

    return { details, found: details.length > 0 };
  }

  private async callOpenAIModeration(
    content: string,
  ): Promise<ModerationCategory[]> {
    if (!this.openai) return [];

    try {
      const response = await this.openai.moderations.create({
        input: content,
      });

      const result = response.results[0];
      const categories: ModerationCategory[] = [];

      for (const [name, flagged] of Object.entries(result.categories)) {
        const score =
          result.category_scores[name as keyof typeof result.category_scores] ||
          0;
        categories.push({ name, flagged, score });
      }

      return categories;
    } catch (err) {
      this.logger.error('OpenAI Moderation API failed', err);
      return [];
    }
  }

  private calculateSeverity(
    details: ModerationDetail[],
    categories: ModerationCategory[],
  ): 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' {
    // OpenAI 严重标记
    if (categories.some((c) => c.flagged && c.score > 0.8)) {
      return 'HIGH';
    }

    // 本地检测结果
    if (
      details.some((d) => d.type.includes('HIGH') || d.type === 'PROMPT_LEAK')
    ) {
      return 'HIGH';
    }
    if (
      details.some((d) => d.type.includes('MEDIUM') || d.type === 'CREDIT_CARD')
    ) {
      return 'MEDIUM';
    }
    if (details.length > 0) {
      return 'LOW';
    }

    // OpenAI 中等标记
    if (categories.some((c) => c.flagged)) {
      return 'MEDIUM';
    }

    return 'NONE';
  }

  private determineAction(
    severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH',
    details: ModerationDetail[],
  ): ModerationAction {
    switch (severity) {
      case 'HIGH':
        // 高危有害内容直接阻止
        if (details.some((d) => d.type.startsWith('HARMFUL_HIGH'))) {
          return ModerationAction.BLOCK;
        }
        // 高危敏感信息可以清洗
        return ModerationAction.SANITIZE;

      case 'MEDIUM':
        return ModerationAction.SANITIZE;

      case 'LOW':
        return ModerationAction.WARN;

      default:
        return ModerationAction.ALLOW;
    }
  }

  private sanitizeContent(
    content: string,
    details: ModerationDetail[],
  ): string {
    let sanitized = content;

    // 按位置倒序处理，避免位置偏移
    const sortedDetails = [...details]
      .filter((d) => d.position && d.suggestion)
      .sort((a, b) => (b.position?.start || 0) - (a.position?.start || 0));

    for (const detail of sortedDetails) {
      if (detail.position && detail.suggestion) {
        sanitized =
          sanitized.slice(0, detail.position.start) +
          detail.suggestion +
          sanitized.slice(detail.position.end);
      }
    }

    // 使用模式替换剩余敏感信息
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.replacement) {
        sanitized = sanitized.replace(pattern.pattern, pattern.replacement);
      }
    }

    return sanitized;
  }

  private checkPromptLeak(
    output: string,
    systemPrompt: string,
  ): { leaked: boolean } {
    // 检查系统提示的关键片段是否出现在输出中
    const promptSegments = systemPrompt
      .split(/[。.!！?？\n]/)
      .filter((s) => s.trim().length > 20);

    for (const segment of promptSegments) {
      const normalized = segment.trim().toLowerCase();
      if (normalized.length > 30 && output.toLowerCase().includes(normalized)) {
        return { leaked: true };
      }
    }

    // 检查特定泄露模式
    const leakPatterns = [
      /我的系统提示是/,
      /my system prompt/i,
      /I was instructed to/i,
      /我被指示/,
      /我的初始指令/,
    ];

    for (const pattern of leakPatterns) {
      if (pattern.test(output)) {
        return { leaked: true };
      }
    }

    return { leaked: false };
  }
}
