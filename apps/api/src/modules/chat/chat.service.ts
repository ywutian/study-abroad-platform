import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageFilterService } from './message-filter.service';
import {
  StorageService,
  StorageFile,
} from '../../common/storage/storage.service';
import {
  Prisma,
  DataReviewStatus,
  ConversationKind,
  Role,
} from '@prisma/client';
import {
  createPaginatedResponse,
  type PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import type {
  RecommendedSocialUser,
  SocialBulkAction,
  SocialBulkResponse,
  SocialOverview,
  SocialRelationItem,
  SocialRelationSort,
  SocialRelationType,
  SocialRelationship,
  SocialRelationshipFilter,
  SocialRoleFilter,
  SocialUser,
} from '@study-abroad/shared';
import type { SocialBulkDto, SocialRelationsQueryDto } from './dto/social.dto';

/** 用户信息的标准 select（复用） */
const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  profile: {
    select: { nickname: true, avatarUrl: true, realName: true },
  },
} as const;

/** 消息中发送者的标准 select — email intentionally excluded for privacy */
const SENDER_SELECT = {
  id: true,
  profile: {
    select: { nickname: true, avatarUrl: true, realName: true },
  },
} as const;

type ConversationListFilter =
  'all' | 'unread' | 'pinned' | 'direct' | 'groups' | 'archived';

interface ConversationListOptions {
  q?: string;
  filter?: ConversationListFilter;
  limit?: number;
  cursor?: string;
}

interface SendMessageOptions {
  clientMessageId?: string;
  replyToId?: string;
}

interface SendMediaMessageOptions extends SendMessageOptions {
  content?: string;
}

const MESSAGE_INCLUDE = {
  sender: { select: SENDER_SELECT },
  attachments: true,
  replyTo: {
    select: {
      id: true,
      content: true,
      senderId: true,
      isDeleted: true,
      isRecalled: true,
    },
  },
} as const;

