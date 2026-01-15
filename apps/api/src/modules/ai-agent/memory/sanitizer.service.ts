/**
 * 敏感数据脱敏服务
 *
 * 提供多级别的数据脱敏能力：
 * - L1 LIGHT: 轻度脱敏，保留部分信息（用于内部日志）
 * - L2 MODERATE: 中度脱敏，大部分敏感信息隐藏（用于数据导出）
 * - L3 FULL: 完全脱敏（用于公开展示）
 *
 * 支持的敏感信息类型：
 * - 个人标识：SSN、身份证、护照号
 * - 联系方式：邮箱、手机号
 * - 学术信息：GPA、标化成绩
 * - 金融信息：银行卡号
 */

import { Injectable, Logger } from '@nestjs/common';

// ==================== 类型定义 ====================

export enum SanitizeLevel {
  /** 轻度脱敏 - 用于内部日志 */
  LIGHT = 'LIGHT',
  /** 中度脱敏 - 用于数据导出 */
  MODERATE = 'MODERATE',
  /** 完全脱敏 - 用于公开展示 */
  FULL = 'FULL',
}

export interface SanitizeOptions {
  level: SanitizeLevel;
  /** 保留原始长度（用占位符填充） */
  preserveLength?: boolean;
  /** 脱敏占位字符 */
  maskChar?: string;
}

export interface SanitizeResult {
  /** 脱敏后的内容 */
  sanitized: string;
  /** 检测到的敏感信息类型 */
  detectedTypes: string[];
  /** 脱敏的数量 */
  maskedCount: number;
}

export interface SensitiveDetectionResult {
  hasSensitive: boolean;
  types: string[];
  locations: Array<{
    type: string;
    start: number;
    end: number;
    sample: string;
  }>;
}

interface SanitizePattern {
  /** 正则表达式 */
  pattern: RegExp;
  /** 敏感信息类型名称 */
  type: string;
  /** 敏感级别：1=高（所有级别脱敏），2=中（MODERATE/FULL），3=低（仅FULL） */
  sensitivity: 1 | 2 | 3;
  /** 替换函数 */
  replacer: (match: string, level: SanitizeLevel, maskChar: string) => string;
}

// ==================== 服务实现 ====================

@Injectable()
export class SanitizerService {
  private readonly logger = new Logger(SanitizerService.name);
  private readonly defaultMaskChar = '*';

  /**
   * 脱敏模式定义
   * 按敏感级别排序：高敏感 -> 低敏感
   */
  private readonly patterns: SanitizePattern[] = [
    // ========== 高敏感（所有级别都脱敏） ==========

    // SSN (美国社会安全号)
    {
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      type: 'SSN',
      sensitivity: 1,
      replacer: (_, __, maskChar) =>
        `${maskChar.repeat(3)}-${maskChar.repeat(2)}-${maskChar.repeat(4)}`,
    },

    // 中国身份证号
    {
      pattern:
        /\b[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
      type: 'ID_CARD_CN',
      sensitivity: 1,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) {
          return `${match.slice(0, 3)}${maskChar.repeat(11)}${match.slice(-4)}`;
        }
        return maskChar.repeat(18);
      },
    },

    // 护照号
    {
      pattern: /\b[A-Z]{1,2}\d{7,9}\b/gi,
      type: 'PASSPORT',
      sensitivity: 1,
      replacer: (match, _, maskChar) => maskChar.repeat(match.length),
    },

    // 信用卡/借记卡号
    {
      pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      type: 'CREDIT_CARD',
      sensitivity: 1,
      replacer: (_, __, maskChar) =>
        `${maskChar.repeat(4)}-${maskChar.repeat(4)}-${maskChar.repeat(4)}-${maskChar.repeat(4)}`,
    },

    // ========== 中敏感（MODERATE/FULL 脱敏） ==========

    // 邮箱地址
    {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      type: 'EMAIL',
      sensitivity: 2,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) return match;

