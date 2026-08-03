/**
 * A case served to anyone other than its owner must not carry `userId`.
 *
 * `AdmissionCase.userId` is the same value the forum publishes as
 * `author.id` (FORUM_AUTHOR_SELECT → USER_SUMMARY_SELECT, which pairs `id`
 * with `profile.realName`). `GET /cases` and `GET /cases/:id` are both
 * @Public() and use `include`, which in Prisma does NOT restrict scalars — so
 * every ANONYMOUS case shipped its owner's user id. Pull the public case list,
 * match the id against the public forum feed, read the real name: the
 * "不暴露你的身份" promise on the share opt-in was defeated by a join over two
 * unauthenticated endpoints. Even with no forum post to match, the id links
 * all of one applicant's cases into a single profile.
 *
 * Owners and admins keep it — the owner check in findOne reads it, and the
 * admin surfaces need it.
 *
 * Denylist rather than an allowlist select because AdmissionCase has ~40
 * display columns and enumerating them here would be the more dangerous
 * change; the fields removed are the only ones that identify a person.
 */
export function stripCaseIdentity<T extends { userId: string }>(
  caseItem: T,
  requesterId: string | null | undefined,
  isPrivileged = false,
): T {
  if (isPrivileged || (requesterId && caseItem.userId === requesterId)) {
    return caseItem;
  }
  const {
    userId: _userId,
    verifiedBy: _verifiedBy,
    ...rest
  } = caseItem as T & {
    verifiedBy?: string | null;
  };
  return rest as T;
}
