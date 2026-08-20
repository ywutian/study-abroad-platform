import { useCallback, useState } from 'react';
import type { TFunction } from 'i18next';
import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { AgentApprovalRequest, AiChatMessage, StreamEvent } from '@/types';
import type { AgentMode, AgentType } from '@/app/uncommon-app.types';
import { API_ROUTES } from '@study-abroad/shared';

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
  const [pendingApproval, setPendingApproval] = useState<AgentApprovalRequest | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);

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

        if (agent) {
          const response = await apiClient.post<{
            message: string;
            agentType: string;
            conversationId?: string;
            data?: { approvalRequired?: AgentApprovalRequest };
          }>('/ai-agent/agent', {
            agent,
            message: text,
            conversationId,
          });
          if (response.conversationId) setConversationId(response.conversationId);
          setActiveAgent(response.agentType);
          if (response.data?.approvalRequired) {
            setPendingApproval(response.data.approvalRequired);
          }
          updateAssistant((message) => {
            message.content = response.message;
          });
          queryClient.invalidateQueries({ queryKey: ['ai-agent', 'quota'] });
          return;
        }

        for await (const chunk of apiClient.stream('/ai-agent/chat', {
          message: text,
          conversationId,
          stream: true,
        })) {
          try {
            const event: StreamEvent = JSON.parse(chunk);
            if (event.type === 'start' || event.type === 'agent_switch') {
              if (event.agent) setActiveAgent(event.agent);
              if (event.conversationId) setConversationId(event.conversationId);
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
            } else if (event.type === 'approval_required' && event.approval) {
              setPendingApproval(event.approval);
            } else if (event.type === 'error') {
              toast.error(event.error || t('errors.unknown'));
            }
          } catch {
            updateAssistant((message) => {
              message.content += chunk;
            });
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

  const resumeApproval = useCallback(async () => {
    if (!pendingApproval || approvalBusy) return;
    setApprovalBusy(true);
    setIsStreaming(true);
    try {
      await apiClient.post(
        `${API_ROUTES.AI_AGENT}/runs/${pendingApproval.runId}/approvals/${pendingApproval.approvalId}/approve`,
        {},
        { retries: 0 }
      );
      setPendingApproval(null);
      for await (const chunk of apiClient.stream(
        `${API_ROUTES.AI_AGENT}/runs/${pendingApproval.runId}/resume`,
        {}
      )) {
        const event: StreamEvent = JSON.parse(chunk);
        if (event.type === 'content' && event.content) {
          updateAssistant((message) => {
            message.content += event.content!;
          });
        } else if (event.type === 'approval_required' && event.approval) {
          setPendingApproval(event.approval);
        } else if (event.type === 'error') {
          toast.error(event.error || t('errors.unknown'));
        }
      }
    } catch (error) {
      setPendingApproval({ ...pendingApproval, status: 'APPROVED' });
      toast.error(error instanceof Error ? error.message : t('errors.unknown'));
    } finally {
      setApprovalBusy(false);
      setIsStreaming(false);
    }
  }, [approvalBusy, pendingApproval, t, toast, updateAssistant]);

  const rejectApproval = useCallback(async () => {
    if (!pendingApproval || approvalBusy) return;
    setApprovalBusy(true);
    try {
      await apiClient.post(
        `${API_ROUTES.AI_AGENT}/runs/${pendingApproval.runId}/approvals/${pendingApproval.approvalId}/reject`,
        {},
        { retries: 0 }
      );
      setPendingApproval(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.unknown'));
    } finally {
      setApprovalBusy(false);
    }
  }, [approvalBusy, pendingApproval, t, toast]);

  const cancelRun = useCallback(async () => {
    if (!pendingApproval || approvalBusy) return;
    setApprovalBusy(true);
    try {
      await apiClient.post(
        `${API_ROUTES.AI_AGENT}/runs/${pendingApproval.runId}/cancel`,
        {},
        { retries: 0 }
      );
      setPendingApproval(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.unknown'));
    } finally {
      setApprovalBusy(false);
    }
  }, [approvalBusy, pendingApproval, t, toast]);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setActiveAgent(undefined);
    setActiveTool(undefined);
    setPendingApproval(null);
  }, []);

  return {
    messages,
    setMessages,
    isStreaming,
    activeAgent,
    activeTool,
    pendingApproval,
    approvalBusy,
    resumeApproval,
    rejectApproval,
    cancelRun,
    sendMessage,
    resetConversation,
  };
}
