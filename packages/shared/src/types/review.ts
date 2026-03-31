// Review & Admission Case

import type { School } from './school';
import type { Visibility } from './auth';

export interface Review {
  id: string;
  reviewerId: string;
  profileId: string;
  academicScore: number;
  testScore: number;
  activityScore: number;
  awardScore: number;
  overallScore: number;
  comment?: string;
  academicComment?: string;
  testComment?: string;
  activityComment?: string;
  awardComment?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  tags: string[];
  helpfulCount: number;
  createdAt: Date;
}

export enum AdmissionResult {
  ADMITTED = 'ADMITTED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
  DEFERRED = 'DEFERRED',
}

export interface AdmissionCase {
  id: string;
  userId: string;
  schoolId: string;
  school?: School;
  year: number;
  round?: string;
  result: AdmissionResult;
  major?: string;
  gpaRange?: string;
  satRange?: string;
  tags: string[];
  visibility: Visibility;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Type alias for backward compatibility
export type CaseResult = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
