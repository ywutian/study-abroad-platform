import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from '@study-abroad/shared';

export interface RequestLocaleInput {
  explicitLocale?: string | string[] | undefined;
  userLocale?: string | null | undefined;
  acceptLanguage?: string | string[] | undefined;
}

function pickLocale(
  value: string | string[] | null | undefined,
): SupportedLocale | null {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  for (const rawValue of values) {
    for (const part of rawValue.split(',')) {
      const token = (part.split(';')[0] ?? '')
        .trim()
        .toLowerCase()
        .replace('_', '-');
      if (!token) continue;
      if (isSupportedLocale(token)) return token;
      if (token.startsWith('zh')) return 'zh';
      if (token.startsWith('en')) return 'en';
    }
  }

  return null;
}

export function resolveRequestLocale(
  input: RequestLocaleInput,
): SupportedLocale {
  return (
    pickLocale(input.explicitLocale) ??
    pickLocale(input.userLocale) ??
    pickLocale(input.acceptLanguage) ??
    DEFAULT_LOCALE
  );
}
