import { Prisma } from '@prisma/client';

/**
 * Author fields returned with a resume comment.
 *
 * Deliberately NOT common/constants USER_SUMMARY_SELECT, which carries
 * profile.realName/avatarUrl and no email. Comments here are self-only —
 * createComment goes through findById → verifyOwnership and stores
 * `authorId: userId`, so the author is always the resume owner and the email
 * the UI renders (resume/[id]/page.tsx) is the viewer's own. If resume
 * collaboration ever lets a second user comment, this must move to
 * USER_SUMMARY_SELECT before it ships: it would then be handing one user
 * another's email address.
 */
export const RESUME_COMMENT_AUTHOR_SELECT = {
  id: true,
  email: true,
  role: true,
} as const satisfies Prisma.UserSelect;

export const RESUME_COMMENT_INCLUDE = {
  author: { select: RESUME_COMMENT_AUTHOR_SELECT },
} as const satisfies Prisma.ResumeCommentInclude;
