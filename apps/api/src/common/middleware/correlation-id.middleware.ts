import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  // Express request augmentation requires its global namespace declaration.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * 请求追踪中间件
 * 为每个请求分配唯一 ID，便于日志追踪和问题排查
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  use(req: Request, res: Response, next: NextFunction) {
    // [SECURITY] Validate client-supplied correlation ID to prevent log injection
    // and log inflation attacks. Accept only valid UUID format.
    const provided = req.headers[CORRELATION_ID_HEADER] as string;
    const correlationId =
      provided && CorrelationIdMiddleware.UUID_REGEX.test(provided)
        ? provided
        : randomUUID();

    req.correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
