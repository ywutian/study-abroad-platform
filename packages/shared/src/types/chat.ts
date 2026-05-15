// Chat & Social

export type ConversationKind = 'DIRECT' | 'MATCH_GROUP';

export interface ChatUserProfile {
  nickname?: string | null;
  avatarUrl?: string | null;
  realName?: string | null;
  currentSchool?: string | null;
  grade?: string | null;
  targetMajor?: string | null;
  bio?: string | null;
}

export interface ChatUser {
  id: string;
  email: string;
  role?: string;
  profile?: ChatUserProfile | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  isDeleted?: boolean;
  isRecalled?: boolean;
  isSystem?: boolean;
  recalledAt?: string | Date | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  sender?: ChatUser;
}

export interface ConversationParticipant {
  id: string;
  conversationId?: string;
  userId: string;
  isPinned?: boolean;
  lastReadAt?: string | Date | null;
  user?: ChatUser;
}

export interface ConversationSummary {
  id: string;
  kind: ConversationKind;
  title: string;
  createdBySystem?: boolean;
  otherUser?: ChatUser | null;
  participantCount: number;
  participantPreview: ChatUser[];
  avatarSummary: Array<string | null>;
  lastMessage?: Message | null;
  unreadCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  isPinned?: boolean;
  teamMatchId?: string | null;
}

export interface Conversation extends ConversationSummary {
  participants: ConversationParticipant[];
  messages: Message[];
  lastMessageAt: string | Date;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  follower?: ChatUser;
  following?: ChatUser;
  createdAt: string;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export type SocialRelationType = 'followers' | 'following' | 'blocked';
export type SocialRelationship = 'mutual' | 'oneWay' | 'blocked';
export type SocialRelationSort = 'recent' | 'name' | 'major';
export type SocialRelationshipFilter = 'all' | 'mutual' | 'oneWay';
export type SocialRoleFilter = 'all' | 'verified' | 'staff';
export type SocialBulkAction = 'follow' | 'unfollow' | 'block' | 'unblock';

export interface SocialUserStats {
  followers: number;
  following: number;
  cases: number;
}

export interface SocialUser extends ChatUser {
  profile?: ChatUserProfile | null;
  stats: SocialUserStats;
}

export interface SocialRelationItem {
  relationId: string;
  relationType: SocialRelationType;
  createdAt: string | Date;
  user: SocialUser;
  relationship: SocialRelationship;
}

export interface SocialOverview {
  counts: {
    followers: number;
    following: number;
    mutual: number;
    blocked: number;
  };
  recommendations: RecommendedSocialUser[];
}

export interface RecommendedSocialUser extends SocialUser {
  score: number;
  reasons: string[];
}

export interface SocialBulkResult {
  userId: string;
  success: boolean;
  error?: string;
}

export interface SocialBulkResponse {
  action: SocialBulkAction;
  results: SocialBulkResult[];
}
