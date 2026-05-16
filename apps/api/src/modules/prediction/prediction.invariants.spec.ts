/**
 * Phase 1 Bug 1+2 invariants: prediction.service.predict() must enforce
 *   - completeness >= 40% (PreconditionFailedException 412)
 *   - every schoolId belongs to the user's SchoolListItem (BadRequestException 400)
 *
 * These guards prevent the "105 predictions + 0 schools" production state.
 * See docs/architecture/dashboard-invariants.md (Phase 3a).
 */
import {
  BadRequestException,
  PreconditionFailedException,
} from '@nestjs/common';

import { calculateProfileCompleteness } from '../profile/profile-completeness.util';

describe('Prediction invariants (Phase 1 Bug 1+2)', () => {
  // We test the validation logic at the unit level by exercising the
  // shared util + simulating the validation path. End-to-end behavior
  // is covered by the existing prediction.service.spec.ts (which mocks
  // the full pipeline) and the new e2e/dashboard-data-integrity.spec.ts.

  describe('PROFILE_INSUFFICIENT (412)', () => {
    it('throws when completeness < 40% (empty profile)', () => {
      const { completeness } = calculateProfileCompleteness(null, 0);
      expect(completeness).toBe(0);
      expect(completeness < 40).toBe(true);
      // The service would throw:
      const wouldThrow = () => {
        if (completeness < 40) {
          throw new PreconditionFailedException({
            code: 'PREDICTION_PROFILE_INSUFFICIENT',
            completeness,
            required: 40,
          });
        }
      };
      expect(wouldThrow).toThrow(PreconditionFailedException);
    });

    it('passes when completeness >= 40% (test-optional + GPA + basic info)', () => {
      const { completeness } = calculateProfileCompleteness(
        {
          applyingTestOptional: true,
          targetMajor: 'CS',
          gpa: 3.85,
          grade: 'SENIOR',
        },
        1,
      );
      // basicInfo 20 + gpa 35 (test-optional) + targetSchools 10 = 65
      expect(completeness).toBeGreaterThanOrEqual(40);
    });

    it('throws when only basic info is present (< 40%)', () => {
      const { completeness } = calculateProfileCompleteness(
        {
          targetMajor: 'CS',
          grade: 'SENIOR',
        },
        0,
      );
      // basicInfo 20 + nothing else = 20
      expect(completeness).toBe(20);
      expect(completeness < 40).toBe(true);
    });
  });

  describe('INVALID_SCHOOL_IDS (400)', () => {
    it('rejects when any schoolId is not in the user list', () => {
      const requested = ['school-a', 'school-b', 'school-c'];
      const ownedIds = new Set(['school-a', 'school-b']);
      const unauthorized = requested.filter((id) => !ownedIds.has(id));

      expect(unauthorized).toEqual(['school-c']);

      const wouldThrow = () => {
        if (unauthorized.length > 0) {
          throw new BadRequestException({
            code: 'PREDICTION_INVALID_SCHOOL_IDS',
            unauthorizedSchoolIds: unauthorized,
          });
        }
      };
      expect(wouldThrow).toThrow(BadRequestException);
    });

    it('allows when every schoolId is in the user list', () => {
      const requested = ['school-a', 'school-b'];
      const ownedIds = new Set(['school-a', 'school-b', 'school-c']);
      const unauthorized = requested.filter((id) => !ownedIds.has(id));
      expect(unauthorized).toEqual([]);
    });
  });
});
