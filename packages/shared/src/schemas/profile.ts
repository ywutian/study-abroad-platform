import { z } from 'zod';

// ─── Main Profile Schema (BasicInfo + Demographics + GPA + Privacy) ───

const GRADE_VALUES = ['FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR', 'GAP_YEAR', ''] as const;
const BUDGET_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'UNLIMITED', ''] as const;
const EDUCATION_SYSTEM_VALUES = [
  'IB',
  'AP',
  'A_LEVEL',
  'GAOKAO',
  'CANADIAN',
  'AUSTRALIAN',
  'OTHER',
  '',
] as const;
const VISIBILITY_VALUES = ['PRIVATE', 'ANONYMOUS', 'VERIFIED_ONLY'] as const;

function getMaxGpa(scaleStr: string): number {
  const scale = parseFloat(scaleStr) || 4.0;
  if (scale === 100) return 100;
  if (scale === 45) return 45;
  if (scale === 6) return 6;
  if (scale === 5) return 5;
  return 4;
}

function validateGpaField(
  value: string,
  scaleStr: string,
  path: string,
  ctx: z.RefinementCtx,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (!value) return;
  const num = parseFloat(value);
  const max = getMaxGpa(scaleStr);
  if (isNaN(num) || num < 0 || num > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t('profile.errors.gpaRange', { max }),
      path: [path],
    });
  }
}

export function createProfileSchema(
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return z
    .object({
      // BasicInfoTab
      grade: z.enum(GRADE_VALUES).default(''),
      currentSchool: z.string().max(200).default(''),
      targetMajor: z.string().max(200).default(''),
      budgetTier: z.enum(BUDGET_VALUES).default(''),

      // DemographicsTab
      nationality: z.string().max(10).default(''),
      countryOfResidence: z.string().max(10).default(''),
      citizenship: z.string().max(10).default(''),
      educationSystem: z.enum(EDUCATION_SYSTEM_VALUES).default(''),
      needsFinancialAid: z.boolean().default(false),
      firstGeneration: z.boolean().default(false),
      recruitedAthlete: z.boolean().default(false),
      legacy: z.array(z.string().max(500)).default([]),
      intendedMajor: z.string().max(200).default(''),
      secondMajor: z.string().max(200).default(''),

      // GpaTab
      gpa: z.string().default(''),
      gpaScale: z.string().default('4.0'),
      gpa9: z.string().default(''),
      gpa10: z.string().default(''),
      gpa11: z.string().default(''),
      gpa12: z.string().default(''),

      // PrivacyTab
      visibility: z.enum(VISIBILITY_VALUES).default('PRIVATE'),
    })
    .superRefine((data, ctx) => {
      validateGpaField(data.gpa, data.gpaScale, 'gpa', ctx, t);
      validateGpaField(data.gpa9, data.gpaScale, 'gpa9', ctx, t);
      validateGpaField(data.gpa10, data.gpaScale, 'gpa10', ctx, t);
      validateGpaField(data.gpa11, data.gpaScale, 'gpa11', ctx, t);
      validateGpaField(data.gpa12, data.gpaScale, 'gpa12', ctx, t);
    });
}

export type ProfileFormValues = z.infer<ReturnType<typeof createProfileSchema>>;

// ─── Test Score Dialog Schema ───

const TEST_TYPE_VALUES = [
  'SAT',
  'ACT',
  'TOEFL',
  'IELTS',
  'AP',
  'IB',
  'A_LEVEL',
  'IGCSE',
  'DUOLINGO',
] as const;

export function createTestScoreSchema(t: (key: string) => string) {
  return z.object({
    type: z.enum(TEST_TYPE_VALUES, {
      required_error: t('validation.testTypeRequired'),
    }),
    score: z.string().min(1, t('validation.scoreRequired')),
    testDate: z.string().optional(),
    satReading: z.string().optional(),
    satMath: z.string().optional(),
    actEnglish: z.string().optional(),
    actMath: z.string().optional(),
    actReading: z.string().optional(),
    actScience: z.string().optional(),
    toeflReading: z.string().optional(),
    toeflListening: z.string().optional(),
    toeflSpeaking: z.string().optional(),
    toeflWriting: z.string().optional(),
    ieltsListening: z.string().optional(),
    ieltsReading: z.string().optional(),
    ieltsWriting: z.string().optional(),
    ieltsSpeaking: z.string().optional(),
  });
}

