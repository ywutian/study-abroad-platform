import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

// Sensitive fields that should be masked in logs
const SENSITIVE_FIELDS = [
  'password', 'passwordHash', 'token', 'refreshToken', 'accessToken',
  'secret', 'apiKey', 'authorization', 'creditCard', 'ssn', 'cvv',
];

/**
 * Recursively mask sensitive fields in an object
 */
function maskSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
        masked[key] = '[REDACTED]';
      } else {
        masked[key] = maskSensitiveData(value, depth + 1);
      }
    }
    return masked;
  }
  
  return obj;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const userId = (request as unknown as { user?: { id?: string } }).user?.id;
    const startTime = Date.now();
    
    // Log request body (masked) for non-GET requests in debug mode
    if (process.env.LOG_LEVEL === 'debug' && method !== 'GET' && request.body) {
      const maskedBody = maskSensitiveData(request.body);
      this.logger.debug(`Request body: ${JSON.stringify(maskedBody)}`);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;
          this.logger.log(`${method} ${url} ${response.statusCode} ${duration}ms ${userId ? `[${userId}]` : ''}`);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(`${method} ${url} ${error.status || 500} ${duration}ms ${userId ? `[${userId}]` : ''}`);
        },
      })
    );
  }
}

export { maskSensitiveData };







