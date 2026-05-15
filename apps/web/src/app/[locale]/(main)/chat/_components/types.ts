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
  clientMessageId?: string;
  replyToId?: string;
  isDeleted?: boolean;
  isRecalled?: boolean;
  isSystem?: boolean;
  recalledAt?: string;
  mediaUrl?: string;
  mediaType?: string;
  attachments?: MessageAttachment[];
  replyTo?: {
    id: string;
    content: string;
    senderId: string;
    isDeleted?: boolean;
    isRecalled?: boolean;
  } | null;
  sender?: {
    id: string;
    email?: string;
    profile?: {
      nickname?: string;
      avatarUrl?: string;
      realName?: string;
    };
  };
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  error?: string;
}

export interface MessageAttachment {
  id: string;
  messageId?: string;
  url: string;
  type: 'image' | 'file' | string;
  name: string;
  size?: number | null;
  mimeType?: string | null;
  createdAt?: string;
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
    bio?: string;
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
  isArchived?: boolean;
  mutedUntil?: string | null;
  isMuted?: boolean;
}

export interface ReportTarget {
  targetType: 'USER' | 'MESSAGE';
  targetId: string;
}

export type ConversationFilter = 'all' | 'unread' | 'pinned' | 'direct' | 'groups' | 'archived';

export interface ChatContext {
  id: string;
  kind: Conversation['kind'];
  title?: string | null;
  createdBySystem?: boolean;
  teamMatch?: {
    id: string;
    matchKind?: string | null;
    status?: string | null;
    createdAt?: string;
  } | null;
  currentUserPreferences?: {
    isPinned?: boolean;
    isArchived?: boolean;
    mutedUntil?: string | null;
    lastReadAt?: string | null;
  };
  participants: Array<
    ChatUser & {
      lastReadAt?: string | null;
      isPinned?: boolean;
      isArchived?: boolean;
      mutedUntil?: string | null;
    }
  >;
  files: MessageAttachment[];
}
