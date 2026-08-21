import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';
import { PersistentMemoryService } from './persistent-memory.service';
import { SanitizeLevel, SanitizerService } from './sanitizer.service';
import { SummarizerService } from './summarizer.service';
import type { ConversationContextSummaryV1, MessageRecord } from './types';
import {
  AlertChannelService,
  AlertSeverity,
} from '../infrastructure/alerting/alert-channel.service';

@Injectable()
export class ConversationContextService {
  private readonly logger = new Logger(ConversationContextService.name);

  constructor(
    private readonly cache: RedisCacheService,
    private readonly persistent: PersistentMemoryService,
    private readonly summarizer: SummarizerService,
    private readonly config: ConfigService,
    @Optional() private readonly sanitizer?: SanitizerService,
    @Optional() private readonly alerts?: AlertChannelService,
  ) {}

  async getCompressedContext(conversationId: string): Promise<{
    summary?: ConversationContextSummaryV1;
    recentMessages: MessageRecord[];
  }> {
    const recentLimit = this.config.get<number>(
      'AI_AGENT_CONTEXT_RECENT_MESSAGES',
      10,
    );
    const messages = await this.persistent.getMessages(conversationId, {
      limit: 100,
    });
    const conversation = await this.persistent.getConversation(conversationId);
    if (!conversation) {
      return { recentMessages: messages.slice(-recentLimit) };
    }

    const previous = this.readSummary(
      conversation.metadata?.conversationContextSummaryV1,
    );
    if (
      !this.isEnabled() ||
      !this.summarizer.shouldSummarize(messages) ||
      messages.length <= recentLimit
    ) {
      return {
        summary: previous,
        recentMessages: messages.slice(-recentLimit),
      };
    }

    const sourceMessages = messages.slice(0, -recentLimit);
    const throughMessageId = sourceMessages.at(-1)?.id;
    if (
      !throughMessageId ||
      previous?.throughMessageId === throughMessageId ||
      (previous &&
        sourceMessages.length - previous.sourceMessageCount < recentLimit)
    ) {
      return {
        summary: previous,
        recentMessages: messages.slice(-recentLimit),
      };
    }

    try {
      const sanitized = this.sanitizer
        ? this.sanitizer.sanitizeMessages(sourceMessages, {
            level: SanitizeLevel.MODERATE,
          })
        : sourceMessages;
      const safeMessages = sanitized.map((message) =>
        message.role === 'tool'
          ? { ...message, content: `[tool result omitted; ref=${message.id}]` }
          : message,
      );
      const generated =
        await this.summarizer.summarizeConversation(safeMessages);
      if (!generated.summary.trim()) {
        return {
          summary: previous,
          recentMessages: messages.slice(-recentLimit),
        };
      }

      const summary: ConversationContextSummaryV1 = {
        version: 1,
        summary: generated.summary,
        keyTopics: generated.keyTopics.slice(0, 10),
        decisions: generated.decisions.slice(0, 10),
        nextSteps: generated.nextSteps.slice(0, 10),
        throughMessageId,
        sourceMessageCount: sourceMessages.length,
        updatedAt: new Date().toISOString(),
      };
      const metadata = {
        ...(conversation.metadata || {}),
        conversationContextSummaryV1: summary,
      };
      await this.persistent.updateConversation(conversationId, {
        summary: summary.summary,
        metadata,
      });
      await this.cache.cacheConversation(conversationId, {
        ...conversation,
        summary: summary.summary,
        metadata,
      });
      return { summary, recentMessages: messages.slice(-recentLimit) };
    } catch (error) {
      this.logger.warn(
        `[AI_AGENT_CONTEXT_COMPRESSION_FALLBACK] Conversation compression failed; retaining last valid summary: ${error instanceof Error ? error.message : String(error)}`,
      );
      void this.alerts
        ?.send({
          alertId: 'ai-agent-context-compression-fallback',
          title: 'AI Agent context compression fallback',
          message:
            'Conversation compression failed and the last valid summary was retained.',
          severity: AlertSeverity.WARNING,
          source: ConversationContextService.name,
        })
        .catch((alertError) =>
          this.logger.warn(
            `Failed to enqueue context compression alert: ${String(alertError)}`,
          ),
        );
      return {
        summary: previous,
        recentMessages: messages.slice(-recentLimit),
      };
    }
  }

  private isEnabled(): boolean {
    return (
      this.config.get<string>('AI_AGENT_HARNESS_V1') === 'true' &&
      this.config.get<string>('AI_AGENT_CONTEXT_V1') === 'true'
    );
  }

  private readSummary(
    value: unknown,
  ): ConversationContextSummaryV1 | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const summary = value as Partial<ConversationContextSummaryV1>;
    if (
      summary.version !== 1 ||
      typeof summary.summary !== 'string' ||
      typeof summary.throughMessageId !== 'string' ||
      typeof summary.sourceMessageCount !== 'number' ||
      typeof summary.updatedAt !== 'string' ||
      !Array.isArray(summary.keyTopics) ||
      !Array.isArray(summary.decisions) ||
      !Array.isArray(summary.nextSteps)
    ) {
      return undefined;
    }
    return summary as ConversationContextSummaryV1;
  }
}
