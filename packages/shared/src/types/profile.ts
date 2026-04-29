// Profile & Academic

import type { Visibility } from './auth';

export interface Profile {
  id: string;
  userId: string;
  realName?: string;
  gpa?: number;
  gpaScale: number;
  currentSchool?: string;
  grade?: string;
  targetMajor?: string;
  regionPref: string[];
  budgetTier?: BudgetTier;
  visibility: Visibility;
  createdAt: Date;
  updatedAt: Date;
}

export enum BudgetTier {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  UNLIMITED = 'UNLIMITED',
}

export enum TestType {
  SAT = 'SAT',
  ACT = 'ACT',
  TOEFL = 'TOEFL',
  IELTS = 'IELTS',
  AP = 'AP',
  IB = 'IB',
  A_LEVEL = 'A_LEVEL',
  IGCSE = 'IGCSE',
  DUOLINGO = 'DUOLINGO',
  GAOKAO = 'GAOKAO',
}

export interface TestScore {
  id: string;
  profileId: string;
  type: TestType;
  score: number;
  subject?: string;
  subScores?: Record<string, number | string>;
  testDate?: Date;
}

export interface Activity {
  id: string;
  profileId: string;
  name: string;
  category: ActivityCategory;
  role: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  hoursPerWeek?: number;
  weeksPerYear?: number;
}

export enum ActivityCategory {
  ACADEMIC = 'ACADEMIC',
  ARTS = 'ARTS',
  ATHLETICS = 'ATHLETICS',
  COMMUNITY_SERVICE = 'COMMUNITY_SERVICE',
  LEADERSHIP = 'LEADERSHIP',
  WORK = 'WORK',
  RESEARCH = 'RESEARCH',
  INTERNSHIP = 'INTERNSHIP',
  CLUB = 'CLUB',
  HOBBY = 'HOBBY',
  OTHER = 'OTHER',
}

export enum AwardCategory {
  STEM = 'STEM',
  MATH = 'MATH',
  SCIENCE = 'SCIENCE',
  COMPUTER_SCIENCE = 'COMPUTER_SCIENCE',
  ENGINEERING = 'ENGINEERING',
  BUSINESS = 'BUSINESS',
  ARTS = 'ARTS',
  HUMANITIES = 'HUMANITIES',
  SOCIAL_SCIENCE = 'SOCIAL_SCIENCE',
  LANGUAGE = 'LANGUAGE',
  SPORTS = 'SPORTS',
  COMMUNITY_SERVICE = 'COMMUNITY_SERVICE',
  LEADERSHIP = 'LEADERSHIP',
  OTHER = 'OTHER',
}

export interface Award {
  id: string;
  profileId: string;
  name: string;
  level: AwardLevel;
  category?: AwardCategory;
  year?: number;
  description?: string;
}

export enum AwardLevel {
  SCHOOL = 'SCHOOL',
  REGIONAL = 'REGIONAL',
  STATE = 'STATE',
  NATIONAL = 'NATIONAL',
  INTERNATIONAL = 'INTERNATIONAL',
}

export interface Education {
  id: string;
  profileId: string;
  schoolName: string;
  degree?: string;
  major?: string;
  startDate?: string;
  endDate?: string;
  gpa?: number;
  gpaScale?: number;
}
