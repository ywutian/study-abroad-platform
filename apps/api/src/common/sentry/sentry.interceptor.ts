import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error) => {
        // Only capture server errors (5xx)
        const statusCode = error.status || error.statusCode || 500;
        
        if (statusCode >= 500) {
          const request = context.switchToHttp().getRequest();
          
          Sentry.withScope((scope) => {
            scope.setTag('type', 'api_error');
            scope.setExtra('path', request.url);
            scope.setExtra('method', request.method);
            scope.setExtra('statusCode', statusCode);
            
            if (request.user) {
              scope.setUser({
                id: request.user.id,
                email: request.user.email,
              });
            }
            
            Sentry.captureException(error);
          });
        }
        
        return throwError(() => error);
      }),
    );
  }
}









