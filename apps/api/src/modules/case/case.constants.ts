/**
 * The importer's dedup key, which must never reach a reader.
 *
 * `prisma/seeds/essay-harvest/import-essays.ts:136` writes
 * `source:<url>#<author>` into `tags[]` and then dedups on it
 * (`where: { schoolId, tags: { has: sourceTag } }`), so the tag cannot be
 * dropped from the data without making the importer non-idempotent. It is pure
 * bookkeeping: the same URL is already in the dedicated `sourceUrl` /
 * `sourceArchive` columns, which is what a UI should read.
 *
 * Left in the response it renders as a badge — measured on production
 * 2026-08-05, 551px wide inside a 386px card, clipped by the card's
 * `overflow-hidden`, on 20 of 20 cases. Strip at the serve boundary rather
 * than in the card, because `case-card.tsx` is not the only reader: mobile
 * renders the same array in two more places.
 */
const INTERNAL_TAG_PREFIXES = ['source:'];

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
 *
 * Internal tags (see INTERNAL_TAG_PREFIXES) are stripped for EVERY caller,
 * owner and admin included — they are importer bookkeeping, not case data, and
 * no surface should render them. Keeping that in this one function is
 * deliberate: both public read paths already call it, so a third one cannot
 * pick up half the rules.
 */
export function stripCaseIdentity<T extends { userId: string }>(
  caseItem: T,
  requesterId: string | null | undefined,
  isPrivileged = false,
): T {
  const withCleanTags = stripInternalTags(caseItem);
  if (isPrivileged || (requesterId && caseItem.userId === requesterId)) {
    return withCleanTags;
  }
  const {
    userId: _userId,
    verifiedBy: _verifiedBy,
    ...rest
  } = withCleanTags as T & {
    verifiedBy?: string | null;
  };
  return rest as T;
}

/**
 * Exported because `AdmissionCase.tags` leaves the API from two unauthenticated
 * surfaces, not one: the case list/detail (via stripCaseIdentity) and
 * `GET /essay-ai/gallery`, which queries the same model. Both were shipping the
 * `source:` key in production on 2026-08-05 — 20/20 cases and 10/10 gallery
 * rows. A second copy of this filter is how one of them gets fixed and the
 * other does not.
 */
export function stripInternalTags<T>(caseItem: T): T {
  const tags = (caseItem as T & { tags?: unknown }).tags;
  if (!Array.isArray(tags)) return caseItem;
  return {
    ...caseItem,
    tags: tags.filter(
      (t) =>
        typeof t !== 'string' ||
        !INTERNAL_TAG_PREFIXES.some((p) => t.startsWith(p)),
    ),
  };
}
