'use client';

/**
 * 企业级对话历史 React Query Hooks
 *
 * 功能：
 * - 对话列表查询（优化 staleTime + 窗口聚焦刷新）
 * - 乐观添加 / 更新 / 删除对话缓存
 * - 缓存失效辅助工具
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ConversationSummary } from './types';

// ─── Query Key Factory ───────────────────────────────────────────────

export const chatHistoryKeys = {
  all: ['agent-chat'] as const,
  conversations: () => [...chatHistoryKeys.all, 'conversations'] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────

/**
 * 获取用户对话列表（按 updatedAt 降序）
 */
export function useConversationList() {
  return useQuery<ConversationSummary[]>({
    queryKey: chatHistoryKeys.conversations(),
    queryFn: async () => {
      const res = await apiClient.get<{ conversations: ConversationSummary[] }>(
        '/ai-agent/conversations'
      );
      return res.conversations ?? [];
    },
    staleTime: 5_000, // 5s 后标记为过期
    gcTime: 5 * 60_000, // 5 分钟后垃圾回收
    refetchOnWindowFocus: 'always', // 切回标签页立即刷新（忽略 staleTime）
    refetchOnReconnect: true, // 网络恢复时刷新
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

/**
 * 删除对话（乐观移除 + 失败回滚）
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiClient.delete(`/ai-agent/conversation`, {
        params: { conversationId },
      }),
    onMutate: async (conversationId) => {
      // 取消进行中的查询，防止覆盖乐观更新
      await queryClient.cancelQueries({ queryKey: chatHistoryKeys.conversations() });
      const previous = queryClient.getQueryData<ConversationSummary[]>(
        chatHistoryKeys.conversations()
      );
      // 乐观移除
      queryClient.setQueryData<ConversationSummary[]>(chatHistoryKeys.conversations(), (old = []) =>
        old.filter((c) => c.id !== conversationId)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      // 回滚
      if (context?.previous) {
        queryClient.setQueryData(chatHistoryKeys.conversations(), context.previous);
      }
    },
    onSettled: () => {
      // 最终与服务端同步
      queryClient.invalidateQueries({ queryKey: chatHistoryKeys.conversations() });
    },
  });
}

// ─── Cache Utilities ─────────────────────────────────────────────────

/**
 * 手动失效对话列表缓存。
 * 在 SSE done 事件等场景使用，触发后台重新获取。
 */
export function useInvalidateConversations() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: chatHistoryKeys.conversations() }),
    [queryClient]
  );
}

/**
 * 乐观添加新对话到列表缓存（SSE start 事件驱动）。
 * 避免重复 ID，新对话置顶。
 */
export function useOptimisticAddConversation() {
  const queryClient = useQueryClient();
  return useCallback(
    (conversation: Partial<ConversationSummary> & { id: string }) => {
      queryClient.setQueryData<ConversationSummary[]>(
        chatHistoryKeys.conversations(),
        (old = []) => {
          if (old.some((c) => c.id === conversation.id)) return old;
          const now = new Date().toISOString();
          const entry: ConversationSummary = {
            messageCount: 1,
            createdAt: now,
            updatedAt: now,
            ...conversation,
          };
          return [entry, ...old];
        }
      );
    },
    [queryClient]
  );
}

/**
 * 乐观更新缓存中某个对话的字段（SSE done 事件驱动）。
 */
export function useOptimisticUpdateConversation() {
  const queryClient = useQueryClient();
  return useCallback(
    (conversationId: string, updates: Partial<ConversationSummary>) => {
      queryClient.setQueryData<ConversationSummary[]>(chatHistoryKeys.conversations(), (old = []) =>
        old.map((c) => (c.id === conversationId ? { ...c, ...updates } : c))
      );
    },
    [queryClient]
  );
}
