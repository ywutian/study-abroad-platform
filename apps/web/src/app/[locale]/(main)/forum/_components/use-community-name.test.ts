import { describe, expect, it } from 'vitest';

import en from '@/messages/en.json';
import zh from '@/messages/zh.json';

import { TRANSLATED_COMMUNITY_SLUGS } from './use-community-name';

const enNames = (en as { forum: { communityNames: Record<string, string> } }).forum.communityNames;
const zhNames = (zh as { forum: { communityNames: Record<string, string> } }).forum.communityNames;

describe('community display names', () => {
  it('has a key in both locales for every slug it claims to translate', () => {
    // A slug in the set with no message key makes next-intl render the raw key
    // ("communityNames.debate") into the sidebar — worse than the English name
    // this exists to replace.
    for (const slug of TRANSLATED_COMMUNITY_SLUGS) {
      expect(enNames, `en.json is missing ${slug}`).toHaveProperty(slug);
      expect(zhNames, `zh.json is missing ${slug}`).toHaveProperty(slug);
    }
  });

  it('carries no message key the resolver will never look up', () => {
    for (const slug of Object.keys(enNames)) {
      expect(TRANSLATED_COMMUNITY_SLUGS.has(slug), `${slug} is dead config`).toBe(true);
    }
  });

  it('actually translates — no zh value left equal to its English one', () => {
    // The whole defect was a zh reader seeing "Personal Statement". Pasting the
    // English string into zh.json would satisfy every other check here.
    for (const slug of TRANSLATED_COMMUNITY_SLUGS) {
      expect(zhNames[slug], `zh.${slug} is still English`).not.toBe(enNames[slug]);
    }
  });
});
