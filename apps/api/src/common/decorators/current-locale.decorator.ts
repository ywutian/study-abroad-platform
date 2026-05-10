import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { resolveRequestLocale } from '../utils/request-locale.util';
import type { SupportedLocale } from '@study-abroad/shared';

export const CurrentLocale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SupportedLocale => {
    const request = ctx.switchToHttp().getRequest();
    const requestWithLocale = request as { locale?: SupportedLocale };

    if (requestWithLocale.locale) {
      return requestWithLocale.locale;
    }

    return resolveRequestLocale({
      explicitLocale: request.headers?.['x-locale'],
      userLocale: request.user?.locale,
      acceptLanguage: request.headers?.['accept-language'],
    });
  },
);
