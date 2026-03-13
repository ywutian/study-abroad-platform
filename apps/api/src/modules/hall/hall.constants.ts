import { Prisma } from '@prisma/client';

/**
 * Reviewer select for hall reviews — includes email for display.
 */
export const HALL_REVIEWER_SELECT = {
  id: true,
  email: true,
  role: true,
} as const satisfies Prisma.UserSelect;
