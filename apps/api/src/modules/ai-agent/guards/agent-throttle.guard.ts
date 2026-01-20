/**
 * AI Agent 限流 Guard
 *
 * 功能:
 * - 请求频率限流
 * - 配额检查
 * - 并发请求限制
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterService } from '../core/rate-limiter.service';
import { TokenTrackerService } from '../core/token-tracker.service';

// 装饰器元数据 Key
export const SKIP_AGENT_THROTTLE = 'skipAgentThrottle';
export const AGENT_THROTTLE_TYPE = 'agentThrottleType';

// 跳过限流装饰器
export const SkipAgentThrottle =
  () => (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(
      SKIP_AGENT_THROTTLE,
      true,
      descriptor?.value || target,
    );
  };

// 自定义限流类型装饰器
export const AgentThrottleType =
  (type: 'user' | 'conversation' | 'agent') =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(
      AGENT_THROTTLE_TYPE,
      type,
      descriptor?.value || target,
    );
  };

// 并发限制配置
const MAX_CONCURRENT_REQUESTS = 2; // 每用户最大并发请求数
const VIP_MAX_CONCURRENT = 5; // VIP 用户

@Injectable()
export class AgentThrottleGuard implements CanActivate {
  private readonly logger = new Logger(AgentThrottleGuard.name);

  // 追踪每个用户的当前请求数
  private activeRequests: Map<string, number> = new Map();

  constructor(
    private reflector: Reflector,
    private rateLimiter: RateLimiterService,
    private tokenTracker: TokenTrackerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否跳过
    const skip = this.reflector.get<boolean>(
      SKIP_AGENT_THROTTLE,
      context.getHandler(),
    );
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const user = request.user;

    if (!user?.sub) {
      return true; // 未登录用户由 Auth Guard 处理
    }

    const userId = user.sub;
    const isVip = user.role === 'VIP' || user.role === 'ADMIN';
    const maxConcurrent = isVip ? VIP_MAX_CONCURRENT : MAX_CONCURRENT_REQUESTS;

    // 获取限流类型
    const throttleType =
      this.reflector.get<'user' | 'conversation' | 'agent'>(
        AGENT_THROTTLE_TYPE,
        context.getHandler(),
      ) || 'user';

    // 1. 并发请求检查
    const currentRequests = this.activeRequests.get(userId) || 0;
    if (currentRequests >= maxConcurrent) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Concurrent Requests',
          message: `您有 ${currentRequests} 个请求正在处理中，请等待完成`,
          concurrent: currentRequests,
          maxConcurrent,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. 频率限流检查
    const limitResult = await this.rateLimiter.checkLimit(
      userId,
      throttleType,
      isVip,
    );
    if (!limitResult.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Rate Limit Exceeded',
          message: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil(limitResult.resetIn / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3. 配额检查
    const quotaResult = await this.tokenTracker.checkQuota(userId);
    if (!quotaResult.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'Quota Exceeded',
          message: quotaResult.reason || '使用配额已达上限',
          usage: quotaResult.usage,
        },
        HttpStatus.PAYMENT_REQUIRED, // 402
      );
    }

    // 增加并发计数
    this.activeRequests.set(userId, currentRequests + 1);

    // 请求完成时减少计数
    response.on('finish', () => {
      const count = this.activeRequests.get(userId) || 1;
      if (count <= 1) {
        this.activeRequests.delete(userId);
      } else {
        this.activeRequests.set(userId, count - 1);
      }
    });

    // 注入限流信息到请求
    request.rateLimit = {
      remaining: limitResult.remaining,
      limit: limitResult.limit,
      resetIn: Math.ceil(limitResult.resetIn / 1000),
      concurrent: currentRequests + 1,
      maxConcurrent,
    };

    return true;
  }

  /**
   * 获取并发统计（用于监控）
   */
  getConcurrentStats(): { total: number; byUser: Record<string, number> } {
    const byUser: Record<string, number> = {};
    let total = 0;

    this.activeRequests.forEach((count, userId) => {
      byUser[userId] = count;
      total += count;
    });

    return { total, byUser };
  }
}
