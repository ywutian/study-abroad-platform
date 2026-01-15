/**
 * AI Agent WebSocket Gateway
 *
 * 提供实时 AI 对话能力，支持流式输出
 * 命名空间: /ai-assistant
 */

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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OrchestratorService, StreamEvent } from './core/orchestrator.service';
import { MemoryManagerService } from './memory/memory-manager.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

interface SendMessagePayload {
  message: string;
  conversationId?: string;
}

interface GetHistoryPayload {
  conversationId?: string;
  limit?: number;
}

interface ClearConversationPayload {
  conversationId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
  namespace: '/ai-assistant',
})
export class AiAgentGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AiAgentGateway.name);

  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private orchestrator: OrchestratorService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private memoryManager: MemoryManagerService,
  ) {}

  /**
   * 处理客户端连接
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn('Connection rejected: No token provided');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      client.userId = payload.sub;
      const userId = client.userId;

      if (!userId) {
        this.logger.warn('Connection rejected: Invalid token payload');
        client.disconnect();
        return;
      }

      // 追踪用户 socket
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      // 加入用户房间
      client.join(`user:${userId}`);

      this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
      client.emit('connected', { userId });
    } catch (error) {
      this.logger.warn(
        `Connection rejected: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      client.disconnect();
    }
  }

  /**
   * 处理客户端断开
   */
  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
      this.logger.log(
        `Client disconnected: ${client.id} (user: ${client.userId})`,
      );
    }
  }

  /**
   * 发送消息给 AI 助手（流式响应）
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessagePayload,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    const { message, conversationId } = data;

    if (
      !message ||
      typeof message !== 'string' ||
      message.trim().length === 0
    ) {
      return { success: false, error: 'Invalid message' };
    }

    try {
      // 发送开始事件
      client.emit('aiTyping', { isTyping: true });

      // 流式处理
      const stream = this.orchestrator.handleMessageStream(
        client.userId,
        message.trim(),
        conversationId,
      );

      let finalConversationId: string | undefined;

      for await (const event of stream) {
        // 发送流式事件
        client.emit('aiResponse', event);

        // 捕获 conversationId
        if (event.type === 'start' && event.conversationId) {
          finalConversationId = event.conversationId;
        }
      }

      // 发送完成事件
      client.emit('aiTyping', { isTyping: false });
      client.emit('aiDone', {
        success: true,
        conversationId: finalConversationId || conversationId,
      });

      return {
        success: true,
        conversationId: finalConversationId || conversationId,
      };
    } catch (error) {
      this.logger.error(
        `Error handling message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      client.emit('aiTyping', { isTyping: false });
      client.emit('aiError', {
        error:
          error instanceof Error ? error.message : 'Failed to process message',
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to process message',
      };
    }
  }

  /**
   * 获取对话历史
   */
  @SubscribeMessage('getHistory')
  async handleGetHistory(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: GetHistoryPayload,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const { conversationId, limit = 50 } = data;

      if (conversationId) {
        // 获取特定对话的消息
        const messages = await this.memoryManager.getMessages(
          conversationId,
          limit,
        );
        return { success: true, messages };
      } else {
        // 获取用户的所有对话列表
        const conversations = await this.memoryManager.getRecentConversations(
          client.userId,
          10,
        );
        return { success: true, conversations };
      }
    } catch (error) {
      this.logger.error(
        `Error getting history: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get history',
      };
    }
  }

  /**
   * 清除对话
   */
  @SubscribeMessage('clearConversation')
  async handleClearConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: ClearConversationPayload,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const { conversationId } = data;

      if (!conversationId) {
        return { success: false, error: 'conversationId is required' };
      }

      // 清除对话（企业级记忆系统）
      await this.memoryManager.clearConversation(conversationId);

      this.logger.log(
        `Conversation cleared: ${conversationId} (user: ${client.userId})`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error clearing conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to clear conversation',
      };
    }
  }

  /**
   * 检查用户是否在线
   */
  isUserOnline(userId: string): boolean {
    return (
      this.userSockets.has(userId) &&
      (this.userSockets.get(userId)?.size ?? 0) > 0
    );
  }

  /**
   * 向指定用户发送事件
   */
  sendToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
