import { Prisma, Role } from '@prisma/client';
import { USER_SUMMARY_SELECT } from '../../common/constants/prisma-selects';

/**
 * Author select for forum posts and comments.
 * Uses shared USER_SUMMARY_SELECT which includes avatarUrl (fixing previous bug).
 */
export const FORUM_AUTHOR_SELECT = USER_SUMMARY_SELECT;

export type ForumAuthorResult = Prisma.UserGetPayload<{
  select: typeof FORUM_AUTHOR_SELECT;
}>;

/**
 * Maps a Prisma User result to the forum author response shape.
 */
export function mapForumAuthor(user: ForumAuthorResult) {
  return {
    id: user.id,
    name: user.profile?.realName || undefined,
    avatar: user.profile?.avatarUrl || undefined,
    isVerified: user.role === Role.VERIFIED || user.role === Role.ADMIN,
  };
}
