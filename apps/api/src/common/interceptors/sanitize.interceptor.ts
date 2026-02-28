import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { stripHtml } from '../utils/sanitize';

const MAX_SANITIZE_DEPTH = 10;

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.body != null && typeof request.body === 'object') {
      request.body = this.sanitizeValue(request.body, 0);
    }
    return next.handle();
  }

  /**
   * Recursively sanitize all string values in the request body.
   * Handles arrays, nested objects, and enforces a depth limit
   * to prevent stack overflow from deeply nested payloads.
   */
  private sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > MAX_SANITIZE_DEPTH || value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'string') {
      return stripHtml(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item, depth + 1));
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        obj[key] = this.sanitizeValue(obj[key], depth + 1);
      }
      return obj;
    }
    return value;
  }
}
