import { describe, it, expect } from 'vitest';
import { buildAlternates } from './seo';

describe('buildAlternates', () => {
  it('canonicalizes to the requested locale path', () => {
    expect(buildAlternates('/zh/schools').canonical).toBe('/zh/schools');
    expect(buildAlternates('/en/schools').canonical).toBe('/en/schools');
  });

  it('points each hreflang at the same page in the other locale', () => {
    expect(buildAlternates('/zh/forum/123').languages).toEqual({
      en: '/en/forum/123',
      zh: '/zh/forum/123',
      'x-default': '/zh/forum/123',
    });
  });

  it('does not treat a non-locale first segment as a locale prefix', () => {
    // would silently canonicalize /schools -> /zh if the prefix match were naive
    expect(buildAlternates('/schools').canonical).toBe('/zh/schools');
  });

  it('collapses trailing slashes so a page has exactly one canonical', () => {
    expect(buildAlternates('/zh/').canonical).toBe('/zh');
    expect(buildAlternates('/en/schools/').canonical).toBe('/en/schools');
  });
});
