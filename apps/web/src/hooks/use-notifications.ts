'use client';

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChatSocket } from './use-chat-socket';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();

  // 处理新通知
  const handleNewNotification = useCallback(
    (notification: Notification) => {
      // 刷新通知列表和未读计数
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });

      // 显示toast提醒
      toast(notification.title, {
        description: notification.content,
        duration: 5000,
      });
    },
    [queryClient]
  );

  // 使用chat socket来接收通知
  const { isConnected } = useChatSocket({
    onNewMessage: () => {
      // 新消息也刷新通知
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // 监听notification事件
  useEffect(() => {
    // WebSocket通知已在useChatSocket中处理
    // 这里可以添加额外的通知逻辑
  }, []);

  return {
    isConnected,
  };
}
