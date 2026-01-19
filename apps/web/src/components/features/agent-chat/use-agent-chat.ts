'use client';

/**
 * Agent 聊天 Hook - 处理流式消息
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth';
import { ChatMessage, StreamEvent, AgentType } from './types';

// API 请求通过 Next.js rewrites 代理（同源），避免跨域 cookie 问题
const API_BASE_URL = '';

interface UseAgentChatOptions {
  conversationId?: string;
  onError?: (error: string) => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const t = useTranslations('agentChat');
  const { accessToken: token, refreshAccessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentType>('orchestrator');
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  // 保存对话 ID，确保上下文连续
  const conversationIdRef = useRef<string | undefined>(options.conversationId);

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // 添加用户消息
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // 创建 assistant 消息占位
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

      // 创建 AbortController
      abortControllerRef.current = new AbortController();

      try {
        // 内部函数：执行实际请求
        const doRequest = async (authToken: string | null) => {
          return fetch(`${API_BASE_URL}/api/v1/ai-agent/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
              message: content,
              conversationId: conversationIdRef.current, // 使用保存的对话 ID
              stream: true,
            }),
            credentials: 'include', // 关键：发送 httpOnly cookie
            signal: abortControllerRef.current?.signal,
          });
        };

        let response = await doRequest(token);

        // 401 时尝试刷新 token 并重试
        if (response.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            const newToken = useAuthStore.getState().accessToken;
            response = await doRequest(newToken);
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
          const { done, value } = await reader.read();
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
              handleStreamEvent(event, assistantId);
            } catch {
              // 忽略解析错误
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        options.onError?.(errorMessage);

        // 更新消息显示错误
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: t('errorProcessing'), isStreaming: false }
              : msg
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
   * 处理流事件
   */
  const handleStreamEvent = useCallback((event: StreamEvent, messageId: string) => {
    switch (event.type) {
      case 'start':
        if (event.agent) setCurrentAgent(event.agent);
        // 保存后端返回的 conversationId，用于后续消息保持上下文
        if (event.conversationId) {
          conversationIdRef.current = event.conversationId;
        }
        break;

      case 'content':
        // 只有当 content 确实存在时才更新
        if (event.content) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, content: msg.content + event.content, agent: event.agent || msg.agent }
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
                    toolCalls: [...(msg.toolCalls || []), { name: event.tool!, status: 'running' }],
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
                  isStreaming: false,
                  agent: event.agent || msg.agent,
                }
              : msg
          )
        );
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
  }, []);

  /**
   * 停止生成
   */
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  }, []);

  /**
   * 清除消息
   */
  const clearMessages = useCallback(async () => {
    const oldConversationId = conversationIdRef.current;
    setMessages([]);
    conversationIdRef.current = undefined; // 重置对话 ID，开始新对话

    if (token && oldConversationId) {
      try {
        await fetch(
          `${API_BASE_URL}/api/v1/ai-agent/conversation?conversationId=${oldConversationId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
          }
        );
      } catch {
        // 忽略错误
      }
    }
  }, [token]);

  return {
    messages,
    isLoading,
    currentAgent,
    activeTools,
    conversationId: conversationIdRef.current, // 导出当前对话 ID
    sendMessage,
    stopGeneration,
    clearMessages,
  };
}
