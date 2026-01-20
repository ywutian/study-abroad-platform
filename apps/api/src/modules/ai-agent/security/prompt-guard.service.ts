/**
 * Prompt 注入防护服务
 *
 * 企业级多层防护：
 * 1. 规则匹配（高效）
 * 2. 启发式检测
 * 3. LLM 辅助检测（可选）
 */

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

// ==================== 类型定义 ====================

export interface PromptGuardResult {
  safe: boolean;
  riskScore: number; // 0-1
  threats: ThreatDetection[];
  sanitizedInput?: string;
  blocked: boolean;
  reason?: string;
}

export interface ThreatDetection {
  type: ThreatType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pattern: string;
  position: { start: number; end: number };
  confidence: number;
}

export enum ThreatType {
  PROMPT_INJECTION = 'PROMPT_INJECTION',
  JAILBREAK = 'JAILBREAK',
  ROLE_MANIPULATION = 'ROLE_MANIPULATION',
  CONTEXT_LEAK = 'CONTEXT_LEAK',
  INSTRUCTION_OVERRIDE = 'INSTRUCTION_OVERRIDE',
  ENCODING_ATTACK = 'ENCODING_ATTACK',
  DELIMITER_ATTACK = 'DELIMITER_ATTACK',
  INDIRECT_INJECTION = 'INDIRECT_INJECTION',
  INPUT_TOO_LONG = 'INPUT_TOO_LONG',
}