export type TestScoreFormValues = z.infer<ReturnType<typeof createTestScoreSchema>>;

// ─── Activity Dialog Schema ───

const ACTIVITY_CATEGORY_VALUES = [
  'ACADEMIC',
  'ARTS',
  'ATHLETICS',
  'COMMUNITY_SERVICE',
  'LEADERSHIP',
  'WORK',
  'RESEARCH',
  'INTERNSHIP',
  'CLUB',
  'HOBBY',
  'OTHER',
] as const;

const ACTIVITY_TIMING_VALUES = ['SCHOOL_YEAR', 'SCHOOL_BREAK', 'ALL_YEAR', ''] as const;

export function createActivitySchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(100, t('validation.nameMaxLength')),
    category: z.enum(ACTIVITY_CATEGORY_VALUES, {
      required_error: t('validation.categoryRequired'),
    }),
    role: z.string().min(1, t('validation.roleRequired')).max(100),
    organization: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    commonAppDescription: z.string().max(150).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    hoursPerWeek: z.string().optional(),
    weeksPerYear: z.string().optional(),
    isOngoing: z.boolean().default(false),
    gradeLevels: z.array(z.number()).default([]),
    timing: z.enum(ACTIVITY_TIMING_VALUES).default(''),
    activityTemplateId: z.string().optional(),
  });
}

export type ActivityFormValues = z.infer<ReturnType<typeof createActivitySchema>>;

// ─── Award Dialog Schema ───

const AWARD_LEVEL_VALUES = ['SCHOOL', 'REGIONAL', 'STATE', 'NATIONAL', 'INTERNATIONAL'] as const;

const AWARD_CATEGORY_VALUES = [
  'STEM',
  'MATH',
  'SCIENCE',
  'COMPUTER_SCIENCE',
  'ENGINEERING',
  'BUSINESS',
  'ARTS',
  'HUMANITIES',
  'SOCIAL_SCIENCE',
  'LANGUAGE',
  'SPORTS',
  'COMMUNITY_SERVICE',
  'LEADERSHIP',
  'OTHER',
  '',
] as const;

export function createAwardSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(200),
    level: z.enum(AWARD_LEVEL_VALUES, {
      required_error: t('validation.levelRequired'),
    }),
    category: z.enum(AWARD_CATEGORY_VALUES).default(''),
    year: z.string().optional(),
    description: z.string().max(500).optional(),
    competitionId: z.string().optional(),
  });
}

export type AwardFormValues = z.infer<ReturnType<typeof createAwardSchema>>;

// ─── Semester GPA Schema ───

const SEMESTER_OPTIONS = [
  'g9fall',
  'g9spring',
  'g10fall',
  'g10spring',
  'g11fall',
  'g11spring',
  'g12fall',
  'g12spring',
] as const;

export function createSemesterGpaSchema(t: (key: string) => string) {
  return z.object({
    semester: z.enum(SEMESTER_OPTIONS, {
      required_error: t('validation.semesterRequired'),
    }),
    year: z.string().min(1, t('validation.yearRequired')),
    gpa: z.string().min(1, t('validation.gpaRequired')),
    gpaScale: z.string().min(1),
    credits: z.string().optional(),
  });
}

export type SemesterGpaFormValues = z.infer<ReturnType<typeof createSemesterGpaSchema>>;

// ─── Recommendation Letter Schema ───

const RECOMMENDER_ROLE_VALUES = ['TEACHER', 'COUNSELOR', 'COACH', 'EMPLOYER', 'OTHER'] as const;

