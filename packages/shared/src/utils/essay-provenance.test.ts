import { describe, expect, it } from 'vitest';

import { getArchiveLabel, parseEssayProvenance } from './essay-provenance';

describe('parseEssayProvenance', () => {
  it('returns all-null for missing / empty tags (legacy-row tolerant)', () => {
    expect(parseEssayProvenance(null)).toEqual({ archive: null, url: null, author: null });
    expect(parseEssayProvenance(undefined)).toEqual({ archive: null, url: null, author: null });
    expect(parseEssayProvenance([])).toEqual({ archive: null, url: null, author: null });
  });

  it('parses source:<url>#<author> into archive/url/author and strips www from archive', () => {
    expect(parseEssayProvenance(['source:https://www.hamilton.edu/essays/4#Nancy'])).toEqual({
      archive: 'hamilton.edu',
      url: 'https://www.hamilton.edu/essays/4',
      author: 'Nancy',
    });
  });

  it('collapses the anon sentinel to a null author (case-insensitive)', () => {
    expect(parseEssayProvenance(['source:https://x.com/a#anon']).author).toBeNull();
    expect(parseEssayProvenance(['source:https://x.com/a#ANON']).author).toBeNull();
  });

  it('treats a tag with no #author as author-null', () => {
    const p = parseEssayProvenance(['source:https://x.com/a']);
    expect(p).toEqual({ archive: 'x.com', url: 'https://x.com/a', author: null });
  });

  it('takes the LAST # segment as the author, re-attaching url fragments', () => {
    expect(parseEssayProvenance(['source:https://x.com/p#essay4#Nancy'])).toEqual({
      archive: 'x.com',
      url: 'https://x.com/p#essay4',
      author: 'Nancy',
    });
  });

  it('skips non-http source markers and picks the first http source tag', () => {
    expect(parseEssayProvenance(['source:reddit:t3_abc'])).toEqual({
      archive: null,
      url: null,
      author: null,
    });
    expect(parseEssayProvenance(['source:reddit:x', 'source:https://x.com/a#Bob']).author).toBe(
      'Bob'
    );
  });

  it('returns all-null when the url fails to parse (never surfaces a junk link)', () => {
    expect(parseEssayProvenance(['source:https://'])).toEqual({
      archive: null,
      url: null,
      author: null,
    });
  });
});

describe('getArchiveLabel', () => {
  it('returns the editorial label for a known archive per locale', () => {
    expect(getArchiveLabel('apply.jhu.edu', 'en')).toBe("Johns Hopkins 'Essays That Worked'");
    expect(getArchiveLabel('apply.jhu.edu', 'zh')).toContain('约翰');
  });

  it('falls back to the bare host for an unknown archive', () => {
    expect(getArchiveLabel('some.unknown.edu', 'en')).toBe('some.unknown.edu');
  });

  it('returns null for a nullish archive', () => {
    expect(getArchiveLabel(null, 'en')).toBeNull();
    expect(getArchiveLabel(undefined, 'zh')).toBeNull();
  });
});
