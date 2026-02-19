import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n/config';
import { env } from '@/lib/env';

const baseUrl = env.NEXT_PUBLIC_APP_URL;

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    '/api/',
    ...locales.flatMap((locale) => [
      `/${locale}/dashboard/`,
      `/${locale}/chat/`,
      `/${locale}/settings/`,
      `/${locale}/admin/`,
    ]),
  ];

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow,
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
