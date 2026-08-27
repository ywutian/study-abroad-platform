/**
 * 对话摘要服务 - 生成摘要并提取记忆
 */

import { Injectable, Logger } from '@nestjs/common';
import { MemoryType, EntityType } from '@prisma/client';
import { extractJsonFromLlm } from '../../../common/utils/llm-json.util';
import { LLMService } from '../core/llm.service';
import {
  MessageRecord,
  ConversationSummary,
  MemoryInput,
  EntityInput,
  LLMParsedMemory,
  LLMParsedEntity,
} from './types';

@Injectable()
export class SummarizerService {
  private readonly logger = new Logger(SummarizerService.name);

  constructor(private llmService: LLMService) {}

  /**
   * 生成对话摘要
   */
  async summarizeConversation(
    messages: MessageRecord[],
  ): Promise<ConversationSummary> {
    if (messages.length === 0) {
      return this.getEmptySummary();
    }

    const prompt = this.buildSummaryPrompt(messages);

    try {
      const content = await this.llmService.chatSimple(
        [
          {
            role: 'system',
            content: `你是一个对话分析专家。分析留学咨询对话，提取关键信息。
输出格式为 JSON：
{
  "summary": "对话的简短摘要（2-3句话）",
  "keyTopics": ["讨论的主要话题"],
  "decisions": ["做出的决定，如选校、文书主题、竞赛计划等"],
  "nextSteps": ["建议的下一步行动"],
  "facts": [
    {"type": "FACT|PREFERENCE|DECISION", "category": "school|essay|profile|competition|summer_program|internship|material|timeline", "content": "具体内容", "importance": 0.8}
  ],
  "entities": [
    {"type": "SCHOOL|PERSON|EVENT|TOPIC", "name": "名称", "description": "描述"}
  ]
}
category 说明: competition=竞赛, summer_program=夏校/暑期项目, internship=实习, material=材料准备, timeline=时间规划`,
          },
          { role: 'user', content: prompt },
        ],
        { taskType: 'memory.summary', temperature: 0.3, maxTokens: 1500 },
      );

      const parsed = this.parseSummaryResponse(content);
      if (!parsed.summary.trim()) {
        this.logger.warn(
          'LLM summary returned an invalid or empty structure; using deterministic fallback',
        );
        return this.fallbackSummary(messages);
      }
      return parsed;
    } catch (error) {
      this.logger.error('Failed to generate summary', error);
      return this.fallbackSummary(messages);
    }
  }

