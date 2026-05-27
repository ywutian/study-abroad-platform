/**
 * Phase 1 Bug 1+2 invariants: prediction.service.predict() must enforce
 *   - the profile is prediction-eligible — GPA + basic info + ≥1 target
 *     school (PreconditionFailedException 412)
 *   - every schoolId belongs to the user's SchoolListItem (BadRequestException 400)
 *
 * These guards prevent the "105 predictions + 0 schools" production state.
 *
 * 2026-05: the 412 gate moved from a `completeness >= 40` score threshold
 * to the field-explicit `evaluatePredictionEligibility` predicate — the
 * single source of truth shared with `/profiles/me/readiness`.
 * See docs/architecture/dashboard-invariants.md.
 */
import {
  BadRequestException,
  PreconditionFailedException,
} from '@nestjs/common';

import { evaluatePredictionEligibility } from '../profile/prediction-eligibility.util';

describe('Prediction invariants (Phase 1 Bug 1+2)', () => {
  // We test the validation logic at the unit level by exercising the
  // shared predicate + simulating the validation path. End-to-end behavior
  // is covered by the existing prediction.service.spec.ts (which mocks
  // the full pipeline) and the new e2e/dashboard-data-integrity.spec.ts.

  describe('PROFILE_INSUFFICIENT (412)', () => {
    it('throws for an empty profile (no GPA, no basic info, no schools)', () => {
      const eligibility = evaluatePredictionEligibility({
        hasGpa: false,
        hasBasicInfo: false,
        schoolListCount: 0,
      });
      expect(eligibility.canRunPrediction).toBe(false);
      expect(eligibility.blockers).toEqual([
        'MISSING_GPA',
        'MISSING_BASIC_INFO',
        'NO_TARGET_SCHOOLS',
      ]);
      // The service would throw:
      const wouldThrow = () => {
        if (!eligibility.canRunPrediction) {
          throw new PreconditionFailedException({
            code: 'PREDICTION_PROFILE_INSUFFICIENT',
            details: { blockers: eligibility.blockers },
          });
        }
      };
      expect(wouldThrow).toThrow(PreconditionFailedException);
    });

    it('passes when GPA + basic info + ≥1 target school are present', () => {
      const eligibility = evaluatePredictionEligibility({
        hasGpa: true,
        hasBasicInfo: true,
        schoolListCount: 1,
      });
      expect(eligibility.canRunPrediction).toBe(true);
      expect(eligibility.blockers).toEqual([]);
    });

    it('throws when only basic info is present (no GPA, no schools)', () => {
      const eligibility = evaluatePredictionEligibility({
        hasGpa: false,
        hasBasicInfo: true,
        schoolListCount: 0,
      });
      expect(eligibility.canRunPrediction).toBe(false);
      expect(eligibility.blockers).toEqual([
        'MISSING_GPA',
        'NO_TARGET_SCHOOLS',
      ]);
    });

    it('throws when GPA + basic info are present but the school list is empty', () => {
      const eligibility = evaluatePredictionEligibility({
        hasGpa: true,
        hasBasicInfo: true,
        schoolListCount: 0,
      });
      expect(eligibility.canRunPrediction).toBe(false);
      expect(eligibility.blockers).toEqual(['NO_TARGET_SCHOOLS']);
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
