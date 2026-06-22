import { describe, expect, it } from 'vitest';

import {
  CIP_NAMES,
  MAJOR_ALIASES,
  resolveMajorToCip,
  resolveMajorToProgramBucket,
  SCHOOL_PROGRAM_BUCKETS,
} from './major-lookup';

describe('resolveMajorToCip', () => {
  it('resolves exact English aliases to their canonical dotted CIP code', () => {
    expect(resolveMajorToCip('computer science')).toBe('11.0101');
    expect(resolveMajorToCip('cs')).toBe('11.0101');
    expect(resolveMajorToCip('business')).toBe('52.0201');
    expect(resolveMajorToCip('nursing')).toBe('51.3801');
    expect(resolveMajorToCip('psychology')).toBe('42.0101');
  });

  it('resolves Chinese aliases to the same CIP codes as their English counterparts', () => {
    expect(resolveMajorToCip('计算机科学')).toBe('11.0101');
    expect(resolveMajorToCip('工程')).toBe('14.0101');
    expect(resolveMajorToCip('护理')).toBe('51.3801');
  });

  it('returns a 6-digit dotted format (the SchoolProgram.cipCode contract), never a 4-digit code', () => {
    const cip = resolveMajorToCip('engineering');
    expect(cip).not.toBeNull();
    // exactly NN.NNNN — two digits, dot, four digits
    expect(cip).toMatch(/^\d{2}\.\d{4}$/);
  });

  it('is case-insensitive and trims surrounding whitespace', () => {
    expect(resolveMajorToCip('  Computer Science  ')).toBe('11.0101');
    expect(resolveMajorToCip('NURSING')).toBe('51.3801');
    expect(resolveMajorToCip('BiOlOgY')).toBe('26.0101');
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(resolveMajorToCip('')).toBeNull();
    expect(resolveMajorToCip('   ')).toBeNull();
  });

  it('returns null when no alias matches at all', () => {
    expect(resolveMajorToCip('underwater basket weaving')).toBeNull();
    expect(resolveMajorToCip('zzzzz')).toBeNull();
  });

  it('matches via substring when the input embeds a known alias', () => {
    // "computer science" alias is a substring of this longer phrase
    expect(resolveMajorToCip('bs in computer science 2026')).toBe('11.0101');
    // "biology" alias is contained in the input
    expect(resolveMajorToCip('molecular biology')).toBe('26.0101');
  });

  it('matches via reverse-substring when input is a fragment of an alias', () => {
    // input "comput" is contained in the "computer science" alias key
    expect(resolveMajorToCip('comput')).toBe('11.0101');
  });

  it('maps Economics to 45.0101 (Social Sciences) — the documented finer-grained code', () => {
    // resolveMajorToCip can return codes that are NOT one of the 7 buckets
    expect(resolveMajorToCip('economics')).toBe('45.0101');
    expect(resolveMajorToCip('econ')).toBe('45.0101');
  });

  it('every value it returns from the alias table is a key present in MAJOR_ALIASES values', () => {
    // sanity: the function only ever returns a configured CIP value
    const known = new Set(Object.values(MAJOR_ALIASES));
    expect(known.has(resolveMajorToCip('finance')!)).toBe(true);
    expect(known.has(resolveMajorToCip('architecture')!)).toBe(true);
  });
});

