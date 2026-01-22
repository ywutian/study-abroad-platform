'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  createdAt: string;
  isDeleted?: boolean;
  mediaUrl?: string;
  mediaType?: string;
  sender?: {
    id: string;
    email: string;
    profile?: {
      nickname?: string;
      avatarUrl?: string;
      realName?: string;
    };
  };
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface InfiniteMessagesData {
  pages: Message[][];
  pageParams: unknown[];
}

interface TypingUser {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

interface ReadReceipt {
  conversationId: string;
  userId: string;
  readAt: string;
}

interface UseChatSocketOptions {
  onNewMessage?: (message: Message) => void;
  onTyping?: (data: TypingUser) => void;
  onOnlineStatusChange?: (userId: string, isOnline: boolean) => void;
  onMessagesRead?: (data: ReadReceipt) => void;
  onMessageDeleted?: (data: { messageId: string; conversationId: string }) => void;
}

export function useChatSocket(options: UseChatSocketOptions = {}) {
  const t = useTranslations('chat');
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 用 ref 保存回调，避免 useEffect 依赖变化导致 socket 重连
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  // WebSocket 连接（只依赖 accessToken）
  useEffect(() => {
    if (!accessToken) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    socketRef.current = io(`${socketUrl}/chat`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connected', () => {
      setIsConnected(true);
    });

    // 新消息
    socket.on('newMessage', (data: { conversationId: string; message: Message }) => {
      // 更新消息列表缓存（useInfiniteQuery 结构: { pages: Message[][], pageParams }）
      queryClientRef.current.setQueryData(
        ['messages', data.conversationId],
        (old: InfiniteMessagesData | undefined) => {
          if (!old?.pages) return old;
          const lastPage = old.pages[0] || [];
          // 防重复
          if (lastPage.some((m) => m.id === data.message.id)) return old;
          // 新消息添加到第一页开头（第一页是最新的，DESC 排序）
          return {
            ...old,
            pages: [[data.message, ...lastPage], ...old.pages.slice(1)],
          };
        }
      );

      // 刷新会话列表
      queryClientRef.current.invalidateQueries({ queryKey: ['conversations'] });

      optionsRef.current.onNewMessage?.(data.message);
    });

    // 已读回执
    socket.on('messagesRead', (data: ReadReceipt) => {
      optionsRef.current.onMessagesRead?.(data);
    });

    // 消息删除
    socket.on('messageDeleted', (data: { messageId: string; conversationId: string }) => {
      // 更新消息列表缓存（useInfiniteQuery 结构）
      queryClientRef.current.setQueryData(
        ['messages', data.conversationId],
        (old: InfiniteMessagesData | undefined) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) => (m.id === data.messageId ? { ...m, isDeleted: true } : m))
            ),
          };
        }
      );
      optionsRef.current.onMessageDeleted?.(data);
    });

    // 输入状态
    socket.on('userTyping', (data: TypingUser) => {
      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(data.conversationId) || [];

        if (data.isTyping) {
          if (!current.includes(data.userId)) {
            newMap.set(data.conversationId, [...current, data.userId]);
          }
        } else {
          newMap.set(
            data.conversationId,
            current.filter((id) => id !== data.userId)
          );
        }
        return newMap;
      });

      optionsRef.current.onTyping?.(data);

      // 3 秒后自动清除 typing 状态
      const timeoutKey = `${data.conversationId}:${data.userId}`;
      if (typingTimeoutRef.current.has(timeoutKey)) {
        clearTimeout(typingTimeoutRef.current.get(timeoutKey));
      }
      if (data.isTyping) {
        typingTimeoutRef.current.set(
          timeoutKey,
          setTimeout(() => {
            setTypingUsers((prev) => {
              const newMap = new Map(prev);
              const c = newMap.get(data.conversationId) || [];
              newMap.set(
                data.conversationId,
                c.filter((id) => id !== data.userId)
              );
              return newMap;
            });
          }, 3000)
        );
      }
    });

    // 在线状态
    socket.on('userOnline', (userId: string) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
      optionsRef.current.onOnlineStatusChange?.(userId, true);
    });

    socket.on('userOffline', (userId: string) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      optionsRef.current.onOnlineStatusChange?.(userId, false);
    });

    socket.on('connect_error', () => {
      toast.error(t('socketError'));
    });

    return () => {
      socket.disconnect();
      typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutRef.current.clear();
    };
  }, [accessToken, t]);

  // 发送消息
  const sendMessage = useCallback(
    async (conversationId: string, content: string): Promise<Message | null> => {
      if (!socketRef.current?.connected) {
        toast.error(t('socketDisconnected'));
        return null;
      }

      return new Promise((resolve) => {
        socketRef.current?.emit(
          'sendMessage',
          { conversationId, content },
          (response: { success: boolean; message?: Message; error?: string }) => {
            if (response.success && response.message) {
              resolve(response.message);
            } else {
              // 区分过滤错误类型
              const errorMsg = response.error || t('sendFailed');
              toast.error(errorMsg);
              resolve(null);
            }
          }
        );
      });
    },
    [t]
  );

  // 加入会话房间
  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('joinConversation', { conversationId });
  }, []);

  // 标记已读
  const markRead = useCallback((conversationId: string) => {
    socketRef.current?.emit('markRead', { conversationId });
  }, []);

  // 发送 typing 状态
  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { conversationId, isTyping });
  }, []);

  // 获取正在输入的用户
  const getTypingUsers = useCallback(
    (conversationId: string): string[] => {
      return typingUsers.get(conversationId) || [];
    },
    [typingUsers]
  );

  // 检查用户是否在线
  const isUserOnline = useCallback(
    (userId: string): boolean => {
      return onlineUsers.has(userId);
    },
    [onlineUsers]
  );

  return {
    isConnected,
    sendMessage,
    joinConversation,
    markRead,
    sendTyping,
    getTypingUsers,
    isUserOnline,
    onlineUsers,
  };
}
