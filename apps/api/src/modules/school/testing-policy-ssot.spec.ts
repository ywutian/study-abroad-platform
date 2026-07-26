import { TestingPolicy } from '@prisma/client';
import { SCHOOL_TESTING_POLICIES } from '@study-abroad/shared';
import type { SchoolTestingPolicy } from '@study-abroad/shared';

/**
 * Drift guard between the Prisma enum and the shared union.
 *
 * The union describing `School.testingPolicy` was hand-copied into 18 files,
 * with nothing tying any of them to the enum. Adding a value to the enum would
 * therefore compile everywhere and silently mis-render: several consumers read
 * the field through `as any`, and the i18n lookups are dynamic
 * (`testingPolicyT(school.testingPolicy)`) so the missing-key lint cannot see
 * them — the user just gets a raw key.
 *
 * This is the check that fires. Prisma is the authority; shared follows.
 */
describe('TestingPolicy SSOT', () => {
  it('shared union matches the Prisma enum exactly', () => {
    expect([...SCHOOL_TESTING_POLICIES].sort()).toEqual(
      Object.keys(TestingPolicy).sort(),
    );
  });

  // Type-level half: this stops compiling if the enum gains a member the union
  // lacks, which catches the drift before the runtime assertion above even runs.
  it('assigns every Prisma value to the shared type', () => {
    const assignable: SchoolTestingPolicy[] = Object.values(TestingPolicy);
    expect(assignable).toHaveLength(SCHOOL_TESTING_POLICIES.length);
  });

  // UNKNOWN is the column default and carries meaning across the codebase
  // ("known to us as not on record", not "we forgot"). Renaming or dropping it
  // would silently change how every unbackfilled school is scored.
  it('keeps UNKNOWN as a member', () => {
    expect(SCHOOL_TESTING_POLICIES).toContain('UNKNOWN');
  });
});
