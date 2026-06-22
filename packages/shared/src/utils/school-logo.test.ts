import { describe, expect, it } from 'vitest';

import {
  extractSchoolLogoDomain,
  getSchoolFaviconUrl,
  getSchoolLogoDevUrl,
  getSchoolLogoSources,
  isValidSchoolLogoUrl,
  normalizeSchoolLogoUrl,
} from './school-logo';

describe('normalizeSchoolLogoUrl', () => {
  it('trims and returns the url', () => {
    expect(normalizeSchoolLogoUrl('  https://x.com/a.png  ')).toBe('https://x.com/a.png');
  });

  it('returns null for empty / whitespace / nullish input', () => {
    expect(normalizeSchoolLogoUrl('')).toBeNull();
    expect(normalizeSchoolLogoUrl('   ')).toBeNull();
    expect(normalizeSchoolLogoUrl(null)).toBeNull();
    expect(normalizeSchoolLogoUrl(undefined)).toBeNull();
  });
});

describe('isValidSchoolLogoUrl', () => {
  it('accepts http(s) urls', () => {
    expect(isValidSchoolLogoUrl('https://logo.dev/a.png')).toBe(true);
    expect(isValidSchoolLogoUrl('http://x.com/a.png')).toBe(true);
  });

  it('rejects non-http protocols, localhost, and garbage', () => {
    expect(isValidSchoolLogoUrl('ftp://x.com/a.png')).toBe(false);
    expect(isValidSchoolLogoUrl('https://localhost/a.png')).toBe(false);
    expect(isValidSchoolLogoUrl('https://app.localhost/a.png')).toBe(false);
    expect(isValidSchoolLogoUrl('not a url')).toBe(false);
    expect(isValidSchoolLogoUrl(null)).toBe(false);
  });
});

describe('extractSchoolLogoDomain', () => {
  it('strips protocol, path and a leading www', () => {
    expect(extractSchoolLogoDomain('https://www.mit.edu/admissions')).toBe('mit.edu');
  });

  it('adds https:// when the scheme is missing', () => {
    expect(extractSchoolLogoDomain('stanford.edu')).toBe('stanford.edu');
  });

  it('returns null for localhost / empty / nullish', () => {
    expect(extractSchoolLogoDomain('localhost')).toBeNull();
    expect(extractSchoolLogoDomain('')).toBeNull();
    expect(extractSchoolLogoDomain(null)).toBeNull();
  });
});

describe('getSchoolFaviconUrl', () => {
  it('builds a google favicon url from the website domain', () => {
    expect(getSchoolFaviconUrl('https://www.mit.edu')).toBe(
      'https://www.google.com/s2/favicons?domain=mit.edu&sz=256'
    );
  });

  it('honors a custom size and returns null without a resolvable domain', () => {
    expect(getSchoolFaviconUrl('mit.edu', 64)).toContain('sz=64');
    expect(getSchoolFaviconUrl(null)).toBeNull();
  });
});

describe('getSchoolLogoDevUrl', () => {
  it('builds a logo.dev url from domain + token', () => {
    expect(getSchoolLogoDevUrl('mit.edu', 'tok')).toBe(
      'https://img.logo.dev/mit.edu?token=tok&size=256'
    );
  });

  it('returns null without a token, blank token, or a non-dotted domain', () => {
    expect(getSchoolLogoDevUrl('mit.edu', null)).toBeNull();
    expect(getSchoolLogoDevUrl('mit.edu', '  ')).toBeNull();
    expect(getSchoolLogoDevUrl('nodot', 'tok')).toBeNull();
  });
});

describe('getSchoolLogoSources', () => {
  it('returns the normalized logo as source and a favicon fallback', () => {
    const r = getSchoolLogoSources({ logoUrl: '  https://cdn/a.png ', website: 'mit.edu' });
    expect(r.source).toBe('https://cdn/a.png');
    expect(r.fallbackSource).toContain('google.com/s2/favicons');
  });

  it('yields null source/fallback when neither input is usable', () => {
    const r = getSchoolLogoSources({ logoUrl: null, website: null });
    expect(r.source).toBeNull();
    expect(r.fallbackSource).toBeNull();
  });
});
