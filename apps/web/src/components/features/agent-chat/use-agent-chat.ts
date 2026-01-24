'use client';

/**
 * React hook for AI agent chat with SSE streaming support.
 * Handles message lifecycle, tool call tracking, agent switching,
 * token refresh on 401, and per-chunk timeout protection.
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/lib/api';
import { ChatMessage, StreamEvent, AgentType } from './types';
import {
  useInvalidateConversations,
  useOptimisticAddConversation,
  useOptimisticUpdateConversation,
} from './use-chat-history';

// SSE streaming requests connect to the backend directly to bypass Next.js proxy buffering
const STREAM_API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface UseAgentChatOptions {
  conversationId?: string;
  onError?: (error: string) => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const t = useTranslations('agentChat');
  const locale = useLocale();
  const { accessToken: token, refreshAccessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentType>('orchestrator');
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(options.conversationId);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Persist conversation ID across renders to maintain context continuity
  const conversationIdRef = useRef<string | undefined>(options.conversationId);
  const invalidateConversations = useInvalidateConversations();
  const optimisticAddConversation = useOptimisticAddConversation();
  const optimisticUpdateConversation = useOptimisticUpdateConversation();
  // Use a ref for handleStreamEvent so sendMessage always calls the latest version
  const handleStreamEventRef = useRef<(event: StreamEvent, messageId: string) => void>(() => {});
  // Track user message content for optimistic title fallback
  const lastUserMessageRef = useRef<string>('');

  /**
   * Send a user message and stream the assistant's response via SSE.
   * Automatically retries once on 401 by refreshing the access token.
   * @param content - The user's message text
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Track user message for optimistic title fallback
      lastUserMessageRef.current = content.trim();

      // Append user message to the list
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Create a placeholder assistant message for streaming
      const assistantId = `assistant_${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        agent: 'orchestrator',
        isStreaming: true,
        toolCalls: [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      setIsLoading(true);
      setActiveTools([]);

      // Create AbortController for cancellation support
      abortControllerRef.current = new AbortController();

      try {
        // Inner function: execute the actual fetch request
        const doRequest = async (authToken: string | null) => {
          return fetch(`${STREAM_API_URL}/api/v1/ai-agent/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
              message: content,
              conversationId: conversationIdRef.current,
              stream: true,
              locale,
            }),
            credentials: 'include', // Required: send httpOnly refresh cookie
            signal: abortControllerRef.current?.signal,
          });
        };

        let response = await doRequest(token);

        // On 401, refresh the access token and retry once
        if (response.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            const newToken = useAuthStore.getState().accessToken;
            response = await doRequest(newToken);
          } else {
            throw new Error('AUTH_EXPIRED');
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          // 60s per-chunk timeout to detect stalled streams
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          const readPromise = reader.read();
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('STREAM_TIMEOUT')), 60000);
          });

          try {
            const { done, value } = await Promise.race([readPromise, timeoutPromise]);
            clearTimeout(timeoutId);
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6);

              if (data === '[DONE]') continue;

              try {
                const event: StreamEvent = JSON.parse(data);
                // Use ref to always call the latest handleStreamEvent
                handleStreamEventRef.current(event, assistantId);
              } catch {
                // Ignore malformed SSE data lines
              }
            }
          } catch (e) {
            clearTimeout(timeoutId);
            throw e;
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User-initiated abort: clean up streaming state
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId && msg.isStreaming ? { ...msg, isStreaming: false } : msg
            )
          );
          return;
        }

        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        // Map error types to user-facing messages
        let displayMessage: string;
        if (errorMsg === 'AUTH_EXPIRED') {
          displayMessage = t('loginExpired', { defaultMessage: '登录已过期，请重新登录' });
        } else if (errorMsg === 'STREAM_TIMEOUT') {
          displayMessage = t('responseTimeout', { defaultMessage: '响应超时，请重试' });
        } else {
          displayMessage = t('errorProcessing');
        }

        options.onError?.(displayMessage);

        // Update the placeholder message with the error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, content: displayMessage, isStreaming: false } : msg
          )
        );
      } finally {
        setIsLoading(false);
        setActiveTools([]);
        abortControllerRef.current = null;
      }
    },
    [token, isLoading, options, refreshAccessToken]
  );

  /**
   * Process a single SSE event and update message/tool state accordingly.
   * @param event - The parsed SSE event payload
   * @param messageId - The ID of the assistant message placeholder to update
   */
  const handleStreamEvent = useCallback(
    (event: StreamEvent, messageId: string) => {
      switch (event.type) {
        case 'start':
          if (event.agent) setCurrentAgent(event.agent);
          // Persist the backend-assigned conversationId for subsequent messages
          if (event.conversationId) {
            const isNew = !conversationIdRef.current;
            conversationIdRef.current = event.conversationId;
            setConversationId(event.conversationId);
            // 新对话立即出现在历史列表（乐观更新）
            if (isNew) {
              optimisticAddConversation({
                id: event.conversationId,
                title: event.title || lastUserMessageRef.current.slice(0, 50),
                agentType: event.agent,
                messageCount: 1,
              });
            }
          }
          break;

        case 'content':
          // Only append when content is non-empty (skip keep-alive events)
          if (event.content) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      content: msg.content + event.content,
                      agent: event.agent || msg.agent,
                    }
                  : msg
              )
            );
          }
          break;

        case 'tool_start':
          if (event.tool) {
            setActiveTools((prev) => [...prev, event.tool!]);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      toolCalls: [
                        ...(msg.toolCalls || []),
                        { name: event.tool!, status: 'running' },
                      ],
                    }
                  : msg
              )
            );
          }
          break;

        case 'tool_end':
          if (event.tool) {
            setActiveTools((prev) => prev.filter((t) => t !== event.tool));
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      toolCalls: msg.toolCalls?.map((tc) =>
                        tc.name === event.tool
                          ? { ...tc, status: 'completed', result: event.toolResult }
                          : tc
                      ),
                    }
                  : msg
              )
            );
          }
          break;

        case 'agent_switch':
          if (event.agent) {
            setCurrentAgent(event.agent);
            setMessages((prev) =>
              prev.map((msg) => (msg.id === messageId ? { ...msg, agent: event.agent } : msg))
            );
          }
          break;

        case 'done':
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    // Fallback: if no content events were received, use done.response.message
                    content: msg.content || event.response?.message || msg.content,
                    isStreaming: false,
                    agent: event.agent || msg.agent,
                  }
                : msg
            )
          );
          // 乐观更新时间戳，然后从服务端同步最新数据
          if (conversationIdRef.current) {
            optimisticUpdateConversation(conversationIdRef.current, {
              updatedAt: new Date().toISOString(),
            });
          }
          invalidateConversations();
          break;

        case 'error':
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, content: event.error || 'An error occurred', isStreaming: false }
                : msg
            )
          );
          break;
      }
    },
    [invalidateConversations, optimisticAddConversation, optimisticUpdateConversation]
  );

  // Keep ref in sync so sendMessage always uses the latest handleStreamEvent
  handleStreamEventRef.current = handleStreamEvent;

  /** Abort the in-flight SSE stream and mark all streaming messages as complete. */
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  }, []);

  /** Clear all messages locally and delete the conversation on the server. */
  const clearMessages = useCallback(async () => {
    const oldConversationId = conversationIdRef.current;
    setMessages([]);
    conversationIdRef.current = undefined;
    setConversationId(undefined);

    if (oldConversationId) {
      try {
        await apiClient.delete('/ai-agent/conversation', {
          params: { conversationId: oldConversationId },
        });
        invalidateConversations();
      } catch {
        // Best-effort cleanup; ignore server errors
      }
    }
  }, [invalidateConversations]);

  /**
   * Load an existing conversation's messages from the server.
   * Replaces the current messages state and sets the conversationId.
   */
  const loadConversation = useCallback(
    async (targetConversationId: string) => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<{
          messages: Array<{
            id: string;
            role: string;
            content: string;
            agentType?: string;
            toolCalls?: ChatMessage['toolCalls'];
            createdAt: string;
          }>;
        }>('/ai-agent/history', {
          params: { conversationId: targetConversationId },
        });

        const rawMessages = res.messages ?? [];

        const loadedMessages: ChatMessage[] = rawMessages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            agent: m.agentType as AgentType | undefined,
            toolCalls: m.toolCalls,
            isStreaming: false,
            timestamp: new Date(m.createdAt),
          }));

        setMessages(loadedMessages);
        conversationIdRef.current = targetConversationId;
        setConversationId(targetConversationId);
      } catch {
        options.onError?.(t('errorProcessing'));
      } finally {
        setIsLoading(false);
      }
    },
    [options, t]
  );

  /**
   * Start a new conversation without deleting the current one on the server.
   * Unlike clearMessages(), this preserves the old conversation in history.
   */
  const startNewConversation = useCallback(() => {
    setMessages([]);
    conversationIdRef.current = undefined;
    setConversationId(undefined);
    setCurrentAgent('orchestrator');
    setActiveTools([]);
  }, []);

  return {
    messages,
    isLoading,
    currentAgent,
    activeTools,
    conversationId,
    sendMessage,
    stopGeneration,
    clearMessages,
    loadConversation,
    startNewConversation,
  };
}
