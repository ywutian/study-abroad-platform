import { Prisma } from '@prisma/client';
import { CASE_REVIEW_APPROVED_WHERE } from '../../common/constants/prisma-selects';

/**
 * Reviewer select for hall reviews — includes email for display.
 */
export const HALL_REVIEWER_SELECT = {
  id: true,
  email: true,
  role: true,
} as const satisfies Prisma.UserSelect;

/**
 * 2026-05 Hall Plan C (C4): the SINGLE source of truth for "what counts as a
 * verified admission case" across every Hall verified surface.
 *
 * Previously `hall-verified.service.ts` (the public ranking) and
 * `hall-verified-dashboard.service.ts` (the China admit dashboard) each
 * defined this predicate independently. They drifted: the HeroBar count and
 * the dashboard count could silently contradict each other ("N verified
 * cases" vs "0 schools"). Both services now COMPOSE this constant so the
 * trust filter — `isVerified` + an approved case review — is defined once.
 *
 * Surface-specific narrowing is layered ON TOP, not forked from a copy:
 *  - the public ranking adds a `visibility` filter (security B4);
 *  - the China dashboard adds `verificationLevel ∈ {L2,L3}` + a
 *    China-nationality filter.
 */
export const VERIFIED_CASE_WHERE = {
  isVerified: true,
  ...CASE_REVIEW_APPROVED_WHERE,
} as const satisfies Prisma.AdmissionCaseWhereInput;
