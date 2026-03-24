import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './url';

describe('isSafeUrl', () => {
  it('accepts http URLs', () => {
    expect(isSafeUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isSafeUrl('HTTPS://example.com')).toBe(true);
    expect(isSafeUrl('Http://example.com')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URIs', () => {
    expect(isSafeUrl('data:text/html,<h1>XSS</h1>')).toBe(false);
  });

  it('rejects ftp: protocol', () => {
    expect(isSafeUrl('ftp://example.com')).toBe(false);
  });

  it('rejects null, undefined, and empty string', () => {
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });

  it('rejects strings without protocol', () => {
    expect(isSafeUrl('example.com')).toBe(false);
    expect(isSafeUrl('www.example.com')).toBe(false);
  });
});
