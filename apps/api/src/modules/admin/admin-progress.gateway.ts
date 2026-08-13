/**
 * Admin Progress WebSocket Gateway
 *
 * Broadcasts job progress events (started/progress/completed/failed)
 * to connected admin clients. Uses EventEmitter2 to receive events
 * from sync services.
 *
 * Namespace: /admin-progress
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export interface JobProgressPayload {
  jobId: string;
  current: number;
  total: number;
  message?: string;
}

export interface JobCompletedPayload {
  jobId: string;
  synced?: number;
  errors?: number;
  message?: string;
}

export interface JobFailedPayload {
  jobId: string;
  error: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:4100',
      'http://localhost:4101',
    ],
    credentials: true,
  },
  namespace: '/admin-progress',
})
export class AdminProgressGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AdminProgressGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const authToken: unknown = client.handshake.auth?.token;
      const token =
        (typeof authToken === 'string' ? authToken : undefined) ??
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub?: string }>(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      const userId = payload.sub;
      if (!userId) {
        client.disconnect();
        return;
      }

      // Verify admin/operator role
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, isBanned: true },
      });

      if (
        !user ||
        user.isBanned ||
        !['ADMIN', 'SUPER_ADMIN', 'OPERATOR'].includes(user.role)
      ) {
        this.logger.warn(
          `Admin progress connection rejected: insufficient role for ${userId}`,
        );
        client.disconnect();
        return;
      }

      client.userId = userId;
      this.logger.log(
        `Admin progress client connected: ${client.id} (${userId})`,
      );
      client.emit('connected', { userId });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.logger.debug(`Admin progress client disconnected: ${client.id}`);
    }
  }

  // ── EventEmitter listeners → WebSocket broadcasts ──

  @OnEvent('admin.job.started')
  onJobStarted(payload: { jobId: string; total?: number }) {
    this.server.emit('jobStarted', payload);
  }

  @OnEvent('admin.job.progress')
  onJobProgress(payload: JobProgressPayload) {
    this.server.emit('jobProgress', payload);
  }

  @OnEvent('admin.job.completed')
  onJobCompleted(payload: JobCompletedPayload) {
    this.server.emit('jobCompleted', payload);
  }

  @OnEvent('admin.job.failed')
  onJobFailed(payload: JobFailedPayload) {
    this.server.emit('jobFailed', payload);
  }
}
