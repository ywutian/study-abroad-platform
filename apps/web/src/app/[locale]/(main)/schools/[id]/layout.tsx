import { cache } from 'react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { API_ROUTES, API_VERSION_PREFIX } from '@study-abroad/shared';
import { SchoolJsonLd } from '@/components/seo';
import { env } from '@/lib/env';

/**
 * page.tsx is `'use client'` and fetches the school in a `useQuery`, so the
 * server-rendered HTML for every one of the ~243 detail pages was the empty
 * app shell: no <h1>, ~48 characters of visible text, and — because a client
 * page cannot export generateMetadata — the root layout's *homepage* <title>
 * and description repeated identically on all of them. Crawlers were being
 * handed hundreds of duplicate, contentless URLs (the sitemap now points at
 * every one of them), which is how thin-content pages get dropped instead of
 * ranked.
 *
 * This layout re-fetches the same public endpoint on the server so the initial
 * HTML carries per-school metadata and structured data. It deliberately does
 * NOT render visible markup: the client page already owns the header, and
 * duplicating it here would double it on screen.
 *
 * ponytail: metadata + JSON-LD only. Server-rendering the actual page body is
 * a 445-line client-component refactor — worth doing only if Search Console
 * shows Google still not indexing these once they stop looking identical.
 */

interface SchoolSeoFields {
  name?: string;
  nameZh?: string;
  description?: string;
  descriptionZh?: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

/**
 * `cache` dedupes this between generateMetadata and the layout body, which
 * Next renders in separate passes — otherwise every page hits the API twice.
 * Returns null rather than throwing: a school page that 500s because its SEO
 * sidecar failed would be far worse than one that falls back to the root
 * metadata.
 */
const getSchool = cache(async (id: string): Promise<SchoolSeoFields | null> => {
  const apiUrl = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  if (!apiUrl) return null;

  try {
    const res = await fetch(`${apiUrl}${API_VERSION_PREFIX}${API_ROUTES.SCHOOLS}/${id}`, {
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data as SchoolSeoFields) ?? null;
  } catch {
    return null;
  }
});

const localizedName = (school: SchoolSeoFields, locale: string) =>
  (locale === 'zh' ? school.nameZh : school.name) || school.name || school.nameZh;

const localizedDescription = (school: SchoolSeoFields, locale: string) =>
  (locale === 'zh' ? school.descriptionZh : school.description) ||
  school.description ||
  school.descriptionZh;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const school = await getSchool(id);
  // Unknown id / API down — inherit the root metadata rather than invent one.
  if (!school) return {};

  const name = localizedName(school, locale);
  if (!name) return {};

  // Only facts the API actually returned; no placeholders, so a school missing
  // rank or acceptance rate simply gets a shorter title.
  const place = [school.city, school.state].filter(Boolean).join(', ');
  const facts = [
    place,
    typeof school.usNewsRank === 'number' ? `US News #${school.usNewsRank}` : null,
    typeof school.acceptanceRate === 'number'
      ? locale === 'zh'
        ? `录取率 ${school.acceptanceRate}%`
        : `${school.acceptanceRate}% acceptance`
      : null,
  ].filter(Boolean);

  return {
    title: facts.length ? `${name} · ${facts.join(' · ')}` : name,
    description: localizedDescription(school, locale) ?? undefined,
    openGraph: { title: name, description: localizedDescription(school, locale) ?? undefined },
  };
}

export default async function SchoolDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const school = await getSchool(id);
  const name = school ? localizedName(school, locale) : null;

  return (
    <>
      {school && name ? (
        <SchoolJsonLd
          name={name}
          url={school.website}
          description={localizedDescription(school, locale)}
          address={{
            addressLocality: school.city,
            addressRegion: school.state,
            addressCountry: school.country,
          }}
        />
      ) : null}
      {children}
    </>
  );
}