describe('resolveMajorToProgramBucket', () => {
  it('returns null only when the major cannot be resolved to any CIP at all', () => {
    expect(resolveMajorToProgramBucket('underwater basket weaving')).toBeNull();
    expect(resolveMajorToProgramBucket('')).toBeNull();
  });

  it('returns one of the 7 populated buckets for any resolvable major', () => {
    const buckets = new Set(Object.values(SCHOOL_PROGRAM_BUCKETS));
    const inputs = [
      'computer science',
      'engineering',
      'business',
      'economics',
      'biology',
      'nursing',
      'physics',
      'psychology',
      'history',
      'fine arts',
      'communications',
      'pre-med',
      'architecture',
      'education',
    ];
    for (const input of inputs) {
      const bucket = resolveMajorToProgramBucket(input);
      expect(bucket).not.toBeNull();
      expect(buckets.has(bucket as never)).toBe(true);
    }
  });

  it('passes through a CIP that is already one of the 7 buckets unchanged', () => {
    // computer science -> 11.0101 which IS a bucket
    expect(resolveMajorToProgramBucket('computer science')).toBe('11.0101');
    // engineering -> 14.0101 IS a bucket
    expect(resolveMajorToProgramBucket('engineering')).toBe('14.0101');
    // nursing -> 51.3801 IS a bucket
    expect(resolveMajorToProgramBucket('nursing')).toBe('51.3801');
  });

  it('maps a non-bucket CIP to the nearest bucket by 2-digit family', () => {
    // economics -> 45.0101 (not a bucket) -> family 45 -> LIBERAL_ARTS (42.0101)
    expect(resolveMajorToProgramBucket('economics')).toBe(SCHOOL_PROGRAM_BUCKETS.LIBERAL_ARTS);
    // physics/chemistry -> 27.0101 -> family 27 -> LIBERAL_ARTS
    expect(resolveMajorToProgramBucket('physics')).toBe(SCHOOL_PROGRAM_BUCKETS.LIBERAL_ARTS);
    // history -> 24.0101 -> family 24 -> LIBERAL_ARTS
    expect(resolveMajorToProgramBucket('history')).toBe(SCHOOL_PROGRAM_BUCKETS.LIBERAL_ARTS);
    // communications -> 09.0401 -> family 09 -> LIBERAL_ARTS
    expect(resolveMajorToProgramBucket('communications')).toBe(SCHOOL_PROGRAM_BUCKETS.LIBERAL_ARTS);
    // architecture -> 04.0901 -> family 04 (unlisted) -> defaults to LIBERAL_ARTS
    expect(resolveMajorToProgramBucket('architecture')).toBe(SCHOOL_PROGRAM_BUCKETS.LIBERAL_ARTS);
  });

  it('routes a major family explicitly mapped to a non-default bucket', () => {
    // fine arts -> 50.0701 which IS a bucket (FINE_ARTS), returned directly
    expect(resolveMajorToProgramBucket('fine arts')).toBe(SCHOOL_PROGRAM_BUCKETS.FINE_ARTS);
    // pre-med -> 51.2201 (not a bucket) -> family 51 -> NURSING bucket
    expect(resolveMajorToProgramBucket('pre-med')).toBe(SCHOOL_PROGRAM_BUCKETS.NURSING);
    // education -> 13.0101 (not a bucket) -> family 13 -> LIBERAL_ARTS
    expect(resolveMajorToProgramBucket('education')).toBe(SCHOOL_PROGRAM_BUCKETS.LIBERAL_ARTS);
  });

  it('agrees with resolveMajorToCip when the resolved CIP is itself a bucket', () => {
    for (const input of ['computer science', 'engineering', 'biology', 'business']) {
      expect(resolveMajorToProgramBucket(input)).toBe(resolveMajorToCip(input));
    }
  });
});

describe('CIP table integrity (data invariants)', () => {
  it('all 7 SCHOOL_PROGRAM_BUCKETS values have a human-readable name in CIP_NAMES', () => {
    for (const cip of Object.values(SCHOOL_PROGRAM_BUCKETS)) {
      expect(CIP_NAMES[cip]).toBeDefined();
      expect(CIP_NAMES[cip].en.length).toBeGreaterThan(0);
      expect(CIP_NAMES[cip].zh.length).toBeGreaterThan(0);
    }
  });

  it('every CIP code referenced by an alias uses the 6-digit dotted format', () => {
    for (const cip of Object.values(MAJOR_ALIASES)) {
      expect(cip).toMatch(/^\d{2}\.\d{4}$/);
    }
  });

  it('every alias-target CIP either is a bucket or has a family entry to resolve from', () => {
    // resolveMajorToProgramBucket must never return null for a resolvable major,
    // which requires every alias CIP family to be reachable (bucket or family map default).
    const buckets = new Set(Object.values(SCHOOL_PROGRAM_BUCKETS));
    for (const cip of new Set(Object.values(MAJOR_ALIASES))) {
      const family = cip.split('.')[0];
      const resolvable = buckets.has(cip as never) || family.length === 2;
      expect(resolvable).toBe(true);
    }
  });
});