        const [local, domain] = match.split('@');
        if (level === SanitizeLevel.MODERATE) {
          // 保留首字母
          return `${local.charAt(0)}${maskChar.repeat(3)}@${domain}`;
        }
        // FULL: 完全隐藏
        return `${maskChar.repeat(4)}@${maskChar.repeat(4)}.${maskChar.repeat(3)}`;
      },
    },

    // 中国手机号
    {
      pattern: /\b1[3-9]\d{9}\b/g,
      type: 'PHONE_CN',
      sensitivity: 2,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) return match;
        if (level === SanitizeLevel.MODERATE) {
          return `${match.slice(0, 3)}${maskChar.repeat(4)}${match.slice(-4)}`;
        }
        return maskChar.repeat(11);
      },
    },

    // 美国手机号
    {
      pattern: /\b(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      type: 'PHONE_US',
      sensitivity: 2,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) return match;
        if (level === SanitizeLevel.MODERATE) {
          // 保留区号
          const cleaned = match.replace(/\D/g, '');
          return `(${cleaned.slice(-10, -7)}) ${maskChar.repeat(3)}-${maskChar.repeat(4)}`;
        }
        return `(${maskChar.repeat(3)}) ${maskChar.repeat(3)}-${maskChar.repeat(4)}`;
      },
    },

    // GPA（4.0 制或 5.0 制）
    {
      pattern: /(?:GPA|绩点|gpa)[:\s]*(\d+\.?\d*)\s*(?:\/\s*(\d+\.?\d*))?/gi,
      type: 'GPA',
      sensitivity: 2,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d+\.?\d*/, `${maskChar}.${maskChar}${maskChar}`);
      },
    },

    // SAT 分数
    {
      pattern: /(?:SAT)[:\s]*(\d{3,4})/gi,
      type: 'SAT_SCORE',
      sensitivity: 2,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d{3,4}/, maskChar.repeat(4));
      },
    },

    // ACT 分数
    {
      pattern: /(?:ACT)[:\s]*(\d{1,2})/gi,
      type: 'ACT_SCORE',
      sensitivity: 2,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d{1,2}/, maskChar.repeat(2));
      },
    },

    // TOEFL 分数
    {
      pattern: /(?:TOEFL|托福)[:\s]*(\d{2,3})/gi,
      type: 'TOEFL_SCORE',
      sensitivity: 2,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d{2,3}/, maskChar.repeat(3));
      },
    },

    // IELTS 分数
    {
      pattern: /(?:IELTS|雅思)[:\s]*(\d\.?\d?)/gi,
      type: 'IELTS_SCORE',
      sensitivity: 2,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d\.?\d?/, `${maskChar}.${maskChar}`);
      },
    },

    // GRE 分数
    {
      pattern: /(?:GRE)[:\s]*(\d{3})/gi,
      type: 'GRE_SCORE',
      sensitivity: 2,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d{3}/, maskChar.repeat(3));
      },
    },

    // GMAT 分数
    {
      pattern: /(?:GMAT)[:\s]*(\d{3})/gi,
      type: 'GMAT_SCORE',
      sensitivity: 2,
      replacer: (match, level, maskChar) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d{3}/, maskChar.repeat(3));
      },
    },

    // ========== 低敏感（仅 FULL 脱敏） ==========

    // 姓名（中文）
    {
      pattern: /(?:姓名|名字|本人)[:\s]*([^\s,，。]{2,4})/gi,
      type: 'NAME_CN',
      sensitivity: 3,
      replacer: (match, level, maskChar) => {
        if (level !== SanitizeLevel.FULL) return match;
        return match.replace(/[^\s:：]+$/, maskChar.repeat(3));
      },
    },

    // 地址
    {
      pattern: /(?:地址|住址|居住)[:\s]*([^\n,，。]{5,50})/gi,
      type: 'ADDRESS',
      sensitivity: 3,
      replacer: (match, level, maskChar) => {
        if (level !== SanitizeLevel.FULL) return match;
        return match.replace(/[^\s:：]+$/, maskChar.repeat(10));
      },
    },
  ];

  // ==================== 公共方法 ====================

  /**
   * 脱敏文本内容
   */
  sanitize(
    content: string,
    options: SanitizeOptions = { level: SanitizeLevel.MODERATE },
  ): string {
    const { level, maskChar = this.defaultMaskChar } = options;
    let result = content;

    for (const { pattern, sensitivity, replacer } of this.patterns) {
      // 根据敏感级别和脱敏级别决定是否处理
      if (this.shouldSanitize(sensitivity, level)) {
        // 重置正则表达式的 lastIndex
        pattern.lastIndex = 0;
        result = result.replace(pattern, (match) =>
          replacer(match, level, maskChar),
        );
      }
    }

    return result;
  }

  /**
   * 脱敏并返回详细结果
   */
  sanitizeWithDetails(
    content: string,
    options: SanitizeOptions = { level: SanitizeLevel.MODERATE },
  ): SanitizeResult {
    const { level, maskChar = this.defaultMaskChar } = options;
    let result = content;
    const detectedTypes = new Set<string>();
    let maskedCount = 0;

    for (const { pattern, type, sensitivity, replacer } of this.patterns) {
      if (!this.shouldSanitize(sensitivity, level)) continue;

      pattern.lastIndex = 0;
      result = result.replace(pattern, (match) => {
        detectedTypes.add(type);
        maskedCount++;
        return replacer(match, level, maskChar);
      });
    }

    return {
      sanitized: result,
      detectedTypes: Array.from(detectedTypes),
      maskedCount,
    };
  }

  /**
   * 批量脱敏
   */
  sanitizeBatch(contents: string[], options?: SanitizeOptions): string[] {
    return contents.map((c) => this.sanitize(c, options));
  }

  /**
   * 脱敏记忆记录
   */
  sanitizeMemory<
    T extends { content: string; metadata?: Record<string, unknown> },
  >(memory: T, options?: SanitizeOptions): T {
    return {
      ...memory,
      content: this.sanitize(memory.content, options),
      metadata: memory.metadata
        ? this.sanitizeMetadata(memory.metadata, options)
        : undefined,
    };
  }

  /**
   * 脱敏对话消息
   */
  sanitizeMessages<T extends { content: string }>(
    messages: T[],
    options?: SanitizeOptions,
  ): T[] {
    return messages.map((msg) => ({
      ...msg,
      content: this.sanitize(msg.content, options),
    }));
  }

  /**
   * 检测内容是否包含敏感信息
   */
  detectSensitive(content: string): SensitiveDetectionResult {
    const types = new Set<string>();
    const locations: SensitiveDetectionResult['locations'] = [];

    for (const { pattern, type } of this.patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(content)) !== null) {
        types.add(type);
        locations.push({
          type,
          start: match.index,
          end: match.index + match[0].length,
          sample: this.truncateSample(match[0]),
        });
      }
    }

    return {
      hasSensitive: types.size > 0,
      types: Array.from(types),
      locations,
    };
  }

  /**
   * 快速检测是否包含敏感信息（不返回详细位置）
   */
  hasSensitiveData(content: string): boolean {
    for (const { pattern } of this.patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 为日志脱敏（使用 LIGHT 级别）
   */
  sanitizeForLog(content: string): string {
    return this.sanitize(content, { level: SanitizeLevel.LIGHT });
  }

  /**
   * 为导出脱敏（使用 MODERATE 级别）
   */
  sanitizeForExport(content: string): string {
    return this.sanitize(content, { level: SanitizeLevel.MODERATE });
  }

  /**
   * 为公开展示脱敏（使用 FULL 级别）
   */
  sanitizeForPublic(content: string): string {
    return this.sanitize(content, { level: SanitizeLevel.FULL });
  }

  // ==================== 私有方法 ====================

  /**
   * 根据敏感级别和脱敏级别判断是否需要脱敏
   */
  private shouldSanitize(
    sensitivity: 1 | 2 | 3,
    level: SanitizeLevel,
  ): boolean {
    switch (level) {
      case SanitizeLevel.LIGHT:
        // 轻度脱敏：只处理高敏感（级别1）
        return sensitivity === 1;
      case SanitizeLevel.MODERATE:
        // 中度脱敏：处理高敏感和中敏感（级别1、2）
        return sensitivity <= 2;
      case SanitizeLevel.FULL:
        // 完全脱敏：处理所有敏感信息
        return true;
      default:
        return false;
    }
  }

  /**
   * 脱敏元数据对象
   */
  private sanitizeMetadata(
    metadata: Record<string, unknown>,
    options?: SanitizeOptions,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string') {
        result[key] = this.sanitize(value, options);
      } else if (Array.isArray(value)) {
        result[key] = value.map((v) =>
          typeof v === 'string' ? this.sanitize(v, options) : v,
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeMetadata(
          value as Record<string, unknown>,
          options,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 截断敏感信息样本（用于检测结果）
   */
  private truncateSample(text: string, maxLength = 10): string {
    if (text.length <= maxLength) {
      return text.charAt(0) + '*'.repeat(text.length - 1);
    }
    return (
      text.charAt(0) + '*'.repeat(maxLength - 2) + text.charAt(text.length - 1)
    );
  }
}
