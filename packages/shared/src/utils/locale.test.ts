import { describe, expect, it } from 'vitest';

import {
  getSchoolDisplayName,
  isSupportedLocale,
  normalizeLocale,
  normalizeSchoolName,
  toBcp47,
} from './locale';

describe('isSupportedLocale', () => {
  it('accepts the supported locales', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('zh')).toBe(true);
  });

  it('rejects unsupported values, wrong case, and non-strings (exact membership)', () => {
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale('EN')).toBe(false);
    expect(isSupportedLocale('zh-CN')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});

describe('normalizeLocale', () => {
  it('maps region tags to the base supported locale (case + underscore tolerant)', () => {
    expect(normalizeLocale('zh-CN')).toBe('zh');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('EN_us')).toBe('en');
  });

  it('parses an Accept-Language header to the first usable locale', () => {
    expect(normalizeLocale('en-US,en;q=0.9,zh;q=0.8')).toBe('en');
  });

  it('falls back when nothing matches or input is the wrong type', () => {
    expect(normalizeLocale('fr', 'en')).toBe('en');
    expect(normalizeLocale(123, 'zh')).toBe('zh');
    expect(normalizeLocale(undefined, 'en')).toBe('en');
  });

  it('resolves the first usable entry of an array', () => {
    expect(normalizeLocale(['en-US'], 'zh')).toBe('en');
  });
});

describe('toBcp47', () => {
  it('expands base locales to BCP-47 tags', () => {
    expect(toBcp47('zh')).toBe('zh-CN');
    expect(toBcp47('en')).toBe('en-US');
  });

  it('uses the fallback for unknown input', () => {
    expect(toBcp47('fr', 'en')).toBe('en-US');
  });
});

describe('getSchoolDisplayName', () => {
  const school = { name: 'MIT', nameZh: '麻省理工' };

  it('prefers nameZh in zh, name in en', () => {
    expect(getSchoolDisplayName(school, 'zh')).toBe('麻省理工');
    expect(getSchoolDisplayName(school, 'en')).toBe('MIT');
  });

  it('falls back to the other name when one is missing', () => {
    expect(getSchoolDisplayName({ name: 'MIT', nameZh: null }, 'zh')).toBe('MIT');
    expect(getSchoolDisplayName({ name: '', nameZh: '麻省理工' }, 'en')).toBe('麻省理工');
  });
});

describe('normalizeSchoolName', () => {
  it('lowercases and trims (matches the DB nameNorm trigger)', () => {
    expect(normalizeSchoolName('  Harvard University  ')).toBe('harvard university');
    expect(normalizeSchoolName('MIT')).toBe('mit');
  });
});
