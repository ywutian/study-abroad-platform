/**
 * 记忆提取服务 - 混合规则与 LLM 提取
 *
 * 策略:
 * 1. 优先使用规则提取（高效、可控）
 * 2. LLM 提取作为补充（灵活、全面）
 * 3. 冲突检测与去重
 */

import { Injectable, Logger } from '@nestjs/common';
import { MemoryType, EntityType } from '@prisma/client';
import {
  EXTRACTION_RULES,
  ExtractionRule,
  ValidationResult,
} from './extraction-rules';
import { SummarizerService } from './summarizer.service';
import {
  MemoryConflictService,
  ConflictStrategy,
} from './memory-conflict.service';
import { MemoryScorerService } from './memory-scorer.service';

// ==================== 类型定义 ====================

export interface ExtractedMemory {
  type: MemoryType;
  category?: string;
  content: string;
  importance: number;
  confidence: number;
  source: 'rule' | 'llm';
  ruleId?: string;
  dedupeKey?: string;
  conflictStrategy?: ConflictStrategy;
  ttlDays?: number;
  metadata?: Record<string, any>;
}

export interface ExtractedEntity {
  type: EntityType;
  name: string;
  description?: string;
  attributes?: Record<string, any>;
  relations?: string[];
  source: 'rule' | 'llm';
}

export interface ExtractionResult {
  memories: ExtractedMemory[];
  entities: ExtractedEntity[];
  stats: {
    ruleMatches: number;
    llmExtractions: number;
    duplicatesRemoved: number;
    validationFailed: number;
    totalTime: number;
  };
}

export interface ExtractionContext {
  userId?: string;
  conversationId?: string;
  existingMemories?: ExtractedMemory[];
  skipLLM?: boolean;
  minConfidence?: number;
}

// ==================== 服务实现 ====================

@Injectable()
export class MemoryExtractorService {
  private readonly logger = new Logger(MemoryExtractorService.name);
  private readonly rules: ExtractionRule[];

  constructor(
    private summarizer: SummarizerService,
    private conflict: MemoryConflictService,
    private scorer: MemoryScorerService,
  ) {
    this.rules = EXTRACTION_RULES;
    this.logger.log(`Loaded ${this.rules.length} extraction rules`);
  }

  /**
   * 从消息中提取记忆和实体
   */
  async extract(
    messageContent: string,
    context: ExtractionContext = {},
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const stats = {
      ruleMatches: 0,
      llmExtractions: 0,
      duplicatesRemoved: 0,
      validationFailed: 0,
      totalTime: 0,
    };

    // 1. 规则提取
    const { memories: ruleMemories, entities: ruleEntities } =
      await this.extractWithRules(messageContent);
    stats.ruleMatches = ruleMemories.length;

    // 2. LLM 提取（仅在规则提取不足时）
    let llmMemories: ExtractedMemory[] = [];
    let llmEntities: ExtractedEntity[] = [];

    if (!context.skipLLM && ruleMemories.length < 2) {
      const llmResult = await this.extractWithLLM(messageContent);
      llmMemories = llmResult.memories;
      llmEntities = llmResult.entities;
      stats.llmExtractions = llmMemories.length;
    }

    // 3. 合并结果
    const allMemories = [...ruleMemories, ...llmMemories];
    const allEntities = [...ruleEntities, ...llmEntities];

    // 4. 验证与去重
    const {
      memories: validMemories,
      entities: validEntities,
      duplicatesRemoved,
      validationFailed,
    } = await this.processExtractedData(
      allMemories,
      allEntities,
      context.existingMemories || [],
      context.minConfidence || 0.5,
    );

    stats.duplicatesRemoved = duplicatesRemoved;
    stats.validationFailed = validationFailed;
    stats.totalTime = Date.now() - startTime;

    this.logger.debug(
      `Extraction complete: rules=${stats.ruleMatches}, llm=${stats.llmExtractions}, ` +
        `final=${validMemories.length}, time=${stats.totalTime}ms`,
    );

    return {
      memories: validMemories,
      entities: validEntities,
      stats,
    };
  }

  /**
   * 使用规则提取
   */
  private async extractWithRules(content: string): Promise<{
    memories: ExtractedMemory[];
    entities: ExtractedEntity[];
  }> {
    const memories: ExtractedMemory[] = [];
    const entities: ExtractedEntity[] = [];

    for (const rule of this.rules) {
      for (const pattern of rule.patterns) {
        const matches = content.matchAll(new RegExp(pattern, 'gi'));

        for (const match of matches) {
          const rawValue = match[1] || match[0];

          // 验证
          const validation = rule.validator(rawValue, match);
          if (!validation.valid) {
            this.logger.debug(
              `Validation failed for rule ${rule.id}: ${validation.error}`,
            );
            continue;
          }

          // 计算重要性
          let importance = rule.baseImportance;
          for (const boost of rule.importanceBoosts) {
            if (content.includes(boost.condition)) {
              importance = Math.min(1, importance + boost.boost);
            }
          }

          // 创建记忆
          const memory: ExtractedMemory = {
            type: rule.type,
            category: rule.category,
            content: rule.formatContent
              ? rule.formatContent(validation.normalized || rawValue, match)
              : `${rule.name}: ${validation.normalized || rawValue}`,
            importance,
            confidence: 0.95, // 规则提取高置信度
            source: 'rule',
            ruleId: rule.id,
            dedupeKey: rule.dedupeKey(validation.normalized || rawValue),
            conflictStrategy: rule.conflictStrategy,
            ttlDays: rule.ttlDays,
            metadata: {
              rawMatch: match[0],
              normalized: validation.normalized,
            },
          };

          memories.push(memory);

          // 提取实体（如果规则定义了）
          if (rule.extractEntity) {
            const entity = rule.extractEntity(
              validation.normalized || rawValue,
              match,
            );
            if (entity) {
              entities.push({
                ...entity,
                source: 'rule',
              });
            }
          }
        }
      }
    }

    return { memories, entities };
  }

