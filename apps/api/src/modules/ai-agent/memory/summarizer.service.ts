/**
 * 对话摘要服务 - 生成摘要并提取记忆
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryType, EntityType } from '@prisma/client';
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
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get('OPENAI_API_KEY', '');
    this.baseUrl = this.config.get(
      'OPENAI_BASE_URL',
      'https://api.openai.com/v1',
    );
    this.model = this.config.get('OPENAI_MODEL', 'gpt-4o-mini');
  }

  /**
   * 生成对话摘要
   */
  async summarizeConversation(
    messages: MessageRecord[],
  ): Promise<ConversationSummary> {
    if (messages.length === 0) {
      return this.getEmptySummary();
    }

    if (!this.apiKey) {
      return this.fallbackSummary(messages);
    }

    const prompt = this.buildSummaryPrompt(messages);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
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
          temperature: 0.3,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';

      return this.parseSummaryResponse(content);
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
    context?: { previousMessages?: MessageRecord[] },
  ): Promise<{ memories: MemoryInput[]; entities: EntityInput[] }> {
    if (!this.apiKey || message.role !== 'user') {
      return { memories: [], entities: [] };
    }

    // 只处理有实质内容的消息
    if (message.content.length < 20) {
      return { memories: [], entities: [] };
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
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
          temperature: 0.2,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        return { memories: [], entities: [] };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        memories: (parsed.memories || []).map((m: LLMParsedMemory) => ({
          type: this.mapMemoryType(m.type),
          category: m.category,
          content: m.content,
          importance: m.importance || 0.5,
        })),
        entities: (parsed.entities || []).map((e: LLMParsedEntity) => ({
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
      const parsed = JSON.parse(content);

      return {
        summary: parsed.summary || '',
        keyTopics: parsed.keyTopics || [],
        decisions: parsed.decisions || [],
        nextSteps: parsed.nextSteps || [],
        extractedFacts: (parsed.facts || []).map((f: LLMParsedMemory) => ({
          type: this.mapMemoryType(f.type),
          category: f.category,
          content: f.content,
          importance: f.importance || 0.5,
        })),
        extractedEntities: (parsed.entities || []).map(
          (e: LLMParsedEntity) => ({
            type: this.mapEntityType(e.type),
            name: e.name,
            description: e.description,
          }),
        ),
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
