/**
 * 快速路由服务 - 关键词预判减少 LLM 调用
 */

import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../types';

// 路由规则定义
interface RoutingRule {
  patterns: RegExp[];
  keywords: string[];
  agent: AgentType;
  confidence: number; // 0-1, 高于阈值直接路由
}

// 路由结果
export interface RoutingResult {
  agent: AgentType | null;
  confidence: number;
  matchedKeywords: string[];
  shouldUseLLM: boolean;
}

// 路由规则配置
const ROUTING_RULES: RoutingRule[] = [
  // 文书相关
  {
    agent: AgentType.ESSAY,
    confidence: 0.9,
    keywords: [
      '文书',
      'essay',
      'ps',
      '个人陈述',
      'personal statement',
      '润色',
      '修改',
      '评估',
      '写作',
      '大纲',
      'outline',
      'brainstorm',
      '头脑风暴',
      '续写',
      '补充',
      'supplement',
      '为什么选择',
      'why',
      '活动描述',
      'activity',
    ],
    patterns: [
      /帮我(写|修改|润色|评估|分析)(一下)?.*文书/i,
      /文书.*怎么写/i,
      /(review|polish|edit).*essay/i,
      /how.*write.*essay/i,
    ],
  },

  // 选校相关
  {
    agent: AgentType.SCHOOL,
    confidence: 0.9,
    keywords: [
      '选校',
      '学校推荐',
      '推荐学校',
      '录取率',
      '录取概率',
      '排名',
      'ranking',
      '对比',
      '比较',
      '哪个学校',
      '申请难度',
      '竞争',
      '匹配度',
      '保底',
      '冲刺',
      'top',
      '藤校',
      'ivy',
      '常春藤',
      '公立',
      '私立',
    ],
    patterns: [
      /推荐.*学校/i,
      /.*学校.*怎么样/i,
      /(我|我的).*录取(概率|机会|可能)/i,
      /哪(个|些|所)学校/i,
      /.*学校.*对比/i,
      /recommend.*school/i,
    ],
  },

  // 档案/背景分析
  {
    agent: AgentType.PROFILE,
    confidence: 0.9,
    keywords: [
      '档案',
      '背景',
      '竞争力',
      'gpa',
      '成绩',
      '活动',
      '提升',
      '软实力',
      '硬实力',
      '短板',
      '优势',
      '分析',
      '评估',
      '定位',
      '亮点',
      '科研',
      '实习',
    ],
    patterns: [
      /(我的|分析.*)(档案|背景|竞争力)/i,
      /怎么(提升|提高|增强)/i,
      /我.*有.*优势/i,
      /profile.*analy/i,
    ],
  },

  // 时间规划
  {
    agent: AgentType.TIMELINE,
    confidence: 0.9,
    keywords: [
      '时间',
      '规划',
      '计划',
      '截止',
      'deadline',
      '日期',
      'ed',
      'ea',
      'rd',
      '提前',
      '常规',
      '什么时候',
      '还来得及',
      '进度',
      '时间线',
      'timeline',
    ],
    patterns: [
      /(申请)?时间(线|表|规划)/i,
      /截止(日期|时间)/i,
      /什么时候(提交|申请|准备)/i,
      /来得及/i,
      /deadline/i,
    ],
  },
];

// 直接回答的简单问题（不需要 Agent）
// 注意：所有回复都应由 LLM 生成，此列表仅保留空数组
const SIMPLE_QA_PATTERNS: Array<{ pattern: RegExp; response: string }> = [];

// 置信度阈值
const CONFIDENCE_THRESHOLD = 0.7;

@Injectable()
export class FastRouterService {
  private readonly logger = new Logger(FastRouterService.name);

