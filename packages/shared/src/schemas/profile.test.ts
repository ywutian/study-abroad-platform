import { describe, expect, it } from 'vitest';

import { createProfileSchema } from './profile';

// Stub translator — validation messages are keyed, we only assert pass/fail.
const t = (key: string) => key;

function parse(input: Record<string, unknown>) {
  // Every field has a Zod default, so a partial object exercises just the
  // field(s) under test while the rest fill in.
  return createProfileSchema(t).safeParse({ gpaScale: '4.0', ...input });
}

describe('createProfileSchema — weighted vs unweighted GPA', () => {
  it('accepts a weighted GPA above the scale (AP/Honors headroom, +1)', () => {
    expect(parse({ weightedGpa: '4.32' }).success).toBe(true);
    expect(parse({ weightedGpa: '5.0' }).success).toBe(true); // exactly scale + 1
  });

  it('rejects a weighted GPA beyond the +1 headroom', () => {
    expect(parse({ weightedGpa: '6.0' }).success).toBe(false);
  });

  it('treats weightedGpa as optional', () => {
    expect(parse({ weightedGpa: '' }).success).toBe(true);
  });

  it('still caps the UNWEIGHTED gpa at the scale — no headroom', () => {
    // The whole point of splitting the fields: 4.32 is valid weighted, invalid unweighted.
    expect(parse({ gpa: '4.32' }).success).toBe(false);
    expect(parse({ gpa: '4.0' }).success).toBe(true);
  });
});
