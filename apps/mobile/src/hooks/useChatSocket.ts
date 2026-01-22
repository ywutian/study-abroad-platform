/**
 * WebSocket hook for mobile chat
 *
 * Replaces the 5-second polling pattern in chat/[id].tsx with a real-time
 * Socket.IO connection. Mirrors the web implementation at
 * apps/web/src/hooks/use-chat-socket.ts but adapted for React Native.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/lib/storage/secure-store';
import type { Message, Conversation } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface Notification {
  id: string;
  type: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UseChatSocketOptions {
  onNewMessage?: (message: Message) => void;
  onTyping?: (data: TypingUser) => void;
  onOnlineStatusChange?: (userId: string, isOnline: boolean) => void;
  onMessagesRead?: (data: ReadReceipt) => void;
  onMessageDeleted?: (data: { messageId: string; conversationId: string }) => void;
  onNotification?: (data: Notification) => void;
  onError?: (error: string) => void;
}

export interface UseChatSocketReturn {
  isConnected: boolean;
  onlineUsers: Set<string>;
  sendMessage: (conversationId: string, content: string) => Promise<Message | null>;
  joinConversation: (conversationId: string) => void;
  markRead: (conversationId: string) => void;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  getTypingUsers: (conversationId: string) => string[];
  isUserOnline: (userId: string) => boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';
const TYPING_TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatSocket(options: UseChatSocketOptions = {}): UseChatSocketReturn {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());
  const typingTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Keep callbacks and queryClient in refs so the socket effect does not
  // re-run when they change (mirrors the web approach).
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const queryClientRef = useRef<QueryClient>(queryClient);
  queryClientRef.current = queryClient;

  // Track whether the component is still mounted to avoid state updates
  // after unmount (the socket events fire asynchronously).
  const mountedRef = useRef(true);

  // -----------------------------------------------------------------------
  // Socket connection — depends only on accessToken availability
  // -----------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    let socket: Socket | null = null;

    async function connect() {
      const token = await getAccessToken();
      if (!token || !mountedRef.current) return;

      socket = io(`${SOCKET_URL}/chat`, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });

      socketRef.current = socket;

      // --- Transport events ---

      socket.on('connect', () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
      });

      socket.on('connected', () => {
        setIsConnected(true);
      });

      socket.on('connect_error', (err: Error) => {
        console.warn('[ChatSocket] Connection error:', err.message);
        optionsRef.current.onError?.(err.message);
      });

      // --- New message ---

      socket.on('newMessage', (data: { conversationId: string; message: Message }) => {
        // Update the conversation cache (mobile uses a flat query, not infinite)
        queryClientRef.current.setQueryData<Conversation>(
          ['conversation', data.conversationId],
          (old) => {
            if (!old) return old;
            // Prevent duplicates
            if (old.messages.some((m) => m.id === data.message.id)) return old;
            return {
              ...old,
              messages: [...old.messages, data.message],
              lastMessageAt: data.message.createdAt,
            };
          }
        );

        // Refresh the conversation list so last-message preview updates
        queryClientRef.current.invalidateQueries({
          queryKey: ['conversations'],
        });

        optionsRef.current.onNewMessage?.(data.message);
      });

      // --- Read receipts ---

      socket.on('messagesRead', (data: ReadReceipt) => {
        // Mark all messages in the conversation as read for the given user
        queryClientRef.current.setQueryData<Conversation>(
          ['conversation', data.conversationId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.map((m) =>
                m.senderId !== data.userId ? { ...m, read: true } : m
              ),
            };
          }
        );
        optionsRef.current.onMessagesRead?.(data);
      });

      // --- Message deleted ---

      socket.on('messageDeleted', (data: { messageId: string; conversationId: string }) => {
        queryClientRef.current.setQueryData<Conversation>(
          ['conversation', data.conversationId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.filter((m) => m.id !== data.messageId),
            };
          }
        );
        optionsRef.current.onMessageDeleted?.(data);
      });

      // --- Typing indicators ---

      socket.on('userTyping', (data: TypingUser) => {
        if (!mountedRef.current) return;

        setTypingUsers((prev) => {
          const next = new Map(prev);
          const current = next.get(data.conversationId) || [];

          if (data.isTyping) {
            if (!current.includes(data.userId)) {
              next.set(data.conversationId, [...current, data.userId]);
            }
          } else {
            next.set(
              data.conversationId,
              current.filter((id) => id !== data.userId)
            );
          }
          return next;
        });

        optionsRef.current.onTyping?.(data);

        // Auto-clear typing status after TYPING_TIMEOUT_MS
        const timeoutKey = `${data.conversationId}:${data.userId}`;
        const existingTimeout = typingTimeoutRef.current.get(timeoutKey);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        if (data.isTyping) {
          typingTimeoutRef.current.set(
            timeoutKey,
            setTimeout(() => {
              if (!mountedRef.current) return;
              setTypingUsers((prev) => {
                const next = new Map(prev);
                const c = next.get(data.conversationId) || [];
                next.set(
                  data.conversationId,
                  c.filter((id) => id !== data.userId)
                );
                return next;
              });
              typingTimeoutRef.current.delete(timeoutKey);
            }, TYPING_TIMEOUT_MS)
          );
        }
      });

      // --- Online / Offline ---

      socket.on('userOnline', (userId: string) => {
        if (!mountedRef.current) return;
        setOnlineUsers((prev) => new Set([...prev, userId]));
        optionsRef.current.onOnlineStatusChange?.(userId, true);
      });

      socket.on('userOffline', (userId: string) => {
        if (!mountedRef.current) return;
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        optionsRef.current.onOnlineStatusChange?.(userId, false);
      });

      // --- Notifications ---

      socket.on('notification', (data: Notification) => {
        optionsRef.current.onNotification?.(data);
      });
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (socket) {
        socket.disconnect();
      }
      socketRef.current = null;

      // Clean up all typing timeouts
      typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutRef.current.clear();
    };
  }, []); // Intentionally no deps — token is fetched async inside

  // -----------------------------------------------------------------------
  // AppState handling — disconnect in background, reconnect in foreground
  // -----------------------------------------------------------------------

  useEffect(() => {
    const appStateRef = { current: AppState.currentState };

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      const isNowActive = nextAppState === 'active';
      const wasActive = appStateRef.current === 'active';
      const isNowBackground = nextAppState.match(/inactive|background/);

      if (wasBackground && isNowActive) {
        // App came to foreground — reconnect if disconnected
        const socket = socketRef.current;
        if (socket && socket.disconnected) {
          socket.connect();
        }
      } else if (wasActive && isNowBackground) {
        // App went to background — disconnect to save resources
        const socket = socketRef.current;
        if (socket && socket.connected) {
          socket.disconnect();
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const sendMessage = useCallback(
    async (conversationId: string, content: string): Promise<Message | null> => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        const errorMsg = 'Socket not connected';
        console.warn('[ChatSocket]', errorMsg);
        optionsRef.current.onError?.(errorMsg);
        return null;
      }

      return new Promise((resolve) => {
        socket.emit(
          'sendMessage',
          { conversationId, content },
          (response: { success: boolean; message?: Message; error?: string }) => {
            if (response.success && response.message) {
              resolve(response.message);
            } else {
              const errorMsg = response.error || 'Failed to send message';
              console.warn('[ChatSocket]', errorMsg);
              optionsRef.current.onError?.(errorMsg);
              resolve(null);
            }
          }
        );
      });
    },
    []
  );

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('joinConversation', { conversationId });
  }, []);

  const markRead = useCallback((conversationId: string) => {
    socketRef.current?.emit('markRead', { conversationId });
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { conversationId, isTyping });
  }, []);

  const getTypingUsers = useCallback(
    (conversationId: string): string[] => {
      return typingUsers.get(conversationId) || [];
    },
    [typingUsers]
  );

  const isUserOnline = useCallback(
    (userId: string): boolean => {
      return onlineUsers.has(userId);
    },
    [onlineUsers]
  );

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    isConnected,
    onlineUsers,
    sendMessage,
    joinConversation,
    markRead,
    sendTyping,
    getTypingUsers,
    isUserOnline,
  };
}
