/**
 * P2P 聊天类型定义
 */

export interface Message {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
  isRecalled?: boolean;
  isSystem?: boolean;
  recalledAt?: string;
  mediaUrl?: string;
  mediaType?: string;
  sender?: {
    id: string;
    email?: string;
    profile?: {
      nickname?: string;
      avatarUrl?: string;
      realName?: string;
    };
  };
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface ChatUser {
  id: string;
  email?: string;
  role?: string;
  profile?: {
    nickname?: string;
    realName?: string;
    avatarUrl?: string;
    currentSchool?: string;
    grade?: string;
    targetMajor?: string;
  };
}

export interface Conversation {
  id: string;
  kind: 'DIRECT' | 'MATCH_GROUP';
  title: string;
  createdBySystem?: boolean;
  otherUser: ChatUser | null;
  participantCount: number;
  participantPreview: ChatUser[];
  avatarSummary: Array<string | null>;
  teamMatchId?: string | null;
  lastMessage?: Message;
  unreadCount: number;
  createdAt?: string;
  updatedAt: string;
  isPinned?: boolean;
}

export interface ReportTarget {
  targetType: 'USER' | 'MESSAGE';
  targetId: string;
}
