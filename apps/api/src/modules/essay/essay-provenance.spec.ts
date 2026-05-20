/**
 * Round-trip tests for the essay-provenance tag parser (PR 2 · §B).
 *
 * The parser itself lives in `@study-abroad/shared` so the web bundle
 * can share it; the test runner only exists on the API side, so the
 * spec lives here. Failure modes covered:
 *   - Canonical `source:<url>#<author>` tag
 *   - `www.` stripping
 *   - Fragment-style URLs (`#essay4`) where the author is the LAST hash
 *   - `anon` sentinel collapsing to null author
 *   - Missing / malformed / non-http tags
 *   - Editorial label map + fallback to bare host
 */
import { parseEssayProvenance, getArchiveLabel } from '@study-abroad/shared';

describe('parseEssayProvenance', () => {
  it('parses canonical url#author tag', () => {
    const r = parseEssayProvenance([
      'source:https://apply.jhu.edu/hopkins-insider/korean-sticky-notes/#Nancy',
      'jhu',
      'essays-that-worked',
    ]);
    expect(r.archive).toBe('apply.jhu.edu');
    expect(r.url).toBe(
      'https://apply.jhu.edu/hopkins-insider/korean-sticky-notes/',
    );
    expect(r.author).toBe('Nancy');
  });

  it('strips a leading www.', () => {
    const r = parseEssayProvenance(['source:https://www.hamilton.edu/foo#Lia']);
    expect(r.archive).toBe('hamilton.edu');
    expect(r.url).toBe('https://www.hamilton.edu/foo');
    expect(r.author).toBe('Lia');
  });

  it('collapses the anon sentinel to null author', () => {
    const r = parseEssayProvenance([
      'source:https://blog.collegevine.com/stanford-essay-example#essay4#anon',
    ]);
    expect(r.archive).toBe('blog.collegevine.com');
    expect(r.url).toBe(
      'https://blog.collegevine.com/stanford-essay-example#essay4',
    );
    expect(r.author).toBeNull();
  });

  it('returns all-null fields when no source tag is present', () => {
    const r = parseEssayProvenance(['stem', 'research', 'recruited']);
    expect(r.archive).toBeNull();
    expect(r.url).toBeNull();
    expect(r.author).toBeNull();
  });

  it('returns all-null on a malformed URL', () => {
    const r = parseEssayProvenance(['source:not-a-url#Whoever']);
    expect(r.archive).toBeNull();
    expect(r.url).toBeNull();
    expect(r.author).toBeNull();
  });

  it('ignores non-http source tags (reddit, etc.)', () => {
    const r = parseEssayProvenance(['source:reddit:ApplyingToCollege']);
    expect(r.archive).toBeNull();
    expect(r.url).toBeNull();
  });

  it('handles null / undefined tags', () => {
    expect(parseEssayProvenance(null).archive).toBeNull();
    expect(parseEssayProvenance(undefined).archive).toBeNull();
    expect(parseEssayProvenance([]).archive).toBeNull();
  });
});

describe('getArchiveLabel', () => {
  it('returns the editorial label for known hosts', () => {
    expect(getArchiveLabel('apply.jhu.edu', 'zh')).toContain('约翰·霍普金斯');
    expect(getArchiveLabel('apply.jhu.edu', 'en')).toContain('Johns Hopkins');
  });

  it('falls back to the bare host for unknown archives', () => {
    expect(getArchiveLabel('random-blog.example', 'en')).toBe(
      'random-blog.example',
    );
  });

  it('returns null when archive is null/undefined', () => {
    expect(getArchiveLabel(null, 'en')).toBeNull();
    expect(getArchiveLabel(undefined, 'zh')).toBeNull();
  });
});
