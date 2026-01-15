/**
 * 请求上下文
 *
 * 使用 AsyncLocalStorage 实现请求范围的上下文传递
 * 无需显式传参即可在任意层级获取请求信息
 */

import { AsyncLocalStorage } from 'async_hooks';
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * 请求上下文数据
 */
export interface RequestContextData {
  // 请求追踪
  requestId: string; // 唯一请求 ID
  correlationId?: string; // 关联 ID (来自上游)
  spanId?: string; // 分布式追踪 Span ID

  // 用户信息
  userId?: string;
  userRole?: string;
  isVip?: boolean;

  // 请求信息
  path: string;
  method: string;
  ip?: string;
  userAgent?: string;

  // 时间
  startTime: number;

  // Agent 相关
  conversationId?: string;
  agentType?: string;

  // 自定义数据
  metadata: Record<string, any>;
}

/**
 * 请求上下文存储
 */
class RequestContextStore {
  private static instance: RequestContextStore;
  private storage = new AsyncLocalStorage<RequestContextData>();

  static getInstance(): RequestContextStore {
    if (!RequestContextStore.instance) {
      RequestContextStore.instance = new RequestContextStore();
    }
    return RequestContextStore.instance;
  }

  run<T>(context: RequestContextData, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get(): RequestContextData | undefined {
    return this.storage.getStore();
  }

  set(key: keyof RequestContextData, value: any): void {
    const store = this.storage.getStore();
    if (store) {
      (store as any)[key] = value;
    }
  }

  setMetadata(key: string, value: any): void {
    const store = this.storage.getStore();
    if (store) {
      store.metadata[key] = value;
    }
  }
}

// 导出单例
export const requestContext = RequestContextStore.getInstance();

/**
 * 便捷获取函数
 */
export function getRequestId(): string {
  return requestContext.get()?.requestId || 'unknown';
}

export function getCorrelationId(): string {
  return (
    requestContext.get()?.correlationId ||
    requestContext.get()?.requestId ||
    'unknown'
  );
}

export function getCurrentUserId(): string | undefined {
  return requestContext.get()?.userId;
}

export function getCurrentConversationId(): string | undefined {
  return requestContext.get()?.conversationId;
}

export function setConversationId(id: string): void {
  requestContext.set('conversationId', id);
}

export function setAgentType(type: string): void {
  requestContext.set('agentType', type);
}

export function getRequestDuration(): number {
  const ctx = requestContext.get();
  return ctx ? Date.now() - ctx.startTime : 0;
}

/**
 * 请求上下文中间件
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestContextMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const context: RequestContextData = {
      requestId: randomUUID(),
      correlationId: req.headers['x-correlation-id'] as string,
      path: req.path,
      method: req.method,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      startTime: Date.now(),
      metadata: {},
    };

    // 设置响应头
    res.setHeader('X-Request-Id', context.requestId);
    if (context.correlationId) {
      res.setHeader('X-Correlation-Id', context.correlationId);
    }

    // 请求完成时记录
    res.on('finish', () => {
      const duration = Date.now() - context.startTime;
      this.logger.debug(
        `${context.method} ${context.path} - ${res.statusCode} - ${duration}ms`,
        { requestId: context.requestId },
      );
    });

    // 在上下文中运行后续中间件和处理器
    requestContext.run(context, () => {
      next();
    });
  }
}

/**
 * 用户信息注入中间件 (在 Auth Guard 之后使用)
 */
@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;
    if (user) {
      requestContext.set('userId', user.sub || user.userId);
      requestContext.set('userRole', user.role);
      requestContext.set('isVip', user.role === 'VIP' || user.role === 'ADMIN');
    }
    next();
  }
}

/**
 * 上下文感知的 Logger
 */
export function createContextLogger(name: string) {
  const logger = new Logger(name);

  return {
    log: (message: string, ...args: any[]) => {
      logger.log(`[${getRequestId()}] ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      logger.error(`[${getRequestId()}] ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      logger.warn(`[${getRequestId()}] ${message}`, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      logger.debug(`[${getRequestId()}] ${message}`, ...args);
    },
    verbose: (message: string, ...args: any[]) => {
      logger.verbose(`[${getRequestId()}] ${message}`, ...args);
    },
  };
}
