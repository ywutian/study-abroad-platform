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
import { Prisma } from '@prisma/client';

/** 用户信息的标准 select（复用） */
const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  profile: {
    select: { nickname: true, avatarUrl: true, realName: true },
  },
} as const;

/** 消息中发送者的标准 select */
const SENDER_SELECT = {
  id: true,
  email: true,
  profile: {
    select: { nickname: true, avatarUrl: true, realName: true },
  },
} as const;

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
  async sendMessage(conversationId: string, senderId: string, content: string) {
    // 验证参与者
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    // 屏蔽检查
    const otherParticipant =
      await this.prisma.conversationParticipant.findFirst({
        where: { conversationId, userId: { not: senderId } },
      });
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

    // 创建消息
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: filterResult.filtered,
      },
      include: {
        sender: { select: SENDER_SELECT },
      },
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
    content?: string,
  ) {
    // 验证参与者
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
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
        content: content || file.originalname,
        mediaUrl: uploadResult.url,
        mediaType,
      },
      include: {
        sender: { select: SENDER_SELECT },
      },
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
  async getConversations(userId: string) {
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
              include: { sender: { select: SENDER_SELECT } },
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

    return participations.map((p) => {
      const otherParticipant = p.conversation.participants.find(
        (part) => part.userId !== userId,
      );

      return {
        id: p.conversation.id,
        otherUser: otherParticipant?.user || null,
        lastMessage: p.conversation.messages[0] || null,
        unreadCount: unreadMap.get(p.conversationId) || 0,
        updatedAt: p.conversation.updatedAt,
        isPinned: p.isPinned,
      };
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
      include: {
        sender: { select: SENDER_SELECT },
      },
    });
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

  // ============================================
  // 关注 / 屏蔽
  // ============================================

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

  async unfollowUser(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
  }

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
    return this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
  }

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

  // ============================================
  // 举报
  // ============================================

  async report(
    reporterId: string,
    targetType: 'USER' | 'MESSAGE' | 'CASE' | 'REVIEW',
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
        context = message.conversation.messages as unknown as object;
      }
    }

    return this.prisma.report.create({
      data: { reporterId, targetType, targetId, reason, detail, context },
    });
  }

  // ============================================
  // 推荐关注
  // ============================================

  async getRecommendedUsers(userId: string, limit = 10) {
    const [following, blocked] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      }),
      this.prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
      }),
    ]);

    const excludeIds = [
      userId,
      ...following.map((f) => f.followingId),
      ...blocked.map((b) => b.blockedId),
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
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            targetMajor: true,
            grade: true,
            gpa: true,
            visibility: true,
            _count: {
              select: { testScores: true, activities: true, awards: true },
            },
          },
        },
        _count: { select: { followers: true, admissionCases: true } },
      },
      orderBy: [{ role: 'desc' }, { followers: { _count: 'desc' } }],
      take: limit * 2,
    });

    const scoredUsers = recommendedUsers.map((user) => {
      let score = 0;
      if (user.role === 'VERIFIED') score += 50;
      if (user.role === 'ADMIN') score += 30;
      if (user._count.admissionCases > 0) score += 30;

      if (user.profile) {
        score +=
          (user.profile._count.testScores > 0 ? 10 : 0) +
          (user.profile._count.activities > 0 ? 10 : 0) +
          (user.profile._count.awards > 0 ? 10 : 0) +
          (user.profile.gpa ? 10 : 0);
      }

      if (
        currentUserProfile?.targetMajor &&
        user.profile?.targetMajor === currentUserProfile.targetMajor
      ) {
        score += 40;
      }

      score += Math.min(user._count.followers * 2, 20);

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile
          ? {
              targetMajor: user.profile.targetMajor,
              grade: user.profile.grade,
              visibility: user.profile.visibility,
              completeness: user.profile._count,
            }
          : null,
        stats: {
          followers: user._count.followers,
          cases: user._count.admissionCases,
        },
        score,
      };
    });

    return scoredUsers
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...user }) => user);
  }
}
