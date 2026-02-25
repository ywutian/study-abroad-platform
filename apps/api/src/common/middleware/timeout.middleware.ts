import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Global request timeout middleware.
 * Returns 408 Request Timeout if a request exceeds the configured threshold.
 *
 * Default: 30s for regular endpoints, 60s for auth (login/refresh), 120s for AI endpoints.
 * Configurable via REQUEST_TIMEOUT_MS, AUTH_REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS.
 */
@Injectable()
export class TimeoutMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TimeoutMiddleware.name);
  private readonly defaultTimeoutMs = Number(
    process.env.REQUEST_TIMEOUT_MS || 30_000,
  );
  private readonly aiTimeoutMs = Number(
    process.env.AI_REQUEST_TIMEOUT_MS || 120_000,
  );

  use(req: Request, res: Response, next: NextFunction) {
    // Use originalUrl which always contains the full path (req.path may be
    // stripped of the global prefix inside NestJS middleware routing).
    const url = req.originalUrl || req.path;

    const isAiEndpoint =
      url.includes('/ai-agent/') ||
      url.includes('/ai/') ||
      url.includes('/prediction') ||
      url.includes('/recommendation');

    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/refresh');
    const authTimeoutMs = Number(process.env.AUTH_REQUEST_TIMEOUT_MS || 60_000);

    const timeoutMs = isAiEndpoint
      ? this.aiTimeoutMs
      : isAuthEndpoint
        ? authTimeoutMs
        : this.defaultTimeoutMs;

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const correlationId = req.correlationId || 'unknown';
        this.logger.warn(
          `[${correlationId}] Request timeout after ${timeoutMs}ms: ${req.method} ${url}`,
        );

        res.status(408).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'The request timed out. Please try again.',
            timestamp: new Date().toISOString(),
            path: req.url,
          },
        });
      }
    }, timeoutMs);

    // Clear timeout when response finishes
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  }
}
