import { describe, it, expect } from 'vitest';
import { suggestEmailDomains, editDistance } from './email-suggestions';

describe('suggestEmailDomains', () => {
  it('returns nothing before an @ with a local part', () => {
    expect(suggestEmailDomains('')).toEqual([]);
    expect(suggestEmailDomains('foo')).toEqual([]);
    expect(suggestEmailDomains('@gmail.com')).toEqual([]);
  });

  it('lists top providers right after the @', () => {
    expect(suggestEmailDomains('foo@')).toEqual([
      'foo@gmail.com',
      'foo@outlook.com',
      'foo@hotmail.com',
      'foo@icloud.com',
    ]);
  });

  it('completes by domain prefix', () => {
    expect(suggestEmailDomains('foo@g')).toEqual(['foo@gmail.com']);
    expect(suggestEmailDomains('foo@q')).toEqual(['foo@qq.com']);
  });

  it('corrects common typos (edit distance ≤ 2)', () => {
    expect(suggestEmailDomains('foo@gmial.com')).toContain('foo@gmail.com');
    expect(suggestEmailDomains('foo@163.con')).toContain('foo@163.com');
  });

  it('suggests nothing for an already-valid domain', () => {
    expect(suggestEmailDomains('foo@gmail.com')).toEqual([]);
  });

  it('does not false-correct a clearly different domain', () => {
    expect(suggestEmailDomains('foo@university.edu')).toEqual([]);
  });
});

describe('editDistance', () => {
  it('computes Levenshtein distance', () => {
    expect(editDistance('gmail.com', 'gmail.com')).toBe(0);
    expect(editDistance('gmial.com', 'gmail.com')).toBe(2);
    expect(editDistance('a', 'b')).toBe(1);
  });
});
