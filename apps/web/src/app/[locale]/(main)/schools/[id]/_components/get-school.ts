import { cache } from 'react';
import { API_ROUTES, API_VERSION_PREFIX } from '@study-abroad/shared';
import { env } from '@/lib/env';
import type { SchoolDetail } from './types';

/**
 * Server-side fetch of one school, shared by generateMetadata, the layout's
 * JSON-LD, and the page body.
 *
 * `cache` dedupes across those three: Next renders metadata, layout and page in
 * separate passes, so without it every request would hit the API three times.
 *
 * Returns null instead of throwing. Callers degrade rather than fail — metadata
 * falls back to the root layout's, and the page hands the client component no
 * initial data so its existing useQuery takes over exactly as it did before
 * this was server-rendered. A school page that 500s because its data prefetch
 * hiccuped would be far worse than one that paints a beat later.
 */
export const getSchool = cache(async (id: string): Promise<SchoolDetail | null> => {
  const apiUrl = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  if (!apiUrl) return null;

  try {
    const res = await fetch(`${apiUrl}${API_VERSION_PREFIX}${API_ROUTES.SCHOOLS}/${id}`, {
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data as SchoolDetail) ?? null;
  } catch {
    return null;
  }
});
