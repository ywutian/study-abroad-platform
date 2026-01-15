import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Request, Response as ExpressResponse } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    timestamp: string;
    correlationId?: string;
    responseTimeMs?: number;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<ExpressResponse>();
    const correlationId = (request as any).correlationId as string | undefined;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        // Set response time header
        const responseTimeMs = Date.now() - startTime;
        response.setHeader('X-Response-Time', `${responseTimeMs}ms`);
      }),
      map((data) => ({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          ...(correlationId && { correlationId }),
          responseTimeMs: Date.now() - startTime,
        },
      })),
    );
  }
}
