export interface BatchRow {
  id: string;
  school: string;
  schoolId?: string;
  year: string;
  round: string;
  result: string;
  major: string;
  gpa: string;
  sat: string;
  act: string;
  toefl: string;
  apCount: string;
  apSubjects: string;
  ibScore: string;
  hsType: string;
  curriculum: string;
  demographics: string;
  activities: ActivityItem[];
  awards: AwardItem[];
  financialAid: string;
  enrollmentStatus: string;
  narrative: string;
  tags: string;
}

export interface ActivityItem {
  category: string;
  description: string;
  role: string;
  tier: string;
  hoursPerWeek: string;
  weeksPerYear: string;
}

export interface AwardItem {
  name: string;
  level: string;
  competition: string;
  tier: string;
  year: string;
}

export interface SchoolOption {
  id: string;
  name: string;
  nameZh?: string;
}

export const RESULT_OPTIONS = ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'];
export const ROUND_OPTIONS = ['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'];
export const HS_TYPE_OPTIONS = [
  'PUBLIC_US',
  'PRIVATE_US',
  'BOARDING_US',
  'INTL_CN',
  'PUBLIC_CN',
  'PRIVATE_CN',
  'INTL_OTHER',
  'PUBLIC_OTHER',
  'PRIVATE_OTHER',
];
export const CURRICULUM_OPTIONS = [
  'AP',
  'IB',
  'A_LEVEL',
  'GAOKAO',
  'CANADIAN',
  'AUSTRALIAN',
  'OTHER',
];
export const AID_OPTIONS = [
  'no_aid',
  'need_based',
  'merit',
  'need_and_merit',
  'full_tuition',
  'full_ride',
  'loan_only',
  'none_received',
  'unknown',
];
export const AWARD_LEVEL_OPTIONS = ['school', 'regional', 'state', 'national', 'international'];
export const ACTIVITY_CATEGORY_OPTIONS = [
  'RESEARCH',
  'ACADEMIC',
  'CLUB',
  'ATHLETICS',
  'COMMUNITY_SERVICE',
  'ARTS',
  'WORK',
  'ENTREPRENEURSHIP',
  'LEADERSHIP',
  'WRITING',
  'OTHER',
];
export const MAX_ROWS = 100;

export function createEmptyRow(): BatchRow {
  return {
    id: crypto.randomUUID(),
    school: '',
    year: new Date().getFullYear().toString(),
    round: '',
    result: '',
    major: '',
    gpa: '',
    sat: '',
    act: '',
    toefl: '',
    apCount: '',
    apSubjects: '',
    ibScore: '',
    hsType: '',
    curriculum: '',
    demographics: '',
    activities: [],
    awards: [],
    financialAid: '',
    enrollmentStatus: '',
    narrative: '',
    tags: '',
  };
}

export function isRowValid(row: BatchRow): boolean {
  return !!(row.school && row.year && row.result);
}
