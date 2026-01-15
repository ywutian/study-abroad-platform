/**
 * 审计日志服务
 *
 * 企业级操作审计：
 * 1. 完整操作记录
 * 2. 合规性追踪
 * 3. 安全事件管理
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import {
  getRequestId,
  getCurrentUserId,
  requestContext,
} from '../infrastructure/context';

// ==================== 类型定义 ====================

export enum AuditAction {
  // Agent 操作
  CHAT_START = 'CHAT_START',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  CHAT_END = 'CHAT_END',
  AGENT_DELEGATE = 'AGENT_DELEGATE',
  TOOL_CALL = 'TOOL_CALL',

  // 记忆操作
  MEMORY_CREATE = 'MEMORY_CREATE',
  MEMORY_READ = 'MEMORY_READ',
  MEMORY_UPDATE = 'MEMORY_UPDATE',
  MEMORY_DELETE = 'MEMORY_DELETE',
  MEMORY_SEARCH = 'MEMORY_SEARCH',

  // 配置操作
  CONFIG_READ = 'CONFIG_READ',
  CONFIG_UPDATE = 'CONFIG_UPDATE',
  CONFIG_ROLLBACK = 'CONFIG_ROLLBACK',

  // 安全事件
  SECURITY_THREAT = 'SECURITY_THREAT',
  SECURITY_BLOCK = 'SECURITY_BLOCK',
  RATE_LIMIT = 'RATE_LIMIT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // 数据操作
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_DELETE = 'DATA_DELETE',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  DENIED = 'DENIED',
}

export enum SecurityEventType {
  PROMPT_INJECTION = 'PROMPT_INJECTION',
  PII_DETECTED = 'PII_DETECTED',
  HARMFUL_CONTENT = 'HARMFUL_CONTENT',
  RATE_LIMIT_HIT = 'RATE_LIMIT_HIT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  AUTHENTICATION_FAILURE = 'AUTHENTICATION_FAILURE',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

export enum SecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AuditEntry {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXECUTE';
  status: AuditStatus;
  details?: Record<string, unknown>;
  duration?: number;
}

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecuritySeverity;
  description: string;
  payload?: Record<string, unknown>;
  mitigationAction?: string;
}

// ==================== 服务实现 ====================

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  // 内存缓冲区（批量写入）
  private auditBuffer: Array<{
    entry: AuditEntry;
    userId?: string;
    sessionId?: string;
    traceId?: string;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
  }> = [];

  private readonly bufferSize = 100;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    // 启动定时刷新
    this.flushTimer = setInterval(() => this.flush(), 5000);
  }

  /**
   * 记录审计日志
   */
  async log(entry: AuditEntry): Promise<void> {
    const ctx = requestContext.get();

    this.auditBuffer.push({
      entry,
      userId: ctx?.userId || getCurrentUserId(),
      sessionId: ctx?.sessionId,
      traceId: ctx?.requestId || getRequestId(),
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      timestamp: new Date(),
    });

    // 缓冲区满时立即刷新
    if (this.auditBuffer.length >= this.bufferSize) {
      await this.flush();
    }

    // 关键操作立即写入
    if (this.isCriticalAction(entry.action)) {
      await this.flush();
    }
  }

  /**
   * 记录安全事件
   * 使用 Prisma 类型安全插入
   */
  async logSecurityEvent(event: SecurityEvent): Promise<string> {
    const ctx = requestContext.get();

    try {
      // 写入数据库
      const record = await this.prisma.agentSecurityEvent.create({
        data: {
          userId: ctx?.userId || null,
          sessionId: ctx?.sessionId || null,
          eventType: event.type,
          severity: event.severity,
          description: event.description,
          payload: event.payload || {},
          mitigationAction: event.mitigationAction || null,
        },
        select: { id: true },
      });

      // 高严重度事件发送告警
      if (
        event.severity === SecuritySeverity.CRITICAL ||
        event.severity === SecuritySeverity.HIGH
      ) {
        await this.sendSecurityAlert(event);
      }

      // 更新 Redis 计数器（用于实时监控）
      await this.updateSecurityMetrics(event);

      this.logger.warn(`Security event: ${event.type}`, {
        severity: event.severity,
        description: event.description,
        userId: ctx?.userId,
      });

      return record.id;
    } catch (err) {
      this.logger.error('Failed to log security event', err);
      throw err;
    }
  }

  /**
   * 查询审计日志
   * 使用 Prisma 类型安全查询替代原始 SQL
   */
  async queryLogs(options: {
    userId?: string;
    action?: AuditAction;
    resource?: string;
    status?: AuditStatus;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: Array<{
      id: string;
      userId: string | null;
      action: string;
      resource: string;
      status: string;
      details: unknown;
      createdAt: Date;
    }>;
    total: number;
  }> {
    // 构建类型安全的 where 条件
    const where: {
      userId?: string;
      action?: string;
      resource?: string;
      status?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.action) {
      where.action = options.action;
    }
    if (options.resource) {
      where.resource = options.resource;
    }
    if (options.status) {
      where.status = options.status;
    }
    if (options.startTime || options.endTime) {
      where.createdAt = {};
      if (options.startTime) {
        where.createdAt.gte = options.startTime;
      }
      if (options.endTime) {
        where.createdAt.lte = options.endTime;
      }
    }

    const limit = Math.min(options.limit || 50, 1000);
    const offset = options.offset || 0;

    const [logs, total] = await Promise.all([
      this.prisma.agentAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          userId: true,
          action: true,
          resource: true,
          status: true,
          details: true,
          createdAt: true,
        },
      }),
      this.prisma.agentAuditLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        status: log.status,
        details: log.details,
        createdAt: log.createdAt,
      })),
      total,
    };
  }

  /**
   * 获取安全事件统计
   * 使用 Prisma 类型安全查询
   */
  async getSecurityStats(options?: {
    userId?: string;
    hours?: number;
  }): Promise<{
    total: number;
    bySeverity: Record<SecuritySeverity, number>;
    byType: Record<string, number>;
    unresolved: number;
  }> {
    const hours = options?.hours || 24;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // 构建类型安全的 where 条件
    const where: {
      createdAt: { gte: Date };
      userId?: string;
    } = {
      createdAt: { gte: startTime },
    };

    if (options?.userId) {
      where.userId = options.userId;
    }

    const [total, severityGroups, typeGroups, unresolved] = await Promise.all([
      this.prisma.agentSecurityEvent.count({ where }),
      this.prisma.agentSecurityEvent.groupBy({
        by: ['severity'],
        where,
        _count: { severity: true },
      }),
      this.prisma.agentSecurityEvent.groupBy({
        by: ['eventType'],
        where,
        _count: { eventType: true },
      }),
      this.prisma.agentSecurityEvent.count({
        where: { ...where, resolved: false },
      }),
    ]);

    const bySeverity: Record<SecuritySeverity, number> = {
      [SecuritySeverity.LOW]: 0,
      [SecuritySeverity.MEDIUM]: 0,
      [SecuritySeverity.HIGH]: 0,
      [SecuritySeverity.CRITICAL]: 0,
    };

    for (const row of severityGroups) {
      bySeverity[row.severity as SecuritySeverity] = row._count.severity;
    }

    const byType: Record<string, number> = {};
    for (const row of typeGroups) {
      byType[row.eventType] = row._count.eventType;
    }

    return {
      total,
      bySeverity,
      byType,
      unresolved,
    };
  }

  /**
   * 解决安全事件
   * 使用 Prisma 类型安全更新
   */
  async resolveSecurityEvent(
    eventId: string,
    resolution: { resolvedBy: string; notes?: string },
  ): Promise<void> {
    await this.prisma.agentSecurityEvent.update({
      where: { id: eventId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: resolution.resolvedBy,
      },
    });
  }

  // ==================== 私有方法 ====================

  private async flush(): Promise<void> {
    if (this.auditBuffer.length === 0) return;

    const batch = this.auditBuffer.splice(0, this.auditBuffer.length);

    try {
      // 批量插入数据
      const data = batch.map((item) => ({
        userId: item.userId || null,
        sessionId: item.sessionId || null,
        traceId: item.traceId || null,
        action: item.entry.action,
        resource: item.entry.resource,
        resourceId: item.entry.resourceId || null,
        operation: item.entry.operation,
        status: item.entry.status,
        details: item.entry.details || null,
        ipAddress: item.ipAddress || null,
        userAgent: item.userAgent || null,
        duration: item.entry.duration || null,
        createdAt: item.timestamp,
      }));

      // 使用 Prisma createMany 批量插入
      await this.prisma.agentAuditLog.createMany({
        data,
        skipDuplicates: true,
      });
    } catch (err) {
      this.logger.error(`Failed to flush audit logs: ${err}`);
      // 失败的日志放回缓冲区
      this.auditBuffer.unshift(...batch);
    }
  }

  private isCriticalAction(action: AuditAction): boolean {
    return [
      AuditAction.SECURITY_THREAT,
      AuditAction.SECURITY_BLOCK,
      AuditAction.CONFIG_UPDATE,
      AuditAction.DATA_DELETE,
    ].includes(action);
  }

  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    // TODO: 集成告警系统（Slack、PagerDuty 等）
    this.logger.error(`🚨 SECURITY ALERT: ${event.type}`, {
      severity: event.severity,
      description: event.description,
    });

    // 写入 Redis 告警队列
    const client = this.redis.getClient();
    if (client && this.redis.connected) {
      try {
        await client.lpush(
          'security:alerts',
          JSON.stringify({
            ...event,
            timestamp: new Date().toISOString(),
          }),
        );
        await client.ltrim('security:alerts', 0, 999);
      } catch {
        // 忽略 Redis 错误
      }
    }
  }

  private async updateSecurityMetrics(event: SecurityEvent): Promise<void> {
    const client = this.redis.getClient();
    if (!client || !this.redis.connected) return;

    try {
      const now = new Date();
      const hourKey = `security:hourly:${now.toISOString().slice(0, 13)}`;
      const dayKey = `security:daily:${now.toISOString().slice(0, 10)}`;

      await Promise.all([
        client.hincrby(hourKey, event.type, 1),
        client.hincrby(hourKey, `severity:${event.severity}`, 1),
        client.expire(hourKey, 86400 * 2),
        client.hincrby(dayKey, event.type, 1),
        client.hincrby(dayKey, `severity:${event.severity}`, 1),
        client.expire(dayKey, 86400 * 35),
      ]);
    } catch {
      // 忽略 Redis 错误
    }
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * 清理（模块销毁时调用）
   */
  async onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}
