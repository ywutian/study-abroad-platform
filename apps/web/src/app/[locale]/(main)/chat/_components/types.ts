/**
 * P2P 聊天类型定义
 */

export interface Message {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  createdAt: string;
  isDeleted?: boolean;
  isRecalled?: boolean;
  recalledAt?: string;
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

export interface Conversation {
  id: string;
  otherUser: {
    id: string;
    email: string;
    role?: string;
    profile?: {
      nickname?: string;
      realName?: string;
      avatarUrl?: string;
    };
  } | null;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
  isPinned?: boolean;
}

export interface ReportTarget {
  targetType: 'USER' | 'MESSAGE';
  targetId: string;
}
