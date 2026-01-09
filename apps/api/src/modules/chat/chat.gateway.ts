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
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

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
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];

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

      // Track user socket
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      // Join user's room
      client.join(`user:${userId}`);

      // Get conversations and join their rooms
      const conversations = await this.chatService.getConversations(userId);
      conversations.forEach((conv) => {
        client.join(`conversation:${conv.id}`);
      });

      client.emit('connected', { userId: client.userId });
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; content: string }
  ) {
    if (!client.userId) return;

    try {
      const message = await this.chatService.sendMessage(data.conversationId, client.userId, data.content);

      // Emit to all participants in the conversation
      this.server.to(`conversation:${data.conversationId}`).emit('newMessage', {
        conversationId: data.conversationId,
        message,
      });

      return { success: true, message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to send message' };
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string }
  ) {
    if (!client.userId) return;

    client.join(`conversation:${data.conversationId}`);
    await this.chatService.markAsRead(data.conversationId, client.userId);

    return { success: true };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean }
  ) {
    if (!client.userId) return;

    client.to(`conversation:${data.conversationId}`).emit('userTyping', {
      conversationId: data.conversationId,
      userId: client.userId,
      isTyping: data.isTyping,
    });
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && (this.userSockets.get(userId)?.size ?? 0) > 0;
  }

  // Send notification to user
  sendToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}