interface PatternRule {
  pattern: RegExp;
  type: ThreatType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

// ==================== 检测规则 ====================

const INJECTION_PATTERNS: PatternRule[] = [
  // 直接指令覆盖
  {
    pattern:
      /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
    type: ThreatType.INSTRUCTION_OVERRIDE,
    severity: 'CRITICAL',
    description: '尝试忽略之前的指令',
  },
  {
    pattern:
      /disregard\s+(all\s+)?(previous|above|prior|your)\s+(instructions?|guidelines?|rules?)/i,
    type: ThreatType.INSTRUCTION_OVERRIDE,
    severity: 'CRITICAL',
    description: '尝试无视指令',
  },
  {
    pattern:
      /forget\s+(everything|all|what)\s+(you|i)\s+(told|said|instructed)/i,
    type: ThreatType.INSTRUCTION_OVERRIDE,
    severity: 'HIGH',
    description: '尝试清除上下文',
  },

  // 角色操纵
  {
    pattern: /you\s+are\s+(now|no\s+longer)\s+(a|an|the)/i,
    type: ThreatType.ROLE_MANIPULATION,
    severity: 'HIGH',
    description: '尝试重新定义角色',
  },
  {
    pattern: /pretend\s+(to\s+be|you\s+are|you're)/i,
    type: ThreatType.ROLE_MANIPULATION,
    severity: 'MEDIUM',
    description: '尝试角色扮演攻击',
  },
  {
    pattern: /act\s+as\s+(if\s+you\s+are|a|an)/i,
    type: ThreatType.ROLE_MANIPULATION,
    severity: 'MEDIUM',
    description: '尝试行为操纵',
  },
  {
    pattern: /roleplay\s+as|assume\s+the\s+role/i,
    type: ThreatType.ROLE_MANIPULATION,
    severity: 'MEDIUM',
    description: '角色扮演请求',
  },

  // DAN/Jailbreak 变体
  {
    pattern: /\bDAN\b|do\s+anything\s+now/i,
    type: ThreatType.JAILBREAK,
    severity: 'CRITICAL',
    description: 'DAN 越狱尝试',
  },
  {
    pattern: /jailbreak|bypass\s+(restrictions?|filters?|safety)/i,
    type: ThreatType.JAILBREAK,
    severity: 'CRITICAL',
    description: '明确的越狱尝试',
  },
  {
    pattern: /developer\s+mode|god\s+mode|sudo\s+mode/i,
    type: ThreatType.JAILBREAK,
    severity: 'CRITICAL',
    description: '模式越狱尝试',
  },
  {
    pattern: /without\s+(any\s+)?(restrictions?|limitations?|filters?|safety)/i,
    type: ThreatType.JAILBREAK,
    severity: 'HIGH',
    description: '尝试绕过限制',
  },

  // 系统提示泄露
  {
    pattern: /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/i,
    type: ThreatType.CONTEXT_LEAK,
    severity: 'HIGH',
    description: '尝试泄露系统提示',
  },
  {
    pattern:
      /what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions?|rules?)/i,
    type: ThreatType.CONTEXT_LEAK,
    severity: 'MEDIUM',
    description: '询问系统提示',
  },
  {
    pattern:
      /show\s+(me\s+)?(your|the)\s+(initial|original|system)\s+(prompt|instructions?)/i,
    type: ThreatType.CONTEXT_LEAK,
    severity: 'HIGH',
    description: '请求显示系统提示',
  },
  {
    pattern: /print\s+(your|the)\s+(system|initial)\s+(prompt|message)/i,
    type: ThreatType.CONTEXT_LEAK,
    severity: 'HIGH',
    description: '尝试打印系统提示',
  },

  // 分隔符攻击
  {
    pattern: /```\s*(system|assistant|user)\s*\n/i,
    type: ThreatType.DELIMITER_ATTACK,
    severity: 'HIGH',
    description: '代码块分隔符攻击',
  },
  {
    pattern: /<\|?(system|assistant|user|im_start|im_end)\|?>/i,
    type: ThreatType.DELIMITER_ATTACK,
    severity: 'CRITICAL',
    description: '特殊标记注入',
  },
  {
    pattern: /\[\[?(system|SYSTEM)\]?\]/i,
    type: ThreatType.DELIMITER_ATTACK,
    severity: 'HIGH',
    description: '方括号分隔符攻击',
  },

  // 编码攻击
  {
    pattern: /\\x[0-9a-fA-F]{2}/,
    type: ThreatType.ENCODING_ATTACK,
    severity: 'MEDIUM',
    description: '十六进制编码',
  },
  {
    pattern: /\\u[0-9a-fA-F]{4}/,
    type: ThreatType.ENCODING_ATTACK,
    severity: 'MEDIUM',
    description: 'Unicode 编码',
  },
  {
    pattern: /base64\s*[:=]|atob\(|btoa\(/i,
    type: ThreatType.ENCODING_ATTACK,
    severity: 'MEDIUM',
    description: 'Base64 编码尝试',
  },

  // 间接注入
  {
    pattern: /when\s+you\s+see\s+this|if\s+you\s+read\s+this/i,
    type: ThreatType.INDIRECT_INJECTION,
    severity: 'MEDIUM',
    description: '条件触发注入',
  },
  {
    pattern: /hidden\s+instructions?|secret\s+command/i,
    type: ThreatType.INDIRECT_INJECTION,
    severity: 'HIGH',
    description: '隐藏指令尝试',
  },
];

// 中文注入模式
const CHINESE_INJECTION_PATTERNS: PatternRule[] = [
  {
    pattern: /忽略(之前|上面|所有)(的)?(指令|规则|提示)/,
    type: ThreatType.INSTRUCTION_OVERRIDE,
    severity: 'CRITICAL',
    description: '中文指令覆盖',
  },
  {
    pattern: /你(现在|不再)是/,
    type: ThreatType.ROLE_MANIPULATION,
    severity: 'HIGH',
    description: '中文角色操纵',
  },
  {
    pattern: /假装(你是|成为)/,
    type: ThreatType.ROLE_MANIPULATION,
    severity: 'MEDIUM',
    description: '中文角色扮演',
  },
  {
    pattern: /越狱|绕过(限制|过滤)/,
    type: ThreatType.JAILBREAK,
    severity: 'CRITICAL',
    description: '中文越狱尝试',
  },
  {
    pattern: /显示(你的|系统)(提示|指令)/,
    type: ThreatType.CONTEXT_LEAK,
    severity: 'HIGH',
    description: '中文系统提示泄露',
  },
];

// ==================== 服务实现 ====================

@Injectable()
export class PromptGuardService {
  private readonly logger = new Logger(PromptGuardService.name);
  private readonly allPatterns: PatternRule[];

  // 威胁计数缓存（用于频率检测）
  private threatCache: Map<string, { count: number; lastSeen: number }> =
    new Map();

  constructor(private redis: RedisService) {
    this.allPatterns = [...INJECTION_PATTERNS, ...CHINESE_INJECTION_PATTERNS];
  }

  /**
   * 分析输入安全性
   */
  async analyze(
    input: string,
    options?: {
      userId?: string;
      strictMode?: boolean;
      allowedPatterns?: string[];
    },
  ): Promise<PromptGuardResult> {
    const threats: ThreatDetection[] = [];
    let riskScore = 0;

    // 0. 超长输入直接标记高风险，跳过正则（防 ReDoS）
    if (input.length > 10000) {
      return {
        safe: false,
        riskScore: 0.8,
        threats: [
          {
            type: ThreatType.INPUT_TOO_LONG,
            severity: 'HIGH',
            pattern: `Input length: ${input.length}`,
            position: { start: 10000, end: input.length },
            confidence: 1.0,
          },
        ],
        sanitizedInput: input.slice(0, 10000),
        blocked: true,
        reason: '输入过长，可能为攻击尝试',
      };
    }

    // 1. 规则匹配检测
    const patternThreats = this.detectPatternThreats(input);
    threats.push(...patternThreats);

    // 2. 启发式检测
    const heuristicThreats = this.detectHeuristicThreats(input);
    threats.push(...heuristicThreats);

    // 3. 计算风险分数
    riskScore = this.calculateRiskScore(threats);

    // 4. 检查用户威胁历史
    if (options?.userId) {
      const historyScore = await this.checkThreatHistory(options.userId);
      riskScore = Math.min(1, riskScore + historyScore);
    }

    // 5. 记录威胁
    if (threats.length > 0 && options?.userId) {
      await this.recordThreat(options.userId, threats);
    }

    // 6. 决策
    const threshold = options?.strictMode ? 0.3 : 0.5;
    const blocked = riskScore >= threshold;
    const safe = riskScore < 0.3;

    // 7. 生成清洗后的输入（如果需要）
    const sanitizedInput = blocked
      ? undefined
      : this.sanitizeInput(input, threats);

    return {
      safe,
      riskScore,
      threats,
      sanitizedInput,
      blocked,
      reason: blocked ? this.generateBlockReason(threats) : undefined,
    };
  }

  /**
   * 快速检查（仅规则匹配）
   */
  quickCheck(input: string): { safe: boolean; threat?: ThreatType } {
    for (const rule of this.allPatterns) {
      if (rule.severity === 'CRITICAL' && rule.pattern.test(input)) {
        return { safe: false, threat: rule.type };
      }
    }
    return { safe: true };
  }

  // ==================== 私有方法 ====================

  private detectPatternThreats(input: string): ThreatDetection[] {
    const threats: ThreatDetection[] = [];

    for (const rule of this.allPatterns) {
      const matches = input.matchAll(new RegExp(rule.pattern, 'gi'));
      for (const match of matches) {
        if (match.index !== undefined) {
          threats.push({
            type: rule.type,
            severity: rule.severity,
            pattern: rule.description,
            position: {
              start: match.index,
              end: match.index + match[0].length,
            },
            confidence: 0.9,
          });
        }
      }
    }

    return threats;
  }

  private detectHeuristicThreats(input: string): ThreatDetection[] {
    const threats: ThreatDetection[] = [];

    // 1. 检测异常字符比例
    const specialCharRatio =
      (input.match(/[^\w\s\u4e00-\u9fa5]/g) || []).length / input.length;
    if (specialCharRatio > 0.3) {
      threats.push({
        type: ThreatType.ENCODING_ATTACK,
        severity: 'MEDIUM',
        pattern: '异常字符比例过高',
        position: { start: 0, end: input.length },
        confidence: 0.6,
      });
    }

    // 2. 检测重复模式（可能是混淆）
    const repeatedPattern = /(.{10,})\1{3,}/;
    if (repeatedPattern.test(input)) {
      threats.push({
        type: ThreatType.ENCODING_ATTACK,
        severity: 'MEDIUM',
        pattern: '检测到重复模式',
        position: { start: 0, end: input.length },
        confidence: 0.7,
      });
    }

    // 3. 检测过长输入（可能是填充攻击）
    if (input.length > 10000) {
      threats.push({
        type: ThreatType.INDIRECT_INJECTION,
        severity: 'LOW',
        pattern: '输入过长',
        position: { start: 0, end: input.length },
        confidence: 0.5,
      });
    }

    // 4. 检测多语言混合（可能是绕过尝试）
    const hasEnglish = /[a-zA-Z]{5,}/.test(input);
    const hasChinese = /[\u4e00-\u9fa5]{5,}/.test(input);
    const hasOther = /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F]{3,}/.test(
      input,
    );
    if (hasEnglish && hasChinese && hasOther) {
      threats.push({
        type: ThreatType.ENCODING_ATTACK,
        severity: 'LOW',
        pattern: '多语言混合输入',
        position: { start: 0, end: input.length },
        confidence: 0.4,
      });
    }

    return threats;
  }

  private calculateRiskScore(threats: ThreatDetection[]): number {
    if (threats.length === 0) return 0;

    const severityWeights = {
      CRITICAL: 0.5,
      HIGH: 0.3,
      MEDIUM: 0.15,
      LOW: 0.05,
    };

    let score = 0;
    for (const threat of threats) {
      score += severityWeights[threat.severity] * threat.confidence;
    }

    return Math.min(1, score);
  }

  private async checkThreatHistory(userId: string): Promise<number> {
    const key = `threat:history:${userId}`;
    const client = this.redis.getClient();

    if (!client || !this.redis.connected) {
      const cached = this.threatCache.get(userId);
      if (cached && Date.now() - cached.lastSeen < 3600000) {
        return Math.min(0.3, cached.count * 0.05);
      }
      return 0;
    }

    try {
      const count = await client.get(key);
      return Math.min(0.3, parseInt(count || '0') * 0.05);
    } catch {
      return 0;
    }
  }

  private async recordThreat(
    userId: string,
    threats: ThreatDetection[],
  ): Promise<void> {
    const hasCritical = threats.some((t) => t.severity === 'CRITICAL');
    const increment = hasCritical ? 3 : 1;

    const client = this.redis.getClient();
    if (client && this.redis.connected) {
      try {
        const key = `threat:history:${userId}`;
        await client.incrby(key, increment);
        await client.expire(key, 3600); // 1小时过期
      } catch (err) {
        this.logger.debug(`Failed to record threat: ${err}`);
      }
    }

    // 更新本地缓存
    const cached = this.threatCache.get(userId) || { count: 0, lastSeen: 0 };
    cached.count += increment;
    cached.lastSeen = Date.now();
    this.threatCache.set(userId, cached);

    // 记录日志
    this.logger.warn(`Security threat detected for user ${userId}`, {
      threats: threats.map((t) => ({ type: t.type, severity: t.severity })),
    });
  }

  private sanitizeInput(input: string, threats: ThreatDetection[]): string {
    let sanitized = input;

    // 移除检测到的威胁模式
    for (const threat of threats) {
      if (threat.severity === 'CRITICAL' || threat.severity === 'HIGH') {
        sanitized =
          sanitized.slice(0, threat.position.start) +
          '[REDACTED]' +
          sanitized.slice(threat.position.end);
      }
    }

    // 移除特殊分隔符
    sanitized = sanitized.replace(/<\|?[a-z_]+\|?>/gi, '');
    sanitized = sanitized.replace(/\[\[(SYSTEM|USER|ASSISTANT)\]\]/gi, '');

    return sanitized.trim();
  }

  private generateBlockReason(threats: ThreatDetection[]): string {
    const criticalThreat = threats.find((t) => t.severity === 'CRITICAL');
    if (criticalThreat) {
      return `检测到安全威胁：${criticalThreat.pattern}`;
    }

    const highThreat = threats.find((t) => t.severity === 'HIGH');
    if (highThreat) {
      return `检测到可疑内容：${highThreat.pattern}`;
    }

    return '输入内容包含不安全的模式';
  }
}
