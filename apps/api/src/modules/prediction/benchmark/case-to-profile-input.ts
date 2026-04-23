import type { AdmissionCase } from '@prisma/client';
import type { ProfileInput } from '../prediction.prompts';

/**
 * Map an anonymized `AdmissionCase` record to a `ProfileInput` suitable
 * for the prediction pipeline. Used by backtest runs — the goal is to
 * reconstruct the applicant's signal shape at application time, not to
 * approximate the user's live Profile.
 *
 * Fields that AdmissionCase does not carry (e.g., essay quality score,
 * MBTI / Holland) are left undefined — the prediction pipeline already
 * degrades gracefully.
 *
 * Caller is expected to JOIN the HighSchool row separately for HS-profile
 * enrichment; pass it via `highSchool` (Prisma relation) if available.
 */
export function admissionCaseToProfileInput(
  c: AdmissionCase & { highSchool?: any },
): ProfileInput {
  const gpa = pickGpa(c);
  const demoTags = new Set(
    (c.demographicTags ?? []).map((t) => t.toLowerCase()),
  );

  const activities = parseActivities(c);
  const awards = parseAwards(c);
  const testScores = parseTestScores(c);

  const hs = c.highSchool;
  const isHsAllowed = hs?.hsImpactEnabled !== false;

  return {
    gpa,
    gpaScale: c.gpaScale ?? 4.0,
    gpaSystem: undefined,
    grade: undefined,
    currentSchoolType: c.highSchoolType ?? undefined,
    targetMajor: c.major ?? undefined,
    isInternational: demoTags.has('international') || isLikelyIntl(c),
    nationality: c.nationality ?? undefined,
    educationSystem: c.curriculumType ?? undefined,
    needsFinancialAid: financialAidFlag(c.financialAid),
    highSchoolId: isHsAllowed
      ? (hs?.id ?? c.highSchoolId ?? undefined)
      : undefined,
    highSchoolName: isHsAllowed ? (hs?.name ?? undefined) : undefined,
    highSchoolTier: isHsAllowed ? (hs?.tier ?? undefined) : undefined,
    highSchoolType: isHsAllowed
      ? (hs?.type ?? c.highSchoolType ?? undefined)
      : undefined,
    highSchoolLocation: isHsAllowed
      ? hs?.state || hs?.country || undefined
      : undefined,
    highSchoolRecognition: isHsAllowed
      ? (hs?.recognition ?? undefined)
      : undefined,
    highSchoolAcademicRigor: isHsAllowed
      ? (hs?.academicRigor ?? undefined)
      : undefined,
    highSchoolPlacementRecord: isHsAllowed
      ? (hs?.placementRecord ?? undefined)
      : undefined,
    highSchoolStudentQuality: isHsAllowed
      ? (hs?.studentQuality ?? undefined)
      : undefined,
    highSchoolResources: isHsAllowed ? (hs?.resources ?? undefined) : undefined,
    highSchoolGradeInflation: isHsAllowed
      ? (hs?.gradeInflation ?? undefined)
      : undefined,
    testScores,
    activities,
    awards,
    assessment: undefined,
    isLegacy: demoTags.has('legacy'),
    legacySchools: undefined,
    isFirstGen: demoTags.has('first_gen'),
    essayQualityScore: undefined,
  };
}

/** Prefer grade-11 GPA (highest prediction weight), then 12/10/9, then capped, then range midpoint. */
function pickGpa(c: AdmissionCase): number | undefined {
  const candidates = [
    c.gpa11,
    c.gpa12,
    c.gpa10,
    c.gpa9,
    c.ucCappedGpa,
    c.ucUncappedGpa,
  ];
  for (const g of candidates) if (g != null && g > 0) return g;
  if (c.gpaRange) {
    const m = c.gpaRange.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
    if (m) return (Number(m[1]) + Number(m[2])) / 2;
  }
  return undefined;
}

function parseTestScores(c: AdmissionCase): ProfileInput['testScores'] {
  if (Array.isArray(c.testScores)) {
    return (c.testScores as any[])
      .filter(
        (s) => s && typeof s.type === 'string' && typeof s.score === 'number',
      )
      .map((s) => ({
        type: s.type,
        score: s.score,
        subScores: s.subScores ?? s.subscores,
      }));
  }
  const out: ProfileInput['testScores'] = [];
  if (c.satRange) {
    const mid = midOfRange(c.satRange);
    if (mid != null) out.push({ type: 'SAT', score: mid });
  }
  if (c.actRange) {
    const mid = midOfRange(c.actRange);
    if (mid != null) out.push({ type: 'ACT', score: mid });
  }
  if (c.toeflRange) {
    const mid = midOfRange(c.toeflRange);
    if (mid != null) out.push({ type: 'TOEFL', score: mid });
  }
  return out;
}

function midOfRange(range: string): number | undefined {
  const m = range.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m) {
    const single = Number(range);
    return Number.isFinite(single) ? single : undefined;
  }
  return (Number(m[1]) + Number(m[2])) / 2;
}

function parseActivities(c: AdmissionCase): ProfileInput['activities'] {
  if (Array.isArray(c.activities)) {
    return (c.activities as any[])
      .filter((a) => a && typeof a === 'object')
      .map((a) => ({
        name: a.name,
        category: String(a.category ?? 'OTHER'),
        role: String(a.role ?? ''),
        description: a.description,
        hoursPerWeek: a.hoursPerWeek,
        weeksPerYear: a.weeksPerYear,
      }));
  }
  if (typeof c.activityList === 'string' && c.activityList.trim()) {
    return c.activityList
      .split(/\r?\n|；|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        name: line,
        category: 'OTHER',
        role: '',
      }));
  }
  return [];
}

function parseAwards(c: AdmissionCase): ProfileInput['awards'] {
  if (!Array.isArray(c.awards)) return [];
  return (c.awards as any[])
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      level: String(a.level ?? 'SCHOOL'),
      name: a.name,
      tier: typeof a.tier === 'number' ? a.tier : undefined,
      competitionName: a.competition,
    }));
}

function financialAidFlag(fa: string | null | undefined): boolean | undefined {
  if (!fa) return undefined;
  const v = fa.toLowerCase();
  if (v === 'none' || v === 'no') return false;
  if (/full|significant|partial|merit/.test(v)) return true;
  return undefined;
}

function isLikelyIntl(c: AdmissionCase): boolean {
  const nat = (c.nationality ?? '').toLowerCase();
  if (!nat) return false;
  return !['us', 'usa', 'united states', 'american'].includes(nat);
}
