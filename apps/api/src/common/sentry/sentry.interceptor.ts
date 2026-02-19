import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Request } from 'express';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error) => {
        // Only capture server errors (5xx)
        const statusCode = error.status || error.statusCode || 500;

        if (statusCode >= 500) {
          const request = context.switchToHttp().getRequest<Request>();

          Sentry.withScope((scope) => {
            scope.setTag('type', 'api_error');
            scope.setExtra('path', request.url);
            scope.setExtra('method', request.method);
            scope.setExtra('statusCode', statusCode);

            const user = (request as Request & { user?: { id?: string } }).user;
            if (user?.id) {
              // Only send user ID to Sentry, not PII like email
              scope.setUser({ id: user.id });
            }

            Sentry.captureException(error);
          });
        }

        return throwError(() => error);
      }),
    );
  }
}
