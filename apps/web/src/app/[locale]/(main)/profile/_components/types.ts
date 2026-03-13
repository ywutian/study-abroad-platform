import { LucideIcon } from 'lucide-react';

export interface TestScore {
  id: string;
  type: string;
  score: number;
  subScores?: Record<string, number>;
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
  year?: number;
  description?: string;
  competitionId?: string;
}

export interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

export interface TargetSchool extends School {
  _listItemId?: string;
  tier?: string;
  prediction?: {
    tier?: string;
    probability: number;
  };
}

export interface ProfileFormData {
  grade: string;
  currentSchool: string;
  gpa: string;
  gpaScale: string;
  targetMajor: string;
  budgetTier: string;
  visibility: string;
  nationality: string;
  countryOfResidence: string;
  citizenship: string;
  educationSystem: string;
  needsFinancialAid: boolean;
  firstGeneration: boolean;
  legacy: string[];
  intendedMajor: string;
  secondMajor: string;
}

export interface ProfileData {
  userId: string;
  grade?: string;
  currentSchool?: string;
  gpa?: number;
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
  legacy?: string[];
  intendedMajor?: string;
  secondMajor?: string;
}
