import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 通知类型
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'system';

// 通知优先级
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// 通知实体
export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

// 通知创建参数
export interface CreateNotificationInput {
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  addNotification: (input: CreateNotificationInput) => string;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  clearRead: () => void;
}

// 生成唯一 ID
const generateId = () => `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (input) => {
        const id = generateId();
        const notification: Notification = {
          id,
          type: input.type,
          priority: input.priority || 'normal',
          title: input.title,
          message: input.message,
          timestamp: Date.now(),
          read: false,
          actionUrl: input.actionUrl,
          actionLabel: input.actionLabel,
          metadata: input.metadata,
        };

        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 100), // 保留最近100条
          unreadCount: state.unreadCount + 1,
        }));

        return id;
      },

      markAsRead: (id) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === id);
          if (!notification || notification.read) return state;

          return {
            notifications: state.notifications.map(n =>
              n.id === id ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      removeNotification: (id) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === id);
          const wasUnread = notification && !notification.read;

          return {
            notifications: state.notifications.filter(n => n.id !== id),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      clearRead: () => {
        set((state) => ({
          notifications: state.notifications.filter(n => !n.read),
        }));
      },
    }),
    {
      name: 'notifications-storage',
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 50), // 持久化最近50条
        unreadCount: state.unreadCount,
      }),
    }
  )
);

// 辅助函数：格式化时间
export function formatNotificationTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}



