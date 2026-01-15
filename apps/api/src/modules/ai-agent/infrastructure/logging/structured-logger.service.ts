/**
 * 企业级结构化日志服务
 *
 * 特性:
 * - JSON 格式输出（便于 ELK/Datadog 分析）
 * - 请求追踪 (requestId, traceId, spanId)
 * - 敏感数据自动脱敏
 * - 日志级别动态控制
 * - 性能指标自动记录
 * - 上下文自动注入
 */

import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SanitizerService,
  SanitizeLevel,
} from '../../memory/sanitizer.service';

// ==================== 类型定义 ====================

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

export interface LogContext {
  /** 请求ID */
  requestId?: string;
  /** 追踪ID (分布式追踪) */
  traceId?: string;
  /** Span ID */
  spanId?: string;
  /** 用户ID */
  userId?: string;
  /** 会话ID */
  conversationId?: string;
  /** Agent 类型 */
  agentType?: string;
  /** 操作名称 */
  operation?: string;
  /** 自定义属性 */
  [key: string]: unknown;
}

export interface LogEntry {
  /** ISO 时间戳 */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 日志消息 */
  message: string;
  /** 服务名称 */
  service: string;
  /** 环境 */
  environment: string;
  /** 上下文信息 */
  context: LogContext;
  /** 错误信息 */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  /** 性能指标 */
  metrics?: {
    durationMs?: number;
    memoryUsageMB?: number;
    cpuUsagePercent?: number;
  };
  /** 额外数据 */
  data?: Record<string, unknown>;
}

export interface StructuredLoggerOptions {
  /** 服务名称 */
  serviceName?: string;
  /** 最小日志级别 */
  minLevel?: LogLevel;
  /** 是否启用脱敏 */
  enableSanitization?: boolean;
  /** 脱敏级别 */
  sanitizeLevel?: SanitizeLevel;
  /** 是否输出到控制台 */
  consoleOutput?: boolean;
  /** 是否美化输出 (开发环境) */
  prettyPrint?: boolean;
}

// ==================== 日志级别优先级 ====================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
  [LogLevel.VERBOSE]: 4,
};

