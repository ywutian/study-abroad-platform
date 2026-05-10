import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { resolveRequestLocale } from '../utils/request-locale.util';
import type { SupportedLocale } from '@study-abroad/shared';

@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    const locale = resolveRequestLocale({
      explicitLocale: request.headers?.['x-locale'],
      userLocale: request.user?.locale,
      acceptLanguage: request.headers?.['accept-language'],
    });
    (request as { locale?: SupportedLocale }).locale = locale;
    if (request.user) {
      request.user = { ...request.user, locale };
    }

    return next.handle();
  }
}
