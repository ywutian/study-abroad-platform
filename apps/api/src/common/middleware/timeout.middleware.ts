import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { AI_REQUEST_TIMEOUT_MS } from '@study-abroad/shared';
import { Request, Response, NextFunction } from 'express';

/**
 * URL substrings that mark a route as AI/LLM-heavy and therefore deserving of the
 * extended AI timeout budget rather than the 30s default. This is the single source
 * of truth the matcher reads — middleware runs before Nest resolves the handler, so
 * it cannot read `@ThrottleAI()` metadata at runtime; instead, EVERY controller route
 * that makes a synchronous LLM call on the request path MUST be reachable by one of
 * these substrings. Kept in sync with the `@ThrottleAI()`-decorated LLM endpoints and
 * locked by `timeout.middleware.spec.ts` (a regression test asserts each AI route gets
 * the AI budget). When you add an LLM endpoint, add its path segment here + a test row.
 *
 * Over-matching a fast route is harmless (it only raises that route's hang ceiling);
 * under-matching a slow LLM route causes a spurious 408 (the #393/#395 + sibling-sweep
 * bug class: /ai-analysis, /essay-ai, /essay-debate, /activities AI ops, ranking-analysis).
 */
export const AI_ENDPOINT_URL_SEGMENTS = [
  '/ai-agent/',
  '/ai/', // also covers nested AI routes e.g. /resumes/:id/ai/review
  '/ai-analysis', // GET/POST /profiles/me/ai-analysis (fans out per-school LLM calls)
  '/prediction',
  '/recommendation',
  '/essay-ai/', // POST /essay-ai/* (polish/review/brainstorm/… — up to 10 LLM calls)
  '/essay-debate/', // POST /essay-debate/turn (one-shot rebuttal LLM call)
  '/activities/', // POST /profiles/me/activities/{ai-sort,:id/refine,:id/generate-common-app-description}
  '/halls/ranking-analysis', // POST /halls/ranking-analysis (precise — rest of /halls is fast reads)
] as const;

/**
 * Global request timeout middleware.
 * Returns 408 Request Timeout if a request exceeds the configured threshold.
 *
 * Default: 30s for regular endpoints, 60s for auth (login/refresh), 120s for AI endpoints.
 * Configurable via REQUEST_TIMEOUT_MS, AUTH_REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS.
 * The AI default is the shared `AI_REQUEST_TIMEOUT_MS` so web + mobile clients can't
 * drift below the server budget (the FE/BE drift class — see the shared constant).
 */
@Injectable()
export class TimeoutMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TimeoutMiddleware.name);
  private readonly defaultTimeoutMs = Number(
    process.env.REQUEST_TIMEOUT_MS || 30_000,
  );
  private readonly aiTimeoutMs = Number(
    process.env.AI_REQUEST_TIMEOUT_MS || AI_REQUEST_TIMEOUT_MS,
  );

  use(req: Request, res: Response, next: NextFunction) {
    // Use originalUrl which always contains the full path (req.path may be
    // stripped of the global prefix inside NestJS middleware routing).
    const url = req.originalUrl || req.path;

    const isAiEndpoint = AI_ENDPOINT_URL_SEGMENTS.some((segment) =>
      url.includes(segment),
    );

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