  /**
   * 从单条消息中提取记忆
   */
  async extractFromMessage(
    message: MessageRecord,
    _context?: { previousMessages?: MessageRecord[] },
  ): Promise<{ memories: MemoryInput[]; entities: EntityInput[] }> {
    if (message.role !== 'user') {
      return { memories: [], entities: [] };
    }

    // 只处理有实质内容的消息
    if (message.content.length < 20) {
      return { memories: [], entities: [] };
    }

    try {
      const content = await this.llmService.chatSimple(
        [
          {
            role: 'system',
            content: `分析用户消息，提取重要信息。只提取明确陈述的事实和偏好，不要推测。
输出 JSON：
{
  "memories": [
    {"type": "FACT|PREFERENCE|DECISION", "category": "school|essay|profile|competition|summer_program|internship|material|timeline", "content": "内容", "importance": 0.5-1.0}
  ],
  "entities": [
    {"type": "SCHOOL|PERSON|EVENT|TOPIC", "name": "名称", "description": "描述"}
  ]
}
category 说明: competition=竞赛, summer_program=夏校/暑期项目, internship=实习, material=材料准备, timeline=时间规划
如果没有值得记录的信息，返回空数组。`,
          },
          { role: 'user', content: message.content },
        ],
        { taskType: 'memory.extract', temperature: 0.2, maxTokens: 500 },
      );

      const parsed = extractJsonFromLlm<{
        memories?: LLMParsedMemory[];
        entities?: LLMParsedEntity[];
      }>(content);

      // Structure validation — extractJsonFromLlm returns { result: rawResponse } on failure
      if (!Array.isArray(parsed?.memories)) {
        this.logger.warn(
          'LLM memory extraction returned unexpected structure, skipping',
        );
        return { memories: [], entities: [] };
      }

      const memories = parsed.memories;
      const entities = Array.isArray(parsed.entities) ? parsed.entities : [];

      return {
        memories: memories.map((m: LLMParsedMemory) => ({
          type: this.mapMemoryType(m.type),
          category: m.category,
          content: m.content,
          importance: m.importance || 0.5,
        })),
        entities: entities.map((e: LLMParsedEntity) => ({
          type: this.mapEntityType(e.type),
          name: e.name,
          description: e.description,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to extract from message', error);
      return { memories: [], entities: [] };
    }
  }

  /**
   * 判断对话是否需要摘要
   */
  shouldSummarize(messages: MessageRecord[]): boolean {
    // 消息数超过阈值
    if (messages.length > 20) return true;

    // 对话时间超过 1 小时
    if (messages.length > 0) {
      const first = messages[0].createdAt;
      const last = messages[messages.length - 1].createdAt;
      const duration = last.getTime() - first.getTime();
      if (duration > 3600000) return true;
    }

    // 内容总长度超过阈值
    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalLength > 10000) return true;

    return false;
  }

  // ==================== 文本摘要方法 ====================

  /**
   * 合并多段文本为一条摘要
   */
  async summarizeTexts(texts: string[]): Promise<string> {
    if (texts.length === 0) return '';
    if (texts.length === 1) return texts[0];

    const combined = texts.join('\n- ');

    try {
      return await this.llmService.chatSimple(
        [
          {
            role: 'system',
            content:
              '将以下多条记忆合并为一条简洁的摘要，保留关键信息。直接输出合并后的文本，不要加前缀。',
          },
          { role: 'user', content: `- ${combined}` },
        ],
        { taskType: 'memory.summary', temperature: 0.3, maxTokens: 300 },
      );
    } catch {
      return texts.slice(0, 3).join('; ');
    }
  }

  /**
   * 压缩单段文本到指定 token 数量
   */
  async summarizeText(text: string, maxTokens: number): Promise<string> {
    try {
      return await this.llmService.chatSimple(
        [
          {
            role: 'system',
            content: `将以下文本压缩为更简短的版本，保留关键信息，目标约 ${maxTokens} 个 token。直接输出压缩后的文本。`,
          },
          { role: 'user', content: text },
        ],
        {
          taskType: 'memory.summary',
          temperature: 0.2,
          maxTokens: maxTokens * 2,
        },
      );
    } catch {
      return text.slice(0, maxTokens * 4);
    }
  }

  // ==================== 私有方法 ====================

  private buildSummaryPrompt(messages: MessageRecord[]): string {
    const formatted = messages
      .map((m) => {
        const role = m.role === 'user' ? '用户' : m.agentType || 'AI';
        return `[${role}]: ${m.content.slice(0, 500)}${m.content.length > 500 ? '...' : ''}`;
      })
      .join('\n\n');

    return `请分析以下留学咨询对话：\n\n${formatted}`;
  }

  private parseSummaryResponse(content: string): ConversationSummary {
    try {
      const parsed = extractJsonFromLlm<{
        summary?: string;
        keyTopics?: string[];
        decisions?: string[];
        nextSteps?: string[];
        facts?: LLMParsedMemory[];
        entities?: LLMParsedEntity[];
      }>(content);

      // Structure validation — reject fallback shape
      if (typeof parsed?.summary !== 'string') {
        return this.getEmptySummary();
      }

      // Defensive array checks — model may return string instead of array
      const keyTopics = Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [];
      const decisions = Array.isArray(parsed.decisions) ? parsed.decisions : [];
      const nextSteps = Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [];
      const facts = Array.isArray(parsed.facts) ? parsed.facts : [];
      const entities = Array.isArray(parsed.entities) ? parsed.entities : [];

      return {
        summary: parsed.summary,
        keyTopics,
        decisions,
        nextSteps,
        extractedFacts: facts.map((f: LLMParsedMemory) => ({
          type: this.mapMemoryType(f.type),
          category: f.category,
          content: f.content,
          importance: f.importance || 0.5,
        })),
        extractedEntities: entities.map((e: LLMParsedEntity) => ({
          type: this.mapEntityType(e.type),
          name: e.name,
          description: e.description,
        })),
      };
    } catch {
      return this.getEmptySummary();
    }
  }

  private fallbackSummary(messages: MessageRecord[]): ConversationSummary {
    const userMessages = messages.filter((m) => m.role === 'user');
    const topics = new Set<string>();

    // 简单的关键词提取
    const keywords = [
      '学校',
      '文书',
      'GPA',
      '活动',
      '推荐',
      '截止',
      '申请',
      '竞赛',
      '夏校',
      '实习',
      '考试',
      '材料',
      '时间线',
    ];
    for (const msg of userMessages) {
      for (const kw of keywords) {
        if (msg.content.includes(kw)) {
          topics.add(kw);
        }
      }
    }

    return {
      summary: `对话包含 ${messages.length} 条消息，主要讨论了 ${Array.from(topics).join('、') || '留学相关话题'}。`,
      keyTopics: Array.from(topics),
      decisions: [],
      nextSteps: [],
      extractedFacts: [],
      extractedEntities: [],
    };
  }

  private getEmptySummary(): ConversationSummary {
    return {
      summary: '',
      keyTopics: [],
      decisions: [],
      nextSteps: [],
      extractedFacts: [],
      extractedEntities: [],
    };
  }

  private mapMemoryType(type: string): MemoryType {
    const map: Record<string, MemoryType> = {
      FACT: MemoryType.FACT,
      PREFERENCE: MemoryType.PREFERENCE,
      DECISION: MemoryType.DECISION,
      SUMMARY: MemoryType.SUMMARY,
      FEEDBACK: MemoryType.FEEDBACK,
    };
    return map[type?.toUpperCase()] || MemoryType.FACT;
  }

  private mapEntityType(type: string): EntityType {
    const map: Record<string, EntityType> = {
      SCHOOL: EntityType.SCHOOL,
      PERSON: EntityType.PERSON,
      EVENT: EntityType.EVENT,
      TOPIC: EntityType.TOPIC,
    };
    return map[type?.toUpperCase()] || EntityType.TOPIC;
  }
}
