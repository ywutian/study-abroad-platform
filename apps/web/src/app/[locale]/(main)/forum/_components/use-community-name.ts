'use client';

import { useTranslations } from 'next-intl';

/**
 * Official community slugs whose names are ordinary English prose, so a zh
 * reader should see Chinese. Seeded by `apps/api/prisma/seed-forum-communities.ts`.
 *
 * The DB `name` stays canonical English on purpose — `create-post-dialog`
 * writes it into `post.tags` and dedupes new communities against it — so the
 * translation happens at display time only. Renaming a community in the seed
 * changes its slug, which is what this map is keyed on; a slug with no entry
 * simply renders its `name`.
 *
 * Deliberately absent: `sat`, `john-locke`, `ac-list`. The first two are proper
 * nouns that Chinese applicants write in English anyway (学术能力评估测试 would
 * be worse, not better), and "AC List" appears nowhere else in this codebase —
 * translating a term whose meaning is unconfirmed puts a wrong Chinese label in
 * front of users, which is worse than leaving the English one. Add them here
 * once someone confirms what they should say.
 *
 * Anything else is a user-created community: show what the user typed, never
 * translate user input.
 */
export const TRANSLATED_COMMUNITY_SLUGS = new Set([
  'personal-statement',
  'personal-essay',
  'debate',
  'mun',
  'competition',
  'school-news',
  'campus-life',
  'general',
]);

type NamedCommunity = { slug: string; name: string };

/**
 * Returns a display-name resolver. Use it for anything a user reads; use the
 * raw `community.name` for anything that gets stored or compared.
 */
export function useCommunityName() {
  const t = useTranslations('forum');

  return (community: NamedCommunity) =>
    TRANSLATED_COMMUNITY_SLUGS.has(community.slug)
      ? t(`communityNames.${community.slug}`)
      : community.name;
}
