import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n/config';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://studyabroad.app';

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