const SOCIAL_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  profile: {
    select: {
      nickname: true,
      avatarUrl: true,
      bio: true,
      targetMajor: true,
      grade: true,
      visibility: true,
    },
  },
  _count: {
    select: {
      followers: true,
      following: true,
      admissionCases: {
        where: {
          reviewStatus: {
            in: [DataReviewStatus.AUTO_APPROVED, DataReviewStatus.APPROVED],
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type SocialPrismaUser = Prisma.UserGetPayload<{
  select: typeof SOCIAL_USER_SELECT;
}>;

type SocialFollowRelation = Prisma.FollowGetPayload<{
  include: {
    follower: { select: typeof SOCIAL_USER_SELECT };
    following: { select: typeof SOCIAL_USER_SELECT };
  };
}>;

const SOCIAL_RECOMMENDATION_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  profile: {
    select: {
      nickname: true,
      avatarUrl: true,
      bio: true,
      targetMajor: true,
      grade: true,
      gpa: true,
      visibility: true,
      _count: {
        select: { testScores: true, activities: true, awards: true },
      },
    },
  },
  _count: {
    select: {
      followers: true,
      following: true,
      admissionCases: {
        where: {
          reviewStatus: {
            in: [DataReviewStatus.AUTO_APPROVED, DataReviewStatus.APPROVED],
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type SocialRecommendationPrismaUser = Prisma.UserGetPayload<{
  select: typeof SOCIAL_RECOMMENDATION_USER_SELECT;
}>;

/**
 * 2026-05 chat PII fix: domains that mark a User row as an internal
 * system account (e.g. seeded by scripts for case-attribution, match
 * notifications, etc). These users must NEVER appear as real
 * participants in any chat surface exposed to end-users.
 *
 * Production audit found `system@studyabroad.internal` rendering in
 * the conversation members panel — a real PII / trust regression.
 */
const SYSTEM_USER_EMAIL_DOMAINS = ['@studyabroad.internal'];

// Exported for unit tests — runtime callers should stay within this file.
export function isSystemUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SYSTEM_USER_EMAIL_DOMAINS.some((suffix) =>
    email.toLowerCase().endsWith(suffix),
  );
}

/**
 * Mask an email so it can't be used as a PII vector when shown to
 * OTHER chat participants.
 *
 * Strategy (revised 2026-05 after first version was too aggressive —
 * users complained the masked names looked "truncated and useless"):
 *
 *   Keep the FULL local part visible (it's effectively a username and
 *   the user already typed it as their public-ish handle). Mask the
 *   DOMAIN, which is the privacy-sensitive bit — corporate domains
 *   leak employer; school domains leak affiliation.
 *
 *     oliviawu@demo.studyabroad.com → oliviawu@***.com
 *     student42@stanford.edu        → student42@***.edu
 *
 * The frontend's `getDisplayName` falls back to the email LOCAL PART
 * (text before `@`) when no nickname/realName is set — so chat members
 * appear as `oliviawu` rather than the unidentifiable `o***`.
 *
 * Returns null when the input has no `@` or no TLD — caller falls back
 * to "成员".
 */
export function maskEmailForPeer(
  email: string | null | undefined,
): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const lastDot = domain.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const tld = domain.slice(lastDot);
  return `${local}@***${tld}`;
}

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private messageFilter: MessageFilterService,
    private storageService: StorageService,
  ) {}

  // ============================================
  // 互关 / 屏蔽检查
  // ============================================

  /**
   * Check whether two users mutually follow each other (bidirectional).
   *
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @returns `true` if both users follow each other
   */
  async checkMutualFollow(userId1: string, userId2: string): Promise<boolean> {
    const [follow1, follow2] = await Promise.all([
      this.prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: userId1, followingId: userId2 },
        },
      }),
      this.prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: userId2, followingId: userId1 },
        },
      }),
    ]);
    return !!follow1 && !!follow2;
  }

  /**
   * Check if a user has blocked another user.
   *
   * @param blockerId - ID of the user who may have blocked
   * @param blockedId - ID of the potentially blocked user
   * @returns `true` if blockerId has blocked blockedId
   */
  async checkBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    return !!block;
  }

  // ============================================
  // 会话管理
  // ============================================

  /**
   * 获取或创建会话
   * 权限：VERIFIED / ADMIN 可发起，USER 只能回复已有会话
   */
  async getOrCreateConversation(initiatorId: string, targetId: string) {
    if (initiatorId === targetId) {
      throw new BadRequestException('Cannot start conversation with yourself');
    }

    // 权限检查：仅 VERIFIED / ADMIN 可发起
    const initiator = await this.prisma.user.findUnique({
      where: { id: initiatorId },
      select: { role: true },
    });
    if (initiator?.role === 'USER') {
      throw new ForbiddenException(
        'Only verified users can initiate conversations',
      );
    }

    // 互关检查
    const isMutual = await this.checkMutualFollow(initiatorId, targetId);
    if (!isMutual) {
      throw new ForbiddenException(
        'Mutual follow required to start a conversation',
      );
    }

    // 双向屏蔽检查
    const [blocked1, blocked2] = await Promise.all([
      this.checkBlocked(initiatorId, targetId),
      this.checkBlocked(targetId, initiatorId),
    ]);
    if (blocked1 || blocked2) {
      throw new ForbiddenException('Cannot message this user');
    }

    // 查找已有会话（精确匹配：恰好包含这两个参与者）
    const existing = await this.prisma.conversation.findFirst({
      where: {
        kind: ConversationKind.DIRECT,
        AND: [
          { participants: { some: { userId: initiatorId } } },
          { participants: { some: { userId: targetId } } },
        ],
      },
      include: {
        participants: { include: { user: { select: USER_SELECT } } },
      },
    });

    if (existing && existing.participants.length === 2) {
      return existing;
    }

    // 创建新会话
    return this.prisma.conversation.create({
      data: {
        kind: ConversationKind.DIRECT,
        participants: {
          create: [{ userId: initiatorId }, { userId: targetId }],
        },
      },
      include: {
        participants: { include: { user: { select: USER_SELECT } } },
      },
    });
  }

  // ============================================
  // 消息
  // ============================================

  /**
   * 发送消息（含内容过滤）
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    options: SendMessageOptions = {},
  ) {
    // 验证参与者
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const normalizedClientMessageId = options.clientMessageId?.trim();
    if (normalizedClientMessageId) {
      const existing = await this.prisma.message.findFirst({
        where: { senderId, clientMessageId: normalizedClientMessageId },
        include: MESSAGE_INCLUDE,
      });
      if (existing) return existing;
    }

    // 屏蔽检查
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        kind: true,
        participants: {
          where: { userId: { not: senderId } },
          select: { userId: true },
        },
      },
    });
    const otherParticipant =
      conversation?.kind === ConversationKind.DIRECT
        ? conversation.participants[0]
        : null;
    if (otherParticipant) {
      const blocked = await this.checkBlocked(
        otherParticipant.userId,
        senderId,
      );
      if (blocked) {
        throw new ForbiddenException('Cannot message this user');
      }
    }

    // 内容过滤（频率 + 重复 + 敏感词）
    const filterResult = await this.messageFilter.validate(senderId, content);
    if (!filterResult.allowed) {
      throw new BadRequestException(filterResult.reason);
    }

    if (options.replyToId) {
      const replyTarget = await this.prisma.message.findFirst({
        where: { id: options.replyToId, conversationId },
        select: { id: true },
      });
      if (!replyTarget) {
        throw new BadRequestException('Reply target not found');
      }
    }

    // 创建消息
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: filterResult.filtered,
        clientMessageId: normalizedClientMessageId || undefined,
        replyToId: options.replyToId || undefined,
        isSystem: false,
      },
      include: MESSAGE_INCLUDE,
    });

    // 更新会话时间戳
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  /**
   * 上传聊天文件并创建消息
   */
  async sendMediaMessage(
    conversationId: string,
    senderId: string,
    file: StorageFile,
    options: SendMediaMessageOptions | string = {},
  ) {
    const normalizedOptions =
      typeof options === 'string' ? { content: options } : options;

    // 验证参与者
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const normalizedClientMessageId = normalizedOptions.clientMessageId?.trim();
    if (normalizedClientMessageId) {
      const existing = await this.prisma.message.findFirst({
        where: { senderId, clientMessageId: normalizedClientMessageId },
        include: MESSAGE_INCLUDE,
      });
      if (existing) return existing;
    }

    if (normalizedOptions.replyToId) {
      const replyTarget = await this.prisma.message.findFirst({
        where: { id: normalizedOptions.replyToId, conversationId },
        select: { id: true },
      });
      if (!replyTarget) {
        throw new BadRequestException('Reply target not found');
      }
    }

    // 上传文件
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const mediaType = imageExts.includes(ext) ? 'image' : 'file';

    const uploadResult = await this.storageService.uploadVerificationFile(
      `chat/${conversationId}`,
      file,
    );

    // 创建消息
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: normalizedOptions.content || file.originalname,
        clientMessageId: normalizedClientMessageId || undefined,
        replyToId: normalizedOptions.replyToId || undefined,
        mediaUrl: uploadResult.url,
        mediaType,
        attachments: {
          create: {
            url: uploadResult.url,
            type: mediaType,
            name: file.originalname,
            size: file.buffer.length,
            mimeType: file.mimetype,
          },
        },
      },
      include: MESSAGE_INCLUDE,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  /**
   * 获取用户的会话列表（含未读数）
   */
  async getConversations(
    userId: string,
    options: ConversationListOptions = {},
  ) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: USER_SELECT } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: MESSAGE_INCLUDE,
            },
            teamMatch: {
              select: { id: true },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    if (participations.length === 0) return [];

    // 批量查询未读数
    const conversationIds = participations.map((p) => p.conversationId);

    const unreadCounts = await this.prisma.$queryRaw<
      { conversationId: string; count: bigint }[]
    >`
      SELECT
        "conversationId",
        COUNT(*) as count
      FROM "Message"
      WHERE
        "conversationId" IN (${Prisma.join(conversationIds)})
        AND "senderId" != ${userId}
        AND "createdAt" > (
          SELECT COALESCE("lastReadAt", '1970-01-01'::timestamp)
          FROM "ConversationParticipant"
          WHERE "conversationId" = "Message"."conversationId"
            AND "userId" = ${userId}
        )
      GROUP BY "conversationId"
    `;

    const unreadMap = new Map(
      unreadCounts.map((u) => [u.conversationId, Number(u.count)]),
    );

    const filter = options.filter ?? 'all';
    const query = options.q?.trim().toLowerCase();

    const summaries = participations
      .map((p) =>
        this.serializeConversationSummary(
          p.conversation,
          userId,
          unreadMap.get(p.conversationId) || 0,
          {
            isPinned: p.isPinned,
            isArchived: p.isArchived,
            mutedUntil: p.mutedUntil,
          },
        ),
      )
      .filter((conversation) => {
        if (filter === 'archived') return conversation.isArchived;
        if (conversation.isArchived) return false;
        if (filter === 'unread') return conversation.unreadCount > 0;
        if (filter === 'pinned') return conversation.isPinned;
        if (filter === 'direct') {
          return conversation.kind === ConversationKind.DIRECT;
        }
        if (filter === 'groups') {
          return conversation.kind === ConversationKind.MATCH_GROUP;
        }
        return true;
      })
      .filter((conversation) => {
        if (!query) return true;
        const haystack = [
          conversation.title,
          conversation.otherUser?.email,
          conversation.otherUser?.profile?.nickname,
          conversation.otherUser?.profile?.realName,
          conversation.lastMessage?.content,
          ...conversation.participantPreview.map(
            (participant) =>
              participant.email ||
              participant.profile?.nickname ||
              participant.profile?.realName ||
              '',
          ),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });

    const cursorIndex = options.cursor
      ? summaries.findIndex(
          (conversation) => conversation.id === options.cursor,
        )
      : -1;
    const start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    const limit = Math.min(options.limit ?? 50, 100);

    return summaries.slice(start, start + limit);
  }

  async getConversation(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const [conversation, unread] = await Promise.all([
      this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            include: {
              user: { select: USER_SELECT },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: MESSAGE_INCLUDE,
          },
          teamMatch: {
            select: { id: true },
          },
        },
      }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Message" m
        INNER JOIN "ConversationParticipant" cp
          ON cp."conversationId" = m."conversationId" AND cp."userId" = ${userId}
        WHERE m."conversationId" = ${conversationId}
          AND m."senderId" != ${userId}
          AND m."createdAt" > COALESCE(cp."lastReadAt", '1970-01-01'::timestamp)
      `,
    ]);

    if (!conversation) {
      throw new BadRequestException('Conversation not found');
    }

    const summary = this.serializeConversationSummary(
      conversation,
      userId,
      Number(unread[0]?.count ?? 0),
      {
        isPinned: participant.isPinned,
        isArchived: participant.isArchived,
        mutedUntil: participant.mutedUntil,
      },
    );

    // Messages were fetched in desc order (for LIMIT), reverse to asc for display
    const messages = [...conversation.messages].reverse();

    return {
      ...summary,
      participants: conversation.participants,
      messages,
      lastMessageAt:
        messages[messages.length - 1]?.createdAt ?? conversation.updatedAt,
    };
  }

  async createMatchGroupConversation(params: {
    title: string;
    participantIds: string[];
    systemSenderId: string;
    initialMessage: string;
  }) {
    const participantIds = Array.from(new Set(params.participantIds));
    if (participantIds.length < 2) {
      throw new BadRequestException(
        'Match group conversation requires at least two participants',
      );
    }

    return this.prisma.conversation.create({
      data: {
        kind: ConversationKind.MATCH_GROUP,
        title: params.title,
        createdBySystem: true,
        participants: {
          create: participantIds.map((userId) => ({ userId })),
        },
        messages: {
          create: {
            senderId: params.systemSenderId,
            content: params.initialMessage,
            isSystem: true,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: { select: USER_SELECT },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: MESSAGE_INCLUDE,
        },
        teamMatch: {
          select: { id: true },
        },
      },
    });
  }

  /**
   * 获取会话消息（分页）
   */
  async getMessages(
    conversationId: string,
    userId: string,
    limit = 50,
    before?: string,
  ) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const where: Prisma.MessageWhereInput = { conversationId };

    if (before) {
      const beforeMessage = await this.prisma.message.findUnique({
        where: { id: before },
      });
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: MESSAGE_INCLUDE,
    });
  }

  async getConversationContext(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                profile: {
                  select: {
                    nickname: true,
                    avatarUrl: true,
                    realName: true,
                    bio: true,
                    targetMajor: true,
                    currentSchool: true,
                    grade: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          where: {
            OR: [{ mediaUrl: { not: null } }, { attachments: { some: {} } }],
          },
          orderBy: { createdAt: 'desc' },
          take: 24,
          include: {
            sender: { select: SENDER_SELECT },
            attachments: true,
          },
        },
        teamMatch: {
          select: {
            id: true,
            matchKind: true,
            closedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new BadRequestException('Conversation not found');
    }

    const files = conversation.messages.flatMap((message) => {
      const attachments = message.attachments.length
        ? message.attachments
        : message.mediaUrl
          ? [
              {
                id: message.id,
                url: message.mediaUrl,
                type: message.mediaType || 'file',
                name: message.content,
                size: null,
                mimeType: null,
                createdAt: message.createdAt,
              },
            ]
          : [];

      return attachments.map((attachment) => ({
        id: attachment.id,
        messageId: message.id,
        url: attachment.url,
        type: attachment.type,
        name: attachment.name,
        size: attachment.size,
        mimeType: attachment.mimeType,
        createdAt: attachment.createdAt,
        sender: message.sender,
      }));
    });

    return {
      id: conversation.id,
      kind: conversation.kind,
      title: conversation.title,
      createdBySystem: conversation.createdBySystem,
      teamMatch: conversation.teamMatch
        ? {
            id: conversation.teamMatch.id,
            matchKind: conversation.teamMatch.matchKind,
            status: conversation.teamMatch.closedAt ? 'CLOSED' : 'ACTIVE',
            createdAt: conversation.teamMatch.createdAt,
          }
        : null,
      currentUserPreferences: {
        isPinned: participant.isPinned,
        isArchived: participant.isArchived,
        mutedUntil: participant.mutedUntil,
        lastReadAt: participant.lastReadAt,
      },
      // 2026-05 chat PII fix:
      // 1. Filter out system users (`@studyabroad.internal` etc) — they
      //    are not real chat members and must never appear in the UI.
      // 2. Mask peer emails (`oliviawu@demo... → o***@d***.com`) so a
      //    group-chat member can't harvest other members' raw inboxes.
      //    The current user sees their own email unmasked.
      participants: conversation.participants
        .filter((item) => !isSystemUserEmail(item.user.email))
        .map((item) => ({
          id: item.user.id,
          email:
            item.user.id === userId
              ? item.user.email
              : (maskEmailForPeer(item.user.email) ?? undefined),
          role: item.user.role,
          profile: item.user.profile,
          lastReadAt: item.lastReadAt,
          isPinned: item.isPinned,
          isArchived: item.isArchived,
          mutedUntil: item.mutedUntil,
        })),
      files,
    };
  }

  /**
   * 标记已读，返回 lastReadAt
   */
  async markAsRead(conversationId: string, userId: string) {
    const now = new Date();
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: now },
    });
    return { lastReadAt: now };
  }

  /**
   * 软删除消息（仅发送者可操作）
   */
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new BadRequestException('Message not found');
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException('Can only delete your own messages');
    }
    await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true },
    });
    return { messageId, conversationId: message.conversationId };
  }

  /**
   * 撤回消息（仅发送者可操作，2 分钟内）
   */
  async recallMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new BadRequestException('Message not found');
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException('Can only recall your own messages');
    }
    if (message.isDeleted || message.isRecalled) {
      throw new BadRequestException('Message already deleted or recalled');
    }
    const diffMs = Date.now() - new Date(message.createdAt).getTime();
    if (diffMs > 2 * 60 * 1000) {
      throw new BadRequestException('Recall window expired (2 minutes)');
    }
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isRecalled: true,
        recalledAt: new Date(),
        content: '',
        mediaUrl: null,
        mediaType: null,
      },
    });
    return { messageId, conversationId: message.conversationId };
  }

  /**
   * 获取用户所有会话的总未读数
   */
  async getTotalUnreadCount(userId: string) {
    const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Message" m
      INNER JOIN "ConversationParticipant" cp
        ON cp."conversationId" = m."conversationId" AND cp."userId" = ${userId}
      WHERE m."senderId" != ${userId}
        AND m."createdAt" > COALESCE(cp."lastReadAt", '1970-01-01'::timestamp)
    `;
    return { count: Number(result[0]?.count ?? 0) };
  }

  /**
   * 切换会话置顶
   */
  async togglePin(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }
    const updated = await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isPinned: !participant.isPinned },
    });
    return { isPinned: updated.isPinned };
  }

  async updateConversationPreferences(
    conversationId: string,
    userId: string,
    preferences: {
      isPinned?: boolean;
      isArchived?: boolean;
      mutedUntil?: string | null;
    },
  ) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const data: Prisma.ConversationParticipantUpdateInput = {};
    if (typeof preferences.isPinned === 'boolean') {
      data.isPinned = preferences.isPinned;
    }
    if (typeof preferences.isArchived === 'boolean') {
      data.isArchived = preferences.isArchived;
    }
    if (preferences.mutedUntil !== undefined) {
      data.mutedUntil = preferences.mutedUntil
        ? new Date(preferences.mutedUntil)
        : null;
    }

    const updated = await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data,
    });

    return {
      isPinned: updated.isPinned,
      isArchived: updated.isArchived,
      mutedUntil: updated.mutedUntil,
    };
  }

  private serializeConversationSummary(
    conversation: {
      id: string;
      kind: ConversationKind;
      title: string | null;
      createdBySystem: boolean;
      createdAt: Date;
      updatedAt: Date;
      participants: Array<{
        id: string;
        userId: string;
        user: Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;
      }>;
      messages: Array<
        Prisma.MessageGetPayload<{
          include: typeof MESSAGE_INCLUDE;
        }>
      >;
      teamMatch?: { id: string } | null;
    },
    currentUserId: string,
    unreadCount: number,
    preferences: {
      isPinned: boolean;
      isArchived?: boolean;
      mutedUntil?: Date | null;
    },
  ) {
    // 2026-05 chat PII fix: system users (e.g. system@studyabroad.internal)
    // must NOT appear as participants in any user-facing surface. Filter
    // them out before deriving "other participants" so they don't leak
    // into the conversation list, title, avatar summary, OR preview.
    const visibleParticipants = conversation.participants.filter(
      (participant) => !isSystemUserEmail(participant.user.email),
    );
    const otherParticipants = visibleParticipants.filter(
      (participant) => participant.userId !== currentUserId,
    );
    const otherUser =
      conversation.kind === ConversationKind.DIRECT
        ? (otherParticipants[0]?.user ?? null)
        : null;
    const derivedTitle =
      conversation.kind === ConversationKind.MATCH_GROUP
        ? conversation.title ||
          otherParticipants
            .map((participant) => this.getDisplayName(participant.user))
            .join(', ')
        : otherUser
          ? this.getDisplayName(otherUser)
          : conversation.title || 'Conversation';

    return {
      id: conversation.id,
      kind: conversation.kind,
      title: derivedTitle,
      createdBySystem: conversation.createdBySystem,
      otherUser,
      // Use the filtered list — system users would otherwise inflate
      // the count and break "X位成员" copy across the UI.
      participantCount: visibleParticipants.length,
      participantPreview: otherParticipants.slice(0, 3).map((participant) => ({
        id: participant.user.id,
        // Mask peer emails so the conversation-list preview also
        // doesn't leak raw inboxes.
        email: maskEmailForPeer(participant.user.email) ?? undefined,
        role: participant.user.role,
        profile: participant.user.profile,
      })),
      avatarSummary: otherParticipants
        .slice(0, 3)
        .map((participant) => participant.user.profile?.avatarUrl ?? null),
      lastMessage: conversation.messages[0] || null,
      unreadCount,
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
      isPinned: preferences.isPinned,
      isArchived: preferences.isArchived ?? false,
      mutedUntil: preferences.mutedUntil ?? null,
      isMuted:
        preferences.mutedUntil instanceof Date &&
        preferences.mutedUntil.getTime() > Date.now(),
      teamMatchId: conversation.teamMatch?.id ?? null,
    };
  }

  private getDisplayName(
    user: Prisma.UserGetPayload<{ select: typeof USER_SELECT }>,
  ) {
    // 2026-05 chat PII fix: never fall back to the raw email — it would
    // leak peer inboxes into conversation titles. Fall back to the
    // local-part only (text before `@`), which is the same handle the
    // user themselves typed at signup but doesn't disclose their domain.
    if (user.profile?.nickname) return user.profile.nickname;
    if (user.profile?.realName) return user.profile.realName;
    if (user.email) {
      const at = user.email.indexOf('@');
      return at > 0 ? user.email.slice(0, at) : user.email;
    }
    return 'Member';
  }

  // ============================================
  // 关注 / 屏蔽
  // ============================================

  /**
   * Follow a user. Idempotent via upsert.
   *
   * @param followerId - ID of the user initiating the follow
   * @param followingId - ID of the user to follow
   * @returns The created or existing follow record
   * @throws {BadRequestException} When attempting to follow yourself
   * @throws {ForbiddenException} When the target user has blocked the follower
   */
  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    const blocked = await this.checkBlocked(followingId, followerId);
    if (blocked) {
      throw new ForbiddenException('Cannot follow this user');
    }
    return this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { followerId, followingId },
    });
  }

  /**
   * Unfollow a user. No-op if the follow does not exist.
   *
   * @param followerId - ID of the user removing the follow
   * @param followingId - ID of the user to unfollow
   */
  async unfollowUser(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
  }

  /**
   * Block a user. Removes any mutual follows first, then upserts the block record.
   *
   * @param blockerId - ID of the user initiating the block
   * @param blockedId - ID of the user to block
   * @returns The created or existing block record
   * @throws {BadRequestException} When attempting to block yourself
   */
  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }
    await this.prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followingId: blockedId },
          { followerId: blockedId, followingId: blockerId },
        ],
      },
    });
    const block = await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
    const affectedMatchGroups = await this.prisma.conversation.findMany({
      where: {
        kind: ConversationKind.MATCH_GROUP,
        AND: [
          { participants: { some: { userId: blockerId } } },
          { participants: { some: { userId: blockedId } } },
        ],
      },
      select: { id: true },
    });
    if (affectedMatchGroups.length > 0) {
      await this.prisma.conversationParticipant.deleteMany({
        where: {
          userId: blockerId,
          conversationId: {
            in: affectedMatchGroups.map((conversation) => conversation.id),
          },
        },
      });
    }
    return block;
  }

  /**
   * Unblock a user. No-op if the block does not exist.
   *
   * @param blockerId - ID of the user removing the block
   * @param blockedId - ID of the user to unblock
   */
  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
  }

  // ============================================
  // 社交查询
  // ============================================

  private readonly SOCIAL_PROFILE_SELECT = {
    nickname: true,
    avatarUrl: true,
    realName: true,
    bio: true,
    targetMajor: true,
  } as const;

  /**
   * Get all followers of a user with profile data.
   *
   * @param userId - ID of the user whose followers to retrieve
   * @returns Array of follow records including follower user and profile details
   */
  async getFollowers(userId: string) {
    return this.prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: this.SOCIAL_PROFILE_SELECT },
          },
        },
      },
    });
  }

  /**
   * Get all users that a user follows with profile data.
   *
   * @param userId - ID of the user whose following list to retrieve
   * @returns Array of follow records including followed user and profile details
   */
  async getFollowing(userId: string) {
    return this.prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: this.SOCIAL_PROFILE_SELECT },
          },
        },
      },
    });
  }

  /**
   * Get all users blocked by a user.
   *
   * @param userId - ID of the user whose block list to retrieve
   * @returns Array of block records including blocked user and profile details
   */
  async getBlocked(userId: string) {
    return this.prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: { nickname: true, avatarUrl: true, realName: true },
            },
          },
        },
      },
    });
  }

  async getSocialOverview(userId: string): Promise<SocialOverview> {
    const [followers, following, blocked, followingRows] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
      this.prisma.block.count({ where: { blockerId: userId } }),
      this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      }),
    ]);

    const followingIds = followingRows.map((follow) => follow.followingId);
    const mutual =
      followingIds.length > 0
        ? await this.prisma.follow.count({
            where: { followingId: userId, followerId: { in: followingIds } },
          })
        : 0;

    return {
      counts: { followers, following, mutual, blocked },
      recommendations: await this.getRecommendedUsers(userId, 4),
    };
  }

  async getSocialRelations(
    userId: string,
    query: SocialRelationsQueryDto,
  ): Promise<PaginatedResponseDto<SocialRelationItem>> {
    const type = query.type ?? 'followers';
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
    const skip = (page - 1) * pageSize;

    if (type === 'blocked') {
      return this.getSocialBlockRelations(userId, query, page, pageSize, skip);
    }

    return this.getSocialFollowRelations(userId, query, page, pageSize, skip);
  }

  async applySocialBulkAction(
    actorId: string,
    dto: SocialBulkDto,
  ): Promise<SocialBulkResponse> {
    const userIds = Array.from(new Set(dto.userIds));
    const results = await Promise.all(
      userIds.map(async (userId) => {
        try {
          await this.applySingleSocialAction(actorId, userId, dto.action);
          return { userId, success: true };
        } catch (error) {
          return {
            userId,
            success: false,
            error: error instanceof Error ? error.message : 'Operation failed',
          };
        }
      }),
    );

    return { action: dto.action, results };
  }

  private async getSocialFollowRelations(
    userId: string,
    query: SocialRelationsQueryDto,
    page: number,
    pageSize: number,
    skip: number,
  ): Promise<PaginatedResponseDto<SocialRelationItem>> {
    const type = query.type === 'following' ? 'following' : 'followers';
    const peerField = type === 'followers' ? 'follower' : 'following';
    const peerIdField = type === 'followers' ? 'followerId' : 'followingId';
    const reciprocalIds =
      type === 'followers'
        ? (
            await this.prisma.follow.findMany({
              where: { followerId: userId },
              select: { followingId: true },
            })
          ).map((relation) => relation.followingId)
        : (
            await this.prisma.follow.findMany({
              where: { followingId: userId },
              select: { followerId: true },
            })
          ).map((relation) => relation.followerId);

    const where: Prisma.FollowWhereInput = {
      ...(type === 'followers'
        ? { followingId: userId }
        : { followerId: userId }),
      [peerField]: this.buildSocialUserWhere(query.search, query.role),
    };

    this.applyRelationshipFilter(
      where,
      peerIdField,
      reciprocalIds,
      query.relationship,
    );

    const [rows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where,
        include: {
          follower: { select: SOCIAL_USER_SELECT },
          following: { select: SOCIAL_USER_SELECT },
        },
        orderBy: this.getFollowOrderBy(type, query.sort),
        skip,
        take: pageSize,
      }) as Promise<SocialFollowRelation[]>,
      this.prisma.follow.count({ where }),
    ]);

    const reciprocalSet = new Set(reciprocalIds);
    const items = rows.map((relation) => {
      const user =
        type === 'followers' ? relation.follower : relation.following;
      return this.toRelationItem({
        relationId: relation.id,
        relationType: type,
        createdAt: relation.createdAt,
        user,
        relationship: reciprocalSet.has(user.id) ? 'mutual' : 'oneWay',
      });
    });

    return createPaginatedResponse(items, total, page, pageSize);
  }

  private async getSocialBlockRelations(
    userId: string,
    query: SocialRelationsQueryDto,
    page: number,
    pageSize: number,
    skip: number,
  ): Promise<PaginatedResponseDto<SocialRelationItem>> {
    const where: Prisma.BlockWhereInput = {
      blockerId: userId,
      blocked: this.buildSocialUserWhere(query.search, query.role),
    };

    const [rows, total] = await Promise.all([
      this.prisma.block.findMany({
        where,
        include: {
          blocked: { select: SOCIAL_USER_SELECT },
        },
        orderBy: this.getBlockOrderBy(query.sort),
        skip,
        take: pageSize,
      }),
      this.prisma.block.count({ where }),
    ]);

    const items = rows.map((relation) =>
      this.toRelationItem({
        relationId: relation.id,
        relationType: 'blocked',
        createdAt: relation.createdAt,
        user: relation.blocked,
        relationship: 'blocked',
      }),
    );

    return createPaginatedResponse(items, total, page, pageSize);
  }

  private buildSocialUserWhere(
    search?: string,
    role?: SocialRoleFilter,
  ): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = [{ deletedAt: null }];
    const normalizedSearch = search?.trim();

    if (normalizedSearch) {
      and.push({
        OR: [
          { email: { contains: normalizedSearch, mode: 'insensitive' } },
          {
            profile: {
              is: {
                nickname: { contains: normalizedSearch, mode: 'insensitive' },
              },
            },
          },
          {
            profile: {
              is: {
                targetMajor: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      });
    }

    if (role === 'verified') {
      and.push({ role: Role.VERIFIED });
    } else if (role === 'staff') {
      and.push({ role: { in: [Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR] } });
    }

    return { AND: and };
  }

  private applyRelationshipFilter(
    where: Prisma.FollowWhereInput,
    peerIdField: 'followerId' | 'followingId',
    reciprocalIds: string[],
    relationship?: SocialRelationshipFilter,
  ) {
    if (!relationship || relationship === 'all') return;

    where[peerIdField] =
      relationship === 'mutual'
        ? { in: reciprocalIds }
        : { notIn: reciprocalIds };
  }

  private getFollowOrderBy(
    type: 'followers' | 'following',
    sort?: SocialRelationSort,
  ): Prisma.FollowOrderByWithRelationInput[] {
    const peerField = type === 'followers' ? 'follower' : 'following';
    if (sort === 'name') {
      return [
        {
          [peerField]: {
            profile: { nickname: { sort: 'asc', nulls: 'last' } },
          },
        },
        { [peerField]: { email: 'asc' } },
      ];
    }
    if (sort === 'major') {
      return [
        {
          [peerField]: {
            profile: { targetMajor: { sort: 'asc', nulls: 'last' } },
          },
        },
        { createdAt: 'desc' },
      ];
    }
    return [{ createdAt: 'desc' }];
  }

  private getBlockOrderBy(
    sort?: SocialRelationSort,
  ): Prisma.BlockOrderByWithRelationInput[] {
    if (sort === 'name') {
      return [
        {
          blocked: {
            profile: { nickname: { sort: 'asc', nulls: 'last' } },
          },
        },
        { blocked: { email: 'asc' } },
      ];
    }
    if (sort === 'major') {
      return [
        {
          blocked: {
            profile: { targetMajor: { sort: 'asc', nulls: 'last' } },
          },
        },
        { createdAt: 'desc' },
      ];
    }
    return [{ createdAt: 'desc' }];
  }

  private toRelationItem(input: {
    relationId: string;
    relationType: SocialRelationType;
    createdAt: Date;
    user: SocialPrismaUser;
    relationship: SocialRelationship;
  }): SocialRelationItem {
    return {
      relationId: input.relationId,
      relationType: input.relationType,
      createdAt: input.createdAt,
      user: this.toSocialUser(input.user),
      relationship: input.relationship,
    };
  }

  private toSocialUser(
    user: SocialPrismaUser | SocialRecommendationPrismaUser,
  ): SocialUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      profile: user.profile
        ? {
            nickname: user.profile.nickname,
            avatarUrl: user.profile.avatarUrl,
            bio: user.profile.bio,
            targetMajor: user.profile.targetMajor,
            grade: user.profile.grade,
          }
        : null,
      stats: {
        followers: user._count.followers,
        following: user._count.following,
        cases: user._count.admissionCases,
      },
    };
  }

  private async applySingleSocialAction(
    actorId: string,
    userId: string,
    action: SocialBulkAction,
  ) {
    if (action === 'follow') return this.followUser(actorId, userId);
    if (action === 'unfollow') return this.unfollowUser(actorId, userId);
    if (action === 'block') return this.blockUser(actorId, userId);
    return this.unblockUser(actorId, userId);
  }

  // ============================================
  // 举报
  // ============================================

  /**
   * Create a report for a user, message, case, or review. When targeting a
   * MESSAGE, the 10 most recent messages from the conversation are attached
   * as context.
   *
   * @param reporterId - ID of the user filing the report
   * @param targetType - Entity type being reported
   * @param targetId - ID of the reported entity
   * @param reason - Short reason for the report
   * @param detail - Optional additional detail
   * @returns The newly created report record
   */
  async report(
    reporterId: string,
    targetType: 'USER' | 'MESSAGE' | 'CASE' | 'REVIEW' | 'RECRUITMENT_CARD',
    targetId: string,
    reason: string,
    detail?: string,
  ) {
    let context: object | undefined;

    if (targetType === 'MESSAGE') {
      const message = await this.prisma.message.findUnique({
        where: { id: targetId },
        include: {
          conversation: {
            include: {
              messages: { orderBy: { createdAt: 'desc' }, take: 10 },
            },
          },
        },
      });
      if (message) {
        context = message.conversation.messages;
      }
    }

    // Auto-assign priority: USER reports = HIGH, MESSAGE = MEDIUM, others = LOW
    const priority =
      targetType === 'USER'
        ? 'HIGH'
        : targetType === 'MESSAGE'
          ? 'MEDIUM'
          : 'LOW';

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType,
        targetId,
        reason,
        detail,
        context,
        priority,
      },
    });
  }

  // ============================================
  // 推荐关注
  // ============================================

  /**
   * Get recommended users to follow, scored by role, major match, profile
   * completeness, and follower count. Already-followed and blocked users
   * are excluded.
   *
   * @param userId - ID of the user requesting recommendations
   * @param limit - Maximum number of users to return (default 10)
   * @returns Scored and ranked list of recommended user profiles
   */
  async getRecommendedUsers(userId: string, limit = 10) {
    const [following, blocked, blockedBy] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      }),
      this.prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
      }),
      this.prisma.block.findMany({
        where: { blockedId: userId },
        select: { blockerId: true },
      }),
    ]);

    const excludeIds = [
      userId,
      ...following.map((f) => f.followingId),
      ...blocked.map((b) => b.blockedId),
      ...blockedBy.map((b) => b.blockerId),
    ];

    const currentUserProfile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { targetMajor: true },
    });

    const recommendedUsers = await this.prisma.user.findMany({
      where: {
        id: { notIn: excludeIds },
        deletedAt: null,
        profile: { isNot: null },
      },
      select: SOCIAL_RECOMMENDATION_USER_SELECT,
      orderBy: [{ role: 'desc' }, { followers: { _count: 'desc' } }],
      take: limit * 2,
    });

    const scoredUsers: RecommendedSocialUser[] = recommendedUsers.map(
      (user) => {
        let score = 0;
        const reasons: string[] = [];
        if (user.role === 'VERIFIED') {
          score += 50;
          reasons.push('verified');
        }
        if (
          user.role === 'ADMIN' ||
          user.role === 'SUPER_ADMIN' ||
          user.role === 'OPERATOR'
        ) {
          score += 30;
          reasons.push('staff');
        }
        if (user._count.admissionCases > 0) {
          score += 30;
          reasons.push('admissionCases');
        }

        if (user.profile) {
          const profileScore =
            (user.profile._count.testScores > 0 ? 10 : 0) +
            (user.profile._count.activities > 0 ? 10 : 0) +
            (user.profile._count.awards > 0 ? 10 : 0) +
            (user.profile.gpa ? 10 : 0);
          score += profileScore;
          if (profileScore >= 20) reasons.push('profileComplete');
        }

        if (
          currentUserProfile?.targetMajor &&
          user.profile?.targetMajor === currentUserProfile.targetMajor
        ) {
          score += 40;
          reasons.push('sameMajor');
        }

        score += Math.min(user._count.followers * 2, 20);
        if (user._count.followers >= 3) reasons.push('popular');

        return {
          ...this.toSocialUser(user),
          score,
          reasons: reasons.slice(0, 3),
        };
      },
    );

    return scoredUsers.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
