import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { stripHtml } from '../utils/sanitize';

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request.body && typeof request.body === 'object') {
      this.sanitizeObject(request.body);
    }
    return next.handle();
  }

  private sanitizeObject(obj: Record<string, any>): void {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        obj[key] = stripHtml(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObject(obj[key]);
      }
    }
  }
}
