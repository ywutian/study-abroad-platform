import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
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
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) || randomUUID();

    req.correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}








