import type {
  SchoolCommunityRatingSummary,
  SchoolFieldSource,
  SchoolFieldSources,
} from '@study-abroad/shared';

function normalizeGrade(grade?: string | null): string | undefined {
  if (!grade) return undefined;
  const normalized = grade.trim();
  return normalized || undefined;
}

export function getSchoolEnrollmentCount(school: {
  totalEnrollment?: number | null;
  studentCount?: number | null;
}): number | undefined {
  return school.totalEnrollment ?? school.studentCount ?? undefined;
}

export function getSchoolFieldSource(
  school: { fieldSources?: SchoolFieldSources | null },
  ...fields: string[]
): SchoolFieldSource | undefined {
  for (const field of fields) {
    const source = school.fieldSources?.[field];
    if (source) return source;
  }

  return undefined;
}

export function hasVerifiedFieldSource(
  school: { fieldSources?: SchoolFieldSources | null },
  ...fields: string[]
): boolean {
  return fields.some((field) => school.fieldSources?.[field]?.tier === 'verified');
}

export function getSupplementalCampusLifeGrades(school: {
  nicheSafetyGrade?: string | null;
  nicheLifeGrade?: string | null;
  nicheFoodGrade?: string | null;
  nicheOverallGrade?: string | null;
  fieldSources?: SchoolFieldSources | null;
}) {
  const overallGrade = getSchoolFieldSource(school, 'nicheOverallGrade')
    ? normalizeGrade(school.nicheOverallGrade)
    : undefined;
  const safetyGrade = getSchoolFieldSource(school, 'nicheSafetyGrade')
    ? normalizeGrade(school.nicheSafetyGrade)
    : undefined;
  const lifeGrade = getSchoolFieldSource(school, 'nicheLifeGrade')
    ? normalizeGrade(school.nicheLifeGrade)
    : undefined;
  const foodGrade = getSchoolFieldSource(school, 'nicheFoodGrade')
    ? normalizeGrade(school.nicheFoodGrade)
    : undefined;

  return {
    overallGrade,
    safetyGrade,
    lifeGrade,
    foodGrade,
    hasGrades: Boolean(overallGrade || safetyGrade || lifeGrade || foodGrade),
  };
}

export function getSchoolCommunityRatingSummary(school: {
  communityRatingSummary?: SchoolCommunityRatingSummary | null;
}): SchoolCommunityRatingSummary {
  return (
    school.communityRatingSummary ?? {
      count: 0,
      safetyAvg: null,
      lifeAvg: null,
      foodAvg: null,
      isPublic: false,
    }
  );
}
