import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
  Inject,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';

interface LogContext {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.REQUEST })
export class LoggerService implements NestLoggerService {
  private context?: string;

  constructor(@Inject(REQUEST) private readonly request?: Request) {}

  setContext(context: string) {
    this.context = context;
  }

  private getCorrelationId(): string | undefined {
    return this.request?.correlationId;
  }

  private formatMessage(
    level: string,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const correlationId = context?.correlationId || this.getCorrelationId();

    const logObject = {
      timestamp,
      level,
      correlationId,
      context: this.context,
      message,
      ...context,
    };

    // In production, output JSON for log aggregators
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logObject);
    }

    // In development, output human-readable format
    const contextStr = this.context ? `[${this.context}]` : '';
    const corrIdStr = correlationId ? `[${correlationId.slice(0, 8)}]` : '';
    const extraStr = context ? ` ${JSON.stringify(context)}` : '';
    return `${timestamp} ${level.toUpperCase().padEnd(5)} ${corrIdStr}${contextStr} ${message}${extraStr}`;
  }

  log(message: string, context?: LogContext) {
    console.log(this.formatMessage('info', message, context));
  }

  error(message: string, trace?: string, context?: LogContext) {
    console.error(this.formatMessage('error', message, { ...context, trace }));
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context));
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  verbose(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.formatMessage('verbose', message, context));
    }
  }

  // HTTP Request logging
  logRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string,
  ) {
    this.log(`${method} ${path} ${statusCode} ${duration}ms`, {
      method,
      path,
      statusCode,
      duration,
      userId,
    });
  }

  // Business event logging
  logEvent(event: string, data?: Record<string, unknown>) {
    this.log(`Event: ${event}`, data);
  }

  // Audit logging
  logAudit(
    action: string,
    userId: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, unknown>,
  ) {
    this.log(`Audit: ${action}`, {
      action,
      userId,
      resource,
      resourceId,
      ...metadata,
    });
  }
}
