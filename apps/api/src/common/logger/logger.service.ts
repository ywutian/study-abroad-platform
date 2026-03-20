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

  private static readonly SEVERITY_MAP: Record<string, string> = {
    info: 'INFO',
    warn: 'WARNING',
    error: 'ERROR',
    debug: 'DEBUG',
    verbose: 'DEBUG',
  };

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
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
      severity: LoggerService.SEVERITY_MAP[level] || 'DEFAULT',
      correlationId,
      context: this.context,
      message,
      ...context,
    };

    // In production, output JSON for Cloud Logging / log aggregators
    if (this.isProduction) {
      return JSON.stringify(logObject);
    }

    // In development, output human-readable format
    const contextStr = this.context ? `[${this.context}]` : '';
    const corrIdStr = correlationId ? `[${correlationId.slice(0, 8)}]` : '';
    const extraStr = context ? ` ${JSON.stringify(context)}` : '';
    return `${timestamp} ${level.toUpperCase().padEnd(5)} ${corrIdStr}${contextStr} ${message}${extraStr}`;
  }

  private writeOutput(level: string, formatted: string): void {
    if (this.isProduction) {
      // In production, route errors to stderr and everything else to stdout
      // so Cloud Logging picks up the correct severity
      if (level === 'error') {
        process.stderr.write(formatted + '\n');
      } else {
        process.stdout.write(formatted + '\n');
      }
    } else {
      // In development, use console methods for colored output
      switch (level) {
        case 'error':
          console.error(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'debug':
          console.debug(formatted);
          break;
        default:
          console.log(formatted);
          break;
      }
    }
  }

  log(message: string, context?: LogContext) {
    this.writeOutput('info', this.formatMessage('info', message, context));
  }

  error(message: string, trace?: string, context?: LogContext) {
    this.writeOutput(
      'error',
      this.formatMessage('error', message, { ...context, trace }),
    );
  }

  warn(message: string, context?: LogContext) {
    this.writeOutput('warn', this.formatMessage('warn', message, context));
  }

  debug(message: string, context?: LogContext) {
    if (!this.isProduction) {
      this.writeOutput('debug', this.formatMessage('debug', message, context));
    }
  }

  verbose(message: string, context?: LogContext) {
    if (!this.isProduction) {
      this.writeOutput(
        'verbose',
        this.formatMessage('verbose', message, context),
      );
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