const REC_LETTER_STATUS_VALUES = [
  'NOT_REQUESTED',
  'REQUESTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'CONFIRMED',
] as const;

export function createRecommendationLetterSchema(t: (key: string) => string) {
  return z.object({
    recommenderName: z.string().min(1, t('recLetter.validation.nameRequired')).max(200),
    recommenderEmail: z.string().max(200).optional().or(z.literal('')),
    recommenderRole: z.enum(RECOMMENDER_ROLE_VALUES, {
      required_error: t('recLetter.validation.roleRequired'),
    }),
    subject: z.string().max(200).optional(),
    status: z.enum(REC_LETTER_STATUS_VALUES).default('NOT_REQUESTED'),
    dueDate: z.string().optional(),
    notes: z.string().max(2000).optional(),
  });
}

export type RecommendationLetterFormValues = z.infer<
  ReturnType<typeof createRecommendationLetterSchema>
>;

// ─── Submit Case Schema ───

const CASE_RESULT_VALUES = ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'] as const;

const CASE_ROUND_VALUES = ['ED', 'ED2', 'EA', 'REA', 'RD', 'UC', ''] as const;

const CASE_VISIBILITY_VALUES = ['PUBLIC', 'ANONYMOUS', 'VERIFIED_ONLY'] as const;

export function createSubmitCaseSchema(t: (key: string) => string) {
  return z.object({
    year: z.string().min(1),
    round: z.enum(CASE_ROUND_VALUES).default(''),
    result: z.enum(CASE_RESULT_VALUES, {
      required_error: t('validation.resultRequired'),
    }),
    major: z.string().max(200).optional(),
    gpaRange: z.string().optional(),
    gpa9: z.string().optional(),
    gpa10: z.string().optional(),
    gpa11: z.string().optional(),
    gpa12: z.string().optional(),
    ucCappedGpa: z.string().optional(),
    ucUncappedGpa: z.string().optional(),
    gpaScale: z.string().default('4.0'),
    satRange: z.string().optional(),
    actRange: z.string().optional(),
    toeflRange: z.string().optional(),
    nationality: z.string().optional(),
    apCount: z.string().optional(),
    apSubjects: z.string().optional(),
    ibScore: z.string().optional(),
    narrative: z.string().max(5000).optional(),
    tags: z.string().optional(),
    activityList: z.string().max(10000).optional(),
    essayType: z.string().optional(),
    essayPrompt: z.string().optional(),
    essayContent: z.string().optional(),
    visibility: z.enum(CASE_VISIBILITY_VALUES).default('ANONYMOUS'),
  });
}

export type SubmitCaseFormValues = z.infer<ReturnType<typeof createSubmitCaseSchema>>;

// ─── Education Schema ───

const SCHOOL_TYPE_VALUES = ['HIGH_SCHOOL', 'COLLEGE', 'GRADUATE', 'OTHER', ''] as const;

export function createEducationSchema(t: (key: string) => string) {
  return z.object({
    schoolName: z.string().min(1, t('validation.schoolNameRequired')).max(200),
    schoolType: z.enum(SCHOOL_TYPE_VALUES).default(''),
    degree: z.string().max(200).optional(),
    major: z.string().max(200).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    gpa: z.string().optional(),
    gpaScale: z.string().default('4.0'),
    gpaSystem: z.string().optional(),
    description: z.string().max(2000).optional(),
    highSchoolId: z.string().optional(),
  });
}

export type EducationFormValues = z.infer<ReturnType<typeof createEducationSchema>>;

// ─── Create List Schema ───

const LIST_CATEGORY_VALUES = ['school_ranking', 'major_ranking', 'tips', 'other'] as const;

export function createListSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t('validation.titleRequired')).max(100, t('validation.titleTooLong')),
    description: z.string().max(500).optional(),
    category: z.enum(LIST_CATEGORY_VALUES).default('school_ranking'),
    isPublic: z.boolean().default(true),
  });
}

export type ListFormValues = z.infer<ReturnType<typeof createListSchema>>;
