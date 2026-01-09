import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Conversation, Message, Prisma } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // Check if users mutually follow each other
  async checkMutualFollow(userId1: string, userId2: string): Promise<boolean> {
    const [follow1, follow2] = await Promise.all([
      this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: userId1, followingId: userId2 } },
      }),
      this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: userId2, followingId: userId1 } },
      }),
    ]);

    return !!follow1 && !!follow2;
  }

  // Check if user is blocked
  async checkBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    return !!block;
  }

  // Get or create conversation between two users
  async getOrCreateConversation(userId1: string, userId2: string): Promise<Conversation> {
    // Check mutual follow
    const isMutual = await this.checkMutualFollow(userId1, userId2);
    if (!isMutual) {
      throw new ForbiddenException('Mutual follow required to start a conversation');
    }

    // Check if blocked
    const [blocked1, blocked2] = await Promise.all([
      this.checkBlocked(userId1, userId2),
      this.checkBlocked(userId2, userId1),
    ]);

    if (blocked1 || blocked2) {
      throw new ForbiddenException('Cannot message this user');
    }

    // Find existing conversation
    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: { in: [userId1, userId2] },
          },
        },
      },
      include: {
        participants: true,
      },
    });

    if (existingConversation && existingConversation.participants.length === 2) {
      return existingConversation;
    }

    // Create new conversation
    return this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: userId1 }, { userId: userId2 }],
        },
      },
      include: {
        participants: true,
      },
    });
  }

  // Send message
  async sendMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
    // Verify sender is participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });

    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    // Get other participant
    const otherParticipant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: { not: senderId },
      },
    });

    if (otherParticipant) {
      // Check if blocked
      const blocked = await this.checkBlocked(otherParticipant.userId, senderId);
      if (blocked) {
        throw new ForbiddenException('Cannot message this user');
      }
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  // Get user's conversations
  async getConversations(userId: string) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, email: true, role: true },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    if (participations.length === 0) {
      return [];
    }

    // Batch query: Get unread counts for all conversations in a single query
    const conversationIds = participations.map((p) => p.conversationId);
    const lastReadMap = new Map(
      participations.map((p) => [p.conversationId, p.lastReadAt || new Date(0)])
    );

    // Use raw query for efficient batch unread count
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
      unreadCounts.map((u) => [u.conversationId, Number(u.count)])
    );

    return participations.map((p) => {
      const otherParticipant = p.conversation.participants.find((part) => part.userId !== userId);
      const unreadCount = unreadMap.get(p.conversationId) || 0;

      return {
        id: p.conversation.id,
        otherUser: otherParticipant?.user,
        lastMessage: p.conversation.messages[0] || null,
        unreadCount,
        updatedAt: p.conversation.updatedAt,
      };
    });
  }

  // Get messages in conversation
  async getMessages(conversationId: string, userId: string, limit = 50, before?: string) {
    // Verify participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const where: any = { conversationId };

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
        sender: {
          select: { id: true, email: true },
        },
      },
    });
  }

  // Mark messages as read
  async markAsRead(conversationId: string, userId: string) {
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  // Follow user
  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    // Check if blocked
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

  // Unfollow user
  async unfollowUser(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
  }

  // Block user
  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    // Remove any follows
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

  // Unblock user
  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
  }

  // Report user/message
  async report(
    reporterId: string,
    targetType: 'USER' | 'MESSAGE' | 'CASE' | 'REVIEW',
    targetId: string,
    reason: string,
    detail?: string
  ) {
    let context: object | undefined = undefined;

    // If reporting a message, attach recent messages as context
    if (targetType === 'MESSAGE') {
      const message = await this.prisma.message.findUnique({
        where: { id: targetId },
        include: {
          conversation: {
            include: {
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 10,
              },
            },
          },
        },
      });

      if (message) {
        context = message.conversation.messages as unknown as object;
      }
    }

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType,
        targetId,
        reason,
        detail,
        context,
      },
    });
  }

  // Get followers
  async getFollowers(userId: string) {
    return this.prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: { id: true, email: true, role: true },
        },
      },
    });
  }

  // Get following
  async getFollowing(userId: string) {
    return this.prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: { id: true, email: true, role: true },
        },
      },
    });
  }

  // Get blocked users
  async getBlocked(userId: string) {
    return this.prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: { id: true, email: true, role: true },
        },
      },
    });
  }
}

