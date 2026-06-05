import { describe, expect, it } from 'vitest';
import { toStableParams } from './use-list-query';

/**
 * toStableParams is the primitive that makes list cache keys stable + deduped.
 * Its contract: drop blank filters, preserve scalars, and serialise nested
 * structures deterministically so deep-equal filter sets hash to one cache entry.
 */
describe('toStableParams', () => {
  it('drops blank values (undefined / null / empty string / empty array)', () => {
    expect(
      toStableParams({ search: '', country: undefined, degree: null, tags: [], page: 1 })
    ).toEqual({ page: 1 });
  });

  it('returns an empty object for undefined / fully-blank filters', () => {
    expect(toStableParams(undefined)).toEqual({});
    expect(toStableParams({ a: '', b: null })).toEqual({});
  });

  it('preserves scalar types, including boolean false and zero', () => {
    expect(toStableParams({ unreadOnly: false, verified: true, page: 0, q: 'x' })).toEqual({
      unreadOnly: false,
      verified: true,
      page: 0,
      q: 'x',
    });
  });

  it('produces identical output for deep-equal filter sets regardless of key order', () => {
    const a = toStableParams({ search: 'mit', country: 'US', degree: 'MS' });
    const b = toStableParams({ degree: 'MS', search: 'mit', country: 'US' });
    expect(a).toEqual(b);
    // Same JSON encoding (what React Query hashes) — a real cache hit, not just deep-equal.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('serialises nested objects with sorted keys so order does not cause a cache miss', () => {
    const a = toStableParams({ weights: { gpa: 0.5, test: 0.5 } });
    const b = toStableParams({ weights: { test: 0.5, gpa: 0.5 } });
    expect(a.weights).toBe(b.weights);
    expect(typeof a.weights).toBe('string');
  });

  it('drops nested objects that are entirely blank', () => {
    expect(toStableParams({ advanced: { region: '', minRank: null } })).toEqual({});
  });

  it('serialises non-empty arrays deterministically', () => {
    const out = toStableParams({ majors: ['cs', 'ee'] });
    expect(typeof out.majors).toBe('string');
    expect(out.majors).toBe('["cs","ee"]');
  });
});
