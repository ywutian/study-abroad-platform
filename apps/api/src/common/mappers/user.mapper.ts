import { Role } from '@prisma/client';
import type { UserSummaryResult } from '../constants/prisma-selects';

/**
 * Standard User summary mapping — used across forum, team, etc.
 * Maps a Prisma User result (from USER_SUMMARY_SELECT) to API response format.
 */
export function mapUserSummary(user: UserSummaryResult) {
  return {
    id: user.id,
    name: user.profile?.realName || undefined,
    avatar: user.profile?.avatarUrl || undefined,
    isVerified: user.role === Role.VERIFIED || user.role === Role.ADMIN,
  };
}
