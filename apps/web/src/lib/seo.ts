import type { Metadata } from 'next';
import { locales, defaultLocale } from './i18n/config';

const LOCALE_PREFIX = new RegExp(`^/(${locales.join('|')})(?=/|$)`);

/**
 * canonical + hreflang for a locale-prefixed pathname.
 * `/zh/schools` -> canonical `/zh/schools`, alternates `/en/schools` + `/zh/schools`.
 *
 * Resolved against `metadataBase` (NEXT_PUBLIC_APP_URL) by Next, so the values
 * stay relative here. Query strings are intentionally dropped — `?tab=x` is a
 * view of the same page, not a separate one.
 */
export function buildAlternates(pathname: string): NonNullable<Metadata['alternates']> {
  const match = LOCALE_PREFIX.exec(pathname);
  const locale = match?.[1] ?? defaultLocale;
  // strip trailing slash so `/zh/` and `/zh` don't canonicalize to two URLs
  const suffix = (match ? pathname.slice(match[0].length) : pathname).replace(/\/+$/, '');

  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, `/${l}${suffix}`])),
      'x-default': `/${defaultLocale}${suffix}`,
    },
  };
}
