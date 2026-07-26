import type { MetadataRoute } from 'next';
// Deliberately NOT importing from '@/lib/api/client': that module pulls sonner
// and the Zustand auth store in at module scope, which has no business in a
// server-only route.
import { API_ROUTES, API_VERSION_PREFIX } from '@study-abroad/shared';
import { locales } from '@/lib/i18n/config';
import { env } from '@/lib/env';

const baseUrl = env.NEXT_PUBLIC_APP_URL;

/**
 * Regenerate daily. School rows are added without a redeploy, and a sitemap
 * frozen at build time would keep them uncrawlable until the next release.
 */
export const revalidate = 86400;

/** The list endpoint caps pageSize at 100 (PaginationDto). */
const PAGE_SIZE = 100;
/**
 * ponytail: runaway guard only — 60 pages is 6,000 schools against 243 today.
 * If the catalogue ever approaches that, sitemap.xml needs splitting into a
 * sitemap index anyway (50,000-URL limit, halved by the ×2 locale fan-out).
 */
const MAX_PAGES = 60;

interface SchoolEntry {
  id: string;
  updatedAt: string | null;
}

/**
 * Detail pages are the only substantial indexable content this site has, so
 * they belong in the sitemap. Never throws: a sitemap that fails the build (or
 * 500s) is worse than one missing its school half, so any failure degrades to
 * whatever was collected plus the static routes.
 */
async function fetchSchools(): Promise<SchoolEntry[]> {
  const apiUrl = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  // No API origin (local dev without the backend) — static routes only.
  if (!apiUrl) return [];

  const schools: SchoolEntry[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(
        `${apiUrl}${API_VERSION_PREFIX}${API_ROUTES.SCHOOLS}?page=${page}&pageSize=${PAGE_SIZE}`,
        { signal: AbortSignal.timeout(15_000) }
      );
      if (!res.ok) break;

      const body = await res.json();
      const items: unknown = body?.data?.items;
      if (!Array.isArray(items)) break;

      for (const item of items) {
        const id = (item as { id?: unknown })?.id;
        if (typeof id === 'string' && id) {
          const updatedAt = (item as { updatedAt?: unknown })?.updatedAt;
          schools.push({ id, updatedAt: typeof updatedAt === 'string' ? updatedAt : null });
        }
      }

      // Stop on the last page — and on a missing/zero totalPages, so a shape
      // change can't spin this to MAX_PAGES.
      if (page >= (Number(body?.data?.totalPages) || 0)) break;
    }
  } catch {
    // Network error / timeout / malformed JSON — keep whatever we collected.
  }
  return schools;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  for (const school of await fetchSchools()) {
    for (const locale of locales) {
      entries.push({
        url: `${baseUrl}/${locale}/schools/${school.id}`,
        lastModified: school.updatedAt ? new Date(school.updatedAt) : now,
        changeFrequency: 'monthly',
        priority: 0.8,
      });
    }
  }

  return entries;
}
