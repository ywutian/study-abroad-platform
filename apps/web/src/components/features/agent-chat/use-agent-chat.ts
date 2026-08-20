'use client';

/**
 * React hook for AI agent chat with SSE streaming support.
 * Handles message lifecycle, tool call tracking, agent switching,
 * token refresh on 401, and per-chunk timeout protection.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { API_ROUTES } from '@study-abroad/shared';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/lib/api';
import { AI_TIMEOUTS } from '@/lib/constants';
import {
  ChatMessage,
  StreamEvent,
  AgentType,
  AgentActionPayload,
  AgentApprovalRequest,
} from './types';
import {
  useInvalidateConversations,
  useOptimisticAddConversation,
  useOptimisticUpdateConversation,
} from './use-chat-history';
import { env } from '@/lib/env';
import { pushAgentChatDebug } from './debug';

// SSE streaming requests connect to the backend directly to bypass Next.js proxy buffering.
// When empty, requests go through the Next.js rewrite proxy which buffers SSE responses
// (Vercel Edge/Serverless does not support streaming passthrough for rewrites).
// MUST be set to the API server URL in production (via NEXT_PUBLIC_API_URL env var).
const STREAM_API_URL = env.NEXT_PUBLIC_API_URL;

interface UseAgentChatOptions {
  conversationId?: string;
  onError?: (error: string) => void;
  onConversationChange?: (conversationId?: string) => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const { conversationId: externalConversationId, onConversationChange, onError } = options;
  const t = useTranslations('agentChat');
  const locale = useLocale();
  const { accessToken: token, refreshAccessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentType>(AgentType.ORCHESTRATOR);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [pendingApproval, setPendingApproval] = useState<AgentApprovalRequest | null>(null);
  const [isApprovalBusy, setIsApprovalBusy] = useState(false);
  // conversationId state is the single source of truth; ref syncs via useEffect for closures
  const [conversationId, setConversationId] = useState<string | undefined>(externalConversationId);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);
  const conversationIdRef = useRef<string | undefined>(externalConversationId);
  const invalidateConversations = useInvalidateConversations();
  const optimisticAddConversation = useOptimisticAddConversation();
  const optimisticUpdateConversation = useOptimisticUpdateConversation();
  // Track user message content for optimistic title fallback
  const lastUserMessageRef = useRef<string>('');
  // Reusable chunk timeout timer (avoid O(n) allocations)
  const chunkTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pausedMessageIdRef = useRef<string | null>(null);

  // Keep ref in sync with state (single source of truth: state)
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const setLoadingState = useCallback((next: boolean) => {
    isLoadingRef.current = next;
    setIsLoading(next);
  }, []);

  // Cleanup on unmount: abort any in-flight stream
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      isLoadingRef.current = false;
      clearTimeout(chunkTimeoutRef.current);
    };
  }, []);

  /**
   * Process a single SSE event and update message/tool state accordingly.
   */
  const handleStreamEvent = useCallback(
    (event: StreamEvent, messageId: string) => {
      switch (event.type) {
        case 'start':
          if (event.agent) setCurrentAgent(event.agent);
          // Persist the backend-assigned conversationId for subsequent messages
          if (event.conversationId) {
            const isNew = !conversationIdRef.current;
            setConversationId(event.conversationId);
            onConversationChange?.(event.conversationId);
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

        case 'approval_required':
          if (event.approval) {
            setPendingApproval(event.approval);
            pausedMessageIdRef.current = messageId;
          }
          break;

        case 'run_paused':
          setMessages((prev) =>
            prev.map((msg) => (msg.id === messageId ? { ...msg, isStreaming: false } : msg))
          );
          return { terminal: true };

        case 'run_resumed':
          setMessages((prev) =>
            prev.map((msg) => (msg.id === messageId ? { ...msg, isStreaming: true } : msg))
          );
          break;

        case 'done':
          setPendingApproval(null);
          pausedMessageIdRef.current = null;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    // Fallback: if no content events were received, use done.response.message
                    content: msg.content || event.response?.message || msg.content,
                    isStreaming: false,
                    agent: event.agent || msg.agent,
                    ...(event.response?.actions?.length ? { actions: event.response.actions } : {}),
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
          return { terminal: true };

        case 'error':
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, content: event.error || 'An error occurred', isStreaming: false }
                : msg
            )
          );
          return { terminal: true };
      }

      return { terminal: false };
    },
    [
      invalidateConversations,
      onConversationChange,
      optimisticAddConversation,
      optimisticUpdateConversation,
    ]
  );

  // Use ref for handleStreamEvent so sendMessage closures always call the latest version
  const handleStreamEventRef = useRef(handleStreamEvent);
  useEffect(() => {
    handleStreamEventRef.current = handleStreamEvent;
  }, [handleStreamEvent]);

  /**
   * Send a user message and stream the assistant's response via SSE.
   * Automatically retries once on 401 by refreshing the access token.
   */
  const sendMessage = useCallback(
    async (input: string | AgentActionPayload) => {
      const payload = typeof input === 'string' ? { message: input } : input;
      const trimmedContent = payload.message.trim();
      pushAgentChatDebug('sendMessage_attempt', {
        trimmedContentLength: trimmedContent.length,
        isLoadingRef: isLoadingRef.current,
        conversationId: conversationIdRef.current ?? null,
      });
      if (!trimmedContent || isLoadingRef.current) {
        pushAgentChatDebug('sendMessage_rejected_guard', {
          reason: !trimmedContent ? 'empty' : 'loading',
          isLoadingRef: isLoadingRef.current,
        });
        return false;
      }

      // Track user message for optimistic title fallback
      lastUserMessageRef.current = trimmedContent;
      pushAgentChatDebug('sendMessage_append_messages', {
        conversationId: conversationIdRef.current ?? null,
        trimmedContentLength: trimmedContent.length,
      });

      // Append user message to the list
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: payload.message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Create a placeholder assistant message for streaming
      const assistantId = `assistant_${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        agent: AgentType.ORCHESTRATOR,
        isStreaming: true,
        toolCalls: [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      setLoadingState(true);
      setActiveTools([]);

      // Create AbortController for cancellation support
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Inner function: execute the actual fetch request
        const doRequest = async (authToken: string | null) => {
          pushAgentChatDebug('sendMessage_fetch_start', {
            conversationId: conversationIdRef.current ?? null,
            locale,
            hasAuthToken: Boolean(authToken),
          });
          return fetch(`${STREAM_API_URL}/api/v1/ai-agent/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
              message: payload.message,
              conversationId: conversationIdRef.current,
              stream: true,
              locale,
              ...(payload.context ? { context: payload.context } : {}),
              ...(payload.agentHint ? { agentHint: payload.agentHint } : {}),
            }),
            credentials: 'include', // Required: send httpOnly refresh cookie
            signal: controller.signal,
          });
        };

        let response = await doRequest(token);
        pushAgentChatDebug('sendMessage_fetch_response', {
          status: response.status,
          ok: response.ok,
          conversationId: conversationIdRef.current ?? null,
        });

        // On 401, refresh the access token and retry once
        if (response.status === 401) {
          pushAgentChatDebug('sendMessage_auth_refresh_required');
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            const newToken = useAuthStore.getState().accessToken;
            response = await doRequest(newToken);
            pushAgentChatDebug('sendMessage_fetch_response_after_refresh', {
              status: response.status,
              ok: response.ok,
            });
          } else {
            throw new Error('AUTH_EXPIRED');
          }
        }

        if (!response.ok) {
          let errorDetail = `HTTP ${response.status}`;
          try {
            const body = await response.json();
            if (body?.error?.message) errorDetail = body.error.message;
          } catch {
            // non-JSON body, use status code
          }
          throw new Error(errorDetail);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let buffer = '';
        let streamTerminated = false;

        /** Reset the single reusable chunk timeout */
        const resetChunkTimeout = () => {
          clearTimeout(chunkTimeoutRef.current);
          chunkTimeoutRef.current = setTimeout(() => {
            controller.abort(new Error('STREAM_TIMEOUT'));
          }, AI_TIMEOUTS.SSE_CHUNK);
        };

        // Start initial chunk timeout
        resetChunkTimeout();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Reset timeout on each received chunk
          resetChunkTimeout();

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);

            if (data === '[DONE]') {
              pushAgentChatDebug('sendMessage_stream_done_marker', {
                conversationId: conversationIdRef.current ?? null,
              });
              streamTerminated = true;
              break;
            }

            try {
              const event: StreamEvent = JSON.parse(data);
              pushAgentChatDebug('sendMessage_stream_event', {
                type: event.type,
                conversationId: event.conversationId ?? conversationIdRef.current ?? null,
              });
              const result = handleStreamEventRef.current(event, assistantId);
              if (result.terminal) {
                streamTerminated = true;
                break;
              }
            } catch {
              // Ignore malformed SSE data lines
            }
          }

          if (streamTerminated) {
            clearTimeout(chunkTimeoutRef.current);
            await reader.cancel().catch(() => undefined);
            break;
          }
        }
      } catch (error) {
        // Distinguish user-initiated abort from stream timeout
        const isUserAbort =
          (error as Error).name === 'AbortError' &&
          !(
            controller.signal.reason instanceof Error &&
            controller.signal.reason.message === 'STREAM_TIMEOUT'
          );

        if (isUserAbort) {
          pushAgentChatDebug('sendMessage_user_abort', {
            conversationId: conversationIdRef.current ?? null,
          });
          // User-initiated abort: clean up streaming state
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId && msg.isStreaming ? { ...msg, isStreaming: false } : msg
            )
          );
          return true;
        }

        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout =
          errorMsg === 'STREAM_TIMEOUT' ||
          (controller.signal.reason instanceof Error &&
            controller.signal.reason.message === 'STREAM_TIMEOUT');

        // Map error types to user-facing messages
        let displayMessage: string;
        if (errorMsg === 'AUTH_EXPIRED') {
          displayMessage = t('loginExpired', { defaultMessage: '登录已过期，请重新登录' });
        } else if (isTimeout) {
          displayMessage = t('responseTimeout', { defaultMessage: '响应超时，请重试' });
        } else {
          displayMessage = t('errorProcessing');
        }

        onError?.(displayMessage);
        pushAgentChatDebug('sendMessage_error', {
          errorMessage: errorMsg,
          displayMessage,
          isTimeout,
          conversationId: conversationIdRef.current ?? null,
        });

        // Update the placeholder message with the error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, content: displayMessage, isStreaming: false } : msg
          )
        );
      } finally {
        pushAgentChatDebug('sendMessage_finally', {
          conversationId: conversationIdRef.current ?? null,
        });
        clearTimeout(chunkTimeoutRef.current);
        setLoadingState(false);
        setActiveTools([]);
        abortControllerRef.current = null;
      }
      return true;
    },
    [token, refreshAccessToken, locale, t, setLoadingState, onError]
  );

  /** Abort the in-flight SSE stream and mark all streaming messages as complete. */
  const stopGeneration = useCallback(() => {
    pushAgentChatDebug('stopGeneration_invoked', {
      conversationId: conversationIdRef.current ?? null,
    });
    abortControllerRef.current?.abort();
    clearTimeout(chunkTimeoutRef.current);
    setLoadingState(false);
    setActiveTools([]);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  }, [setLoadingState]);

  const resumePendingApproval = useCallback(async () => {
    const approval = pendingApproval;
    const messageId = pausedMessageIdRef.current;
    if (!approval || !messageId || isApprovalBusy) return;

    setIsApprovalBusy(true);
    setLoadingState(true);
    try {
      await apiClient.post(
        `${API_ROUTES.AI_AGENT}/runs/${approval.runId}/approvals/${approval.approvalId}/approve`
      );

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const request = (authToken: string | null) =>
        fetch(`${STREAM_API_URL}/api/v1/ai-agent/runs/${approval.runId}/resume`, {
          method: 'POST',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          credentials: 'include',
          signal: controller.signal,
        });
      let response = await request(token);
      if (response.status === 401 && (await refreshAccessToken())) {
        response = await request(useAuthStore.getState().accessToken);
      }
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      setPendingApproval(null);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let terminal = false;
      while (!terminal) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            terminal = true;
            break;
          }
          try {
            const event: StreamEvent = JSON.parse(data);
            if (handleStreamEventRef.current(event, messageId).terminal) {
              terminal = true;
              break;
            }
          } catch {
            // Ignore malformed keep-alive data.
          }
        }
      }
    } catch {
      setPendingApproval({ ...approval, status: 'APPROVED' });
      onError?.(t('approval.resumeError'));
    } finally {
      setIsApprovalBusy(false);
      setLoadingState(false);
      abortControllerRef.current = null;
    }
  }, [isApprovalBusy, onError, pendingApproval, refreshAccessToken, setLoadingState, t, token]);

  const rejectPendingApproval = useCallback(async () => {
    if (!pendingApproval || isApprovalBusy) return;
    setIsApprovalBusy(true);
    try {
      await apiClient.post(
        `${API_ROUTES.AI_AGENT}/runs/${pendingApproval.runId}/approvals/${pendingApproval.approvalId}/reject`,
        {}
      );
      setPendingApproval(null);
      pausedMessageIdRef.current = null;
    } catch {
      onError?.(t('approval.rejectError'));
    } finally {
      setIsApprovalBusy(false);
    }
  }, [isApprovalBusy, onError, pendingApproval, t]);

  const cancelPendingRun = useCallback(async () => {
    if (!pendingApproval || isApprovalBusy) return;
    setIsApprovalBusy(true);
    try {
      await apiClient.post(`${API_ROUTES.AI_AGENT}/runs/${pendingApproval.runId}/cancel`);
      setPendingApproval(null);
      pausedMessageIdRef.current = null;
    } catch {
      onError?.(t('approval.cancelError'));
    } finally {
      setIsApprovalBusy(false);
    }
  }, [isApprovalBusy, onError, pendingApproval, t]);

  /** Clear all messages locally and delete the conversation on the server. */
  const clearMessages = useCallback(async () => {
    const oldConversationId = conversationIdRef.current;
    setMessages([]);
    setConversationId(undefined);
    setPendingApproval(null);
    pausedMessageIdRef.current = null;
    onConversationChange?.(undefined);

    if (oldConversationId) {
      try {
        await apiClient.delete(`${API_ROUTES.AI_AGENT}/conversation`, {
          params: { conversationId: oldConversationId },
        });
        invalidateConversations();
      } catch {
        // Best-effort cleanup; ignore server errors
      }
    }
  }, [invalidateConversations, onConversationChange]);

  /**
   * Load an existing conversation's messages from the server.
   * Replaces the current messages state and sets the conversationId.
   */
  const loadConversation = useCallback(
    async (targetConversationId: string) => {
      setLoadingState(true);
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
        }>(`${API_ROUTES.AI_AGENT}/history`, {
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
        setConversationId(targetConversationId);
        onConversationChange?.(targetConversationId);
      } catch {
        onError?.(t('errorProcessing'));
      } finally {
        setLoadingState(false);
      }
    },
    [onConversationChange, onError, t, setLoadingState]
  );

  /**
   * Start a new conversation without deleting the current one on the server.
   * Unlike clearMessages(), this preserves the old conversation in history.
   */
  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setCurrentAgent(AgentType.ORCHESTRATOR);
    setActiveTools([]);
    setPendingApproval(null);
    pausedMessageIdRef.current = null;
    onConversationChange?.(undefined);
  }, [onConversationChange]);

  useEffect(() => {
    if (!externalConversationId || externalConversationId === conversationIdRef.current) return;
    void loadConversation(externalConversationId);
  }, [externalConversationId, loadConversation]);

  return {
    messages,
    isLoading,
    currentAgent,
    activeTools,
    pendingApproval,
    isApprovalBusy,
    conversationId,
    sendMessage,
    stopGeneration,
    resumePendingApproval,
    rejectPendingApproval,
    cancelPendingRun,
    clearMessages,
    loadConversation,
    startNewConversation,
  };
}
