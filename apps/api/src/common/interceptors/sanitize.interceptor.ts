import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { stripHtml } from '../utils/sanitize';

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.body && typeof request.body === 'object') {
      this.sanitizeObject(request.body as Record<string, unknown>);
    }
    return next.handle();
  }

  private sanitizeObject(obj: Record<string, unknown>): void {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        obj[key] = stripHtml(value);
      } else if (typeof value === 'object' && value !== null) {
        this.sanitizeObject(value as Record<string, unknown>);
      }
    }
  }
}
