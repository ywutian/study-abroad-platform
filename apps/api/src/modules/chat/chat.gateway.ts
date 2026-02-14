import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      client.userId = payload.sub;
      const userId = client.userId;

      if (!userId) {
        client.disconnect();
        return;
      }

      const canConnect = await this.ensureNotBanned(userId);
      if (!canConnect) {
        client.disconnect();
        return;
      }

      // 是否为该用户第一个连接（用于广播上线）
      const isFirstConnection = !this.userSockets.has(userId);

      // 记录 socket
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      // 加入用户专属房间
      client.join(`user:${userId}`);

      // 加入所有会话房间
      const conversations = await this.chatService.getConversations(userId);
      conversations.forEach((conv) => {
        client.join(`conversation:${conv.id}`);
      });

      // 通知客户端已连接
      client.emit('connected', { userId });

      // 广播上线状态
      if (isFirstConnection) {
        this.server.emit('userOnline', userId);
      }

      this.logger.debug(`User ${userId} connected (socket: ${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) return;

    const userId = client.userId;
    const sockets = this.userSockets.get(userId);

    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        // 广播下线状态
        this.server.emit('userOffline', userId);
        this.logger.debug(`User ${userId} went offline`);
      }
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    if (!client.userId) return { success: false, error: 'Not authenticated' };

    try {
      const message = await this.chatService.sendMessage(
        data.conversationId,
        client.userId,
        data.content,
      );

      // 广播给会话内所有参与者
      this.server.to(`conversation:${data.conversationId}`).emit('newMessage', {
        conversationId: data.conversationId,
        message,
      });

      // 给不在线的对方发通知（异步，不阻塞发送）
      this.sendMessageNotification(data.conversationId, client.userId).catch(
        (err) => this.logger.warn(`Notification failed: ${err.message}`),
      );

      return { success: true, message };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to send message',
      };
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) return;

    // 安全校验：验证用户是会话参与者
    const participant = await this.chatService[
      'prisma'
    ].conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: data.conversationId,
          userId: client.userId,
        },
      },
    });
    if (!participant) {
      return { success: false, error: 'Not a participant' };
    }

    client.join(`conversation:${data.conversationId}`);

    return { success: true };
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) return;

    const result = await this.chatService.markAsRead(
      data.conversationId,
      client.userId,
    );

    // 广播给会话内其他人
    client.to(`conversation:${data.conversationId}`).emit('messagesRead', {
      conversationId: data.conversationId,
      userId: client.userId,
      readAt: result.lastReadAt,
    });

    return { success: true };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    if (!client.userId) return;

    client.to(`conversation:${data.conversationId}`).emit('userTyping', {
      conversationId: data.conversationId,
      userId: client.userId,
      isTyping: data.isTyping,
    });
  }

  // ============================================
  // 公共方法（供 NotificationService 等使用）
  // ============================================

  isUserOnline(userId: string): boolean {
    return (
      this.userSockets.has(userId) &&
      (this.userSockets.get(userId)?.size ?? 0) > 0
    );
  }

  sendToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  broadcastToConversation(
    conversationId: string,
    event: string,
    data: unknown,
  ) {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * Block chat gateway access for banned users.
   * If a temporary ban has expired, auto-unban and allow connection.
   */
  private async ensureNotBanned(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true, bannedUntil: true },
    });

    if (!user?.isBanned) return true;

    if (user.bannedUntil && user.bannedUntil.getTime() < Date.now()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: false,
          bannedAt: null,
          bannedUntil: null,
          banReason: null,
        },
      });
      return true;
    }

    this.logger.warn(`Blocked banned user connection attempt: ${userId}`);
    return false;
  }

  /**
   * 给会话中不在线的对方发送消息通知
   */
  private async sendMessageNotification(
    conversationId: string,
    senderId: string,
  ) {
    // 找到对方参与者
    const participants = await this.chatService[
      'prisma'
    ].conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    for (const p of participants) {
      if (p.userId !== senderId && !this.isUserOnline(p.userId)) {
        await this.notificationService.createNotification(
          p.userId,
          NotificationType.NEW_MESSAGE,
          {
            actorId: senderId,
            relatedId: conversationId,
            relatedType: 'conversation',
          },
        );
      }
    }
  }
}
