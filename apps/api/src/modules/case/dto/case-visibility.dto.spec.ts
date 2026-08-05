import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Visibility } from '@prisma/client';

import { CreateCaseDto } from './create-case.dto';
// The batch-level DTO, not BatchImportCaseItemDto — the per-item shape has no
// `visibility` of its own; the batch carries the default applied to every row.
import { BatchImportCaseDto } from './batch-import-case.dto';
import {
  CASE_VISIBILITY_ALLOWED,
  CASE_PUBLIC_VISIBILITY_WHERE,
  caseVisibilityWhereForRole,
} from '../../../common/constants/prisma-selects';

/**
 * `Visibility.PUBLIC` is retired for AdmissionCase (2026-08-04).
 *
 * The enum still carries the value, and must: `Profile.visibility` uses the
 * same enum and PUBLIC is live there. So nothing in the type system says a case
 * may not be PUBLIC — `@IsEnum(Visibility)` accepted it happily, which is what
 * these DTOs used to do. Removing the option from two dropdowns does not close
 * the API; this does.
 *
 * Why it was retired: `findById` served PUBLIC to anyone while `findAll` never
 * listed it, so the value made a case HARDER to find than ANONYMOUS, and the
 * surfaces built on each route inherited opposite halves of the contradiction.
 */
const visibilityErrors = async (
  Dto: typeof CreateCaseDto | typeof BatchImportCaseDto,
  visibility: string,
) =>
  (await validate(plainToInstance(Dto as never, { visibility }))).filter(
    (e) => e.property === 'visibility',
  );

describe('case visibility — PUBLIC is retired', () => {
  describe.each([
    ['CreateCaseDto', CreateCaseDto],
    ['BatchImportCaseDto', BatchImportCaseDto],
  ])('%s', (_name, Dto) => {
    it('rejects PUBLIC over the wire', async () => {
      expect(await visibilityErrors(Dto, 'PUBLIC')).not.toHaveLength(0);
    });

    it.each(CASE_VISIBILITY_ALLOWED)('still accepts %s', async (value) => {
      expect(await visibilityErrors(Dto, value)).toHaveLength(0);
    });
  });

  it('keeps PUBLIC out of the allowed set', () => {
    expect(CASE_VISIBILITY_ALLOWED).not.toContain(Visibility.PUBLIC);
  });

  // The enum value itself must survive — Profile.visibility uses it, and a
  // migration dropping it would break an unrelated model.
  it('leaves the shared Visibility enum intact', () => {
    expect(Visibility.PUBLIC).toBe('PUBLIC');
  });

  describe('read filters', () => {
    it('never selects PUBLIC, for any role', () => {
      const sets = [
        CASE_PUBLIC_VISIBILITY_WHERE,
        caseVisibilityWhereForRole(undefined),
        caseVisibilityWhereForRole('USER'),
        caseVisibilityWhereForRole('VERIFIED'),
        caseVisibilityWhereForRole('ADMIN'),
        caseVisibilityWhereForRole('SUPER_ADMIN'),
      ];
      for (const where of sets) {
        expect(where.visibility.in).not.toContain(Visibility.PUBLIC);
      }
    });

    // The two routes disagreed about PUBLIC for as long as it existed; with it
    // gone they finally grant the same thing, and this is what pins that.
    it('grants VERIFIED_ONLY to exactly the roles the REST route does', () => {
      const canSeeVerifiedOnly = (role?: string) =>
        caseVisibilityWhereForRole(role).visibility.in.includes(
          Visibility.VERIFIED_ONLY,
        );

      expect(canSeeVerifiedOnly('VERIFIED')).toBe(true);
      expect(canSeeVerifiedOnly('ADMIN')).toBe(true);
      expect(canSeeVerifiedOnly('SUPER_ADMIN')).toBe(true);

      expect(canSeeVerifiedOnly(undefined)).toBe(false);
      expect(canSeeVerifiedOnly('USER')).toBe(false);
      expect(canSeeVerifiedOnly('COUNSELOR')).toBe(false);
      expect(canSeeVerifiedOnly('OPERATOR')).toBe(false);
    });
  });
});
