import { LucideIcon } from 'lucide-react';

export interface TestScore {
  id: string;
  type: string;
  score: number;
  subject?: string;
  subScores?: Record<string, number | string>;
  testDate?: string;
}

export interface ActivityTemplate {
  id: string;
  name: string;
  nameZh?: string;
  category: string;
  tier: number;
}

export interface Activity {
  id: string;
  name: string;
  category: string;
  role: string;
  organization?: string;
  description?: string;
  commonAppDescription?: string;
  startDate?: string;
  endDate?: string;
  hoursPerWeek?: number;
  weeksPerYear?: number;
  isOngoing?: boolean;
  gradeLevels?: number[];
  timing?: string;
  activityTemplateId?: string;
  activityTemplate?: ActivityTemplate;
}

export interface Award {
  id: string;
  name: string;
  level: string;
  category?: string;
  year?: number;
  description?: string;
  competitionId?: string;
}

export interface SchoolRanking {
  source: string;
  list: string;
  rank: number;
  year: number;
}

export interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
  website?: string;
  scorecardId?: string;
  ipedsId?: string;
  transferAcceptanceRate?: number;
  needBlindInternational?: boolean | null;
  percentNeedMet?: number;
  averageAidPackage?: number;
  averageNetPrice?: number;
  rankings?: SchoolRanking[];
}

export interface SchoolDeadlineInfo {
  round: string;
  applicationDeadline: string;
  financialAidDeadline?: string;
  interviewRequired: boolean;
  interviewDeadline?: string;
  interviewFormat?: string;
}

export interface TargetSchool extends School {
  _listItemId?: string;
  tier?: string;
  round?: string;
  essayPromptCount?: number;
  hasEarlyDecision?: boolean;
  deadlines?: SchoolDeadlineInfo[];
  prediction?: {
    tier?: string;
    probability: number;
  };
}

export interface SemesterGpa {
  id: string;
  semester: string;
  year: number;
  gpa: number;
  gpaScale: number;
  credits?: number;
  order: number;
}

export interface ProfileData {
  userId: string;
  grade?: string;
  currentSchool?: string;
  gpa?: number;
  gpaScale?: number;
  gpa9?: number;
  gpa10?: number;
  gpa11?: number;
  gpa12?: number;
  semesterGpas?: SemesterGpa[];
  targetMajor?: string;
  budgetTier?: string;
  visibility?: string;
  nationality?: string;
  countryOfResidence?: string;
  citizenship?: string;
  educationSystem?: string;
  needsFinancialAid?: boolean;
  firstGeneration?: boolean;
  recruitedAthlete?: boolean;
  applyingTestOptional?: boolean;
  legacy?: string[];
  intendedMajor?: string;
  secondMajor?: string;
  testScores?: TestScore[];
  activities?: Activity[];
  awards?: Award[];
}

export interface TabConfig {
  value: string;
  labelKey: string;
  icon: LucideIcon;
  color: string;
}

export interface ProfileUpdatePayload {
  grade?: string;
  currentSchool?: string;
  gpa?: number | null;
  gpaScale?: number;
  targetMajor?: string;
  budgetTier?: string;
  visibility?: string;
  nationality?: string;
  countryOfResidence?: string;
  citizenship?: string;
  educationSystem?: string;
  needsFinancialAid?: boolean;
  firstGeneration?: boolean;
  recruitedAthlete?: boolean;
  applyingTestOptional?: boolean;
  legacy?: string[];
  intendedMajor?: string;
  secondMajor?: string;
  gpa9?: number | null;
  gpa10?: number | null;
  gpa11?: number | null;
  gpa12?: number | null;
}
