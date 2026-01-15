/**
 * 分布式追踪服务
 *
 * 记录请求链路，便于排障和性能分析
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getRequestId, requestContext, getCorrelationId } from '../context';

// ==================== Span 定义 ====================

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  service: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'ok' | 'error';
  tags: Record<string, string | number | boolean>;
  logs: SpanLog[];
}

export interface SpanLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, any>;
}

// ==================== Span Context ====================

interface SpanContext {
  traceId: string;
  spanId: string;
}

// ==================== 服务实现 ====================

@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);

  // 存储活跃 Span (生产环境应发送到 Jaeger/Zipkin)
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: Span[] = [];
  private readonly maxCompletedSpans = 1000;

  /**
   * 开始一个新 Span
   */
  startSpan(
    name: string,
    options?: {
      parentSpanId?: string;
      tags?: Record<string, string | number | boolean>;
    },
  ): Span {
    const ctx = requestContext.get();
    const traceId = ctx?.requestId || getCorrelationId() || randomUUID();

    const span: Span = {
      traceId,
      spanId: randomUUID().slice(0, 16),
      parentSpanId: options?.parentSpanId,
      name,
      service: 'ai-agent',
      startTime: Date.now(),
      status: 'ok',
      tags: {
        'http.method': ctx?.method || 'unknown',
        'http.path': ctx?.path || 'unknown',
        'user.id': ctx?.userId || 'anonymous',
        ...options?.tags,
      },
      logs: [],
    };

    this.activeSpans.set(span.spanId, span);
    return span;
  }

  /**
   * 结束 Span
   */
  endSpan(span: Span, status?: 'ok' | 'error') {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    if (status) {
      span.status = status;
    }

    this.activeSpans.delete(span.spanId);
    this.completedSpans.push(span);

    // 限制存储数量
    if (this.completedSpans.length > this.maxCompletedSpans) {
      this.completedSpans = this.completedSpans.slice(-this.maxCompletedSpans);
    }

    // 记录慢请求
    if (span.duration > 5000) {
      this.logger.warn(`Slow span: ${span.name} took ${span.duration}ms`, {
        traceId: span.traceId,
        spanId: span.spanId,
      });
    }
  }

  /**
   * 添加标签
   */
  addTag(span: Span, key: string, value: string | number | boolean) {
    span.tags[key] = value;
  }

  /**
   * 添加日志
   */
  addLog(
    span: Span,
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, any>,
  ) {
    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      data,
    });
  }

  /**
   * 标记错误
   */
  setError(span: Span, error: Error) {
    span.status = 'error';
    span.tags['error'] = true;
    span.tags['error.message'] = error.message;
    span.tags['error.type'] = error.name;

    this.addLog(span, 'error', error.message, { stack: error.stack });
  }

  /**
   * 包装异步函数，自动追踪
   */
  async trace<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: {
      parentSpanId?: string;
      tags?: Record<string, string | number | boolean>;
    },
  ): Promise<T> {
    const span = this.startSpan(name, options);

    try {
      const result = await fn(span);
      this.endSpan(span, 'ok');
      return result;
    } catch (error) {
      this.setError(
        span,
        error instanceof Error ? error : new Error(String(error)),
      );
      this.endSpan(span, 'error');
      throw error;
    }
  }

  /**
   * 获取 Trace 信息
   */
  getTrace(traceId: string): Span[] {
    return this.completedSpans.filter((s) => s.traceId === traceId);
  }

  /**
   * 获取最近的 Span
   */
  getRecentSpans(limit: number = 100): Span[] {
    return this.completedSpans.slice(-limit);
  }

  /**
   * 获取慢请求
   */
  getSlowSpans(thresholdMs: number = 5000, limit: number = 50): Span[] {
    return this.completedSpans
      .filter((s) => s.duration && s.duration > thresholdMs)
      .slice(-limit);
  }

  /**
   * 获取错误 Span
   */
  getErrorSpans(limit: number = 50): Span[] {
    return this.completedSpans
      .filter((s) => s.status === 'error')
      .slice(-limit);
  }

  /**
   * 导出为 Jaeger 格式 (简化版)
   */
  exportJaegerFormat(traceId: string): any {
    const spans = this.getTrace(traceId);
    return {
      traceID: traceId,
      spans: spans.map((s) => ({
        traceID: s.traceId,
        spanID: s.spanId,
        parentSpanID: s.parentSpanId,
        operationName: s.name,
        startTime: s.startTime * 1000, // microseconds
        duration: (s.duration || 0) * 1000,
        tags: Object.entries(s.tags).map(([key, value]) => ({
          key,
          type: typeof value,
          value,
        })),
        logs: s.logs.map((l) => ({
          timestamp: l.timestamp * 1000,
          fields: [
            { key: 'level', value: l.level },
            { key: 'message', value: l.message },
          ],
        })),
      })),
    };
  }
}