  /**
   * 使用 LLM 提取
   */
  private async extractWithLLM(content: string): Promise<{
    memories: ExtractedMemory[];
    entities: ExtractedEntity[];
  }> {
    try {
      const result = await this.summarizer.extractFromMessage({
        id: 'temp',
        conversationId: '',
        role: 'user',
        content,
        createdAt: new Date(),
      });

      return {
        memories: result.memories.map((m) => ({
          ...m,
          importance: m.importance ?? 0.5,
          confidence: 0.7, // LLM 提取中等置信度
          source: 'llm' as const,
        })),
        entities: result.entities.map((e) => ({
          type: e.type,
          name: e.name,
          description: e.description,
          attributes: e.attributes,
          relations: e.relations?.map((r) => r.targetName),
          source: 'llm' as const,
        })),
      };
    } catch (error) {
      this.logger.error('LLM extraction failed', error);
      return { memories: [], entities: [] };
    }
  }

  /**
   * 处理提取的数据（验证、去重、评分）
   */
  private async processExtractedData(
    memories: ExtractedMemory[],
    entities: ExtractedEntity[],
    existingMemories: ExtractedMemory[],
    minConfidence: number,
  ): Promise<{
    memories: ExtractedMemory[];
    entities: ExtractedEntity[];
    duplicatesRemoved: number;
    validationFailed: number;
  }> {
    let duplicatesRemoved = 0;
    let validationFailed = 0;

    // 1. 过滤低置信度
    const filteredMemories = memories.filter((m) => {
      if (m.confidence < minConfidence) {
        validationFailed++;
        return false;
      }
      return true;
    });

    // 2. 去重（基于 dedupeKey）
    const seenKeys = new Set<string>();
    const existingKeys = new Set(
      existingMemories.map((m) => m.dedupeKey).filter(Boolean),
    );

    const uniqueMemories: ExtractedMemory[] = [];

    for (const memory of filteredMemories) {
      const key = memory.dedupeKey || `${memory.type}:${memory.content}`;

      // 检查是否已存在
      if (seenKeys.has(key) || existingKeys.has(key)) {
        duplicatesRemoved++;
        continue;
      }

      seenKeys.add(key);
      uniqueMemories.push(memory);
    }

    // 3. 评分调整
    const scoredMemories = uniqueMemories.map((m) => {
      const scoreResult = this.scorer.score({
        type: m.type,
        content: m.content,
        importance: m.importance,
        confidence: m.confidence,
        createdAt: new Date(),
      });

      return {
        ...m,
        importance: scoreResult.components.importanceScore,
        metadata: {
          ...m.metadata,
          score: scoreResult.totalScore,
          tier: scoreResult.tier,
        },
      };
    });

    // 4. 实体去重
    const seenEntityNames = new Set<string>();
    const uniqueEntities = entities.filter((e) => {
      const key = `${e.type}:${e.name}`;
      if (seenEntityNames.has(key)) {
        return false;
      }
      seenEntityNames.add(key);
      return true;
    });

    return {
      memories: scoredMemories,
      entities: uniqueEntities,
      duplicatesRemoved,
      validationFailed,
    };
  }

  /**
   * 获取所有规则
   */
  getRules(): ExtractionRule[] {
    return [...this.rules];
  }

  /**
   * 测试单个规则
   */
  testRule(
    ruleId: string,
    content: string,
  ): {
    matched: boolean;
    result?: ExtractedMemory;
    validation?: ValidationResult;
  } {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) {
      return { matched: false };
    }

    for (const pattern of rule.patterns) {
      const match = content.match(pattern);
      if (match) {
        const rawValue = match[1] || match[0];
        const validation = rule.validator(rawValue, match);

        if (!validation.valid) {
          return { matched: true, validation };
        }

        return {
          matched: true,
          result: {
            type: rule.type,
            category: rule.category,
            content: `${rule.name}: ${validation.normalized || rawValue}`,
            importance: rule.baseImportance,
            confidence: 0.95,
            source: 'rule',
            ruleId: rule.id,
          },
          validation,
        };
      }
    }

    return { matched: false };
  }
}
