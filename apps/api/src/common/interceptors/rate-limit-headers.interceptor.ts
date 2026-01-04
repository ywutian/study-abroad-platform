/**
 * Rate Limit Headers Interceptor
 * 
 * 在响应中添加标准的限流 Headers
 * 
 * Headers:
 * - X-RateLimit-Limit: 每个时间窗口的请求上限
 * - X-RateLimit-Remaining: 剩余可用请求数
 * - X-RateLimit-Reset: 下次重置时间（Unix 时间戳）
 * - X-RateLimit-Concurrent: 当前并发请求数
 * - X-RateLimit-Concurrent-Max: 最大并发请求数
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetIn: number; // ms
  concurrent?: number;
  maxConcurrent?: number;
}

// 扩展 Request 类型
declare module 'express' {
  interface Request {
    rateLimit?: RateLimitInfo;
  }
}

@Injectable()
export class RateLimitHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        const rateLimit = request.rateLimit;
        
        if (rateLimit) {
          // 标准限流 Headers (RFC 6585)
          response.setHeader('X-RateLimit-Limit', rateLimit.limit);
          response.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimit.remaining));
          response.setHeader(
            'X-RateLimit-Reset',
            Math.ceil((Date.now() + rateLimit.resetIn) / 1000)
          );

          // 并发限制 Headers
          if (rateLimit.concurrent !== undefined) {
            response.setHeader('X-RateLimit-Concurrent', rateLimit.concurrent);
          }
          if (rateLimit.maxConcurrent !== undefined) {
            response.setHeader('X-RateLimit-Concurrent-Max', rateLimit.maxConcurrent);
          }
        }
      }),
    );
  }
}


