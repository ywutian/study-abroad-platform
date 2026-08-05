import { stripCaseIdentity, stripInternalTags } from './case.constants';

/**
 * `AdmissionCase.tags` carries the essay importer's dedup key —
 * `source:<url>#<author>`, written by `prisma/seeds/essay-harvest/import-essays.ts:136`
 * and used as the idempotency key on re-import, so it cannot be removed from
 * the data. It reached users anyway: measured on production 2026-08-05, 20/20
 * cases on `GET /cases` and 10/10 rows on `GET /essay-ai/gallery` shipped it,
 * and `case-card.tsx` renders each tag as a badge — a 551px URL in a 386px
 * card, clipped by the card's own `overflow-hidden`.
 *
 * The fixtures below use the REAL production string, not `'source:x'`. A
 * fixture shorter than the thing that broke can pass while the real one still
 * fails (a length cap, a regex anchored differently); this one is the exact
 * value curl returned.
 */
const REAL_TAG =
  'source:https://www.shemmassianconsulting.com/blog/college-essay-examples#essay14#anon';

describe('internal tag stripping', () => {
  it('drops the importer dedup key and keeps the display tags', () => {
    const out = stripInternalTags({ tags: [REAL_TAG, 'brown', 'shemmassian'] });
    expect(out.tags).toEqual(['brown', 'shemmassian']);
  });

  it('strips for the OWNER too — it is bookkeeping, not case data', () => {
    // The owner branch of stripCaseIdentity returns early. If the tag filter is
    // ever moved inside that branch, this is the case that catches it.
    const owned = stripCaseIdentity(
      { userId: 'u1', tags: [REAL_TAG, 'brown'] },
      'u1',
    );
    expect(owned.tags).toEqual(['brown']);
  });

  it('strips for an admin too', () => {
    const asAdmin = stripCaseIdentity(
      { userId: 'someone-else', tags: [REAL_TAG, 'brown'] },
      'admin-id',
      true,
    );
    expect(asAdmin.tags).toEqual(['brown']);
  });

  it('still removes userId for a stranger, and does not lose other fields', () => {
    const out = stripCaseIdentity(
      { userId: 'owner', verifiedBy: 'v1', tags: [REAL_TAG], gpa: 3.9 },
      'stranger',
    );
    expect(out).not.toHaveProperty('userId');
    expect(out).not.toHaveProperty('verifiedBy');
    expect(out.tags).toEqual([]);
    expect(out.gpa).toBe(3.9);
  });

  it('no serialized response mentions the source URL', () => {
    // The assertion that survives a refactor: not "the array equals X" but
    // "the string is nowhere in what we send". Catches a future field that
    // reintroduces it by another name.
    const serialized = JSON.stringify(
      stripCaseIdentity({ userId: 'u', tags: [REAL_TAG, 'brown'] }, null),
    );
    expect(serialized).not.toContain('shemmassianconsulting.com');
    expect(serialized).not.toContain('source:');
  });

  it('leaves rows without tags untouched', () => {
    expect(stripInternalTags({ userId: 'u' })).toEqual({ userId: 'u' });
    expect(stripInternalTags({ tags: null })).toEqual({ tags: null });
  });
});
