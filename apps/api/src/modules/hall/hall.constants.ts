import { Prisma } from '@prisma/client';
import { CASE_REVIEW_APPROVED_WHERE } from '../../common/constants/prisma-selects';

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

/**
 * A published list served to anyone must not carry its creator's user id.
 *
 * `GET /halls/lists` and `GET /halls/lists/:id` are both `@Public()` and query
 * with `include`, which in Prisma does NOT restrict scalars — so `userId`
 * shipped on every row. Beside it sat a deliberate `user: { select: { id } }`
 * whose comment called that id "opaque" while stripping the creator's email as
 * PII. Half of that is right: the email is PII. But the id is not opaque — it
 * is the value `GET /forum/posts` publishes as `author.id` next to
 * `profile.realName`, which is the whole defect this branch documented in
 * `.claude/rules/backend.md`. Removing the name and keeping the join key is
 * what hall, team and profile each did in turn.
 *
 * Nothing displays a list's creator: no web or mobile surface reads it, and the
 * relation was only ever selected to be "safe". So both go.
 */
export function stripListOwner<T extends { userId: string }>(list: T): T {
  const {
    userId: _userId,
    user: _user,
    ...rest
  } = list as T & {
    user?: unknown;
  };
  return rest as T;
}
