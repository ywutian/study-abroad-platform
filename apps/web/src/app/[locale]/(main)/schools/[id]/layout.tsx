import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { SchoolJsonLd } from '@/components/seo';
import { getSchool } from './_components/get-school';
import type { SchoolDetail } from './_components/types';

/**
 * Per-school <title>/description and JSON-LD.
 *
 * These live in a layout rather than in page.tsx because a metadata export has
 * to sit in a server file, and this route's page was `'use client'` when the
 * metadata was added. page.tsx is a server shell now, so this could be folded
 * in — it is kept separate only because generateMetadata and JSON-LD are one
 * concern (what a crawler reads) and the page is another (what a visitor sees).
 *
 * Renders no visible markup on purpose: the client component owns the header,
 * and repeating it here would double it on screen.
 */

const localizedName = (school: SchoolDetail, locale: string) =>
  (locale === 'zh' ? school.nameZh : school.name) || school.name || school.nameZh;

const localizedDescription = (school: SchoolDetail, locale: string) =>
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

  const t = await getTranslations({ locale, namespace: 'school.meta' });

  // Only facts the API actually returned; no placeholders, so a school missing
  // rank or acceptance rate simply gets a shorter title.
  const place = [school.city, school.state].filter(Boolean).join(', ');
  const facts = [
    place,
    typeof school.usNewsRank === 'number' ? `US News #${school.usNewsRank}` : null,
    typeof school.acceptanceRate === 'number'
      ? t('acceptanceRate', { rate: school.acceptanceRate })
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
