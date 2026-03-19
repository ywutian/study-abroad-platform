import { Prisma } from '@prisma/client';

/** Profile with included relations used by prediction logic */
export type ProfileWithRelations = Prisma.ProfileGetPayload<{
  include: {
    testScores: true;
    activities: true;
    awards: { include: { competition: true } };
  };
}>;
