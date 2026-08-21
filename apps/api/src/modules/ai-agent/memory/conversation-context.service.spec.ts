import { ConfigService } from '@nestjs/config';
import { ConversationContextService } from './conversation-context.service';
import { PersistentMemoryService } from './persistent-memory.service';
import { RedisCacheService } from './redis-cache.service';
import { SummarizerService } from './summarizer.service';

describe('ConversationContextService', () => {
  const previous = {
    version: 1 as const,
    summary: 'previous valid summary',
    keyTopics: [],
    decisions: [],
    nextSteps: [],
    throughMessageId: 'old-message',
    sourceMessageCount: 1,
    updatedAt: '2026-08-20T00:00:00.000Z',
  };

  function createService(
    summarizeConversation: jest.Mock,
    alerts?: { send: jest.Mock },
    harnessOperations?: {
      consumeContextCompressionFailure: jest.Mock;
      recordEvent: jest.Mock;
    },
  ) {
    const messages = Array.from({ length: 22 }, (_, index) => ({
      id: `message-${index}`,
      conversationId: 'conversation-1',
      role: index === 0 ? ('tool' as const) : ('user' as const),
      content: index === 0 ? 'raw secret tool payload' : `message ${index}`,
      createdAt: new Date(),
    }));
    const persistent = {
      getMessages: jest.fn().mockResolvedValue(messages),
      getConversation: jest.fn().mockResolvedValue({
        id: 'conversation-1',
        userId: 'user-1',
        metadata: { conversationContextSummaryV1: previous },
        messageCount: messages.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      updateConversation: jest.fn().mockResolvedValue(undefined),
    };
    const cache = { cacheConversation: jest.fn().mockResolvedValue(undefined) };
    const summarizer = {
      shouldSummarize: jest.fn().mockReturnValue(true),
      summarizeConversation,
    };
    const config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'AI_AGENT_HARNESS_V1') return 'true';
        if (key === 'AI_AGENT_CONTEXT_V1') return 'true';
        if (key === 'AI_AGENT_CONTEXT_RECENT_MESSAGES') return 10;
        return fallback;
      }),
    };
    return {
      service: new ConversationContextService(
        cache as unknown as RedisCacheService,
        persistent as unknown as PersistentMemoryService,
        summarizer as unknown as SummarizerService,
        config as unknown as ConfigService,
        undefined,
        alerts as never,
        harnessOperations as never,
      ),
      persistent,
      cache,
    };
  }

  it('omits tool payloads before generating a structured summary', async () => {
    const summarize = jest.fn().mockResolvedValue({
      summary: 'safe summary',
      keyTopics: [],
      decisions: [],
      nextSteps: [],
    });
    const { service, persistent } = createService(summarize);

    const result = await service.getCompressedContext('conversation-1');

    const summarizedMessages = summarize.mock.calls[0][0];
    expect(summarizedMessages[0].content).toContain('tool result omitted');
    expect(JSON.stringify(summarizedMessages)).not.toContain(
      'raw secret tool payload',
    );
    expect(result.summary?.summary).toBe('safe summary');
    expect(persistent.updateConversation).toHaveBeenCalledTimes(1);
  });

  it('retains the last valid summary when compression fails', async () => {
    const alerts = { send: jest.fn().mockResolvedValue(undefined) };
    const { service, persistent, cache } = createService(
      jest.fn().mockRejectedValue(new Error('LLM unavailable')),
      alerts,
    );

    const result = await service.getCompressedContext('conversation-1');

    expect(result.summary).toEqual(previous);
    expect(persistent.updateConversation).not.toHaveBeenCalled();
    expect(cache.cacheConversation).not.toHaveBeenCalled();
    expect(alerts.send).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: 'ai-agent-context-compression-fallback',
      }),
    );
  });

  it('consumes a one-shot synthetic failure without calling the summarizer', async () => {
    const alerts = { send: jest.fn().mockResolvedValue(undefined) };
    const harnessOperations = {
      consumeContextCompressionFailure: jest.fn().mockResolvedValue(true),
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };
    const summarize = jest.fn();
    const { service, persistent } = createService(
      summarize,
      alerts,
      harnessOperations,
    );

    const result = await service.getCompressedContext('conversation-1');

    expect(result.summary).toEqual(previous);
    expect(summarize).not.toHaveBeenCalled();
    expect(persistent.updateConversation).not.toHaveBeenCalled();
    expect(harnessOperations.recordEvent).toHaveBeenCalledWith(
      'context_compression_fallback',
    );
  });
});
