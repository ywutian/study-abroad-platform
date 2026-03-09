/**
 * High School Context Helper
 *
 * Shared utility for formatting high school background info across
 * prediction prompts, recommendation prompts, and AI agent tools.
 */

const TIER_DESCRIPTIONS_ZH: Record<number, string> = {
  5: '顶级 Feeder School',
  4: '知名重点学校',
  3: '优质学校',
  2: '一般知名度',
  1: '参考数据',
};

const TIER_DESCRIPTIONS_EN: Record<number, string> = {
  5: 'Top Feeder School',
  4: 'Well-Known Prestigious School',
  3: 'Strong School',
  2: 'Recognized School',
  1: 'Listed School',
};

const HS_TYPE_LABELS_ZH: Record<string, string> = {
  PUBLIC_US: '美国公立',
  PRIVATE_US: '美国私立',
  BOARDING_US: '美国私立寄宿',
  INTL_CN: '中国国际学校',
  PUBLIC_CN: '中国公立',
  PRIVATE_CN: '中国私立',
  INTL_OTHER: '国际学校',
  PUBLIC_OTHER: '公立',
  PRIVATE_OTHER: '私立',
};

const HS_TYPE_LABELS_EN: Record<string, string> = {
  PUBLIC_US: 'US Public',
  PRIVATE_US: 'US Private',
  BOARDING_US: 'US Boarding',
  INTL_CN: 'China International',
  PUBLIC_CN: 'China Public',
  PRIVATE_CN: 'China Private',
  INTL_OTHER: 'International',
  PUBLIC_OTHER: 'Public',
  PRIVATE_OTHER: 'Private',
};

export interface HighSchoolInfo {
  name: string;
  tier: number;
  type: string;
  country: string;
  state?: string | null;
}

export interface EducationEntry {
  school: string;
  schoolType?: string | null;
  highSchoolId?: string | null;
}

/**
 * Extract the first HIGH_SCHOOL entry from an education array.
 */
export function extractHighSchoolFromEducation(
  educations: EducationEntry[] | undefined | null,
): EducationEntry | null {
  if (!educations?.length) return null;
  return educations.find((e) => e.schoolType === 'HIGH_SCHOOL') || null;
}

/**
 * Format high school context string for AI prompts.
 *
 * Known high school (with tier): "Phillips Exeter Academy (Tier 5 — Top Feeder School, US Boarding, NH)"
 * Unknown high school: "上海某高中 (user-provided)"
 *
 * Returns null if no HIGH_SCHOOL education entry exists.
 */
export function formatHighSchoolContext(
  educations: EducationEntry[] | undefined | null,
  highSchool: HighSchoolInfo | undefined | null,
  locale: string = 'zh',
): string | null {
  const hsEntry = extractHighSchoolFromEducation(educations);
  if (!hsEntry) return null;

  const isZh = locale === 'zh';
  const label = isZh ? '高中背景' : 'High School';

  if (highSchool) {
    const tierDesc = isZh
      ? TIER_DESCRIPTIONS_ZH[highSchool.tier] || `Tier ${highSchool.tier}`
      : TIER_DESCRIPTIONS_EN[highSchool.tier] || `Tier ${highSchool.tier}`;
    const typeLabel = isZh
      ? HS_TYPE_LABELS_ZH[highSchool.type] || highSchool.type
      : HS_TYPE_LABELS_EN[highSchool.type] || highSchool.type;
    const location = highSchool.state || highSchool.country;
    return `${label}: ${hsEntry.school} (Tier ${highSchool.tier} — ${tierDesc}, ${typeLabel}, ${location})`;
  }

  const suffix = isZh ? '（用户自填）' : '(user-provided)';
  return `${label}: ${hsEntry.school} ${suffix}`;
}
