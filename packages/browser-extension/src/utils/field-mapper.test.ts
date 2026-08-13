import { beforeEach, describe, expect, it } from 'vitest';

import {
  autoFillForm,
  COMMONAPP_FIELD_MAPPINGS,
  getAvailableFields,
  getNestedValue,
} from './field-mapper';

describe('getNestedValue', () => {
  const o = { a: { b: { c: 1 } }, x: 0, n: null };

  it('resolves nested paths, including falsy-but-present values', () => {
    expect(getNestedValue(o, 'a.b.c')).toBe(1);
    expect(getNestedValue(o, 'x')).toBe(0);
  });

  it('returns undefined for any missing segment', () => {
    expect(getNestedValue(o, 'a.b.zzz')).toBeUndefined();
    expect(getNestedValue(o, 'a.missing.c')).toBeUndefined();
    expect(getNestedValue(o, 'nope')).toBeUndefined();
    expect(getNestedValue(o, 'n.c')).toBeUndefined();
  });
});

describe('COMMONAPP_FIELD_MAPPINGS integrity', () => {
  // A duplicate profilePath or selector means two mappings fight over one
  // field — the silent "filled the wrong box" class. Guard against it.
  it('has unique profilePaths', () => {
    const paths = COMMONAPP_FIELD_MAPPINGS.map((m) => m.profilePath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('has unique selectors', () => {
    const sels = COMMONAPP_FIELD_MAPPINGS.map((m) => m.selector);
    expect(new Set(sels).size).toBe(sels.length);
  });

  it('every entry has a selector, a profilePath, and a valid type', () => {
    const VALID = new Set(['text', 'select', 'radio', 'checkbox', 'date']);
    for (const m of COMMONAPP_FIELD_MAPPINGS) {
      expect(m.selector).toBeTruthy();
      expect(m.profilePath).toBeTruthy();
      expect(VALID.has(m.type)).toBe(true);
    }
  });
});

describe('autoFillForm (jsdom)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  const val = (sel: string) => (document.querySelector(sel) as HTMLInputElement).value;

  it('fills matching text fields from the nested profile and counts them', () => {
    document.body.innerHTML = `<input name="firstName"><input name="email"><input name="gpa">`;
    const r = autoFillForm({
      firstName: 'Mei',
      email: 'mei@x.com',
      education: { gpa: '3.9' },
    } as never);
    expect(val('[name="firstName"]')).toBe('Mei');
    expect(val('[name="email"]')).toBe('mei@x.com');
    expect(val('[name="gpa"]')).toBe('3.9');
    expect(r.filled).toBe(3);
  });

  it('matches a select option by value', () => {
    document.body.innerHTML = `<select name="state"><option value="">--</option><option value="CA">California</option></select>`;
    autoFillForm({ address: { state: 'CA' } } as never);
    expect(val('[name="state"]')).toBe('CA');
  });

  it('normalizes a date to ISO yyyy-mm-dd', () => {
    document.body.innerHTML = `<input name="dateOfBirth" type="date">`;
    autoFillForm({ dateOfBirth: '2008-03-15' } as never);
    expect(val('[name="dateOfBirth"]')).toBe('2008-03-15');
  });

  it('skips disabled inputs (counts as skipped, not filled)', () => {
    document.body.innerHTML = `<input name="firstName" disabled>`;
    const r = autoFillForm({ firstName: 'Mei' } as never);
    expect(val('[name="firstName"]')).toBe('');
    expect(r.filled).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it('does not fill when the profile has no value for the field', () => {
    document.body.innerHTML = `<input name="firstName">`;
    const r = autoFillForm({} as never);
    expect(val('[name="firstName"]')).toBe('');
    expect(r.filled).toBe(0);
  });
});

describe('getAvailableFields (jsdom)', () => {
  it('reports which mappings have a matching element on the page', () => {
    document.body.innerHTML = `<input name="firstName">`;
    const fields = getAvailableFields();
    expect(fields).toHaveLength(COMMONAPP_FIELD_MAPPINGS.length);
    expect(fields.find((f) => f.profilePath === 'firstName')?.hasElement).toBe(true);
    expect(fields.find((f) => f.profilePath === 'email')?.hasElement).toBe(false);
  });
});
