import { describe, expect, it } from 'vitest';

import { isSafeUrl } from './url';

describe('isSafeUrl', () => {
  it('accepts http and https (any case)', () => {
    expect(isSafeUrl('https://x.com')).toBe(true);
    expect(isSafeUrl('http://x.com')).toBe(true);
    expect(isSafeUrl('HTTPS://X.COM')).toBe(true);
  });

  it('rejects javascript:/data:, relative paths, and nullish (XSS guard)', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>')).toBe(false);
    expect(isSafeUrl('/relative/path')).toBe(false);
    expect(isSafeUrl('//protocol-relative.com')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });
});
