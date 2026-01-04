import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../logger/logger.service';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private logger: LoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const userId = (request as unknown as { user?: { id?: string } }).user?.id;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;
          this.logger.logRequest(method, url, response.statusCode, duration, userId);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.logRequest(method, url, error.status || 500, duration, userId);
        },
      })
    );
  }
}