  /**
   * Determine which specialist agent should handle a message using keyword and
   * regex-based pattern matching, without invoking the LLM.
   *
   * Evaluation order:
   * 1. Check for simple Q&A patterns (no agent needed)
   * 2. Score each routing rule by regex patterns (weight 0.5) and keywords (weight 0.15)
   *    with a bonus for 3+ keyword matches
   * 3. If the best match exceeds the confidence threshold (0.7), route directly
   * 4. Otherwise, flag the result as needing LLM-based routing
   *
   * @param message - The user's raw message text
   * @returns Routing result with the target agent, confidence score, matched keywords,
   *          and whether LLM-based routing is still needed
   */
  /**
   * 快速路由决策
   */
  route(message: string): RoutingResult {
    const normalizedMessage = message.toLowerCase().trim();

    // 1. 检查是否是简单问答
    const simpleResponse = this.checkSimpleQA(normalizedMessage);
    if (simpleResponse) {
      return {
        agent: null,
        confidence: 1.0,
        matchedKeywords: ['simple_qa'],
        shouldUseLLM: false,
      };
    }

    // 2. 规则匹配
    let bestMatch: {
      agent: AgentType;
      confidence: number;
      matchedKeywords: string[];
    } | null = null;

    for (const rule of ROUTING_RULES) {
      const matchResult = this.matchRule(normalizedMessage, rule);

      if (matchResult.score > 0) {
        const confidence = Math.min(matchResult.score * rule.confidence, 1.0);

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            agent: rule.agent,
            confidence,
            matchedKeywords: matchResult.matchedKeywords,
          };
        }
      }
    }

    // 3. 根据置信度决定是否使用 LLM
    if (bestMatch && bestMatch.confidence >= CONFIDENCE_THRESHOLD) {
      this.logger.debug(
        `Fast route: ${bestMatch.agent} (confidence: ${bestMatch.confidence.toFixed(2)}, keywords: ${bestMatch.matchedKeywords.join(', ')})`,
      );

      return {
        agent: bestMatch.agent,
        confidence: bestMatch.confidence,
        matchedKeywords: bestMatch.matchedKeywords,
        shouldUseLLM: false,
      };
    }

    // 4. 置信度不足，需要 LLM 判断
    return {
      agent: bestMatch?.agent || null,
      confidence: bestMatch?.confidence || 0,
      matchedKeywords: bestMatch?.matchedKeywords || [],
      shouldUseLLM: true,
    };
  }

  /**
   * Check if a message matches a predefined simple Q&A pattern and return
   * the canned response if so.
   *
   * Currently the pattern list is empty (all responses are LLM-generated),
   * so this always returns null.
   *
   * @param message - The user's raw message text
   * @returns The canned response string, or null if no match
   */
  /**
   * 获取简单问答的回复
   */
  getSimpleResponse(message: string): string | null {
    const normalizedMessage = message.toLowerCase().trim();
    return this.checkSimpleQA(normalizedMessage);
  }

  /**
   * Extract domain-specific intent keywords from a message for prompt enrichment.
   *
   * Scans the message against all routing rule keywords and returns a
   * deduplicated list of matched terms (e.g., "文书", "选校", "GPA").
   *
   * @param message - The user's raw message text
   * @returns Deduplicated array of matched keyword strings
   */
  /**
   * 提取用户意图关键词（用于增强 prompt）
   */
  extractIntentKeywords(message: string): string[] {
    const keywords: string[] = [];
    const normalizedMessage = message.toLowerCase();

    for (const rule of ROUTING_RULES) {
      for (const keyword of rule.keywords) {
        if (normalizedMessage.includes(keyword.toLowerCase())) {
          keywords.push(keyword);
        }
      }
    }

    return [...new Set(keywords)];
  }

  /**
   * Heuristically determine whether a message is likely to require tool calls.
   *
   * Tests the message against regex indicators for data queries, analysis,
   * content generation, and comparison operations.
   *
   * @param message - The user's raw message text
   * @returns True if the message likely requires one or more tool invocations
   */
  /**
   * 判断是否需要工具调用
   */
  needsToolCall(message: string): boolean {
    const indicators = [
      // 需要数据查询
      /查(询|找|看|一下)/,
      /有(哪些|什么|多少)/,
      /列(出|举)/,
      /搜索/,
      // 需要分析计算
      /分析|评估|预测|计算/,
      // 需要生成内容
      /写|生成|创建|制定/,
      // 需要对比
      /对比|比较|哪个更/,
    ];

    return indicators.some((pattern) => pattern.test(message));
  }

  // ==================== 私有方法 ====================

  /**
   * Test a normalized message against the simple Q&A pattern list.
   *
   * Only matches messages shorter than 20 characters to avoid false positives
   * on longer, more nuanced queries.
   *
   * @param message - Lowercase, trimmed message text
   * @returns The canned response string, or null if no pattern matched
   */
  private checkSimpleQA(message: string): string | null {
    for (const qa of SIMPLE_QA_PATTERNS) {
      if (qa.pattern.test(message) && message.length < 20) {
        return qa.response;
      }
    }
    return null;
  }

  /**
   * Score a message against a single routing rule using regex patterns and keywords.
   *
   * Scoring algorithm:
   * - Each regex match adds 0.5 to the score
   * - Each keyword match adds 0.15
   * - A bonus of 0.2 is added when 3 or more keywords match
   * - The final score is capped at 1.0
   *
   * @param message - Lowercase, trimmed message text
   * @param rule - The routing rule to evaluate
   * @returns Object with the computed score (0-1) and list of matched keywords
   */
  private matchRule(
    message: string,
    rule: RoutingRule,
  ): { score: number; matchedKeywords: string[] } {
    let score = 0;
    const matchedKeywords: string[] = [];

    // 正则匹配 (权重高)
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) {
        score += 0.5;
        matchedKeywords.push(`pattern:${pattern.source.substring(0, 20)}`);
      }
    }

    // 关键词匹配
    for (const keyword of rule.keywords) {
      if (message.includes(keyword.toLowerCase())) {
        score += 0.15;
        matchedKeywords.push(keyword);
      }
    }

    // 多关键词加成
    if (matchedKeywords.length >= 3) {
      score += 0.2;
    }

    return { score: Math.min(score, 1.0), matchedKeywords };
  }
}
