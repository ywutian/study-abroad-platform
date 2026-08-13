import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request } from 'express';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const route =
      (request.route?.path as string | undefined) || request.url || 'unknown';
    const user = (request as Request & { user?: { id?: string } }).user;

    return new Observable((subscriber) => {
      Sentry.startSpan(
        {
          name: `${method} ${route}`,
          op: 'http.server',
          attributes: {
            'http.method': method,
            'http.route': route,
            'http.url': request.url,
            ...(user?.id ? { 'user.id': user.id } : {}),
          },
        },
        () => {
          return next
            .handle()
            .pipe(
              tap({
                next: (value) => subscriber.next(value),
                complete: () => subscriber.complete(),
              }),
              catchError((error: unknown) => {
                const errorRecord =
                  typeof error === 'object' && error !== null
                    ? (error as Record<string, unknown>)
                    : {};
                const statusCodeCandidate =
                  errorRecord.status ?? errorRecord.statusCode;
                const statusCode =
                  typeof statusCodeCandidate === 'number'
                    ? statusCodeCandidate
                    : 500;

                if (statusCode >= 500) {
                  Sentry.withScope((scope) => {
                    scope.setTag('type', 'api_error');
                    scope.setExtra('path', request.url);
                    scope.setExtra('method', method);
                    scope.setExtra('statusCode', statusCode);

                    if (user?.id) {
                      scope.setUser({ id: user.id });
                    }

                    Sentry.captureException(error);
                  });
                }

                return throwError(() => error);
              }),
            )
            .subscribe({
              error: (error: unknown): void => {
                subscriber.error(error);
              },
            });
        },
      );
    });
  }
}
