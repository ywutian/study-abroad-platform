import { useCallback, useState } from 'react';
import type { TFunction } from 'i18next';
import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { AiChatMessage, StreamEvent } from '@/types';
import type { AgentMode, AgentType } from '@/app/uncommon-app.types';

interface ConversationOptions {
  input: string;
  setInput: (value: string) => void;
  isAuthenticated: boolean;
  agentMode: AgentMode;
  toast: { error: (message: string) => void };
  t: TFunction;
  queryClient: QueryClient;
}

export function useAiAgentConversation(options: ConversationOptions) {
  const { input, setInput, isAuthenticated, agentMode, toast, t, queryClient } = options;
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [activeAgent, setActiveAgent] = useState<string>();
  const [activeTool, setActiveTool] = useState<string>();

  const updateAssistant = useCallback((update: (message: AiChatMessage) => void) => {
    setMessages((previous) => {
      const next = [...previous];
      const assistant = next[next.length - 1];
      if (assistant?.role === 'assistant') update(assistant);
      return next;
    });
  }, []);

  const sendMessage = useCallback(
    async (messageText?: string, directAgent?: AgentType) => {
      const text = messageText || input.trim();
      if (!text || isStreaming) return;
      if (!isAuthenticated) return toast.error(t('errors.unauthorized'));

      setMessages((previous) => [
        ...previous,
        { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date() },
        { id: `assistant-${Date.now()}`, role: 'assistant', content: '', timestamp: new Date() },
      ]);
      setInput('');
      setIsStreaming(true);
      setActiveTool(undefined);

      try {
        const agent = directAgent || (agentMode !== 'auto' ? agentMode : undefined);
        const endpoint = agent ? '/ai-agent/agent' : '/ai-agent/chat';
        const body = agent
          ? { agent, message: text, conversationId }
          : { message: text, conversationId, stream: true };

        if (agent) {
          const response = await apiClient.post<{
            message: string;
            agentType: string;
            conversationId?: string;
          }>(endpoint, body);
          if (response.conversationId) setConversationId(response.conversationId);
          setActiveAgent(response.agentType);
          updateAssistant((message) => {
            message.content = response.message;
          });
        } else {
          for await (const chunk of apiClient.stream(endpoint, body)) {
            try {
              const event: StreamEvent = JSON.parse(chunk);
              if (event.type === 'start' || event.type === 'agent_switch') {
                if (event.agent) setActiveAgent(event.agent);
              } else if (event.type === 'content' && event.content) {
                updateAssistant((message) => {
                  message.content += event.content;
                });
              } else if (event.type === 'tool_start' && event.tool) {
                setActiveTool(event.tool);
                updateAssistant((message) => {
                  message.toolCalls = [
                    ...(message.toolCalls ?? []),
                    { name: event.tool!, status: 'running' },
                  ];
                });
              } else if (event.type === 'tool_end') {
                setActiveTool(undefined);
                updateAssistant((message) => {
                  const call = message.toolCalls?.[message.toolCalls.length - 1];
                  if (call) call.status = 'done';
                });
              } else if (event.type === 'done' && event.response?.agentType) {
                setActiveAgent(event.response.agentType);
              } else if (event.type === 'error') {
                toast.error(event.error || t('errors.unknown'));
              }
            } catch {
              updateAssistant((message) => {
                message.content += chunk;
              });
            }
          }
        }
        queryClient.invalidateQueries({ queryKey: ['ai-agent', 'quota'] });
        queryClient.invalidateQueries({ queryKey: ['ai-agent', 'usage'] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('errors.unknown'));
        setMessages((previous) =>
          previous.at(-1)?.role === 'assistant' && !previous.at(-1)?.content
            ? previous.slice(0, -1)
            : previous
        );
      } finally {
        setIsStreaming(false);
        setActiveTool(undefined);
      }
    },
    [
      agentMode,
      conversationId,
      input,
      isAuthenticated,
      isStreaming,
      queryClient,
      setInput,
      t,
      toast,
      updateAssistant,
    ]
  );

  const resetConversation = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setActiveAgent(undefined);
    setActiveTool(undefined);
  }, []);

  return {
    messages,
    setMessages,
    isStreaming,
    activeAgent,
    activeTool,
    sendMessage,
    resetConversation,
  };
}