// ==================== 服务实现 ====================

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService implements LoggerService {
  private context: LogContext = {};
  private readonly serviceName: string;
  private readonly environment: string;
  private readonly minLevel: LogLevel;
  private readonly enableSanitization: boolean;
  private readonly sanitizeLevel: SanitizeLevel;
  private readonly prettyPrint: boolean;

  constructor(
    private config: ConfigService,
    private sanitizer: SanitizerService,
  ) {
    this.serviceName = this.config.get('APP_NAME', 'ai-agent');
    this.environment = this.config.get('NODE_ENV', 'development');
    this.minLevel = this.config.get('LOG_LEVEL', LogLevel.INFO);
    this.enableSanitization =
      this.config.get('LOG_SANITIZE', 'true') === 'true';
    this.sanitizeLevel = SanitizeLevel.LIGHT;
    this.prettyPrint = this.environment === 'development';
  }

  // ==================== 上下文管理 ====================

  /**
   * 设置日志上下文
   */
  setContext(context: LogContext): this {
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * 清除上下文
   */
  clearContext(): this {
    this.context = {};
    return this;
  }

  /**
   * 创建子 Logger（继承上下文）
   */
  child(additionalContext: LogContext): StructuredLoggerService {
    const child = new StructuredLoggerService(this.config, this.sanitizer);
    child.setContext({ ...this.context, ...additionalContext });
    return child;
  }

  // ==================== 日志方法 ====================

  log(message: string, context?: LogContext | string): void {
    this.writeLog(LogLevel.INFO, message, this.normalizeContext(context));
  }

  error(message: string, trace?: string, context?: LogContext | string): void {
    const ctx = this.normalizeContext(context);
    if (trace) {
      ctx.error = { name: 'Error', message, stack: trace };
    }
    this.writeLog(LogLevel.ERROR, message, ctx);
  }

  warn(message: string, context?: LogContext | string): void {
    this.writeLog(LogLevel.WARN, message, this.normalizeContext(context));
  }

  debug(message: string, context?: LogContext | string): void {
    this.writeLog(LogLevel.DEBUG, message, this.normalizeContext(context));
  }

  verbose(message: string, context?: LogContext | string): void {
    this.writeLog(LogLevel.VERBOSE, message, this.normalizeContext(context));
  }

  // ==================== 结构化日志方法 ====================

  /**
   * 记录带数据的日志
   */
  info(
    message: string,
    data?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    this.writeLog(
      LogLevel.INFO,
      message,
      { ...this.context, ...context },
      undefined,
      data,
    );
  }

  /**
   * 记录错误（带完整错误对象）
   */
  logError(message: string, error: Error, context?: LogContext): void {
    this.writeLog(
      LogLevel.ERROR,
      message,
      { ...this.context, ...context },
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as NodeJS.ErrnoException).code,
      },
    );
  }

  /**
   * 记录带性能指标的日志
   */
  logWithMetrics(
    message: string,
    metrics: { durationMs?: number; memoryUsageMB?: number },
    context?: LogContext,
  ): void {
    const entry = this.buildLogEntry(LogLevel.INFO, message, {
      ...this.context,
      ...context,
    });
    entry.metrics = metrics;
    this.output(entry);
  }

  /**
   * 记录操作开始
   */
  startOperation(
    operation: string,
    context?: LogContext,
  ): { end: (data?: Record<string, unknown>) => void } {
    const startTime = Date.now();
    const ctx = { ...this.context, ...context, operation };

    this.writeLog(LogLevel.DEBUG, `${operation} started`, ctx);

    return {
      end: (data?: Record<string, unknown>) => {
        const duration = Date.now() - startTime;
        const entry = this.buildLogEntry(
          LogLevel.INFO,
          `${operation} completed`,
          ctx,
        );
        entry.metrics = { durationMs: duration };
        entry.data = data;
        this.output(entry);
      },
    };
  }

  /**
   * 记录 Agent 事件
   */
  logAgentEvent(
    event: string,
    agentType: string,
    data?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    this.writeLog(
      LogLevel.INFO,
      `Agent event: ${event}`,
      { ...this.context, ...context, agentType, event },
      undefined,
      data,
    );
  }

  /**
   * 记录工具调用
   */
  logToolCall(
    toolName: string,
    args: Record<string, unknown>,
    result: { success: boolean; durationMs: number; error?: string },
    context?: LogContext,
  ): void {
    const level = result.success ? LogLevel.INFO : LogLevel.WARN;
    const entry = this.buildLogEntry(level, `Tool call: ${toolName}`, {
      ...this.context,
      ...context,
      tool: toolName,
    });
    entry.metrics = { durationMs: result.durationMs };
    entry.data = {
      arguments: this.sanitizeData(args),
      success: result.success,
      error: result.error,
    };
    this.output(entry);
  }

  /**
   * 记录 LLM 调用
   */
  logLLMCall(
    model: string,
    tokens: { prompt: number; completion: number },
    durationMs: number,
    context?: LogContext,
  ): void {
    const entry = this.buildLogEntry(LogLevel.INFO, `LLM call: ${model}`, {
      ...this.context,
      ...context,
      model,
    });
    entry.metrics = { durationMs };
    entry.data = {
      promptTokens: tokens.prompt,
      completionTokens: tokens.completion,
      totalTokens: tokens.prompt + tokens.completion,
    };
    this.output(entry);
  }

  /**
   * 记录内存操作
   */
  logMemoryOperation(
    operation: 'create' | 'read' | 'update' | 'delete' | 'search',
    count: number,
    durationMs: number,
    context?: LogContext,
  ): void {
    const entry = this.buildLogEntry(
      LogLevel.DEBUG,
      `Memory ${operation}: ${count} items`,
      { ...this.context, ...context, memoryOperation: operation },
    );
    entry.metrics = { durationMs };
    entry.data = { count };
    this.output(entry);
  }

  // ==================== 私有方法 ====================

  private normalizeContext(context?: LogContext | string): LogContext {
    if (!context) return { ...this.context };
    if (typeof context === 'string')
      return { ...this.context, component: context };
    return { ...this.context, ...context };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private writeLog(
    level: LogLevel,
    message: string,
    context: LogContext,
    error?: LogEntry['error'],
    data?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.buildLogEntry(level, message, context);
    if (error) entry.error = error;
    if (data) entry.data = this.sanitizeData(data);

    this.output(entry);
  }

  private buildLogEntry(
    level: LogLevel,
    message: string,
    context: LogContext,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message: this.enableSanitization
        ? this.sanitizer.sanitize(message, { level: this.sanitizeLevel })
        : message,
      service: this.serviceName,
      environment: this.environment,
      context: this.sanitizeContext(context),
    };
  }

  private sanitizeContext(context: LogContext): LogContext {
    if (!this.enableSanitization) return context;

    const sanitized: LogContext = {};
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizer.sanitize(value, {
          level: this.sanitizeLevel,
        });
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    if (!this.enableSanitization) return data;

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizer.sanitize(value, {
          level: this.sanitizeLevel,
        });
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private output(entry: LogEntry): void {
    const output = this.prettyPrint
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建带上下文的 Logger
 */
export function createLogger(
  baseLogger: StructuredLoggerService,
  context: LogContext,
): StructuredLoggerService {
  return baseLogger.child(context);
}
