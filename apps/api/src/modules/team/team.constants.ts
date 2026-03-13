import { Prisma } from '@prisma/client';

/**
 * User fields for team member display — includes email and profile.
 */
export const TEAM_USER_SELECT = {
  id: true,
  email: true,
  profile: { select: { nickname: true, avatarUrl: true } },
} as const satisfies Prisma.UserSelect;
