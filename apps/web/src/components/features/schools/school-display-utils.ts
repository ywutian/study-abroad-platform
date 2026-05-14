import type {
  SchoolCommunityRatingSummary,
  SchoolFieldSource,
  SchoolFieldSources,
  TrustTier,
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

export function getFieldTrust(
  school: { fieldSources?: SchoolFieldSources | null },
  ...fields: string[]
): { tier: TrustTier; badge: TrustTier; source: SchoolFieldSource } | undefined {
  const source = getSchoolFieldSource(school, ...fields);
  if (!source) return undefined;

  return {
    tier: source.tier,
    badge: source.tier,
    source,
  };
}

export function hasVerifiedFieldSource(
  school: { fieldSources?: SchoolFieldSources | null },
  ...fields: string[]
): boolean {
  return fields.some((field) => Boolean(school.fieldSources?.[field]));
}

export function getTrustedValue<T>(
  school: { fieldSources?: SchoolFieldSources | null },
  value: T | null | undefined,
  ...fields: string[]
): T | undefined {
  return getSchoolFieldSource(school, ...fields) && value != null ? value : undefined;
}

export function isOfficialFieldSource(source?: SchoolFieldSource): boolean {
  return source?.tier === 'OFFICIAL' || source?.tier === 'PARTNER';
}

export function isPublicFieldSource(source?: SchoolFieldSource): source is SchoolFieldSource {
  return source?.tier === 'OFFICIAL' || source?.tier === 'PARTNER' || source?.tier === 'SCRAPED';
}

export function isSupplementalFieldSource(source?: SchoolFieldSource): boolean {
  return isPublicFieldSource(source) && !isOfficialFieldSource(source);
}

export function getSupplementalCampusLifeGrades(school: {
  nicheSafetyGrade?: string | null;
  nicheLifeGrade?: string | null;
  nicheFoodGrade?: string | null;
  nicheOverallGrade?: string | null;
  fieldSources?: SchoolFieldSources | null;
}) {
  const overallGrade = isPublicFieldSource(getSchoolFieldSource(school, 'nicheOverallGrade'))
    ? normalizeGrade(school.nicheOverallGrade)
    : undefined;
  const safetyGrade = isPublicFieldSource(getSchoolFieldSource(school, 'nicheSafetyGrade'))
    ? normalizeGrade(school.nicheSafetyGrade)
    : undefined;
  const lifeGrade = isPublicFieldSource(getSchoolFieldSource(school, 'nicheLifeGrade'))
    ? normalizeGrade(school.nicheLifeGrade)
    : undefined;
  const foodGrade = isPublicFieldSource(getSchoolFieldSource(school, 'nicheFoodGrade'))
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
