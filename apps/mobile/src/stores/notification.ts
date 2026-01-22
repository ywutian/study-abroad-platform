import { create } from 'zustand';

interface NotificationState {
  unreadCount: number;

  // Actions
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
  resetUnread: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,

  setUnreadCount: (count: number) => set({ unreadCount: Math.max(0, count) }),

  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),

  decrementUnread: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),

  resetUnread: () => set({ unreadCount: 0 }),
}));
