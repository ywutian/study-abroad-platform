import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n/config';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://studyabroad.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ['', '/schools', '/forum', '/login', '/register'];

  const entries: MetadataRoute.Sitemap = [];

  // Homepage (root - redirects to default locale)
  entries.push({
    url: baseUrl,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 1,
  });

  for (const locale of locales) {
    for (const path of routes) {
      const url = path ? `${baseUrl}/${locale}${path}` : `${baseUrl}/${locale}`;
      entries.push({
        url,
        lastModified: now,
        changeFrequency:
          path === '' ? 'weekly' : path === '/schools' || path === '/forum' ? 'weekly' : 'monthly',
        priority: path === '' ? 1 : path === '/schools' || path === '/forum' ? 0.9 : 0.7,
      });
    }
  }

  return entries;
}
