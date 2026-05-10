import { Prisma } from '@prisma/client';

/** Profile with included relations used by prediction logic */
export type ProfileWithRelations = Prisma.ProfileGetPayload<{
  include: {
    testScores: true;
    activities: { include: { activityTemplate: true } };
    awards: { include: { competition: true } };
    education: { include: { highSchool: true } };
    semesterGpas: true;
  };
}>;
