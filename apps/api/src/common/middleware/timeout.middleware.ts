import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Global request timeout middleware.
 * Returns 408 Request Timeout if a request exceeds the configured threshold.
 *
 * Default: 30s for regular endpoints, 120s for AI endpoints.
 * Configurable via REQUEST_TIMEOUT_MS environment variable.
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
    const isAiEndpoint =
      req.path.includes('/ai-agent/') ||
      req.path.includes('/ai/') ||
      req.path.includes('/prediction') ||
      req.path.includes('/recommendation');

    const timeoutMs = isAiEndpoint ? this.aiTimeoutMs : this.defaultTimeoutMs;

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const correlationId = (req as any).correlationId || 'unknown';
        this.logger.warn(
          `[${correlationId}] Request timeout after ${timeoutMs}ms: ${req.method} ${req.path}`,
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
